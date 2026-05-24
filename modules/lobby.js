const dotenv = require("dotenv").config();
const constants = require("../data/constants");
const db = require("../db/db");
const models = require("../db/models");
const sockets = require("../lib/sockets");
const gameCatalogUtils = require("../lib/gameCatalog");
const routeUtils = require("../routes/utils");
const redis = require("./redis");
const logger = require("./logging")("lobby");

const port = process.env.LOBBY_PORT || process.env.LOBBY_PORT || 2998;
const server = new sockets.SocketServer(port);
const subscriber = redis.client.duplicate();
const clients = new Map();
const LOBBY_REFRESH_DEBOUNCE_MS = 300;

subscriber.select(process.env.REDIS_DB || 0);
subscriber.on("error", (e) => logger.error(e));

(async function () {
  try {
    await db.promise;

    process
      .on("unhandledRejection", (err) => logger.error(err))
      .on("uncaughtException", (err) => logger.error(err))
      .on("exit", onClose)
      .on("SIGINT", onClose)
      .on("SIGUSR1", onClose)
      .on("SIGUSR2", onClose);

    subscriber.subscribe(redis.LOBBY_UPDATE_CHANNEL);

    subscriber.on("message", (channel, message) => {
      if (channel !== redis.LOBBY_UPDATE_CHANNEL) return;

      let update;

      try {
        update = JSON.parse(message);
      } catch {
        update = { type: "unknown", date: Date.now() };
      }

      for (const socket of clients.keys()) {
        queueLobbyData(socket, update);
      }
    });

    server.on("connection", (socket) => {
      clients.set(socket, {
        filters: getDefaultFilters(),
        updateTimeout: null,
        userId: null,
      });
      socket.send("connected");
      sendLobbyData(socket);

      socket.on("auth", async (token) => {
        try {
          const client = clients.get(socket);
          const userId = await redis.authenticateToken(String(token));

          if (!client || !userId) return;

          client.userId = userId;
          sendLobbyData(socket);
        } catch (e) {
          logger.error(e);
        }
      });

      socket.on("watchLobby", (filters) => {
        const client = clients.get(socket);

        if (!client || typeof filters !== "object") return;

        client.filters = {
          ...client.filters,
          ...filters,
        };
        sendLobbyData(socket);
      });

      socket.on("getLobbyData", () => {
        sendLobbyData(socket);
      });

      socket.on("disconnected", () => {
        clearClient(socket);
      });
    });
  } catch (e) {
    logger.error(e);
  }
})();

function getDefaultFilters() {
  return {
    list: "all",
    listType: "All",
    lobby: "All",
    page: 1,
    pageSize: 6,
  };
}

async function getGameCoinsRequired(gameType) {
  const gameCatalog = await models.GameCatalog.findOne({
    $or: [
      { key: gameType },
      { title: gameType },
      { slug: gameCatalogUtils.slugifyGameTitle(gameType) },
    ],
  })
    .select("coins -_id")
    .lean();

  return Number(gameCatalog?.coins || 0);
}

async function getVisibleLiveGames(listName, canSeePrivate) {
  let games = [];

  if (listName === "all" || listName === "open") {
    const openGames = canSeePrivate
      ? await redis.getOpenGames()
      : await redis.getOpenPublicGames();

    openGames.sort((a, b) => routeUtils.scoreGame(b) - routeUtils.scoreGame(a));
    games = games.concat(openGames);
  }

  if (listName === "all" || listName === "in progress") {
    const inProgressGames = canSeePrivate
      ? await redis.getInProgressGames()
      : await redis.getInProgressPublicGames();

    inProgressGames.sort((a, b) => b.startTime - a.startTime);
    games = games.concat(inProgressGames);
  }

  return games;
}

async function formatLiveGame(game, userId) {
  const setup = await models.Setup.findOne({
    id: game.settings.setup,
  }).select(
    "id gameType name roles closed gameSettings useRoleGroups roleGroupSizes count total -_id"
  );

  if (!setup) return null;

  const newGame = {
    id: game.id,
    type: game.type,
    setup: setup.toJSON(),
    hostId: game.hostId,
    players: game.players.length,
    spectatorCount: game.spectatorCount,
    gameState: game.gameState,
    winnersInfo: game.winnersInfo,
    lobbyName: game.settings.lobbyName,
    ranked: game.settings.ranked,
    competitive: game.settings.competitive,
    spectating: game.settings.spectating,
    scheduled: game.settings.scheduled,
    readyCheck: game.settings.readyCheck,
    noVeg: game.settings.noVeg,
    anonymousGame: game.settings.anonymousGame,
    anonymousDeck: game.settings.anonymousDeck,
    coinsRequired: await getGameCoinsRequired(game.type),
    private: game.settings.private,
    status: game.status,
    lobby: game.lobby,
    endTime: 0,
  };

  if (userId) {
    const reservations = await redis.getGameReservations(game.id);
    newGame.reserved = reservations.indexOf(userId) !== -1;
  }

  return newGame;
}

function validateLobbyFilters({ list, lobby, gameType }) {
  const listName = String(list || "all").toLowerCase();
  const lobbyName = String(lobby || "All");
  const selectedGameType = gameType ? String(gameType) : null;

  if (
    !routeUtils.validProp(lobbyName) ||
    (constants.lobbies.indexOf(lobbyName) === -1 && lobbyName !== "All")
  ) {
    return null;
  }

  if (
    selectedGameType &&
    (!routeUtils.validProp(selectedGameType) ||
      constants.gameTypes.indexOf(selectedGameType) === -1)
  ) {
    return null;
  }

  return { listName, lobbyName, selectedGameType };
}

async function getLobbyGames(options = {}) {
  const userId = options.userId || null;
  const filters = validateLobbyFilters(options);

  if (!filters) return [];

  const { listName, lobbyName, selectedGameType } = filters;
  const pageSize = Math.min(
    Math.max(Number(options.pageSize) || constants.lobbyPageSize, 1),
    50
  );
  const page = Math.max(Number(options.page) || 1, 1);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const last = Number(options.last);
  const first = Number(options.first);
  const canSeePrivate =
    userId && (await routeUtils.verifyPermission(userId, "breakGame"));

  let games = await getVisibleLiveGames(listName, canSeePrivate);

  if (lobbyName !== "All") {
    games = games.filter((game) => game.lobby === lobbyName);
  }

  if (selectedGameType) {
    games = games.filter((game) => game.type === selectedGameType);
  }

  games = games.slice(start, end);
  games = (
    await Promise.all(games.map((game) => formatLiveGame(game, userId)))
  ).filter(Boolean);

  if (
    (listName === "all" || listName === "finished") &&
    games.length < pageSize
  ) {
    const gameFilter = lobbyName !== "All" ? { lobby: lobbyName } : {};
    const finishedLast = Number.isNaN(last) || last === 0 ? Infinity : last;
    const finishedFirst = Number.isNaN(first) ? undefined : first;

    if (selectedGameType) gameFilter.type = selectedGameType;

    let finishedGames = await routeUtils.modelPageQuery(
      models.Game,
      gameFilter,
      "endTime",
      finishedLast,
      finishedFirst,
      "id type setup lobby lobbyName anonymousGame anonymousDeck ranked competitive private spectating guests readyCheck noVeg stateLengths gameTypeOptions broken winnersInfo playerIdMap playerAlignmentMap endTime -_id",
      pageSize - games.length,
      [
        "setup",
        "id gameType name roles closed useRoleGroups roleGroupSizes count total -_id",
      ]
    );

    finishedGames = finishedGames.map((game) => ({
      ...game.toJSON(),
      status: "Finished",
    }));
    games = games.concat(finishedGames);
  }

  return games;
}

async function getOpenGameSummary(userId) {
  const canSeePrivate =
    userId && (await routeUtils.verifyPermission(userId, "breakGame"));
  const openGames = canSeePrivate
    ? await redis.getOpenGames()
    : await redis.getOpenPublicGames();
  const openGamesCounts = {};
  let hasOneOpenGame = false;
  let hasOneOpenUrankedGame = false;

  for (const game of openGames) {
    const gameType = game?.type;

    if (!gameType) continue;

    openGamesCounts[gameType] = (openGamesCounts[gameType] || 0) + 1;
    hasOneOpenGame = true;

    if (!game.settings?.ranked) {
      hasOneOpenUrankedGame = true;
    }
  }

  return {
    openGamesCounts,
    hasOneOpenGame,
    hasOneOpenUrankedGame,
  };
}

async function getLobbyPayload(options = {}) {
  const [games, openSummary] = await Promise.all([
    getLobbyGames(options),
    getOpenGameSummary(options.userId),
  ]);

  return {
    games,
    ...openSummary,
    listType: options.listType || options.list || "All",
    page: Math.max(Number(options.page) || 1, 1),
    gameType: options.gameType || null,
    date: Date.now(),
  };
}

function queueLobbyData(socket, update) {
  const client = clients.get(socket);

  if (!client) return;

  if (client.updateTimeout) {
    clearTimeout(client.updateTimeout);
  }

  client.updateTimeout = setTimeout(() => {
    client.updateTimeout = null;
    sendLobbyData(socket, update);
  }, LOBBY_REFRESH_DEBOUNCE_MS);
}

async function sendLobbyData(socket, update) {
  const client = clients.get(socket);

  if (!client) return;

  try {
    const payload = await getLobbyPayload({
      ...client.filters,
      userId: client.userId,
    });

    socket.send("lobbyData", {
      ...payload,
      update,
    });
  } catch (e) {
    logger.error(e);
    socket.send("error", "Unable to load lobby data.");
  }
}

function clearClient(socket) {
  const client = clients.get(socket);

  if (client?.updateTimeout) {
    clearTimeout(client.updateTimeout);
  }

  clients.delete(socket);
}

async function onClose() {
  try {
    for (const socket of clients.keys()) {
      clearClient(socket);
    }

    await subscriber.quitAsync();
    await redis.client.quitAsync();
    process.exit();
  } catch (e) {
    logger.error(e);
  }
}

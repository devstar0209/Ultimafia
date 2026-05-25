const constants = require("../data/constants");
const bootstrapActionNames = [
  "Created Game Catalog",
  "Updated Managed Game",
  "Updated Managed Game Logo",
  "Removed Managed Game Logo",
  "Deleted Game Catalog",
  "Hid Game Catalog",
  "Unhid Game Catalog",
  "Reordered Game Catalogs",
];

function slugifyGameTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildDefaultGameDefinitions() {
  return constants.gameTypes.map((gameType, index) => ({
    key: gameType,
    title: gameType,
    slug: slugifyGameTitle(gameType),
    logoPath: "",
    hidden: false,
    coins: 0,
    pointsFinishGame: 20,
    pointsWin: 25,
    pointsCorrectVote: 10,
    pointsRoleSuccess: 15,
    startingChips: gameType === "Texas Hold Em" ? 50 : 0,
    maxRounds: gameType === "Dice Wars" ? 5 : 0,
    sortOrder: index,
  }));
}

function getGameLogoRelativePath(gameKey) {
  return `game-catalog/${slugifyGameTitle(gameKey)}`;
}

function isDiceWarsCatalog(entry) {
  return [entry.key, entry.title, entry.slug].some(
    (value) => slugifyGameTitle(value) === "dice-wars"
  );
}

function buildGameCatalogMap(entries) {
  return (entries || []).reduce((map, entry) => {
    map[entry.key] = entry;
    return map;
  }, {});
}

function buildGameCatalogPayload(entries) {
  return (entries || []).map((entry) => ({
    key: entry.key,
    title: entry.title,
    slug: entry.slug,
    hidden: Boolean(entry.hidden),
    sortOrder: Number(entry.sortOrder || 0),
    coins: Number(entry.coins || 0),
    pointsFinishGame: Number(entry.pointsFinishGame ?? 20),
    pointsWin: Number(entry.pointsWin ?? 25),
    pointsCorrectVote: Number(entry.pointsCorrectVote ?? 10),
    pointsRoleSuccess: Number(entry.pointsRoleSuccess ?? 15),
    startingChips:
      entry.key === "Texas Hold Em" || entry.title === "Texas Hold Em"
        ? Number(entry.startingChips || 50)
        : Number(entry.startingChips || 0),
    maxRounds: isDiceWarsCatalog(entry)
      ? Number(entry.maxRounds || 5)
      : Number(entry.maxRounds || 0),
    logoUrl: entry.logoPath,
    updatedAt: Number(entry.updatedAt || 0),
  }));
}

async function syncGameCatalog(models) {
  const existingCount = await models.GameCatalog.countDocuments({});
  if (existingCount === 0) {
    const priorCatalogActions = await models.ModAction.countDocuments({
      name: { $in: bootstrapActionNames },
    });

    if (priorCatalogActions === 0) {
      const defaults = buildDefaultGameDefinitions();
      if (defaults.length) {
        await models.GameCatalog.insertMany(
          defaults.map((game) => ({
            ...game,
            updatedAt: Date.now(),
          }))
        );
      }
    }
  }

  return models.GameCatalog.find({})
    .sort("sortOrder key")
    .lean();
}

module.exports = {
  buildDefaultGameDefinitions,
  buildGameCatalogMap,
  buildGameCatalogPayload,
  getGameLogoRelativePath,
  slugifyGameTitle,
  syncGameCatalog,
};

/**
 * Migration: Seed Daily Challenges
 * Moves the existing daily challenge definitions into MongoDB.
 */

require("dotenv").config();

const db = require("../db/db");
const models = require("../db/models");
const logger = require("../modules/logging")("(migration)");

const dailyChallengesData = [
  {
    id: "Basic0",
    name: "Play One Game",
    tier: 0,
    internal: ["PlayOneGame"],
    description: "Complete one game.",
    reward: 0,
    rewardSetting: "dailyPlayOneGameBonus",
    sortOrder: 0,
  },
  {
    id: "BasicHost1",
    name: "Host One Game",
    tier: 0,
    internal: ["HostOneGame"],
    description: "Host and complete one game.",
    reward: 0,
    rewardSetting: "dailyHostOneGameBonus",
    sortOrder: 1,
  },
  {
    id: "Basic1",
    name: "Play a game of ExtraData",
    tier: 1,
    internal: ["PlayTypeOfGame"],
    description: "Complete a game of ExtraData.",
    extraData: "Game Type",
    reward: 2,
    sortOrder: 2,
  },
  {
    id: "Basic2",
    name: "Play 3 Unranked Games",
    tier: 1,
    internal: ["Play3Games"],
    description: "Complete 3 Unranked games.",
    reward: 2,
    sortOrder: 3,
  },
  {
    id: "Advanced2",
    name: "Win as ExtraData",
    tier: 2,
    internal: ["WinAsRole"],
    description: "Win as ExtraData in a game.",
    extraData: "Role Name",
    reward: 5,
    sortOrder: 4,
  },
  {
    id: "Hard1",
    name: "Win 5 Games",
    tier: 3,
    internal: ["Win5Games"],
    description: "Win 5 games.",
    reward: 7,
    sortOrder: 5,
  },
  {
    id: "Hard2",
    name: "Win 3 games in a row",
    tier: 3,
    internal: ["Win3GamesInRow"],
    description: "Win 3 games in a row.",
    reward: 7,
    sortOrder: 6,
  },
];

async function seedDailyChallenges() {
  await db.promise;
  logger.info("Starting daily challenge seed...");

  const now = Date.now();
  const operations = dailyChallengesData.map((challenge) => ({
    updateOne: {
      filter: { id: challenge.id },
      update: {
        $set: {
          ...challenge,
          disabled: false,
          updatedAt: now,
          updatedBy: "seed",
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      upsert: true,
    },
  }));

  const result = await models.DailyChallenge.bulkWrite(operations);
  logger.info(
    `Seeded daily challenges. upserted=${result.upsertedCount || 0}, modified=${result.modifiedCount || 0}`
  );

  return result;
}

module.exports = seedDailyChallenges;

if (require.main === module) {
  seedDailyChallenges()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error("Error seeding daily challenges:", error);
      process.exit(1);
    });
}

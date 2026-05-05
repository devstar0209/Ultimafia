/**
 * Migration: replace the old competitive round unique index.
 *
 * The old index was { season: 1, number: 1 }. Competitive rounds are now scoped
 * by game catalog, so the unique index must include gameCatalogKey.
 *
 * Run with: node migrations/fixCompetitiveRoundIndexes.js
 */

require("dotenv").config();

const mongoose = require("mongoose");
const models = require("../db/models");
const logger = require("../modules/logging")("(migration)");

const OLD_INDEX_NAME = "season_1_number_1";
const NEW_INDEX_NAME = "gameCatalogKey_1_season_1_number_1";

async function migrate() {
  await mongoose.connect(
    process.env.MONGO_URI || "mongodb://localhost:27017/ultimafia",
    {
      user: process.env.MONGO_USER,
      pass: process.env.MONGO_PW,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  );

  logger.info("Connected to database");

  const collection = models.CompetitiveRound.collection;
  const duplicateGroups = await collection
    .aggregate([
      {
        $group: {
          _id: {
            gameCatalogKey: { $ifNull: ["$gameCatalogKey", "Mafia"] },
            season: "$season",
            number: "$number",
          },
          count: { $sum: 1 },
          ids: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 10 },
    ])
    .toArray();

  if (duplicateGroups.length > 0) {
    logger.error(
      `Cannot create ${NEW_INDEX_NAME}; duplicate competitive rounds exist: ${JSON.stringify(
        duplicateGroups
      )}`
    );
    process.exit(1);
  }

  await collection.updateMany(
    { gameCatalogKey: { $exists: false } },
    { $set: { gameCatalogKey: "Mafia" } }
  );

  const indexes = await collection.indexes();
  const oldIndex = indexes.find(
    (index) =>
      index.name === OLD_INDEX_NAME ||
      JSON.stringify(index.key) === JSON.stringify({ season: 1, number: 1 })
  );

  if (oldIndex) {
    logger.info(`Dropping old index ${oldIndex.name}`);
    await collection.dropIndex(oldIndex.name);
  } else {
    logger.info(`Old index ${OLD_INDEX_NAME} was not present`);
  }

  logger.info(`Creating index ${NEW_INDEX_NAME}`);
  await collection.createIndex(
    { gameCatalogKey: 1, season: 1, number: 1 },
    { unique: true, name: NEW_INDEX_NAME }
  );

  logger.info("Competitive round index migration complete");
  process.exit(0);
}

migrate().catch((error) => {
  logger.error("Migration failed:", error);
  process.exit(1);
});

/**
 * Migration: Seed Shop Items
 * Migrates hardcoded shop items from shop.js to ShopItem collection
 */

require("dotenv").config();

const models = require("../db/models");
const logger = require("../modules/logging")("(migration)");
const db = require("../db/db");


const shopItemsData = [
  {
    name: "Name and Text Colors",
    desc: "Set the colors of your name and text in games and chat",
    key: "textColors",
    price: 20,
    limit: 1,
    sortOrder: 0,
  },
  {
    name: "Profile Customization",
    desc: "Change the panel color and banner image on your profile",
    key: "customProfile",
    price: 20,
    limit: 1,
    sortOrder: 1,
  },
  {
    name: "Name Change",
    desc: "Change your name once per purchase",
    key: "nameChange",
    price: 20,
    limit: null,
    sortOrder: 2,
  },
  {
    name: "3 Character Username",
    desc: "Set your name to one that is 3 characters long",
    key: "threeCharName",
    price: 100,
    limit: 1,
    sortOrder: 3,
  },
  {
    name: "2 Character Username",
    desc: "Set your name to one that is 2 characters long",
    key: "twoCharName",
    price: 400,
    limit: 1,
    sortOrder: 4,
  },
  {
    name: "1 Character Username",
    desc: "Set your name to one that is 1 character long",
    key: "oneCharName",
    price: 800,
    limit: 1,
    sortOrder: 5,
  },
  {
    name: "Custom Death Message",
    desc: "Set the system message that appears on death. Comes with 2 free death message changes.",
    key: "deathMessageEnabled",
    price: 50,
    limit: 1,
    sortOrder: 6,
  },
  {
    name: "Death Message Change",
    desc: "Change your death message, requires enabling custom death messages.",
    key: "deathMessageChange",
    price: 10,
    limit: null,
    sortOrder: 7,
  },
  {
    name: "Anonymous Deck",
    desc: "Create name decks for anonymous games.",
    key: "anonymousDeck",
    price: 70,
    limit: null, // Note: Original had constants.maxOwnedAnonymousDecks - update if needed
    sortOrder: 8,
  },
  {
    name: "Custom Emotes",
    desc: "Create custom emotes that you can use in game.",
    key: "customEmotes",
    price: 5,
    limit: null, // Note: Original had constants.maxOwnedCustomEmotes - update if needed
    sortOrder: 9,
  },
  {
    name: "MORE Custom Emotes",
    desc: "Once you've bought all of the cheaper ones, get more custom emotes here.",
    key: "customEmotesExtra",
    price: 25,
    limit: null, // Note: Original had constants.maxOwnedCustomEmotesExtra - update if needed
    sortOrder: 10,
  },
  {
    name: "Archived Games",
    desc: "Gain the ability to archive games and have them displayed on your profile!",
    key: "archivedGames",
    price: 100,
    limit: 1,
    sortOrder: 11,
  },
  {
    name: "Maximum Archived Games",
    desc: "Increases the amount of games that you can archive.",
    key: "archivedGamesMax",
    price: 30,
    limit: null, // Note: Original had constants.maxArchivedGamesMax - update if needed
    sortOrder: 12,
  },
  {
    name: "Bonus Red Heart Capacity",
    desc: "Increases the amount of red hearts that you can hold.",
    key: "bonusRedHearts",
    price: 10,
    limit: null, // Note: Original had constants.maxBonusRedHearts - update if needed
    sortOrder: 13,
  },
  {
    name: "Square",
    desc: "Unlock the ability to become a square (currently profile only)",
    key: "avatarShape",
    price: 20,
    limit: 1,
    sortOrder: 14,
  },
  {
    name: "Vanity URL",
    desc: "Set a custom URL for your profile (1-20 characters)",
    key: "vanityUrl",
    price: 100,
    limit: 1,
    sortOrder: 15,
  },
  {
    name: "Custom Site Primary Color",
    desc: "Change the primary color of the site to whatever you'd like",
    key: "customPrimaryColor",
    price: 100,
    limit: 1,
    sortOrder: 16,
  },
  {
    name: "Icon Filter",
    desc: "Unlock the ability to apply a filter to all icons on the site",
    key: "iconFilter",
    price: 40,
    limit: 1,
    sortOrder: 17,
  },
  {
    name: "Profile Background",
    desc: "Upload a custom background image to replace the default pattern on all pages",
    key: "profileBackground",
    price: 20,
    limit: 1,
    sortOrder: 18,
  },
  {
    name: "Create Family",
    desc: "Create a Crime Family and top the leaderboard",
    key: "createFamily",
    price: 1000,
    limit: 1,
    sortOrder: 19,
  },
  {
    name: "Scrapbook Stamp",
    desc: "Commemorate a Mafia game win with a stamp of your role. Displayed on your profile scrapbook.",
    key: "stamp",
    price: 5,
    limit: null,
    sortOrder: 20,
  },
];

async function migrateShopItems() {
  try {
    await await db.promise;
    logger.info("Starting shop items migration...");

    // Check if items already exist
    const existingCount = await models.ShopItem.countDocuments({});
    if (existingCount > 0) {
      logger.info(`Found ${existingCount} existing shop items. Skipping migration.`);
      return;
    }

    // Insert all items
    const result = await models.ShopItem.insertMany(shopItemsData);
    logger.info(`Successfully migrated ${result.length} shop items to database`);

    return result;
  } catch (e) {
    logger.error("Error migrating shop items:", e);
    throw e;
  }
}

module.exports = migrateShopItems;

// Run migration if called directly
if (require.main === module) {

  migrateShopItems()
    .then(() => {
      logger.info("Migration completed successfully");
      process.exit(0);
    })
    .catch((e) => {
      logger.error("Migration failed:", e);
      process.exit(1);
    });
}

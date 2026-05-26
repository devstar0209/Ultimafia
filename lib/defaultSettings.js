/**
 * Default Settings Utility
 * Reads configurable platform defaults from database with fallback to hardcoded defaults
 * Allows admins to adjust game settings without code changes
 */

const constants = require("../data/constants");

let cachedSettings = null;
let cacheExpireTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // Cache for 5 minutes

/**
 * Get currency/game settings from database or cache
 * Falls back to hardcoded constants if database query fails
 * @param {Object} models - Mongoose models object
 * @returns {Promise<Object>} Settings object with defaults
 */
async function getSettings(models) {
  try {
    // Return cached settings if valid
    if (cachedSettings && Date.now() < cacheExpireTime) {
      return cachedSettings;
    }

    const dbSettings = await models.DefaultSettings.findOne({ key: "default" });

    const settings = {
      registerCoinsReward: dbSettings?.registerCoinsReward ?? 0,
      referralBonus: dbSettings?.referralBonus ?? 0,
      coinsPerDollar: dbSettings?.coinsPerDollar ?? constants.coinsPerDollar ?? 100,
      dailyPlayOneGameBonus: dbSettings?.dailyPlayOneGameBonus ?? 0,
      dailyHostOneGameBonus: dbSettings?.dailyHostOneGameBonus ?? 0,
      minimumGamesForRanked: dbSettings?.minimumGamesForRanked ?? constants.minimumGamesForRanked ?? 5,
      minimumPointsForCompetitive: dbSettings?.minimumPointsForCompetitive ?? constants.minimumPointsForCompetitive ?? 150,
      openDaysPerCompetitiveRound: dbSettings?.openDaysPerCompetitiveRound ?? constants.openDaysPerCompetitiveRound ?? 9,
      reviewDaysPerCompetitiveRound: dbSettings?.reviewDaysPerCompetitiveRound ?? constants.reviewDaysPerCompetitiveRound ?? 4,
      pointsNominalAmount: dbSettings?.pointsNominalAmount ?? constants.pointsNominalAmount ?? 60,
    };

    // Cache the settings
    cachedSettings = settings;
    cacheExpireTime = Date.now() + CACHE_TTL;

    return settings;
  } catch (error) {
    console.error("Error fetching default settings, using constants:", error);
    // Return hardcoded fallback
    return getDefaultSettings();
  }
}

/**
 * Get hardcoded default settings (fallback)
 * @returns {Object} Default settings object
 */
function getDefaultSettings() {
  return {
    registerCoinsReward: 0,
    referralBonus: 0,
    coinsPerDollar: constants.coinsPerDollar || 100,
    dailyPlayOneGameBonus: 0,
    dailyHostOneGameBonus: 0,
    minimumGamesForRanked: constants.minimumGamesForRanked || 5,
    minimumPointsForCompetitive: constants.minimumPointsForCompetitive || 150,
    openDaysPerCompetitiveRound: constants.openDaysPerCompetitiveRound || 9,
    reviewDaysPerCompetitiveRound: constants.reviewDaysPerCompetitiveRound || 4,
    pointsNominalAmount: constants.pointsNominalAmount || 60,
  };
}

/**
 * Invalidate the settings cache
 * Call this after updating settings in admin panel
 */
function invalidateCache() {
  cachedSettings = null;
  cacheExpireTime = 0;
}

/**
 * Get a specific setting value
 * @param {Object} models - Mongoose models object
 * @param {String} settingKey - Key of the setting to retrieve
 * @returns {Promise<*>} The setting value
 */
async function getSetting(models, settingKey) {
  const settings = await getSettings(models);
  return settings[settingKey];
}

module.exports = {
  getSettings,
  getDefaultSettings,
  invalidateCache,
  getSetting,
};

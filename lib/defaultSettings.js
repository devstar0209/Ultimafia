/**
 * Default Settings Utility
 * Reads configurable currency constants from database with fallback to hardcoded defaults
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
      initialRedHeartCapacity: dbSettings?.initialRedHeartCapacity ?? constants.initialRedHeartCapacity ?? 15,
      initialGoldHeartCapacity: dbSettings?.initialGoldHeartCapacity ?? constants.initialGoldHeartCapacity ?? 0,
      maxBonusRedHearts: dbSettings?.maxBonusRedHearts ?? constants.maxBonusRedHearts ?? 5,
      redHeartRefreshIntervalMillis: dbSettings?.redHeartRefreshIntervalMillis ?? constants.redHeartRefreshIntervalMillis ?? 82800000,
      goldHeartRefreshIntervalMillis: dbSettings?.goldHeartRefreshIntervalMillis ?? constants.goldHeartRefreshIntervalMillis ?? 82800000,
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
    initialRedHeartCapacity: constants.initialRedHeartCapacity || 15,
    initialGoldHeartCapacity: constants.initialGoldHeartCapacity || 0,
    maxBonusRedHearts: constants.maxBonusRedHearts || 5,
    redHeartRefreshIntervalMillis: constants.redHeartRefreshIntervalMillis || 82800000,
    goldHeartRefreshIntervalMillis: constants.goldHeartRefreshIntervalMillis || 82800000,
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

let cachedDailyChallengeData = {};

function normalizeDailyChallenge(doc = {}) {
  const challenge = doc.toObject ? doc.toObject() : doc;
  const extraData = String(challenge.extraData || "").trim();
  const rewardSetting = String(challenge.rewardSetting || "").trim();

  return {
    ID: String(challenge.id || challenge.ID || "").trim(),
    name: String(challenge.name || "").trim(),
    tier: Number(challenge.tier || 0),
    internal: Array.isArray(challenge.internal)
      ? challenge.internal.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    description: String(challenge.description || "").trim(),
    extraData: extraData || undefined,
    reward: Number(challenge.reward || 0),
    rewardSetting: rewardSetting || undefined,
    disabled: Boolean(challenge.disabled),
    sortOrder: Number(challenge.sortOrder || 0),
    updatedAt: Number(challenge.updatedAt || 0),
    updatedBy: String(challenge.updatedBy || ""),
  };
}

function buildChallengeMap(challenges = []) {
  return challenges.reduce((accumulator, challenge) => {
    if (!challenge.name || !challenge.ID) return accumulator;
    accumulator[challenge.name] = challenge;
    return accumulator;
  }, {});
}

async function getDailyChallengeEntries(models, options = {}) {
  const query = options.includeDisabled ? {} : { disabled: false };
  const docs = await models.DailyChallenge.find(query)
    .sort("sortOrder tier name")
    .lean();

  return docs.map(normalizeDailyChallenge);
}

async function refreshDailyChallengeCache(models) {
  const challenges = await getDailyChallengeEntries(models, {
    includeDisabled: true,
  });
  cachedDailyChallengeData = buildChallengeMap(challenges);
  return cachedDailyChallengeData;
}

function getDailyChallengeData() {
  return cachedDailyChallengeData;
}

function buildPublicDailyChallengePayload(challenges = []) {
  const items = challenges.map((challenge) => ({
    id: challenge.ID,
    name: challenge.name,
    tier: challenge.tier,
    description: challenge.description,
    extraData: challenge.extraData || "",
    reward: challenge.reward,
    rewardSetting: challenge.rewardSetting || "",
  }));

  return {
    items,
    byId: items.reduce((accumulator, challenge) => {
      accumulator[challenge.id] = challenge;
      return accumulator;
    }, {}),
  };
}

function formatDailyChallenge(id, extraData, rewardOverride) {
  const challenge = Object.values(cachedDailyChallengeData).find(
    (entry) => entry.ID === id
  );

  if (!challenge) return "";

  const reward = Number.isFinite(Number(rewardOverride))
    ? Number(rewardOverride)
    : challenge.reward;

  return `${challenge.name.replace(
    "ExtraData",
    extraData
  )}- ${challenge.description.replace("ExtraData", extraData)} (${reward} Coins)`;
}

module.exports = {
  buildPublicDailyChallengePayload,
  formatDailyChallenge,
  getDailyChallengeData,
  getDailyChallengeEntries,
  normalizeDailyChallenge,
  refreshDailyChallengeCache,
};

const shortid = require("shortid");
const dailyChallengeUtils = require("../../lib/dailyChallenges");

module.exports = class DailyChallenge {
  constructor(name, player) {
    this.id = shortid.generate();
    this.name = name;
    this.game = player.game;
    this.player = player;

    const DailyChallengeData = dailyChallengeUtils.getDailyChallengeData();
    const challengeData = DailyChallengeData[this.name] || {};
    this.ID = challengeData.ID;
    this.reward = challengeData.reward || 0;

    this.listeners = {};
  }

  getReward() {
    const challenge = this.player.user.dailyChallenges.find(
      (dailyChallenge) => dailyChallenge[0] == this.ID
    );
    const rewardOverride = Number(challenge?.[3]);

    if (Number.isFinite(rewardOverride) && rewardOverride >= 0) {
      return rewardOverride;
    }

    const DailyChallengeData = dailyChallengeUtils.getDailyChallengeData();
    const settingKey = DailyChallengeData[this.name]?.rewardSetting;
    const settingReward = Number(this.game.defaultSettings?.[settingKey]);

    if (settingKey && Number.isFinite(settingReward) && settingReward >= 0) {
      return settingReward;
    }

    return this.reward;
  }

  start() {
    for (let eventName in this.listeners) {
      this.listeners[eventName] = this.listeners[eventName].bind(this);
      this.game.events.on(eventName, this.listeners[eventName]);
    }
  }

  remove() {
    this.game.events.removeListener("state", this.ageListener);

    for (let eventName in this.listeners)
      this.player.events.removeListener(eventName, this.listeners[eventName]);
  }

  speak(message) {}

  speakQuote(quote) {}

  hear(message) {}

  hearQuote(quote) {}

  seeVote(vote) {}

  seeUnvote(info) {}

  seeTyping(info) {}
};

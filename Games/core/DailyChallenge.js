const shortid = require("shortid");
const DailyChallengeData = require("../../data/DailyChallenge");

module.exports = class DailyChallenge {
  constructor(name, player) {
    this.id = shortid.generate();
    this.name = name;
    this.game = player.game;
    this.player = player;

    this.ID = DailyChallengeData[this.name].ID;
    this.reward = DailyChallengeData[this.name].reward;

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

    const settingKey = DailyChallengeData[this.name].rewardSetting;
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

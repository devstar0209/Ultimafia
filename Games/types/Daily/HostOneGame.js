const DailyChallenge = require("../../core/DailyChallenge");

module.exports = class HostOneGame extends DailyChallenge {
  constructor(name, player) {
    super(name, player);

    this.listeners = {
      aboutToFinish: function () {
        if (!this.game.hasIntegrity || this.game.private) {
          return;
        }

        if (this.player.user.id != this.game.hostId) {
          return;
        }

        for (let Challenge of this.player.user.dailyChallenges) {
          if (Challenge[0] == this.ID) {
            this.player.DailyPayout += this.getReward();
            this.player.DailyCompleted += 1;
            this.player.user.dailyChallenges.splice(
              this.player.user.dailyChallenges.indexOf(Challenge),
              1
            );
            this.player.CompletedDailyChallenges.push([this.ID, ""]);
            return;
          }
        }
      },
    };
  }
};

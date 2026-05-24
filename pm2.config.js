module.exports = {
  apps: [
    {
      name: "games",
      script: "./Games/games.js",
      autorestart: false,
      time: true,
      "node-args": ["--debug=7000"],
      watch: false,
    },
    {
      name: "www",
      script: "./bin/www",
      time: true,
      "node-args": ["--debug=7000"],
      watch: false,
    },
    {
      name: "chat",
      script: "./modules/chat.js",
      time: true,
      "node-args": ["--debug=7000"],
      watch: false,
    },
    {
      name: "lobby",
      script: "./modules/lobby.js",
      time: true,
      "node-args": ["--debug=7000"],
      watch: false,
    },
  ],
};

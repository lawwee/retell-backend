module.exports = {
  apps: [
    {
      name: "Retell",
      script: "dist/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

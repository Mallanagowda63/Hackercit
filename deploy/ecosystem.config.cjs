// pm2 process file. Start from the repo root: pm2 start deploy/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "devorbit",
      script: "hacker.js",
      cwd: __dirname + "/..",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000",
        BACKEND_PORT: "4000",
      },
      max_memory_restart: "1500M",
      restart_delay: 3000,
    },
  ],
};

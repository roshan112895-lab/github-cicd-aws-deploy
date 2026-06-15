const path = require('path');

module.exports = {
  apps: [
    {
      name: 'express-app',
      script: path.join(__dirname, 'src/server.js'),
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      error_file: path.join(__dirname, 'logs/err.log'),
      out_file: path.join(__dirname, 'logs/out.log'),
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
        DATA_FILE: path.join(__dirname, 'data/tasks.json'),
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000,
        DATA_FILE: path.join(__dirname, 'data/tasks.json'),
      },
    },
  ],
};

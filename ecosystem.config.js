module.exports = {
  apps: [
    {
      name: 'express-app',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      env: {
        NODE_ENV: 'development',
        PORT: 5001,
        DATA_FILE: './data/tasks.json',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001,
        DATA_FILE: './data/tasks.json',
      },
    },
  ],
};

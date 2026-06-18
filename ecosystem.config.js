const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

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
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5001,
        DATABASE_URL: process.env.DATABASE_URL,
        DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL,
        AUTH_TOKEN_SECRET: process.env.AUTH_TOKEN_SECRET,
        AUTH_TOKEN_TTL: process.env.AUTH_TOKEN_TTL || '86400'
      }
    }
  ]
};

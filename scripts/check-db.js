require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

const { connectDatabase, pool } = require('../src/db');

connectDatabase()
  .then(async () => {
    const users = await pool.query('SELECT COUNT(*)::int AS c FROM users');
    const tasks = await pool.query('SELECT COUNT(*)::int AS c FROM tasks');
    console.log(`DB OK — users: ${users.rows[0].c}, tasks: ${tasks.rows[0].c}`);
    await pool.end();
  })
  .catch(async (error) => {
    console.error('DB check failed:', error.message);
    try {
      await pool.end();
    } catch {}
    process.exit(1);
  });

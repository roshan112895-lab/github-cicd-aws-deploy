const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/taskflow';
const DIRECT_URL = process.env.DIRECT_URL || DATABASE_URL;

function poolOptions(url) {
  const isSupabase = url.includes('supabase.com');
  return {
    connectionString: url,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined
  };
}

const pool = new Pool(poolOptions(DATABASE_URL));

async function connectDatabase() {
  const setupPool = new Pool(poolOptions(DIRECT_URL));

  try {
    await setupPool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'medium',
        due_date DATE NULL,
        tags TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT status_check CHECK (status IN ('todo', 'in_progress', 'done')),
        CONSTRAINT priority_check CHECK (priority IN ('low', 'medium', 'high'))
      );
    `);
    await setupPool.query(`ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::text;`);
    await setupPool.query(`ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;`);
    await setupPool.query(`ALTER TABLE tasks ALTER COLUMN id TYPE TEXT USING id::text;`);
    await setupPool.query(`ALTER TABLE tasks ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;`);

    await pool.query('SELECT 1');
    const label = DATABASE_URL.includes('supabase.com') ? 'Supabase' : 'local PostgreSQL';
    console.log(`PostgreSQL connected (${label})`);
  } finally {
    await setupPool.end();
  }
}

module.exports = {
  connectDatabase,
  pool
};

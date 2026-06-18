require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

const fs = require('fs/promises');
const path = require('path');
const { connectDatabase, pool } = require('../src/db');

const ROOT_DIR = path.join(__dirname, '..');
const TASKS_FILE = path.join(ROOT_DIR, 'data', 'tasks.json');
const USERS_FILE = path.join(ROOT_DIR, 'data', 'users.json');

async function readJsonArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function migrateUsers(users) {
  let count = 0;
  for (const user of users) {
    const id = String(user.id || '');
    const email = String(user.email || '').trim().toLowerCase();
    const name = String(user.name || '').trim() || email.split('@')[0] || 'user';
    const passwordHash = String(user.passwordHash || '').trim();
    if (!id || !email || !passwordHash) continue;

    await pool.query(
      `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           created_at = EXCLUDED.created_at,
           updated_at = EXCLUDED.updated_at`,
      [
        id,
        email,
        name,
        passwordHash,
        user.createdAt || new Date().toISOString(),
        user.updatedAt || user.createdAt || new Date().toISOString()
      ]
    );
    count += 1;
  }
  return count;
}

async function migrateTasks(tasks) {
  let count = 0;
  for (const task of tasks) {
    const id = String(task.id || '');
    const title = String(task.title || '').trim();
    if (!id || !title) continue;

    const status = ['todo', 'in_progress', 'done'].includes(task.status) ? task.status : 'todo';
    const priority = ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium';
    const dueDate = task.dueDate || null;
    const tags = Array.isArray(task.tags) ? task.tags.map((t) => String(t).trim()).filter(Boolean) : [];

    await pool.query(
      `INSERT INTO tasks (id, title, description, status, priority, due_date, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9)
       ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           description = EXCLUDED.description,
           status = EXCLUDED.status,
           priority = EXCLUDED.priority,
           due_date = EXCLUDED.due_date,
           tags = EXCLUDED.tags,
           created_at = EXCLUDED.created_at,
           updated_at = EXCLUDED.updated_at`,
      [
        id,
        title,
        String(task.description || ''),
        status,
        priority,
        dueDate,
        tags,
        task.createdAt || new Date().toISOString(),
        task.updatedAt || task.createdAt || new Date().toISOString()
      ]
    );
    count += 1;
  }
  return count;
}

async function main() {
  await connectDatabase();

  const [users, tasks] = await Promise.all([
    readJsonArray(USERS_FILE),
    readJsonArray(TASKS_FILE)
  ]);

  const usersMigrated = await migrateUsers(users);
  const tasksMigrated = await migrateTasks(tasks);

  console.log(`Users migrated: ${usersMigrated}`);
  console.log(`Tasks migrated: ${tasksMigrated}`);
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

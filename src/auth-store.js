const crypto = require('crypto');
const { pool } = require('./db');

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function comparePassword(password, stored) {
  return new Promise((resolve, reject) => {
    const [salt, key] = String(stored).split(':');
    if (!salt || !key) return resolve(false);

    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      const keyBuffer = Buffer.from(key, 'hex');
      if (keyBuffer.length !== derivedKey.length) return resolve(false);
      resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
    });
  });
}

async function createUser({ email, password, name }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [normalizedEmail]);
  if (existing.rowCount > 0) return null;

  const result = await pool.query(
    `INSERT INTO users (email, name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, created_at, updated_at`,
    [
      normalizedEmail,
      String(name || '').trim() || normalizedEmail.split('@')[0],
      await hashPassword(password)
    ]
  );

  return toSafeUser(result.rows[0]);
}

async function findUserByEmail(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const result = await pool.query(
    `SELECT id, email, name, password_hash, created_at, updated_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail]
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toSafeUser(user) {
  if (!user) return null;
  return {
    id: String(user.id),
    email: user.email,
    name: user.name,
    createdAt: user.created_at || user.createdAt,
    updatedAt: user.updated_at || user.updatedAt
  };
}

module.exports = {
  comparePassword,
  createUser,
  findUserByEmail,
  toSafeUser
};

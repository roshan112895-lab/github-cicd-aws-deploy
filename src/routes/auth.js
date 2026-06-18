const express = require('express');
const { comparePassword, createUser, findUserByEmail, toSafeUser } = require('../auth-store');
const { generateToken, verifyToken } = require('../auth-token');

const router = express.Router();

function getBearerToken(req) {
  const value = req.headers.authorization || '';
  const [type, token] = value.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

router.post('/register', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await createUser({ email, password, name });
    if (!user) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const token = generateToken(user);
    res.status(201).json({ data: { user: toSafeUser(user), token } });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const safeUser = toSafeUser(user);
    const token = generateToken(safeUser);
    res.json({ data: { user: safeUser, token } });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res) => {
  const token = getBearerToken(req);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.json({
    data: {
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name
      }
    }
  });
});

module.exports = router;

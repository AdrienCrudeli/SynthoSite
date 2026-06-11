const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const BCRYPT_ROUNDS = 12;

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new AppError('JWT secret is not configured.', 500);
  }

  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function signup(req, res, next) {
  try {
    const { username, email, password } = req.body;
    const existingUsers = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );

    if (existingUsers.length > 0) {
      throw new AppError('Username or email is already in use.', 409);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    return res.status(201).json({
      message: 'User created successfully.',
      user: {
        id: result.insertId,
        username,
        email,
        role: 'user'
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const users = await db.query(
      'SELECT id, username, email, password_hash, role FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (users.length === 0) {
      throw new AppError('Invalid email or password.', 401);
    }

    const user = users[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      throw new AppError('Invalid email or password.', 401);
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    return res.json({
      token: signToken(safeUser),
      user: safeUser
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  signup,
  login
};

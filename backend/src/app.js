const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('./config/env');

const authRoutes = require('./routes/auth.routes');
const projectsRoutes = require('./routes/projects.routes');
const adminRoutes = require('./routes/admin.routes');
const publicRoutes = require('./routes/public.routes');
const { AppError, errorHandler } = require('./middleware/errorHandler');

const app = express();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many authentication attempts. Please try again later.'
  }
});

const configuredCorsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const localCorsOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedCorsOrigins = new Set([
  ...configuredCorsOrigins,
  ...(process.env.NODE_ENV === 'production' ? [] : localCorsOrigins)
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new AppError('This origin is not allowed by CORS.', 403));
  }
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SynthoSite API' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/admin', adminRoutes);
app.use(publicRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use(errorHandler);

module.exports = app;

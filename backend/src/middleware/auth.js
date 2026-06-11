const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication token is required.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return next(new AppError('Invalid or expired authentication token.', 401));
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Admin access is required.', 403));
  }

  return next();
}

module.exports = {
  verifyToken,
  requireAdmin
};

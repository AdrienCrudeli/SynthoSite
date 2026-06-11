const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 400));
  }

  return next();
}

module.exports = validateRequest;

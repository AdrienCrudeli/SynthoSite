class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;

  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      message: 'A resource with these values already exists.'
    });
  }

  return res.status(statusCode).json({
    message: statusCode === 500 ? 'Internal server error.' : err.message
  });
}

module.exports = {
  AppError,
  errorHandler
};

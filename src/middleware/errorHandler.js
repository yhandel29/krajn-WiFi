function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  const safeMessage = statusCode >= 500
    ? 'A server error occurred. Please try again later.'
    : err.message || 'Request failed.';

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[${new Date().toISOString()}] ${err.name}: ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;

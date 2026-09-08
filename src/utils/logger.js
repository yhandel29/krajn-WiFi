function logger(level) {
  return (...args) => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}]`, ...args);
  };
}

module.exports = {
  info: logger('info'),
  warn: logger('warn'),
  error: logger('error'),
  debug: logger('debug'),
};

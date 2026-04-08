class Logger {
  constructor() {
    this.jsonFormat = process.env.LOG_FORMAT === 'json';
  }

  _write(level, message, data, writer) {
    const timestamp = new Date().toISOString();

    if (this.jsonFormat) {
      writer(JSON.stringify({
        timestamp,
        level,
        message,
        ...(data ? { data } : {})
      }));
      return;
    }

    writer(`[${timestamp}] ${level}: ${message}`, data || '');
  }

  log(message, data = null) {
    this._write('INFO', message, data, console.log);
  }

  error(message, error = null) {
    this._write('ERROR', message, error, console.error);
  }

  warn(message, data = null) {
    this._write('WARN', message, data, console.warn);
  }

  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      this._write('DEBUG', message, data, console.log);
    }
  }
}

module.exports = new Logger();

const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) =>
      `${timestamp} [${level.toUpperCase()}]: ${stack || message}`
    )
  ),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, '..', 'logs', 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(__dirname, '..', 'logs', 'combined.log') })
  ]
});

// Render (aur zyadatar cloud/container platforms) sirf stdout/stderr capture
// karte hain, disk-files ephemeral hote hain aur unke apne log-viewer mein
// kabhi dikhte nahi — isliye demo-deploy debug karne ke liye Console-transport
// hamesha zaroori hai, chahe NODE_ENV kuch bhi ho. (Production ke PM2/local
// setup mein files persist hoti hain isliye wahan farak nahi padta, lekin
// yahan is bina crash-reason kabhi dikhega hi nahi.)
logger.add(new winston.transports.Console({
  format: winston.format.combine(winston.format.colorize(), winston.format.simple())
}));

module.exports = logger;
const winston = require('winston');

require('winston-papertrail').Papertrail;
var logger = new winston.transports.Papertrail({
    host: 'logs2.papertrailapp.com',
    port: 27700,
    disableTls: true,
    colorize: false,
    handleExceptions: true
  });
module.exports = logger;


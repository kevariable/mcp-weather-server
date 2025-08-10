import winston from 'winston';
const loggerFormat = winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json());
export const logger = winston.createLogger({
    level: 'info',
    format: loggerFormat,
    transports: [
        new winston.transports.Console({
            format: loggerFormat,
            stderrLevels: ['error', 'warn', 'info', 'debug'],
        }),
    ],
});
//# sourceMappingURL=logger.js.map
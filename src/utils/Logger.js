const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = './logs';
        this.createLogDirectory();
        this.logFile = path.join(this.logDir, `bot-${this.getDateString()}.log`);
        this.securityLogFile = path.join(this.logDir, `security-${this.getDateString()}.log`);
    }

    createLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getDateString() {
        const now = new Date();
        return now.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    getTimestamp() {
        return new Date().toISOString();
    }

    formatMessage(level, message, data = null) {
        const timestamp = this.getTimestamp();
        let logMessage = `[${timestamp}] [${level}] ${message}`;
        
        if (data) {
            logMessage += ` | Data: ${JSON.stringify(data)}`;
        }
        
        return logMessage;
    }

    writeToFile(filename, message) {
        try {
            fs.appendFileSync(filename, message + '\n', 'utf8');
        } catch (error) {
            console.error('Erro ao escrever no arquivo de log:', error);
        }
    }

    info(message, data = null) {
        const logMessage = this.formatMessage('INFO', message, data);
        console.log(`\x1b[36m${logMessage}\x1b[0m`); // Cyan
        this.writeToFile(this.logFile, logMessage);
    }

    warn(message, data = null) {
        const logMessage = this.formatMessage('WARN', message, data);
        console.warn(`\x1b[33m${logMessage}\x1b[0m`); // Yellow
        this.writeToFile(this.logFile, logMessage);
    }

    error(message, data = null) {
        const logMessage = this.formatMessage('ERROR', message, data);
        console.error(`\x1b[31m${logMessage}\x1b[0m`); // Red
        this.writeToFile(this.logFile, logMessage);
    }

    debug(message, data = null) {
        if (process.env.NODE_ENV === 'development') {
            const logMessage = this.formatMessage('DEBUG', message, data);
            console.log(`\x1b[35m${logMessage}\x1b[0m`); // Magenta
            this.writeToFile(this.logFile, logMessage);
        }
    }

    security(eventType, data = null) {
        const logMessage = this.formatMessage('SECURITY', eventType, data);
        console.log(`\x1b[41m\x1b[37m${logMessage}\x1b[0m`); // Red background, white text
        this.writeToFile(this.securityLogFile, logMessage);
    }

    success(message, data = null) {
        const logMessage = this.formatMessage('SUCCESS', message, data);
        console.log(`\x1b[32m${logMessage}\x1b[0m`); // Green
        this.writeToFile(this.logFile, logMessage);
    }
}

module.exports = { Logger };

const config = require('./config');
const logger = require('./logger').logger;
const isPgError = (err) => ('code' in err) && ('schema' in err) && ('table' in err);
const isPgDataExceptionRe = /^(22|23)/;

module.exports = function errorHandler(err, req, res, next) {
	
	if (isPgError(err) && isPgDataExceptionRe.test(err.code)) {
		res.status(400).json(err.message);
	}
	else if (err.status) {
		res.status(err.status).json(err.message);
	}
	/* istanbul ignore next */
	else if (/^(test|development)$/.test(config.get('NODE_ENV'))) {
		logger.log('error', err.stack);
		res.status(500).end(err.stack);
	}
	/* istanbul ignore next */
	else {
		next(err);
	}
};

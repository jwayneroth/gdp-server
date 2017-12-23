//const winston = require('winston');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const logger = require('./lib/core/logger').logger;
const errorHandler = require('./lib/core/errorHandler');
const config = require('./lib/core/config');
const port = config.get('PORT');
const importerResource = require('./lib/importer/resource');
const apiResource = require('./lib/api/resource');
const usersResource = require('./lib/users/resource');
const tokensResource = require('./lib/tokens/resource');
const models = require('./lib/core/models');
const db = require('./lib/core/db.js');
const app = express();

/**
 *  connect to db and populate to match model schema
 *  check sql_mode for ONLY_FULL_GROUP_BY, update if necessary
 */
models.sync({
	force: false
})
.then( function() {
	return db.pool.query("SELECT @@sql_mode;")
	.spread(function(results, metadata) {
		let mode = results[0]['@@sql_mode'].split(',');
		const idx = mode.indexOf('ONLY_FULL_GROUP_BY');
		if (idx !== -1) {
			mode.splice(idx, 1);
			mode = mode.join(',');
			return db.pool
				.query('SET sql_mode = ' + mode)
				.spread((results, metadata) => {console.log('metadata: ', metadata)});
		}
		return;
	});
})
.catch(function(err) {
	throw err;
});

/* istanbul ignore if */
if (config.get('NODE_ENV') !== 'test') {
	app.use(morgan(':date[iso] (server) INFO: :method :url :remote-addr :response-time :status', {
		skip: (req) => /^\/favicon.ico/.test(req.originalUrl),
	}));
}

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.get('/_health', (req, res) => res.end('ok'));
app.get('/favicon.ico', (req, res) => res.end());
app.use('/importer', importerResource);
app.use('/api', apiResource);
app.use('/users', usersResource);
app.use('/tokens', tokensResource);
app.use('/static', express.static(path.join(__dirname, '../app/dist/static')));
app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, '../app/dist/index.html'));
});
app.use(errorHandler);

app.listen(port, () => {
	logger.log('info', `listening on :${port}`);
});

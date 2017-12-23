const {promisify} = require('util');
const logger = require('../core/logger').logger;
const config = require('../core/config');

const BCRYPT_ROUNDS = parseInt(config.get('BCRYPT_ROUNDS'));

let bcrypt;
/* istanbul ignore next */
try {
  bcrypt = require('bcrypt');
} catch (e) {
  logger.log('warning', 'using "bcryptjs" as "bcrypt" failed to load');
  bcrypt = require('bcryptjs');
}

module.exports = {
  hash: promisify(bcrypt.hash),
  compare: promisify(bcrypt.compare),
  saltRounds: BCRYPT_ROUNDS,
};

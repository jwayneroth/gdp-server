const logger = require('./logger').logger;
const Sequelize = require('sequelize');

const pool = new Sequelize(process.env.DATABASE_URL, {
	dialect: 'mysql',
	pool: {
		max: 5,
		idle: 30000,
		acquire: 60000,
	},
	logging: false, //(msg) => logger.log('info', msg),
	operatorsAliases: false,
});

module.exports = {
	pool,
	sync() { return pool.sync();}
};

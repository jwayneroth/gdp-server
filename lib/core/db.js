const Sequelize = require('sequelize');
//var mysql = require('mysql');
const config = require('./config');

let redis;

//console.log('connecting to database:', JSON.stringify(process.env.DATABASE_URL));
//console.log('env: ' + process.env.NODE_ENV);

const pool = new Sequelize(process.env.DATABASE_URL, {
	dialect: 'mysql',
	pool: {
		max: 5,
		idle: 30000,
		acquire: 60000,
	},
});

/**
 * redis placeholder
 * TODO: remove or implement
 */
if (process.env.NODE_ENV === "development") {
	redis = {
		get: null,
		set: null,
		expire: null,
		zrange: null,
		zadd: null
	};
	//redis = require("redis").createClient(6379, '127.0.0.1');
} else {
	const { REDIS_HOST } = process.env;
	redis = require("redis").createClient(process.env.REDIS_URL, {});
}

module.exports = {
	redis,
	pool,
	sync(cb) { return pool.sync();}
};

const {promisify} = require('util');
const jwt = require('jsonwebtoken');
const createJwtMid = require('express-jwt');
const createJwtAuthzMid = require('express-jwt-authz');
const config = require('../core/config');

const JWT_PRIVATE_KEY = config.get('JWT_PRIVATE_KEY');
const JWT_PUBLIC_KEY = config.get('JWT_PUBLIC_KEY');
const JWT_ISSUER = config.get('JWT_ISSUER');
const JWT_AUDIENCE = JWT_ISSUER;

const jwtSign = promisify(jwt.sign);

function getJwtUserData(user) {
	const blacklist = ['password'];
	return Object.keys(user).reduce((jwtUser, field) => {
		if (blacklist.indexOf(field) === -1 && user[field] && user[field] !== null) {
			jwtUser[field] = user[field];
		}
		return jwtUser;
	}, {});
}

exports.createToken = function(user, permissions) {
	
	const claims = {
		scope: permissions.join(' '),
		...getJwtUserData(user),
	};
	
	const options = {
		subject: user.id.toString(),
		algorithm: 'RS256',
		expiresIn: '1 year', // seconds or string Eg: 60, "2 days", "10h", "7d"
		audience: JWT_AUDIENCE,
		issuer: JWT_ISSUER,
	};
	
	return jwtSign(claims, JWT_PRIVATE_KEY, options);
};

/**
 * middleware to check token
 */
exports.ensureAuth = function(permissions) {
	
	// createJwtMid validates token and pushes user onto req
	const mids = [createJwtMid({
		algorithms: ['RS256'],
		secret: JWT_PUBLIC_KEY,
		issuer: JWT_ISSUER,
		audience: JWT_AUDIENCE,
	})];
	
	// createJwtAuthzMid validates token scope
	mids.push(createJwtAuthzMid(permissions));
	
	return mids;
};
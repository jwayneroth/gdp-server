const credsFromBasicAuth = require('basic-auth');
const createError = require('http-errors');
const createRouter = require('../core/createRouter');
const {getUserByAuth} = require('../users');
const {createToken} = require('./');

const router = module.exports = createRouter();

/**
 * issue access token
 */
router.post('/', async (req, res, next) => {
	
	const creds = credsFromBasicAuth(req);
	
	if (!creds) return next(createError(400, 'you must provide a valid email and password to log in.'));
	
	const user = await getUserByAuth(creds.name, creds.pass);
	
	if (user === 'no user') return next(createError(401, 'no user with that email can be found.'));
	if (user === 'bad pass') return next(createError(401, 'invalid password.'));
	if (!user) return next(createError(401, 'invalid email or password.'));
	
	const permissions = ['*']; //'github:read',
	
	res.status(201).json(await createToken(user, permissions));
});

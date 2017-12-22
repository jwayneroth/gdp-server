const credsFromBasicAuth = require('basic-auth');
const createError = require('http-errors');

const createRouter = require('../core/createRouter');
const {
	createToken,
	ensureAuth,
	ensureUser,
} = require('../tokens/');
const {
	fetchUsers,
	fetchUser,
	createUser,
	getUserByAuth,
	updateUserList,
} = require('./');

const router = module.exports = createRouter();

/*router.get('/', async (req, res) => {
	res.json(await fetchUsers());
});*/

/**
 * register new user
 * validate email and password
 * return access token
 */
router.post('/register', async (req, res, next) => {
	
	const {username, email, password} = req.body; 
	
	if (!username || !email || !password) return next(createError(401, 'you must provide a username, email, and password to register.'));
	
	const user = await createUser(username, email, password);
	
	if (!user) return next(createError(401, 'a user with that email address already exists.'));
	
	const token = await createToken(user, ['*']);
	
	const res_user = {
		token,
		id: user.id,
		username: user.username,
		Tracks: [],
		Shows: [],
	};
	
	res.status(201).json(res_user);
});

/**
 * log in existing user
 * issue access token and return with all of user's public info
 */
router.post('/login', async (req, res, next) => {
	
	const creds = credsFromBasicAuth(req);
	
	if (!creds) return next(createError(400, 'you must provide a valid email and password to log in.'));
	
	const user = await getUserByAuth(creds.name, creds.pass);
	
	if (user === 'no user') return next(createError(401, 'no user with that email can be found.'));
	if (user === 'bad pass') return next(createError(401, 'invalid password.'));
	if (!user) return next(createError(401, 'invalid email or password.'));
	
	const token = await createToken(user, ['*']);
	
	user.token = token;
	
	res.status(201).json(user);
});

/**
 * get user's public info
 */
router.get('/:id', async (req, res, next) => {
	const user = await fetchUser(req.params.id);
	user ? res.json(user) : next(createError(404));
});

/**
 * update user favorite
 */
router.post(
	'/choice/:media/:list/:id',
	ensureAuth(['*']),
	async (req, res, next) => {
		
		const {val} = req.body;
		const {media, list, id} = req.params;
		
		const update = (await (updateUserList(media, list, req.user.id, id, val)));
		
		if (!update) return next(createError(500, 'update failed'));
		
		res.status(201).json(update);
	}
);

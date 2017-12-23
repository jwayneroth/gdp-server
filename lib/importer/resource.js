const basicAuth = require('basic-auth');
const createError = require('http-errors');

const createRouter = require('../core/createRouter');
const router = module.exports = createRouter();
const {getUserByAuth} = require('../users/');
const importer = require('./index.js');

const adminAuth = async function(req, res, next) {
	const creds = basicAuth(req);
	if (!creds) return next(createError(400, 'you must provide a valid email and password.'));
	const user = await getUserByAuth(creds.name, creds.pass);
	if (user === 'no user') return next(createError(401, 'no user with that email can be found.'));
	if (user === 'bad pass') return next(createError(401, 'invalid password.'));
	if (!user) return next(createError(401, 'invalid email or password.'));
	if (!user.is_admin) return next(createError(401, 'not allowed.'));
	return next();
}

router.get("/rebuild_index", adminAuth, (req, res) => {
	importer.rebuild_index();
	res.set('Cache-Control', 'no-cache');
	res.json({success: true});
});

router.post("/build-shows-from-recordings", adminAuth, (req, res, next) => {
	
	importer.build_shows_from_recordings()
	.then(() => {
		res.status(201).json('build success');
	})
	.catch((err) => {
		return next(createError(401, err));
	});
});

/*
const auth = function(req, res, next) {
	const unauthorized = function(res) {
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		return res.sendStatus(401);
	};
	const user = basicAuth(req);
	if (!user || !user.name || !user.pass) {
		return unauthorized(res);
	}
	if ((user.name === 'gdp') && (user.pass === process.env.ADMIN_PASSWORD)) {
		return next();
	} else {
		return unauthorized(res);
	}
};
*/

//router.get("/:artist/rebuild_index", auth, importer.rebuild_index);
//router.get("/rebuild-all", auth, importer.rebuild_all);
//router.get("/rebuild-weighted-avg", auth, importer.reweigh);
//router.get "/:artist/:archive_id/rebuild_index", importer.rebuild_show
//router.get "/:artist/rebuild_setlists", importer.rebuild_setlists
//router.get "/reslug", importer.reslug
//router.get "/search_data", api.search_data
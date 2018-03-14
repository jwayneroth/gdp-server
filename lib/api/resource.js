const createError = require('http-errors');

const createRouter = require('../core/createRouter');
const router = module.exports = createRouter();
const api = require("./index.js");

/*
router.get('/', async (req, res) => {
	res.json(await getShowYears());
});
*/

router.get('/status', api.status);

router.get('/years', api.years);

router.get('/years/:year', (req, res, next) => {
	api.year_shows(req.params.year)
	.then(shows => res.status(201).json(shows))
	.catch(() => next(createError(401, 'database error.')));
});

router.get('/shows/:id', async (req, res, next) => {
	
	const show = (await api.show_recordings(req.params.id));
	
	if (!show) return next(createError(401, 'database error.'));
	
	res.status(201).json(show);
});

router.post('/teasers/:media', async (req, res, next) => {
		
	const {ids} = req.body;
	const {media} = req.params;
	
	if (!ids || !ids.length) return next(createError(401, 'invalid query'));
	
	const teasers = await (api.teasers_by_ids(media, ids));
	
	if (!teasers) return next(createError(401, 'invalid media type'));
	
	res.status(201).json(teasers);
});

// create new list for user
router.put('/lists', aync (req, res, next) => {
	
});
//router.get('/top_shows', api.top_shows);
//router.get('/random_show', api.random_show);
//router.get('/random_date', api.random_date);
//router.get('/shows', api.shows);
//router.get('/shows/:show_id', api.single_show);
//router.get('/mp3/:track_id', api.mp3);
//router.get('/venues', api.venues);
//router.get('/venues/:venue_id', api.single_venue);
//router.get('/search', api.search);
//router.get('/artists', api.artists);
//router.get('/', api.single_artist);
//router.get '/setlists', api.setlist.setlist
//router.get '/setlists/:setlist_id', api.setlist.show_id
//router.get '/setlists/on-date/:show_date', api.setlist.on_date
//router.get '/song_stats', api.setlist.song_stats
//router.get('/latest-tapes', api.latest);
//router.get('/today', api.today);
//router.get('/poll', api.poll);
//router.post('/play', api.live);
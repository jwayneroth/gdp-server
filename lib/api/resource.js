const createError = require('http-errors');

const models = require('../core/models');
const createRouter = require('../core/createRouter');
const router = module.exports = createRouter();
const { ensureAuth } = require('../tokens/');
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

/**
 * get a user resource, including all her lists and list media
 */
router.get('/user', ensureAuth(['*']),  async (req, res, next) => {
	const user = await models.User.findById(req.user.id, {
		include: [{
			model: models.List,
			attributes: ['id', 'title', 'createdAt'],
			include: [
				{model: models.Show, attributes: ['id']},
				{model: models.Recording, attributes: ['id']},
				{model: models.Track, attributes: ['id']}
			]
		}],
	});
	res.status(201).json(user.toJSON());
});

/**
 * lists POST
 * create a new list for the user
 */
router.post('/lists', ensureAuth(['*']), async (req, res, next) => {
	
	const {title, media} = req.body;
	
	if (!title) return next(createError(401, 'you must give your list a title.'));
	
	const user = await models.User.findById(req.user.id);
	const list = await user.createList({title});
	
	if (!list) return next(createError(500, 'we experienced an error creating your list. Please try again later.'));
	
	if (media && media.type && media.id) {
		const update = await api.updateListMedia(list, media);
	}
	
	res.status(201).json(list.toJSON());
	
});

/**
 * lists DELETE via POST
 * delete a list, verifying it belongs to the user
 */
router.post('/lists/delete/:id', ensureAuth(['*']), async (req, res, next) => {
	
	const user = await models.User.findById(req.user.id);
	const list = await models.List.findById(req.params.id);
	
	if (!list) return next(createError(500, 'we experienced an unknown error. Please try again later.'));
	if (list.UserId !== req.user.id) return next(createError(500, 'unauthorized.'));
	
	const destroy = await list.destroy();
	
	res.status(201).json();
	
});

/**
 * lists GET
 * get an individual list, with all its media
 */
router.get('/lists/:id', ensureAuth(['*']), async (req, res, next) => {
	
	const list = await models.List.findById(req.params.id, {
		include: [{
			model: models.Show,
			attributes: ['id', 'title', 'date'],
			order: ['date', 'ASC'],
		}, {
			model: models.Recording,
			attributes: ['id', 'title', 'ShowId', 'date'],
			order: ['date', 'ASC'],
		}, {
			model: models.Track,
			attributes: ['id', 'title', 'length', 'file'],
			include: [{
				model: models.Recording,
				attributes: ['id', 'title', 'date'],
				include: [{ model: models.Show, attributes: ['id'] }],
			}],
		}],
	});
	
	if (!list) return next(createError(500, 'we experienced an unknown error. Please try again later.'));
	if (list.UserId !== req.user.id && !list.isPublic) return next(createError(500, 'unauthorized.'));
	
	res.status(201).json(list.toJSON());
});

/**
 * lists PUT
 * update a list
 */
router.put('/lists/:id', ensureAuth(['*']), async (req, res, next) => {
	
	const list = await models.List.findById(req.params.id);
	
	if (!list) return next(createError(401, 'not a valid list.'));
	if (list.UserId !== req.user.id) return next(createError(500, 'unauthorized.'));
	
	let update;
	
	const {media, title} = req.body;
	
	if (media && media.hasOwnProperty('type') && media.hasOwnProperty('id')) {
		update = await api.updateListMedia(list, media);
	}
	
	if (title && title !== '') {
		list.set('title', title);
		update = await list.save();
	}
	
	//return next(createError(401, 'invalid data.'));
	
	res.status(201).json('list updated.');
});

/**
 * get the lists for a media item
 */
router.get('/lists/media/:type/:id', ensureAuth(['*']), async (req, res, next) => {
	
	const {type, id}  = req.params;
	
	const model = api.modelByMediaType(type);
	if (!model) return next(createError(401, 'invalid media type.'));
	
	const media = await model.findById(id, {
		include: [{
			model: models.List,
			attributes: ['id', 'title'],
		}]
	});
	
	if (!media) return next(createError(500, 'we experienced an unknown error. Please try again later.'));
	
	res.status(201).json(media.toJSON().Lists);
	
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
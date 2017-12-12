/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const async = require('async');
const _ = require('underscore');
const createError = require('http-errors');

const models = require('../core/models');
const {redis} = models;

const error = (res) => {
	err => res.json({is_success: false, data: err})
	//return next(createError(401, 'db error'));
};

const not_found = res => res.json(404, {is_success: false, data: null});

const success = function(data) {
	const res = {is_success: true};
	if (Array.isArray(data)) res.length = data.length;
	res.data = data;
	return res;
};

const cleanup_show = function(show, removeReviews) {
	//console.log('cleanup_show', show);
	
	if (removeReviews) {
		show.reviews = undefined;
	} else if (show.reviews) {
		try {
			show.reviews = JSON.parse(show.reviews);
		} catch (e) {
			show.reviews = [];
			show.reviews_count = 0;
			show.average_rating = 0.0;
			console.log('Couldnt parse reviews for ' + show.id + ': ' + show.reviews);
		}
	}
	return show;
}

const cleanup_shows = function(shows, removeReviews=false) {
	
	// single show
	if (Array.isArray(shows) === false) {
		return cleanup_show(shows, removeReviews);
	}
	
	// show array
	return shows.map((v) => {
		return cleanup_show(v, removeReviews)
	});
};

exports.status = (req, res) => res.json({success: true});

exports.shows = (req, res) => {
	return models.Recording.findAll()
	.catch(error(res))
	.then(shows => res.json(cleanup_shows(shows)));
};

exports.years = (req, res, next) => {
	
	return models.Year.findAll({
		order: [['year', 'ASC']]
	})
	.catch(err => next(createError(401, err)))
	.then(years => {
		res.json(years);
	});
};

exports.year_shows = (year) => {
	
	return models.Show.findAll({
		where: {year},
		order: [['date', 'ASC']]
	});
};

exports.single_show = (req, res, next) => {
	
	models.Recording.find({
		where: {id: req.params['show_id']}
	})
	.catch(err => next(createError(401, err)))
	.then(function(show) {
		
		if (!show) return next(createError(401, 'db error'));
		
		return show.getTracks()
		.catch(err => next(createError(401, err)))
		.then(tracks =>
			
			show.getVenue()
			.catch(err => next(createError(401, err)))
			.then(function(venue) {
				
				show = show.toJSON();
				show.tracks = tracks;
				
				delete show.VenueId;
				show.venue = venue;
				
				return res.json(cleanup_shows(show));
			})
		);
	})
};

exports.show_recordings = async (id) => {
	
	return models.Show.findOne({
		where: {id},
		order: [[models.Sequelize.literal('Recordings.weighted_avg'), 'DESC']],
		include: {
			model: models.Recording,
			include: [
				{model: models.Track},
				{model: models.Venue},
			]
		}
	});
};

/*
exports.year_shows = (req, res, next) => {
	
	return models.Year.findOne({
		where: {year: req.params['year']}
	})
	.catch(err => next(createError(401, err)))
	.then(function(year) {
		
		if (!year) return next(createError(401, 'db error'));
		
		year = year.toJSON();
		
		return models.pool.query(
			'SELECT COUNT(Recordings.display_date) as recording_count, Recordings.title, Recordings.date, Recordings.display_date, ' + 
			'Recordings.year, Recordings.archive_identifier, Recordings.id, Recordings.VenueId, Recordings.ArtistId, Recordings.is_soundboard, ' +
			'AVG(Recordings.track_count) as track_count, AVG(Recordings.duration) as duration, SUM(Recordings.reviews_count) as reviews_count, MAX(Recordings.average_rating) as average_rating, ' +
			'Venues.city as venue_city, Venues.name as venue_name FROM Recordings ' + 
			'INNER JOIN Venues on Recordings.VenueId = Venues.id ' +
			'WHERE year = ? GROUP BY Recordings.display_date ORDER BY Recordings.display_date ASC, weighted_avg DESC', {
			replacements: [year.year]
		})
		.catch(err => next(createError(401, err)))
		.spread(function(shows) {
			year.shows = cleanup_shows(shows);
			return res.json(year);
		});
	});
};

exports.top_shows = (req, res) => {
	return models.pool.query(
		'SELECT COUNT(Recordings.display_date) as recording_count, Recordings.title, Recordings.date, Recordings.display_date, ' +
		'Recordings.year, Recordings.archive_identifier, Recordings.id, Recordings.VenueId, Recordings.ArtistId, Recordings.is_soundboard, ' +
		'AVG(Recordings.duration) as duration, SUM(Recordings.reviews_count) as reviews_count, MAX(Recordings.average_rating) as average_rating, ' +
		'Venues.city as venue_city, Venues.name as venue_name FROM Recordings ' +
		'INNER JOIN Venues on Recordings.VenueId = Venues.id ' +
		'reviews_count > ? GROUP BY Recordings.display_date ' +
		'ORDER BY average_rating DESC, reviews_count DESC LIMIT 30 ', {
		replacements: [1]
	})
	.catch(error(res))
	.spread(shows => res.json(success(cleanup_shows(shows, true))));
};

exports.random_show = (req, res) => {
	
	return models.Recording.findAll({
		group: 'display_date',
		order: [{raw: 'RAND()'}],
		limit: 1
	})
	.catch(error(res))
	.then(function(shows) {
		
		if (!shows || (shows.length === 0)) { return not_found(res); }
		
		return models.Recording.find({where: {display_date: shows[0].display_date}})
		.catch(error(res))
		.then(function(shows) {
			
			let json = [];
			
			return async.each(shows, (show, cb) => {
				
				show.getTracks({order: 'track ASC'})
				.catch(err => cb(err))
				.then(tracks => {
					
					show.getVenue()
					.catch(err => cb(err))
					.then(function(venue) {
						
						show = show.toJSON();
						show.tracks = tracks;
						
						delete show.VenueId;
						show.venue = venue;
						
						json.push(cleanup_shows(show));
						
						return cb(null);
					})
				});
			});
			
		}, function(err) {
			
			if (err) { return error(res)(err); }
			
			json = json.sort(function(a, b) {
				const diff = b.average_rating - a.average_rating;
				if (diff === 0) { return b.reviews_count - a.reviews_count; }
				return diff;
			});
			
			res.set('Cache-Control', 'no-cache');
			
			return res.json(success(json));
		});
	});
};

exports.random_date = (req, res) => {
	
	return models.Recording.findAll({
		group: 'display_date',
		order: [{raw: 'RAND()'}],
		limit: 1
	}).catch(error(res)).then(function(shows) {
		
		if (!shows || (shows.length === 0)) { return not_found(res); }
		
		res.set('Cache-Control', 'no-cache');
		
		return res.json(success(shows[0].display_date));
	});
};

exports.show_by_date = async (date) => {
	
	const shows = (await models.Recording.findAll({
		where: {display_date: date},
		order: 'weighted_avg DESC'
	}));
	
	if (!shows || shows.length === 0) return null;
	
	let shows_formatted = [];
	
	return new Promise(function(resolve, reject) {
		async.each(
			shows,
			async (show, cb) => {
				
				const tracks = (await show.getTracks({order: 'track ASC'}));
				const venue = (await show.getVenue());
				
				show = show.toJSON();
				
				show.tracks = tracks;
				
				delete show.VenueId;
				show.venue = venue;
				
				shows_formatted.push(cleanup_shows(show, true));
				
				cb(null);
			},
			function(err) {
				if (err) reject(err);
				resolve(shows_formatted);
			}
		);
	});
};
*/
/*
exports.venues = (req, res) => {
	
	return models.pool.query(
		'SELECT *, (select count(DISTINCT display_date) FROM Recordings WHERE VenueId = v.id) as show_count ' +
		'FROM Venues as v ORDER BY show_count DESC', {
		replacements: []
	})
	.catch(error(res))
	.spread(venues => res.json(success(venues.filter(v => v.show_count > 0))));
};

exports.single_venue = (req, res) => {
	
	return models.Venue.findById(req.params['venue_id'])
	.catch(error(res))
	.then(function(venue) {
	
		if (!venue) { return not_found(res); }
		
		return models.pool.query(
			'SELECT COUNT(Recordings.display_date) as recording_count, Recordings.title, Recordings.date, Recordings.display_date, ' + 
			'Recordings.year, Recordings.archive_identifier, Recordings.id, Recordings.VenueId, Recordings.ArtistId, Recordings.is_soundboard, ' +
			'AVG(Recordings.duration) as duration, SUM(Recordings.reviews_count) as reviews_count, MAX(Recordings.average_rating) as average_rating, ' +
			'Venues.city as venue_city, Venues.name as venue_name FROM Recordings ' +
			'INNER JOIN Venues on Recordings.VenueId = Venues.id WHERE VenueId = ? ' +
			'GROUP BY Recordings.display_date ORDER BY date ASC', {
			replacements: [venue.id]
		})
		.catch(error(res))
		.spread(function(shows) {
		
			venue = venue.toJSON();
			venue.shows = cleanup_shows(shows);
			return res.json(success(venue));
		});
	});
};

exports.mp3 = (req, res) => {
	models.Track.find({
		where: {id: req.params['track_id']}
	})
	.catch(error(res))
	.then(function(track) {
		if (!track) { return not_found(res); }
		return res.redirect(track.file);
	})
};

exports.search = function(req, res) {
	
	let { q } = req.query;
	
	if (!q) { res.send(404); }
	
		q = `%${q}%`;
		
		// search Recordings, Tracks, Venues
		
		return async.parallel([
			cb => {
				models.pool.query(
					'SELECT Recordings.*, v.city as venue_city, v.name as venue_name ' + 
					'FROM Recordings INNER JOIN Venues v on Recordings.VenueId = v.id ' + 
					'WHERE (title LIKE :query OR date LIKE :query OR year LIKE :query OR ' + 
					'source LIKE :query OR lineage LIKE :query OR taper LIKE :query OR ' +
					'description LIKE :query OR archive_identifier LIKE :query) ' +
					'GROUP BY Recordings.display_date ORDER BY date ASC LIMIT 15', {
					replacements: {'query': q}
				})
				.catch(error(res))
				.spread(shows => cb(null, {type: "shows", data: shows}))
			},
			cb => {
				models.pool.query(
					'SELECT Tracks.length, Tracks.title, Tracks.track, Tracks.slug, Tracks.id, Recordings.year, Recordings.date, Recordings.ArtistId ' +
					'FROM Tracks INNER JOIN Recordings on Recordings.id = Tracks.RecordingId WHERE Tracks.title LIKE :query LIMIT 15', {
					replacements: {'query': q}
				})
				.catch(error(res))
				.spread(tracks => cb(null, {type: "tracks", data: tracks}))
			},
			cb => {
				models.pool.query("SELECT * FROM Venues WHERE name LIKE :query OR city LIKE :query LIMIT 15", {replacements: {'query': q}})
				.catch(error(res))
				.spread(venues => cb(null, {type: "venues", data: venues}))
			},
		], function(err, results) {
			
			if (err) { return error(res); }
			
			const final = {shows: [], tracks: [], venues: []};
			
			for (let search_result of Array.from(results)) {
				if (search_result.type === "shows") { final.shows = final.shows.concat(search_result.data); }
				if (search_result.type === "tracks") { final.tracks = final.tracks.concat(search_result.data); }
				if (search_result.type === "venues") { final.venues = final.venues.concat(search_result.data); }
			}
			
			final.shows = cleanup_shows(final.shows);
			
			return res.json(success(final));
		});
};

exports.search_data = function(req, res) {
	
	let oup = [];
	
	return models.Recording.findAll()
	.catch(error(res))
	.then(function(shows) {
		
		shows = cleanup_shows(shows);
		
		oup = oup.concat(shows.map(function(v) {
			v = v.toJSON();
			v._index = 'search';
			v._type = 'show';
			v._id = v.id;
			delete v.id;
			return v;
		}));

		return models.Venue.findAll()
		.catch(error(res))
		.then(function(venues) {
			oup = oup.concat(venues.map(function(v) {
				v = v.toJSON();
				v._index = 'search';
				v._type = 'venue';
				v._id = v.id;
				delete v.id;
				return v;
			}));
			
			return models.Track.findAll()
			.catch(error(res))
			.then(function(venues) {
				
				oup = oup.concat(venues.map(function(v) {
					v = v.toJSON();
					v._index = 'search';
					v._type = 'track';
					v._id = v.id;
					delete v.id;
					return v;
				}));
				
				const final = [];
				
				oup.forEach(function(v) {
					final.push(JSON.stringify({index: {_index: v._index, _type: v._type, _id: v._id}}));
					return final.push(JSON.stringify(v));
				});
				
				return res.send(final.join("\n"));
			});
		});
	});
};

exports.latest = (req, res) => {
	models.pool.query(
		'SELECT Recording.id,' +
		'Recording.title,' +
		'Recording.date,' +
		'Recording.display_date,' +
		'Recording.year,' +
		'Recording.source,' +
		'Recording.lineage,' +
		'Recording.transferer,' +
		'Recording.taper,' +
		'Recording.description,' +
		'Recording.archive_identifier,' +
		'Recording.reviews,' +
		'Recording.reviews_count,' +
		'Recording.average_rating,' +
		'Recording.duration,' +
		'Recording.track_count,' +
		'Recording.is_soundboard,' +
		'Recording.orig_source,' +
		'Recording.weighted_avg,' +
		'Recording.createdat,' +
		'Recording.updatedat,' +
		'Recording.venueid,' +
		'Recording.ArtistId,' +
		'Artist.slug,' +
		'Artist.name'  +
		'FROM Recordings AS Recording ' +
		'INNER JOIN Artists as Artist ON Recording.ArtistId = Artist.id ' +
		'ORDER BY id DESC ' +
		'LIMIT 50;'
	)
	.catch(error(res)).then(function(shows) {
		
		if (!shows) { return not_found(res); }
		
		return res.send(success(shows[0]));})
};

exports.today = function(req, res) {
	
	const now = new Date();
	
	let month = now.getMonth() + 1;
	
	let day = now.getDate();
	
	if (month < 10) { month = `0${month}`; }
	
	if (day < 10) { day = `0${day}`; }
	
	const DATE_REGEX = new RegExp(`${month}-${day}$`);
	
	return redis.get(`tih-${month}-${day}`, function(err, response) {
		
		if (!err && response) { return res.json({tih: JSON.parse(response)}); }
		
		return models.pool.query(
			'SELECT id,title,display_date,date,ArtistId,year ' +
			'FROM Recordings WHERE display_date LIKE :string ' +
			'GROUP BY display_date ORDER BY title, display_date', {
			replacements: {'string': `%${month}-${day}`}
		})
		.catch(error(res))
		.spread(shows => {
			
			models.pool.query("SELECT * FROM Artists ORDER BY name")
			.catch(error(res))
			.spread(function(artists) {
				
				shows = shows.filter(show => DATE_REGEX.test(show.display_date))
				.map(function(show) {
					let year;
					[year, month, day] = Array.from(show.display_date.split('-'));
					show.month = month;
					show.day = day;
					return show;
				});
				
				const grouped = _.groupBy(shows, 'ArtistId');
				
				let gd = {};
				let phish = {};

				const output = artists.map(function(artist) {
					const obj = {shows: grouped[artist.id], name: artist.name, slug: artist.slug};
					if (artist.slug === "grateful-dead") { gd = obj; }
					if (artist.slug === "phish") { phish = obj; }
					return obj;
				}).filter(artist => artist.shows && !/(phish)|(grateful\-dead)/.test(artist.slug));
				
				if (phish.shows != null ? phish.shows.length : undefined) { output.unshift(phish); }
				if (gd.shows != null ? gd.shows.length : undefined) { output.unshift(gd); }
				
				redis.set(`tih-${month}-${day}`, JSON.stringify(output));
				redis.expire(`tih-${month}-${day}`, 86400);
				
				return res.json({tih: output});
			})
		});
	});
};

exports.poll = function(req, res) {
	
	//#{ since } = req.query
	
	const now = Math.floor(Date.now() / 1000);
	
	const handlePlays = function(err, plays) {
		const output = plays.map(function(play) {
			
			const song = JSON.parse(play);
			
			const { title, slug, band, year, month, day, showVersion, id } = song;
			
			return { title, slug, band, year, month, day, showVersion, id };
		
		});
		
		return res.json({plays: output.reverse(), now});
	};
	
	//if since
	//	redis.zrangebyscore ['played', since, now], handlePlays
	//else
	
	return redis.zrange('played', -26, -1, handlePlays);
};

exports.live = function(req, res) {
	
	const { song } = req.body;
	
	if (!song.showVersion) { song.showVersion = "";}
	
	const now = Math.floor(Date.now() / 1000);
	
	return redis.zadd('played', now, JSON.stringify(song), length => res.json({song, length}));
};
*/
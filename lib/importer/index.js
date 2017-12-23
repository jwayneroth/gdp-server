const logger = require('../core/logger').logger;
//const winston = require('winston');
const async = require('async');

const models = require('../core/models');
const importer = require('./helpers.js');

exports.rebuild_index = function() {
	importer.refreshData(function(err) {
		if (err) { throw err; }
		return logger.log('info', 'Done rebuilding index');
	});
};

/**
 * build shows for recording dates
 * TODO: query all recordings grouped by date (or unique date)
 * loop dates and query all recordings for each date
 * use recordings collection to build show for date (opposed to building show from single recording representing grouped date)
 */
exports.build_shows_from_recordings = () => {
	
	return new Promise(async function(resolve, reject) {
		
		await models.pool.query("SET FOREIGN_KEY_CHECKS=0;");
		await models.pool.query("TRUNCATE TABLE Shows;");
		await models.pool.query("SET FOREIGN_KEY_CHECKS=1;");
		
		models.pool.query(
			'SELECT ' +
				'COUNT(Recordings.date) as recording_count, ' +
				'Recordings.date, ' +
				'Recordings.year, ' +
				'AVG(Recordings.track_count) as average_track_count, ' + 
				'AVG(Recordings.duration) as average_duration, ' +
				'SUM(Recordings.reviews_count) as reviews_count, ' +
				'AVG(Recordings.average_rating) as average_rating, ' +
				'MAX(Recordings.is_soundboard) as has_soundboard ' +
			'FROM Recordings ' +
			'GROUP BY Recordings.date ' +
			'ORDER BY Recordings.date ASC'
			//+ ' LIMIT 1'
		)
		.catch(err => reject(err))
		.spread(dates => {
			
			async.eachLimit(dates, 20, async function(date, cb) {
				
				const show = Object.assign({}, date);
				
				const recordings = (await models.Recording.findAll({
					where: {date: date.date},
					order: [['weighted_avg', 'DESC']]
				}));
				
				const top_recording = recordings[0];
				
				show.title = top_recording.title
					.slice(0, top_recording.title.lastIndexOf(' on '))
					.replace('Grateful Dead', '')
					.trim();
				
				models.Show.create(show)
				.then(function(show) {
					
					async.each(recordings, function(rec, cb_inner) {
						
						rec.ShowId = show.id;
						
						rec.save()
						.then(function() {
							cb_inner(null);
						})
						.catch(function(err) {
							cb_inner(err);
						});
						
					}, function(err) {
						cb(err);
					});
					
				})
				.catch(function(err) {
					cb(err);
				});
				
			}, function(err) {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	});
}

/*
exports.rebuild_all = function(req, res) {
	res.set('Cache-Control', 'no-cache');
	res.json({success: true});

	return models.Artist
	.findAll()
	.catch(function(err) { if (err) { throw err; } })
	.then(artists => {
		
		async.eachSeries(artists, (artist, cb) => {
			
			importer.refreshData(artist, function(err) {
				winston.info('Done rebuilding index for ' + artist.name);
				return cb(err);
			}, function(err) {
				if (err) { throw err; }
				return winston.info("Done rebuilding all indexes");
			});
		});
	});
};

exports.rebuild_show = function(req, res) {
	res.set('Cache-Control', 'no-cache');
	res.json({success: true});

	return models.Artist
	.find({where: {slug: req.param('artist')}})
	.catch(function(err) { if (err) { throw err; } })
	.then(artist =>
		importer.refreshShow(artist, req.param('archive_id'), function(err) {
			if (err) { throw err; }
			return winston.info(`Done rebuilding index for ${artist.name}: ${req.param('archive_id')}`);
		})
	);
};

exports.reslug = function(req, res) {
	
	res.set('Cache-Control', 'no-cache');
	
	res.json({success: true});
	
	return importer.reslug(function(err) {
		if (err) { throw err; }
		return winston.info("Done reslugging");
	});
};

exports.reweigh = function(req, res) {
	
	res.set('Cache-Control', 'no-cache');
	
	res.json({success: true});
	
	return models.Artist.findAll()
	.catch(function(err) { if (err) { throw err; } })
	.then(artists => {
		
		Array.from(artists).map((artist) => {
			importer.refresh_weighted_avg(artist, function(err) {
				if (err) { throw err; }
				return winston.info("Done reweighing");
			});
		});
	});
};

exports.build_shows_from_recordings = async () => {
	
	return new Promise(function(resolve, reject) {
		
		// get recordings by date (shows)
		models.pool.query(
			'SELECT COUNT(Recordings.date) as recording_count, ' +
			'Recordings.date, ' +
			'Recordings.year, ' +
			'AVG(Recordings.track_count) as average_track_count, ' + 
			'AVG(Recordings.duration) as average_duration, ' +
			'SUM(Recordings.reviews_count) as reviews_count, ' +
			'AVG(Recordings.average_rating) as average_rating, ' +
			'GROUP BY Recordings.date ' +
			'ORDER BY Recordings.date ASC'
		)
		.catch((err) => {
			reject(err);
		})
		.spread((recordings_by_date) => {
			
			async.eachLimit(
				recordings_by_date,
				10,
				async (rec, cb) => {
					
					let show = {
						title : rec.venue_name + ", " + rec.venue_city,
						date : rec.date,
						display_date : rec.display_date,
						year : rec.year,
						recording_count : rec.recording_count,
						average_duration : rec.duration,
						reviews_count : rec.reviews_count,
						average_rating : rec.average_rating,
						VenueId : rec.VenueId,
					};
					
					// add show to db
					models.Show.create(show)
					.then(() => {cb(null)})
					.catch(err => {reject(err)});
				},
				(err) => {
					if (err) reject(err);
					resolve();
				}
			);
		});
	});
}

exports.rebuild_index = function(req, res) {
	res.set('Cache-Control', 'no-cache');
	res.json({success: true});

	return models.Artist
	.find({where: {slug: req.param('artist')}})
	.catch(function(err) { if (err) { throw err; }})
	.then(artist => importer.refreshData(artist, function(err) {
		if (err) { throw err; }
		return winston.info(`Done rebuilding index for ${artist.name}`);
	})
	);
};
*/
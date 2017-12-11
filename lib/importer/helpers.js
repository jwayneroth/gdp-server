/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const request = require('request');
const winston = require('winston');
const async = require('async');
const slugsA = require('slugs');
const _ = require('underscore');

const models = require('../core/models');
const {Sequelize} = models;

const SEARCH_URL = (collection = 'GratefulDead') => 'http://archive.org/advancedsearch.php?q=collection%3A' + collection + '&fl%5B%5D=date&fl%5B%5D=identifier&fl%5B%5D=year&sort%5B%5D=year+asc&sort%5B%5D=&sort%5B%5D=&rows=9999999&page=1&output=json&save=yes';
const SINGLE_URL = identifier => 'https://archive.org/details/' + identifier + '?output=json';

const parseTime = str => str.split(':').reverse().map((v, k) => Math.max(1, 60 * k) * parseInt(v)).reduce((x,y) => x+y);
const sum = arr => _.reduce(arr, (memo, num) => memo + num, 0);
const average = arr => sum(arr) / arr.length;

/**
 * get show data for artist
 * get data for each show
 * update years table to match shows
 * update recording weighted averages (for date)
 */
const refreshData = function(done) {
	
	return request(SEARCH_URL(), function(err, response, body) {
		
		if (err) throw err;
		
		body = JSON.parse(body);
		
		winston.info('got search results');
		
		const recordings = body['response']['docs'];
		
		winston.info(artist.slug, recordings.length, 'recordings');
		
		// get data for each of the returned recordings
		// mapLimit takes function to run for each iteration,
		// and callback function to call on error or on completion
		// in callback, call cache_year_stats and refresh_weighted_avg, respectively
		return async.mapLimit(recordings, 1, function(small_show, cb) {
			winston.info('requesting ' + small_show.date);
			return loadShow(artist, small_show, cb);
		}, function(err) {
			if (err) return done(err);
			return cache_year_stats(function(err) {
				if (err) {
					winston.info('err: ' + err);
					return done(err);
				}
				winston.info("reweighing averages");
				return refresh_weighted_avg(artist, done);
			});
		});
	});
};

const refreshShow = function(artist, id, done) {
	winston.info('requesting search url');
	
	return request(SINGLE_URL(id), function(err, httpres, body) {
		
		if (err) { throw err; }
		
		const show = JSON.parse(body);
		
		winston.info('got search results');
		
		winston.info(`requesting ${(show.metadata.indentifier != null ? show.metadata.indentifier[0] : undefined)}`);
		
		return loadShow(artist, {identifier: show.metadata.identifier[0]}, done);
	});
};

var refresh_weighted_avg = (artist, done) => {
	
	models.Recording.findAll({
		group: 'date', where: { artistId: artist.id }
	})
	.catch(done)
	.then(function(dates) {
		winston.info('mapping dates: ' + dates.length);
		
		return dates.map(date => {
			models.Recording.findAll({
				where: { 
					date: date.date,
					artistId: artist.id
				}
			})
			.catch(done)
			.then(function(tapes) {
				
				const averages = _.pluck(tapes, 'average_rating');
				const ratings = _.pluck(tapes, 'reviews_count');
				const avgAll = average(averages);
				const ratingAll = average(ratings);
				const proms = [];
				
				tapes.map(function(tape) {
					
					let weighted_avg;
					
					if (tape.reviews_count === 0) {
						weighted_avg = 0;
					} else {
						weighted_avg = (ratingAll * avgAll) + ((tape.reviews_count * tape.average_rating) / (ratingAll + tape.reviews_count));
					}
					
					return proms.push(tape.update({weighted_avg}));
				});
				
				winston.info('updating ' + proms.length + ' tapes');
				
				return Sequelize.Promise.all(proms)
				.catch(done)
				.then(() => done());
			})
		});
	});
}

const slugify = function(t, slugs) {
	
	let l = t.toLowerCase();
	
	if (l.slice(0, 2) === "E:") { l = l.slice(2);}
	
	let slug = slugsA(l.trim())
	.slice(0, 254)
	.replace(/-{2,100}/, '-')
	.replace(/^-+|-+$/, '');
	
	// If we want unique slugs, keep track of the slugs we've used
	if (slugs) {
		let i = 1;
		while (slugs[slug]) {
			slug = slug.replace(/-[0-9]+$/, '') + '-' + i++;
		}
		slugs[slug] = true;
	}
	return slug;
};

const venue_slugify = t => t.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '');

const reslug = function(done) {
	
	const chainer = new Sequelize.Utils.QueryChainer;
	
	return models.Recording.findAll().catch(done).then(shows => {
		
		Array.from(shows).map((show) => {
			
			show.getTracks()
			.catch(done)
			.then(function(tracks) {
				
				const slugObj = {};
				
				let i = 1;
				
				return (() => {
					
					const result = [];
					
					for (let track of Array.from(tracks)) {
						
						const title = track.title.trim();
						
						let slug = slugs(title)
							.replace(/-{2,100}/, '-')
							.replace(/-+$/, '');
						
						while (slugObj[slug]) {
							slug = slug.replace(/-[0-9]+$/, '') + '-' + i++;
						}
						
						slugObj[slug] = true;
						
						result.push(track.updateAttributes({slug, title})
						.then(() => 0)//console.log arguments[0].dataValues.slug
						.catch(() => 0));
					}
					
					return result;
				})();
			})
		})
	});
};

/**
 * cache_year_stats
 -- Cache duration and track counts
  INSERT INTO Years (ArtistId, year, show_count, duration, avg_duration, avg_rating,createdAt,updatedAt)
  SELECT ArtistId, year, COUNT(*), SUM(Recordings.duration), AVG(Recordings.duration), AVG(NULLIF(Recordings.average_rating, 0)), NOW(), NOW()
  FROM Recordings
  GROUP BY ArtistId, year
 -- Cache year information
  SELECT year, ArtistId, COUNT(*) FROM Recordings GROUP BY ArtistId, year
 */
var cache_year_stats = function(done) {
	winston.info("Caching year information");
	
	return models.pool.query("TRUNCATE TABLE Years")
	.catch(done)
	.then(() => {
		
		models.pool.query(
			'INSERT INTO Years (ArtistId, year, show_count, recording_count, duration, avg_duration, avg_rating,createdAt,updatedAt) ' +
			'SELECT ArtistId, year, COUNT(DISTINCT Shows.date), COUNT(*), SUM(Recordings.duration), ' +
			'AVG(Recordings.duration), AVG(NULLIF(Recordings.average_rating, 0)), NOW(), NOW() FROM Recordings GROUP BY ArtistId, year'
		)
		.catch(done)
		.then(() => {
			
			models.pool.query("UPDATE Years SET avg_rating = 0 WHERE avg_rating IS NULL")
			.catch(done)
			.then(function() {
				winston.info("Complete year cache");
				return done();
			});
		});
	});
};

/**
 * loadShow
 *  if show exists, do nothing
 *  else get show data, add it AND its tracks AND its venue to the db
 */
var loadShow = (artist, small_show, cb) => {
	
	models.Recording.find({
		where: {archive_identifier: small_show.identifier}
	})
	.catch(cb)
	.then(function(pre_existing_show) {
		
		if (pre_existing_show !== null) {
			winston.info("this archive identifier is already in the db");
			return cb();
		}
		
		const single_url = SINGLE_URL(small_show.identifier);
		
		return request(single_url, function(err, httpres, body) {
			winston.info('GET ' + single_url);
			
			try {
				body = JSON.parse(body);
			} catch (e) {
				// invalid json
				console.log(e);
				return cb();
			}
			
			const { files } = body;
			
			const mp3_tracks = Object.keys(files)
			.filter(function(v) {
			
				const file = files[v];
				
				if (file.format !== "VBR MP3") { return false; }
				
				const title = file.title || file.original;
				
				// make sure all required props are there
				if (!title || !file.bitrate || !file.size || !file.length || !file.md5) {
					return false;
				}
				
				return true;
			});
			
			if (mp3_tracks.length === 0) {return cb();}
			
			if (!body.metadata.date) {
				winston.info('no date:', body.metadata.title);
				
				return cb();
			}
			
			/*let d = new Date(body.metadata.date[0]);
			if (isNaN(d.getTime())) {
				const parts = body.metadata.date[0].split('-');
				if (parts[1] === '00') { parts[1] = '01'; }
				if (parts[2] === '00') { parts[2] = '01'; }
				if (parseInt(parts[2], 10) > 31) parts[2] = '31';
				if (parseInt(parts[1], 10) > 12) parts[2] = '12';
				d = new Date(`${parts[0]}-${parts[2]}-${parts[1]}`);
				if (isNaN(d.getTime())) d = new Date(0);
			}*/
			
			const showProps = {
				title : body.metadata.title.join(", "),
				//date : d,
				date : body.metadata.date[0], //display_date : body.metadata.date[0],
				year : body.metadata.year ? parseInt(body.metadata.year[0]) : new Date(body.metadata.date[0]).getFullYear(),
				source : body.metadata.source ? body.metadata.source[0] : "Unknown",
				lineage : body.metadata.lineage ? body.metadata.lineage[0] : "Unknown",
				taper : body.metadata.taper ? body.metadata.taper[0] : "Unknown",
				transferer : body.metadata.transferer ? body.metadata.transferer[0] : "Unknown",
				description : body.metadata.description ? body.metadata.description[0] : "",
				archive_identifier : body.metadata.identifier[0],
				reviews : body.reviews ? JSON.stringify(body.reviews.reviews.slice(0, 30)).replace(/[Â]+/g, "Â").replace(/[Ã]+/g, "Ã") : "[]",
				reviews_count : body.reviews ? body.reviews.info.num_reviews : 0,
				average_rating : body.reviews ? body.reviews.info.avg_rating : 0.0,
				//orig_source : "archive.org"
			};
			
			showProps.is_soundboard = ((showProps.archive_identifier != null ? showProps.archive_identifier.toString().toLowerCase().indexOf('sbd') : undefined) !== -1) ||
				((showProps.title != null ? showProps.title.toString().toLowerCase().indexOf('sbd') : undefined) !== -1) ||
				((showProps.source != null ? showProps.source.toString().toLowerCase().indexOf('sbd') : undefined) !== -1) ||
				((showProps.lineage != null ? showProps.lineage.toString().toLowerCase().indexOf('sbd') : undefined) !== -1);
			
			const venueProps = {
				name : body.metadata.venue ? body.metadata.venue[0] : "Unknown",
				city : body.metadata.coverage ? body.metadata.coverage[0] : "Unknown"
			};
			
			venueProps.slug = slugify(venueProps.name);
			
			let track_i = 0;
			let total_duration = 0;
			const slugs = {};
			const tracks = mp3_tracks.sort()
			.map(function(v) {
			
				const file = files[v];
				
				let t = file.title || file.original;
				
				total_duration += parseTime(file.length);
				
				t = t.replace(/\\'/g, "'").replace(/\\>/g, ">").replace(/Â»/g, ">").replace(/\([0-9:]+\)/g, '');
				
				const parsed_track = file.track ? parseInt(file.track.replace(/[^0-9]+/, '')) : undefined;
				
				return models.Track.build({
					title : t.slice(0, 254),
					md5 : file.md5,
					track : ++track_i,
					bitrate : parseInt(file.bitrate),
					size : parseInt(file.size),
					length : parseTime(file.length),
					file : `https://archive.org/download/${showProps.archive_identifier}${v}`,
					slug : slugify(t, slugs)
				});
			});
			
			showProps.duration = total_duration;
			showProps.track_count = tracks.length;
			
			const showCreated = function(show, created) {
				
				if (!created) {
					winston.info("this show is already in the db; ensuring archive_collection tracks are present");
					return cb();
				} else {
					winston.info("show created! looking for venue");
				}
				
				return models.Venue.findOrCreate({
					where: {slug: venueProps.slug},
					defaults: venueProps
				})
				.catch(cb)
				.spread(function(venue, created) {
					winston.info("building tracks");
					winston.info("setting venue and tracks");
					
					show.setVenue(venue);
					show.setArtist(artist);
					
					const proms = [show.save()];
					
					for (var tr of Array.from(tracks)) {
						proms.push(tr.save());
					}
					
					winston.info("saving!");
					
					return Sequelize.Promise.all(proms)
					.catch(cb)
					.then(function() {
						console.log("done! relating tracks to shows");
						
						const proms2 = [];
						
						for (tr of Array.from(tracks)) {
							proms2.push(tr.setShow(show));
						}
						
						return Sequelize.Promise.all(proms2)
						.catch(cb)
						.then(function() {
							console.log("related");
							return cb();
						});
					});
				});
			};
			
			winston.info("looking for show in db");
			
			return models.Recording.findOrCreate({
				where: {
					date: showProps.date,
					ArtistId: artist.id,
					archive_identifier: showProps.archive_identifier
				},
				defaults: showProps
			})
			.catch(showCreated)
			.spread(showCreated);
		});
	});
}

module.exports = (exports = { 
	refreshData,
	reslug,
	slugify,
	refreshShow,
	refresh_weighted_avg
});

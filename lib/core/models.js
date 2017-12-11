const Sequelize = require('sequelize');
const db = require('./db');
const pool = db.pool;
const {redis} = db;

const User = pool.define('User', {
	username: Sequelize.STRING,
	email: Sequelize.STRING,
	password: Sequelize.STRING,
	is_admin: Sequelize.BOOLEAN,
});

const Show = pool.define('Show', {
	title : Sequelize.STRING(255),
	date : Sequelize.STRING,
	year : Sequelize.INTEGER,
	recording_count : Sequelize.INTEGER,
	average_duration : Sequelize.INTEGER,
	reviews_count : Sequelize.INTEGER,
	average_rating : Sequelize.FLOAT,
	average_track_count: Sequelize.INTEGER,
	has_soundboard: Sequelize.BOOLEAN,
});

const Recording = pool.define('Recording', {
	title : Sequelize.STRING(255),
	date : Sequelize.STRING, //date : Sequelize.DATE, display_date : Sequelize.STRING,
	year : Sequelize.INTEGER,
	source : 'MEDIUMTEXT', // Sequelize.TEXT
	lineage : Sequelize.TEXT,
	transferer : Sequelize.TEXT,
	taper : Sequelize.TEXT,
	description : Sequelize.TEXT,
	archive_identifier : { type: Sequelize.STRING, unique: true},
	reviews : Sequelize.TEXT,
	reviews_count : Sequelize.INTEGER,
	average_rating : Sequelize.FLOAT,
	duration : Sequelize.INTEGER,
	track_count : Sequelize.INTEGER,
	is_soundboard : Sequelize.BOOLEAN,
	orig_source : Sequelize.STRING,
	weighted_avg : Sequelize.FLOAT
});

const Venue = pool.define('Venue', {
	name : Sequelize.STRING,
	city : Sequelize.STRING,
	slug : Sequelize.STRING
});

const Track = pool.define('Track', {
	title : Sequelize.STRING,
	md5 : Sequelize.STRING,
	track : Sequelize.INTEGER,
	bitrate : Sequelize.INTEGER,
	size : Sequelize.INTEGER,
	length : Sequelize.INTEGER,
	file : { type: Sequelize.STRING, unique: true},
	slug : Sequelize.STRING
});

/*const Artist = pool.define('Artist', {
	name : Sequelize.STRING,
	archive_collection : Sequelize.STRING,
	slug : { type: Sequelize.STRING, unique: true},
	from_archive : Sequelize.BOOLEAN,
	musicbrainz_id : { type: Sequelize.STRING, unique: true},
	extended_features : Sequelize.INTEGER
});*/

const Year = pool.define('Year', {
	year : Sequelize.INTEGER,
	show_count : Sequelize.INTEGER,
	recording_count : Sequelize.INTEGER,
	duration : Sequelize.INTEGER,
	avg_duration : Sequelize.FLOAT,
	avg_rating : Sequelize.FLOAT
});

const UserShow = pool.define('UserShow', {
	is_favorite: Sequelize.BOOLEAN,
	is_checked: Sequelize.BOOLEAN,
});
const UserRecording = pool.define('UserRecording', {
	is_favorite: Sequelize.BOOLEAN,
	is_checked: Sequelize.BOOLEAN,
});
const UserTrack = pool.define('UserTrack', {
	is_favorite: Sequelize.BOOLEAN,
	is_checked: Sequelize.BOOLEAN,
});

User.belongsToMany(Show, {
	through: UserShow,
	constraints: false
});
User.belongsToMany(Recording, {
	through: UserRecording,
	constraints: false
});
User.belongsToMany(Track, {
	through: UserTrack,
	constraints: false
});

//Show.belongsTo(Venue);
//Venue.hasMany(Show);

Recording.belongsTo(Show);
Show.hasMany(Recording);

Recording.belongsTo(Venue);
Venue.hasMany(Recording);

Track.belongsTo(Recording);
Recording.hasMany(Track);

//Show.belongsTo(Artist);
//Artist.hasMany(Show);
//Year.belongsTo(Artist);
//Artist.hasMany(Year);

module.exports = {
	User,
	Show,
	Recording,
	Venue,
	Track,
	//Artist,
	Year,
	UserShow,
	UserRecording,
	UserTrack,
	Sequelize,
	pool,
	sync(o) { return pool.sync(o); },
	redis
};
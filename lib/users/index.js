const models = require('../core/models.js');
//const { pool } = require('../core/db');
const bc = require('./bcrypt');

const flattenJoinArray = function(arr, childKey) {
	
	return arr.map((val) => {
		
		const child = val[childKey];
		
		delete val[childKey];
		
		return {
			...val, 
			...child
		};
	});
};

/**
 * check for existing user with email
 * create new user with hashed password
 */
exports.createUser = async function(username, email, plaintextPassword) {
	
	const existing = (await models.User.findOne({
		where: {email}
	}));
	
	if (existing) return null;
	
	const hashedPassword = await bc.hash(plaintextPassword, bc.saltRounds);
	
	return (await models.User.create({
		username,
		email,
		password: hashedPassword,
		is_admin: false,
	})).toJSON();
};

exports.getUserByAuth = async function(email, plaintextPassword) {
	
	let user = (await models.User.findOne({
		where: {email},
		attributes: ['id', 'username', 'email', 'password', 'is_admin'],
		include: [{
			model: models.Show,
			attributes: ['id'],
			through: {
				attributes: ['is_favorite', 'is_checked'],
			},
		}, {
			model: models.Track,
			attributes: ['id'],
			through: {
				attributes: ['is_favorite', 'is_checked'],
			},
		}, {
			model: models.Recording,
			attributes: ['id'],
			through: {
				attributes: ['is_favorite', 'is_checked'],
			},
		}],
	}));
	
	if (!user) return 'no user';
	
	user = user.toJSON();
	
	const isValidPass = await bc.compare(plaintextPassword, user.password);
	
	if (!isValidPass) return 'bad pass';
	
	user.Tracks = flattenJoinArray(user.Tracks, 'UserTrack');
	user.Shows = flattenJoinArray(user.Shows, 'UserShow');
	
	delete user.password;
	
	return user;
};

exports.updateUserList = async function(media_type, choice_type, user_id, media_id, val) {
	
	console.log('updateUserList media_type: ' + media_type + ' choice_type: ' + choice_type + ' media_id: ' + media_id + ' val: ' + val);
	
	let q_model, q_where;
	
	let choice_key = (choice_type === 'favorite') ? 'is_favorite' : 'is_checked';
	
	if (media_type === 'track') {
		q_model = models.UserTrack;
		q_where = {UserId: user_id, TrackId: media_id};
	} else if (media_type === 'recording') {
		q_model = models.UserRecording;
		q_where = {UserId: user_id, RecordingId: media_id};
	} else if (media_type === 'show') {
		q_model = models.UserShow;
		q_where = {UserId: user_id, ShowId: media_id};
	} else {
		return null;
	}
	
	console.log('updateUserList media_type: ' + media_type + ' choice_key: ' + choice_key, q_where);
	
	const existing = (await q_model.findOne({where: q_where}));
	
	if (existing) {
		
		return (await existing.set(choice_key, val).save());
		
	} else {
		
		q_where[choice_key] = val;
		
		return (await q_model.create(q_where));
	}
	return null; 
};

exports.fetchUser = async function (userId) {
	 return (await pool.query(
		'SELECT id, email FROM users WHERE id = ?',
		{replacements: [userId]}
	))[0];
};

exports.fetchUsers = async function (limit = 10, offset = 0) {
	return (await pool.query(
		'SELECT id, email FROM users LIMIT ? OFFSET ?',
		{replacements: [limit, offset]}
	));
};

/*
exports.createUser = async function(email, plaintextPassword) {
	const hashedPassword = await bc.hash(plaintextPassword, bc.saltRounds);
	return new Promise((resolve, reject) => {
		pool.query(
			'INSERT INTO users (email, password) VALUES (?, ?)',
			[email, hashedPassword],
			(error, results, fields) => {
				if (error) reject(error);
				resolve(results.insertId);
			}
		);
	});
};

exports.getUserByAuth = function(email, plaintextPassword) {
	return new Promise((resolve, reject) => {
		let user;
		pool.query(
			`SELECT * FROM users WHERE email = ?`,
			[email],
			async (error, results, fields) => {
				if (error) reject(error);
				user = results[0];
				if (!user) resolve(null);
				const isValidPass = await bc.compare(plaintextPassword, user.password);
				if (!isValidPass) resolve(null);
				resolve(user);
			}
		);
	});
};

exports.fetchUser = function (userId) {
	return new Promise((resolve, reject) => {
		pool.query(
			`SELECT id, email FROM users WHERE id = ?`,
			[userId],
			(error, results, fields) => {
				if (error) reject(error);
				resolve(results[0]);
			}
		);
	});
};

exports.fetchUsers = function (limit = 10, offset = 0) {
	return new Promise((resolve, reject) => {
		pool.query(
			`SELECT id, email FROM users LIMIT ? OFFSET ?`,
			[limit, offset],
			(error, results, fields) => {
				if (error) reject(error);
				resolve(results);
			}
		);
	});
};
*/

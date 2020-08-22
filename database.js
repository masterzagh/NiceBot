const fs = require('fs');
const bsqlite = require('better-sqlite3');

let db = new bsqlite('./users.db');

// Create migrations table if it doesn't already exist
db.exec(`
	CREATE TABLE IF NOT EXISTS migrations(
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		file VARCHAR(256)
	);
`);

// Make an index of already executed migrations
let migrations = db.prepare('SELECT * FROM migrations;').all();
let index = migrations.reduce((cum, migration) => {
	cum[migration.file] = true;
	return cum;
}, {});

// Run new migrations
fs.readdir('migrations', (err, f) => {
	if(err) return console.log('Error reading migrations');
	files = f.sort();
	files.forEach(file => {
		if(index[file]) return;


		let sql = fs.readFileSync('migrations/'+file, 'utf8');
		db.exec('BEGIN TRANSACTION;');
		db.exec(sql);
		db.exec(`INSERT INTO migrations(file) VALUES ('${file}');`);
		db.exec('COMMIT;');
		console.log(`Successfully ran migration '${file}'`);
	});

	if(db.onReady) db.onReady();
	else console.log('There is no db ready callback');
});

// Inner Utils
let db_dirty = false;
let saveTimeout = 60*1000;
function saveDatabase(){
	if(!db_dirty){
		console.log('[DB] Nothing to save');
		setTimeout(saveDatabase, saveTimeout);
		return;
	}

	console.log('[DB] Start save');
	DB_User.save();
	console.log('[DB] Finish save');

	db_dirty = false;
	setTimeout(saveDatabase, saveTimeout);
}
setTimeout(saveDatabase, saveTimeout);

// "Models"
const MAX_INT = 1000000000000000;
const MIN_INT = -1000000000000000;
function DB_COLUMNS(model, row){
	if(model.columns) return;
	model.columns = [];
	for(let i in row){
		model.columns.push(i);
	}
}
function DB_LIMITS(row){
	let innerValues = {};
	for(let i in row){
		innerValues[i] = row[i];
		if(typeof row[i] === "number"){
			Object.defineProperty(row, i, {
				enumerable: true,
				set: value => {
					if(value <= MIN_INT)
						innerValues[i] = MIN_INT;
					else if(value >= MAX_INT)
						innerValues[i] = MAX_INT;
					else
						innerValues[i] = value;
				},
				get: _ => innerValues[i]
			});
		}
	}
}
function DB_RESET(row, except, object){
	for(let i in row){
		if(typeof row[i] == "function" || except.includes(i)) continue;
		row[i] = object[i]?object[i]:null;
	}
}

function DB_User(row){
	DB_COLUMNS(DB_User, row);
	DB_LIMITS(row);

	row.reset = function(){
		DB_RESET(row, ['user_id'], {
			reset_times: row.reset_times+1
		});
		row.save();
	}
	row.save = function(){
		DB_User.dirty[row.user_id] = true;
		DB_User.isDirty = true;
		db_dirty = true;
	};
	row.sqlValues = function(){
		let values = [];
		DB_User.columns.forEach(c => values.push(row[c]+""));
		return `(${values.join(', ')})`;
	}

	return row;
}
DB_User.cache = {};
DB_User.dirty = {};
DB_User.isDirty = false;

DB_User.insertStmt = db.prepare(`
	INSERT INTO users(user_id, nice_points)
	VALUES (?, ?);
`);
DB_User.getStmt = db.prepare(`
	SELECT *
	FROM users
	WHERE user_id = ?;
`);
DB_User.getTopStmt = db.prepare(`
	SELECT *
	FROM users
	ORDER BY nice_points DESC
	LIMIT ?;
`);
DB_User.get = function(user_id){
	let user = DB_User.cache[user_id];
	if(user) return user;

	user = DB_User.getStmt.get(user_id);
	if(!user){
		DB_User.insertStmt.run(user_id, 100); // Start off with 100 points
		user = DB_User.getStmt.get(user_id);
	}

	user = new DB_User(user);
	DB_User.cache[user.user_id] = user;
	return user;
}
DB_User.getTop = function(limit){
	DB_User.save();
	let users = DB_User.getTopStmt.all(limit);
	users.map(user => new DB_User(user));
	return users;
}
DB_User.save = function(){
	if(!DB_User.isDirty) return;

	let values = [];
	for(let i in DB_User.dirty){
		let user = DB_User.cache[i];
		values.push(user.sqlValues());
	}
	DB_User.dirty = {};
	DB_User.isDirty = false;

	let sql = `REPLACE INTO users (${DB_User.columns.join(',')})\nVALUES\n${values.join(',\n')};`

	db.exec(sql);
}

// Utils
db.getUser = function(user_id){
	return DB_User.get(user_id);
};
db.getTopUsers = function(limit){
	return DB_User.getTop(limit);
};
db.save = function(){
	saveDatabase();
}

// Exports
module.exports.db = db;

const fs = require('fs');
const sqlite = require('sqlite3');

let db = new sqlite.Database('./users.db');
db.exec(`
	CREATE TABLE IF NOT EXISTS migrations(
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		file VARCHAR(256)
	);
`, error => {
	if(error) return console.error('Error creating migrations', error);
	db.all('SELECT * FROM migrations;', [], (err, rows) => {
		if(err) return console.error('Error reading migrations', error);
		let index = rows.reduce((cum, row) => {
			cum[row.file] = true;
			return cum;
		}, {});

		// Run migrations
		let files;
		function runMigrations(){
			let file = files.shift();
			if(!file){
				if(db.onReady) db.onReady();
				else console.log('There is no db ready callback');
				return;
			}
			if(index[file]) return setTimeout(runMigrations, 0);

			let sql = fs.readFileSync('migrations/'+file, 'utf8');
			db.exec(sql, error => {
				if(error) return console.error(`Error running migration '${file}'`, error);
				console.log(`Successfully ran migration '${file}'`);
				db.exec(`INSERT INTO migrations(file) VALUES ('${file}');`, error => {
					if(error) return console.error(`Error updating migrations table`, error);
					runMigrations();
				});
			});
		}
		fs.readdir('migrations', (err, f) => {
			if(err) return console.log('Error reading migrations');
			files = f.sort();
			runMigrations();
		});
	});
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
	let promises = [];
	promises.push(DB_User.save());
	Promise.all(promises).then(_ => {
		db_dirty = false;
		console.log('[DB] Finish save');
		setTimeout(saveDatabase, saveTimeout);
	});
}
setTimeout(saveDatabase, saveTimeout);

// "Model"
function DB_User(row){
	if(!DB_User.columns){
		DB_User.columns = [];
		for(let i in row){
			DB_User.columns.push(i);
		}
	}

	row.save = function(){
		DB_User.dirty[row.user_id] = true;
		DB_User.isDirty = true;
		db_dirty = true;
	};
	row.sqlValues = function(){
		let values = [];
		DB_User.columns.forEach(c => values.push(row[c]));
		return `(${values.join(', ')})`;
	}

	return row;
}
DB_User.cache = {};
DB_User.dirty = {};
DB_User.isDirty = false;
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

	return new Promise((succ, fail) => {
		db.exec(sql, err => {
			if(err) console.error('Error replacing into!', err, sql);
			succ();
		});
	});
}

// Utils
let defaultPoints = 100;
db.getUser = function(user_id){
	return new Promise((succ, fail) => {
		if(DB_User.cache[user_id]) return succ(DB_User.cache[user_id]);
		db.get(`SELECT * FROM users WHERE user_id = ${user_id};`, (error, row) => {
			if(error) return console.error('[DB] Failed to get user'); //fail(error);
			if(row === undefined){
				db.run(`
					INSERT INTO users(user_id, nice_points) VALUES
					(${user_id}, ${defaultPoints});
				`, (error) => {
					if(error) return fail(error);
					db.getUser(user_id).then(succ);
				});
			}else{
				let db_user = DB_User(row);
				DB_User.cache[db_user.user_id] = db_user;
				succ(DB_User(row));
			}
		})
	});
};


// Exports
module.exports.db = db;

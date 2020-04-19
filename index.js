require('dotenv').config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_ADMIN = process.env.BOT_ADMIN;
const BOT_PREFIX = process.env.BOT_PREFIX||"'";

const Discord = require('discord.js');
const client = new Discord.Client();
const commands = require('./commands.js').commands;
const db = require('./database.js').db;
commands.set({db, client, Discord});

db.onReady = function(){
	console.log('DB is ready!');
	client.on('ready', () => {
		console.log(`Logged in as ${client.user.tag}!`);
		commands.prefix = BOT_PREFIX;
	});

	client.on('message', msg => {
		if(msg.author.id != client.user.id)
			commands.run(msg.content, msg);
	});

	client.on('messageReactionAdd', (reaction, user) => {
		commands.react(reaction, user);
	});

	client.login(BOT_TOKEN);
};

process.on('SIGINT', _ => process.exit());
process.on('exit', e => {
	console.log('[DB] Saving before exit');
	db.save();
	db.close();
	db_closed = true;
});
process.on('uncaughtException', e => {
	console.error(e);
});

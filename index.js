require('dotenv').config();
let TOKEN = process.env.TOKEN;
let ADMIN = process.env.ADMIN;

const Discord = require('discord.js');
const client = new Discord.Client();
const commands = require('./commands.js').commands;
const db = require('./database.js').db;
commands.set({db, client, Discord});

db.onReady = function(){
	console.log('DB is ready!');
	client.on('ready', () => {
		console.log(`Logged in as ${client.user.tag}!`);
		commands.prefix = `'`;
	});

	client.on('message', msg => {
		if(msg.author.id != client.user.id)
			commands.run(msg.content, msg);
	});

	client.on('messageReactionAdd', (reaction, user) => {
		commands.react(reaction, user);
	});

	client.login(TOKEN);
};

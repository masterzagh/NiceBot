let fs = require('fs');

let db;
let client;
let Discord;
function Commands(){
	this.prefix = '!';
	this.commands = {};
	this.names = [];


	this.not_a_command = function(){};
	this.no_match = function(){};
	this.no_exist = function(){};

	this.add = function(name, run, help){
		this.commands[name] = {run, help};
		this.names.push(name);
	};
	this.list = function(){
		return this.names;
	}
	this.help = function(name){
		let command = this.commands[name];
		if(!command) return "This command does not exist!";
		return `\`\`\`\n${command.help()}\n\`\`\``;
	}

	this.run = function(content, object){
		if(!content.startsWith(this.prefix)) return this.not_a_command(object);
		let match = content.match(/'(.+?)( |$)/);
		if(!match || !match[1]) return this.no_match(object);

		let name = match[1];
		let args = content.split(/\s+/);
		args.shift();
		if(!this.commands[name]) return this.no_exist(object, name, args);
		this.commands[name].run(object, name, args);
	}

	this.react = function(reaction, user){
		let r = reactMessages[reaction.message.id];
		if (r &&
				r.emojis.includes(reaction.emoji.name) &&
				r.user_ids.includes(user.id)
			)
			r.run(reaction, user);
	}

	this.set = function(object){
		Discord = object.Discord;
		client = object.client;
		db = object.db;
	}
}

// Reactions
let reactMessages = {};
function awaitReactions(msg_id, user_ids, emojis, run){
	reactMessages[msg_id] = {user_ids, emojis, run};
}

// Session
let sessions = {};


// Utils
function baseEmbed(){
	return new Discord.MessageEmbed()
		.setColor('#fe72e9')
		.setTimestamp()
		.setFooter(' - from your nice friend', client.user.avatarURL());
}
function userEmbed(author){
 return baseEmbed()
	 .setAuthor(author.tag, author.avatarURL())
	 .setThumbnail(author.avatarURL());
}

// Add commands
let commands = new Commands();
commands.add('help', function(msg, name, args){
	let embed = baseEmbed();
	if(args[0]){
		if(args[0] == 'help'){
			return msg.channel.send('', {files:['images/help.gif']});
		}
		embed = embed
			.setTitle(`Command '${args[0]}'`)
			.setDescription(commands.help(args[0]));
	}else{
		let list = commands.list();
		list = `\`\`\`\n${list.join('\n')}\n\`\`\``;
		embed = embed
			.setTitle('Commands')
			.setDescription(list);
	}

	msg.channel.send(embed);
}, function(msg){
	// Empty for now
});
commands.add('nice', function(msg, name, args){
	db.getUser(msg.author.id).then(db_user => {
		db_user.nice_points += 10;
		db_user.save();
	});
	msg.channel.send("", {files: ['images/nice.gif']});
}, function(msg){
	return 'Nice.';
});
commands.add('points', function(msg, name, args){
	let user = msg.author;
	let mention = msg.mentions.users.first();
	if(args[0]){
		let match = args[0].match(/<@!?(\d+)>/);
		if(match && match[1] && mention && mention.id == match[1])
			user = mention;
	}
	db.getUser(user.id).then(db_user => {
		let embed = userEmbed(user)
			.addField('[NP] Nice Points', db_user.nice_points)
			.addField('Your action score', db_user.hugs+db_user.kisses, true)
			.addField('Your word score', db_user.nice_words-db_user.rude_words, true);

		msg.channel.send(embed);
	});
}, function(msg){
	return 'Check your points.';
});

commands.add('hug', function(msg, name, args){
	let author = msg.author;
	let originalMsg = msg;
	db.getUser(author.id).then(db_user => {
		db_user.hugs++;
		db_user.save();
		let embed = userEmbed(author)
			.addField('Total hugs', db_user.hugs, true)
			.addField('This session', sessions[originalMsg.id] = 1, true);

		msg.channel.send(embed).then(msg => {
			msg.react('🤗');
			awaitReactions(msg.id, [author.id], ['🤗'], (reaction, user) => {
				db.getUser(author.id).then(db_user => {
					db_user.hugs++;
					db_user.save();

					let embed = userEmbed(author)
						.addField('Total hugs', db_user.hugs, true)
						.addField('This session', ++sessions[originalMsg.id], true);

					msg.edit(embed);
				});
			});
		});

	});
}, function(msg){
	return 'Perform a nice hug.\nClick the hug reaction to give more than one hug.\nRemember to remove the reaction and add it again several times.';
});
commands.add('kiss', function(msg, name, args){
	let author = msg.author;
	let originalMsg = msg;
	db.getUser(author.id).then(db_user => {
		db_user.kisses++;
		db_user.save();
		let embed = userEmbed(author)
			.addField('Total kisses', db_user.kisses, true)
			.addField('This session', sessions[originalMsg.id] = 1, true);

		msg.channel.send(embed).then(msg => {
			msg.react('💋');
			awaitReactions(msg.id, [author.id], ['💋'], (reaction, user) => {
				db.getUser(author.id).then(db_user => {
					db_user.kisses++;
					db_user.save();

					let embed = userEmbed(author)
						.addField('Total kisses', db_user.kisses, true)
						.addField('This session', ++sessions[originalMsg.id], true);

					msg.edit(embed);
				});
			});
		});

	});
}, function(msg){
	return 'Perform a nice kiss.\nClick the kiss reaction to give more than one kiss.\nRemember to remove the reaction and add it again several times.';
});

let wordReactionTimeout = 15*60*1000;
let wordReactionTimeouts = {};
let maxWordPerMessage = 5;

let rude_words = fs.readFileSync('wordlists/rude.txt', 'utf8').split(/(\r\n|\r|\n)/);
let nice_words = fs.readFileSync('wordlists/nice.txt', 'utf8').split(/(\r\n|\r|\n)/);
let rude_map = rude_words.reduce((cum, word) => {
	if(!word.match(/^(|\r\n|\r|\n)$/))
		cum[word] = true;
	return cum;
}, {});
let nice_map = nice_words.reduce((cum, word) => {
	if(!word.match(/^(|\r\n|\r|\n)$/))
		cum[word] = true;
	return cum;
}, {});
let rude_regex = new RegExp(`(${rude_words.join('|')})`, 'gi');
let nice_regex = new RegExp(`(${nice_words.join('|')})`, 'gi');

let rude_reaction = [':(', 'That\'s not nice.'];
let nice_reaction = [':)', 'Nice message!'];
commands.not_a_command = function(msg){
	let words = msg.content.split(/\s+/);
	let rude_count = 0;
	let nice_count = 0;
	let count = 0;
	let level = 0;
	words.forEach(word => {
		if(nice_map[word]){
			level++;count++;
			if(nice_count<maxWordPerMessage)
				nice_count++;
		}
		if(rude_map[word]){
			level--;count++;
			if(rude_count<maxWordPerMessage)
				rude_count++;
		}
	});
	if(count>0){
		db.getUser(msg.author.id).then(db_user => {
			db_user.rude_words += rude_count;
			db_user.nice_words += nice_count;
			db_user.save();
		});

		let now = Date.now();
		if (wordReactionTimeouts[msg.author.id] &&
				wordReactionTimeouts[msg.author.id] > now)
			return;
		let content = "";
		if(level>0){
			level--;
			if(level>=nice_reaction.length) level = nice_reaction.length-1;
			content = nice_reaction[level];
		}else if(level<0){
			level = -level;
			level--;
			if(level>=rude_reaction.length) level = rude_reaction.length-1;
			content = rude_reaction[level];
		}
		if(content != ""){
			msg.channel.send(`<@${msg.author.id}> ${content}`);
			wordReactionTimeouts[msg.author.id] = now + wordReactionTimeout;
		}
	}
}
commands.no_match = function(msg){
	//console.log("no_exist", msg.content);
}
commands.no_exist = function(msg){
	//console.log("no_exist", msg.content);
}

// Exports
module.exports.commands = commands;
CREATE TABLE users(
	user_id VARCHAR(32) PRIMARY KEY,
	nice_points INT DEFAULT 0,
	hugs INT DEFAULT 0,
	kisses INT DEFAULT 0,
	nice_words INT DEFAULT 0,
	rude_words INT DEFAULT 0
);
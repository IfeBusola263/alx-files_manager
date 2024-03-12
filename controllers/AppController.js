import redisClient from '../utils/redis.js';
import dbClient from '../utils/db.js';

export default class AppController {
    static getStatus(req, res) {
	if (redisClient.isAlive() && dbClient.isAlive()) {
	    res.status(200).json({ "redis": true, "db": true });
	    return;
	} else {
	    res.status(500);
	}
    }

    static async getStats(req, res) {
	const numUsers = await dbClient.nbUsers();
	const numFiles = await dbClient.nbFiles();
	res.status(200).json({ "users": numUsers, "files": numFiles });
    }
}

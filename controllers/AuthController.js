import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class AuthController {
  static async getConnect(req, res) {
    const authValue = req.get('Authorization').split(' ')[1];
    const decodedAuth = Buffer.from(authValue, 'base64').toString('ascii');
    console.log(decodedAuth);
    const [email, password] = decodedAuth.split(':');
    console.log(`This is the email -> ${email} and Password ${password}`);

    const userInfo = await dbClient.db.collection('users').findOne({ email });
    if (!userInfo) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (userInfo.password !== sha1(password)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = uuidv4();
    const redisKey = `auth_${token}`;
    const userId = userInfo._id.toString();

    // expiration is 24 hours, which must be converted to seconds
    const expiration = 86400;
    await redisClient.set(redisKey, userId, expiration);
    res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.get('X-Token');
    const userRedisToken = `auth_${token}`;
    const userId = await redisClient.get(userRedisToken);

    if (userId) {
      await redisClient.del(userRedisToken);
      res.status(204).json(' ');
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }
}

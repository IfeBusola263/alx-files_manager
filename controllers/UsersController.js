import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return;
    } if (!password) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }

    const mailCheck = await dbClient.db.collection('users').findOne({ email });

    if (mailCheck) {
      res.status(400).json({ error: 'Already exist' });
      return;
    }

    const hashedPass = sha1(password);
    await dbClient.db.collection('users')
      .insertOne({ email, password: hashedPass }, (err, result) => {
        if (err) {
          console.log(err);
        } else {
          const id = result.insertedId;
          res.status(201).json({ id, email });
        }
      });
  }

  static async getMe(req, res) {
    const token = req.get('X-Token');
    const userRedisToken = `auth_${token}`;
    const userId = await redisClient.get(userRedisToken);

    if (userId) {
      const userDbInfo = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
      res.status(200).json({ id: userId, email: userDbInfo.email });
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }
}

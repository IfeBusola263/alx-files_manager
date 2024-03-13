import sha1 from 'sha1';
import dbClient from '../utils/db';

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
}

import { MongoClient } from 'mongodb';

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const database = process.env.DB_DATABASE || 'files_manager';
const url = `mongodb://${host}:${port}`;

class DBClient {
  constructor() {
    this.client = new MongoClient(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
      })
      .catch((err) => {
        console.log(err);
      });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    const userCollections = this.db.collection('users');
    const numDocs = await userCollections.countDocuments();
    return numDocs;
  }

  async nbFiles() {
    const fileCollections = this.db.collection('files');
    const numFiles = await fileCollections.countDocuments();
    return numFiles;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;

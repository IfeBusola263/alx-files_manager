import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    this.host = process.env.DB_HOST || 'localhost';
    this.port = process.env.DB_PORT || 27017;
    this.database = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${this.host}:${this.port}`;
    this.client = new MongoClient(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }

  isAlive() {
    try {
      this.client.connect();
      return true;
    } catch (err) {
      return false;
    }
  }

  async nbUsers() {
    // try {
    await this.client.connect();
    const db = this.client.db(this.database);
    const userCollections = db.collections('users');
    const numDocs = await userCollections.countDocuments({});
    return numDocs;
    // } catch(error) {
    //     console.log(error);
    // }
  }

  async nbFiles() {
    // try {
    await this.client.connect();
    const db = this.client.db(this.database);
    const fileCollections = db.collections('files');
    const numFiles = await fileCollections.countDocuments({});
    return numFiles;
    // } catch(error) {
    //     console.log(error);
    // }
  }
}

const dbClient = new DBClient();
module.exports = dbClient;

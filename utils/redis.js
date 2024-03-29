import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.client
      .on('error', (err) => console.log(err));
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    const getter = promisify(this.client.get).bind(this.client);
    const value = await getter(key);
    return value;
  }

  async set(key, value, expiration) {
    const setter = promisify(this.client.set).bind(this.client);
    await setter(key, value, 'EX', expiration);
  }

  async del(key) {
    const deleter = promisify(this.client.del).bind(this.client);
    await deleter(key);
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;

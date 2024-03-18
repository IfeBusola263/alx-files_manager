import { ObjectId } from 'mongodb';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const typeList = ['folder', 'file', 'image'];
const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';

export default class FilesController {
  static async postUpload(req, res) {
    const token = req.get('X-Token');
    const userRedisKey = `auth_${token}`;
    const userId = await redisClient.get(userRedisKey);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userObjId = new ObjectId(userId);
    const {
      name, type, parentId, isPublic, data,
    } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Missing name' });
      return;
    }

    if (!type || !typeList.includes(type)) {
      res.status(400).json({ error: 'Missing type' });
      return;
    }

    if (!data && type !== 'folder') {
      res.status(400).json({ error: 'Missing data' });
      return;
    }

    if (parentId) {
      const fileInfo = await dbClient.db.collection('files').findOne({ _id: new ObjectId(parentId) });
      if (!fileInfo) {
        res.status(400).json({ error: 'Parent not found' });
        return;
      }

      if (fileInfo.type !== 'folder') {
        res.status(400).json({ error: 'Parent is not a folder' });
        return;
      }
    }

    if (type === 'folder') {
      const newFolderInfo = {
        userId: userObjId,
        name,
        type,
        parentId: parentId || 0,
        isPublic: false,
      };

      await dbClient.db.collection('files').insertOne(newFolderInfo);
      const folder = await dbClient.db.collection('files').findOne({ name, userId: userObjId });
      folder.id = folder._id;
      delete folder._id;
      res.status(201).json(folder);
      return;
    }

    if (!fs.existsSync(filePath)) fs.mkdirSync(filePath, { recursive: true });

    const storedData = Buffer.from(data, 'base64').toString('ascii');
    const pathToFile = `${filePath}/${uuidv4()}`;
    fs.writeFile(pathToFile, storedData, 'utf8', (err) => {
      if (err) {
        console.log(err);
      }
    });

    const fileInfo = {
      userId: userObjId,
      name,
      type,
      localPath: pathToFile,
      isPublic: isPublic || false,
      parentId: parentId || 0,
    };

    await dbClient.db.collection('files').insertOne(fileInfo);
    const storedInfo = await dbClient.db.collection('files').findOne({ name });
    storedInfo.id = storedInfo._id;
    delete storedInfo._id;
    delete storedInfo.localPath;
    res.status(201).json(storedInfo);
  }
}

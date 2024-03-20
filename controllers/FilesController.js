/* eslint-disable no-new-object */
/* eslint-disable no-param-reassign */
import { ObjectId } from 'mongodb';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
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
        parentId: parentId ? new ObjectId(parentId) : 0,
      };

      await dbClient.db.collection('files').insertOne(newFolderInfo);
      const folder = await dbClient.db.collection('files').findOne({ name, userId: userObjId });
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
      isPublic: isPublic || false,
      parentId: parentId ? new ObjectId(parentId) : 0,
      localPath: pathToFile,
    };

    await dbClient.db.collection('files').insertOne(fileInfo);
    const storedInfo = await dbClient.db.collection('files').findOne({ name });
    delete storedInfo.localPath;
    res.status(201).json(storedInfo);
  }

  static async getShow(req, res) {
    const { id } = req.params;
    const token = req.get('X-Token');
    const userRedisKey = `auth_${token}`;
    const userId = await redisClient.get(userRedisKey);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const idObj = new ObjectId(id);
    const userInfo = await dbClient.db.collection('files').findOne({ _id: idObj });

    if (!userInfo || userInfo.userId.toString() !== userId) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    delete userInfo.localPath;
    const { _id, ...rest } = userInfo;
    res.status(200).json({ id: _id, ...rest });
  }

  static async getIndex(req, res) {
    const token = req.get('X-Token');
    const userRedisKey = `auth_${token}`;
    const userId = await redisClient.get(userRedisKey);
    const pageSize = 20;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { parentId, page } = req.query;

    if (parentId) {
      if (page) {
        const start = (page - 1) * pageSize;
        // const end = start + pageSize;

        const pipeline = [
          { $match: { parentId } },
          { $skip: start },
          { $limit: pageSize },
        ];

        const files = await dbClient.db.collection('files').aggregate(pipeline).toArray();
        res.status(200).json(files);
        return;
      }

      const parentObjId = new ObjectId(parentId);
      const files = await dbClient.db.collection('files').find({ parentId: parentObjId });
      const filesList = await files.toArray();
      filesList.forEach((file) => {
        delete file.localPath;
        // file.id = file._id;
        // delete file._id;
      });
      const dataToSend = filesList.map((obj) => {
        const { _id, ...rest } = obj;
        return { id: _id, ...rest };
      });
      res.status(200).json(dataToSend);
      return;
    }

    const allFiles = await dbClient.db.collection('files').find();
    const allFilesList = await allFiles.toArray();
    allFilesList.forEach((fileObj) => {
      delete fileObj.localPath;
      // fileObj.id = fileObj._id;
      // delete fileObj._id;
    });
    const dataToSend = allFilesList.map((obj) => {
      const { _id, ...rest } = obj;
      return { id: _id, ...rest };
    });
    res.status(200).json(dataToSend);
  }

  static async putPublish(req, res) {
    const token = req.get('X-Token');
    const userRedisKey = `auth_${token}`;
    const userId = await redisClient.get(userRedisKey);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const idObj = new ObjectId(id);
    const userObjId = new ObjectId(userId);

    const fileInfo = await dbClient.db.collection('files').findOne({ _id: idObj, userId: userObjId });
    if (!fileInfo) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await dbClient.db.collection('files').updateOne(
      { _id: idObj },
      { $set: { isPublic: true } },
    );

    const storedInfo = await dbClient.db.collection('files').findOne({ _id: idObj });
    delete storedInfo.localPath;
    res.status(200).json(storedInfo);
  }

  static async putUnpublish(req, res) {
    const token = req.get('X-Token');
    const userRedisKey = `auth_${token}`;
    const userId = await redisClient.get(userRedisKey);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const idObj = new ObjectId(id);
    const userObjId = new ObjectId(userId);

    const fileInfo = await dbClient.db.collection('files').findOne({ _id: idObj, userId: userObjId });
    if (!fileInfo) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await dbClient.db.collection('files').updateOne(
      { _id: idObj },
      { $set: { isPublic: false } },
    );

    const storedInfo = await dbClient.db.collection('files').findOne({ _id: idObj });
    delete storedInfo.localPath;
    res.status(200).json(storedInfo);
  }

  static async getFile(req, res) {
    const token = req.get('X-Token');
    const userRedisKey = `auth_${token}`;
    const userId = await redisClient.get(userRedisKey);
    console.log(userId);
    const { id } = req.params;
    const idObj = new ObjectId(id);

    const fileInfo = await dbClient.db.collection('files').findOne({ _id: idObj });

    if (!fileInfo) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // if (fileInfo.isPublic === false && !userId) {
    //   res.status(404).json({ error: 'Not found' });
    //   return;
    // }

    if (fileInfo.type === 'folder') {
      res.status(400).json({ error: "A folder doesn't have content" });
      return;
    }

    if (fileInfo.isPublic === false && fileInfo.userId !== userId) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (!fs.existsSync(fileInfo.localPath)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const mimeType = mime.contentType(fileInfo.name);
    fs.readFile(fileInfo.localPath, 'utf8', (err, data) => {
      if (err) {
        console.log(err);
        return;
      }
      res.setHeader('Content-Type', mimeType);
      res.status(200).send(data);
    });
  }
}

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const logger = require('./logger');

let memoryServer;

async function connectDB() {
  const preferredUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/screenstream';

  try {
    await mongoose.connect(preferredUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    logger.warn(`MongoDB unavailable at ${preferredUri}. Falling back to in-memory MongoDB.`);
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'screenstream',
      },
    });

    await mongoose.connect(memoryServer.getUri(), {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected using in-memory server');
  }

  mongoose.connection.on('error', (error) => {
    logger.error(`MongoDB error: ${error.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
}

module.exports = connectDB;

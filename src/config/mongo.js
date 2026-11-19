// src/config/mongo.js
import mongoose from 'mongoose';
import { ENV } from './env.js';
import { logger } from '../utils/logger.js';

export const connectMongo = async () => {
  const mongoUri = process.env.MONGO_URI || ENV.MONGO_URI || '';
  if (!mongoUri) {
    logger.warn('MongoDB URI not provided – incident report export will not work.');
    return;
  }
  try {
    await mongoose.connect(mongoUri, {
      // useNewUrlParser, useUnifiedTopology are defaults in Mongoose 7+
    });
    logger.info('✅ MongoDB connected');
  } catch (err) {
    logger.error('❌ MongoDB connection error:', err.message);
  }
};
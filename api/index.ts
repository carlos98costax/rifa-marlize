import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://carlos98costa:1234567890@cluster0.mongodb.net/sistema_rifa?retryWrites=true&w=majority';

// Connect to MongoDB with retry logic
async function connectDB() {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      if (mongoose.connection.readyState === 0) {
        console.log(`Attempting to connect to MongoDB (attempt ${retryCount + 1}/${maxRetries})...`);
        
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          family: 4,
          maxPoolSize: 10,
          minPoolSize: 5,
          maxIdleTimeMS: 10000,
          connectTimeoutMS: 10000,
          heartbeatFrequencyMS: 10000,
          retryWrites: true,
          retryReads: true,
          autoIndex: true,
          autoCreate: true
        });

        console.log('MongoDB connected successfully to sistema_rifa database');
        return;
      }
      return;
    } catch (error) {
      retryCount++;
      console.error(`MongoDB connection attempt ${retryCount} failed:`, error);
      
      if (retryCount === maxRetries) {
        throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
}

// Connect to MongoDB
connectDB().catch(err => console.error('MongoDB connection error:', err));

// Import routes
import numbersRouter from './numbers.js';

// Use routes
app.use('/api', numbersRouter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    database: mongoose.connection.db.databaseName
  });
});

export default app; 
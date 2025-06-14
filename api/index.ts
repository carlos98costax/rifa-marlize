import app from './numbers.js';
import mongoose from 'mongoose';

// Initialize MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://carlos98costa:1234567890@cluster0.mongodb.net/rifa?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Export the Express app for Vercel
export default app; 
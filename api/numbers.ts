import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://carlos98costa:1234567890@cluster0.mongodb.net/rifa?retryWrites=true&w=majority';

// Number Schema
const numberSchema = new mongoose.Schema({
  number: { type: Number, required: true, unique: true },
  isAvailable: { type: Boolean, default: true },
  purchasedBy: { type: String, default: null },
  purchaseDate: { type: Date, default: null }
});

// Create model if it doesn't exist
const NumberModel = mongoose.models.Number || mongoose.model('Number', numberSchema);

// Initialize numbers if collection is empty
async function initializeNumbers() {
  try {
    const count = await NumberModel.countDocuments();
    if (count === 0) {
      const numbers = Array.from({ length: 400 }, (_, i) => ({
        number: i + 1,
        isAvailable: true,
        purchasedBy: null,
        purchaseDate: null
      }));
      await NumberModel.insertMany(numbers);
      console.log('Numbers initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing numbers:', error);
  }
}

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

        console.log('MongoDB connected successfully');
        await initializeNumbers();
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

// Middleware to ensure database connection
async function ensureConnection(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      error: 'Database connection error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

// Apply connection middleware to all routes
app.use(ensureConnection);

// Routes
app.get('/api/numbers', async (req, res) => {
  try {
    const numbers = await NumberModel.find().sort({ number: 1 });
    res.json(numbers);
  } catch (error) {
    console.error('Error fetching numbers:', error);
    res.status(500).json({
      error: 'Error fetching numbers',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/numbers/purchase', async (req, res) => {
  try {
    const { number, name } = req.body;

    if (!number || !name) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Number and name are required',
        timestamp: new Date().toISOString()
      });
    }

    const numberDoc = await NumberModel.findOne({ number });

    if (!numberDoc) {
      return res.status(404).json({
        error: 'Number not found',
        message: `Number ${number} does not exist`,
        timestamp: new Date().toISOString()
      });
    }

    if (!numberDoc.isAvailable) {
      return res.status(400).json({
        error: 'Number not available',
        message: `Number ${number} is already purchased`,
        timestamp: new Date().toISOString()
      });
    }

    numberDoc.isAvailable = false;
    numberDoc.purchasedBy = name;
    numberDoc.purchaseDate = new Date();
    await numberDoc.save();

    res.json({
      message: 'Number purchased successfully',
      number: numberDoc,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error purchasing number:', error);
    res.status(500).json({
      error: 'Error purchasing number',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        state: dbState,
        connected: dbState === 1,
        stateName: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown',
        uri: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') // Hide credentials
      }
    };
    res.json(status);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err instanceof Error ? err.message : 'Unknown error',
    timestamp: new Date().toISOString()
  });
});

export default app; 
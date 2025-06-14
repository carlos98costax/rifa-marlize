import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://carlos98costa:1234567890@cluster0.mongodb.net/rifa?retryWrites=true&w=majority';

// Number Schema
interface INumber {
  number: number;
  isAvailable: boolean;
  purchasedBy: string | null;
  purchaseDate: Date | null;
}

const numberSchema = new mongoose.Schema<INumber>({
  number: { type: Number, required: true, unique: true },
  isAvailable: { type: Boolean, default: true },
  purchasedBy: { type: String, default: null },
  purchaseDate: { type: Date, default: null }
});

// Create model if it doesn't exist
const NumberModel = mongoose.models.Number || mongoose.model<INumber>('Number', numberSchema);

// Initialize numbers if collection is empty
async function initializeNumbers(): Promise<void> {
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
async function connectDB(): Promise<void> {
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
async function ensureConnection(_req: Request, res: Response, next: NextFunction): Promise<void> {
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
app.get('/api/numbers', async (_req: Request, res: Response): Promise<void> => {
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

app.post('/api/numbers/purchase', async (req: Request, res: Response): Promise<void> => {
  try {
    const { numbers, buyer, password } = req.body;

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Numbers array is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!buyer || typeof buyer !== 'string' || buyer.trim() === '') {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Buyer name is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Password is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if all numbers are available
    const numberDocs = await NumberModel.find({ number: { $in: numbers } });
    
    if (numberDocs.length !== numbers.length) {
      res.status(400).json({
        error: 'Invalid numbers',
        message: 'Some numbers do not exist',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const unavailableNumbers = numberDocs.filter(doc => !doc.isAvailable);
    if (unavailableNumbers.length > 0) {
      res.status(400).json({
        error: 'Numbers not available',
        message: `Numbers ${unavailableNumbers.map(n => n.number).join(', ')} are already purchased`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Update all numbers
    const now = new Date();
    const buyerName = buyer.trim();

    // Update each number individually to ensure atomicity
    for (const number of numbers) {
      await NumberModel.findOneAndUpdate(
        { number },
        {
          $set: {
            isAvailable: false,
            purchasedBy: buyerName,
            purchaseDate: now
          }
        },
        { new: true }
      );
    }

    // Fetch updated numbers
    const updatedNumbers = await NumberModel.find().sort({ number: 1 });

    res.json({
      message: 'Numbers purchased successfully',
      numbers: numbers,
      buyer: buyerName,
      purchaseDate: now,
      timestamp: new Date().toISOString(),
      updatedNumbers: updatedNumbers
    });
  } catch (error) {
    console.error('Error purchasing numbers:', error);
    res.status(500).json({
      error: 'Error purchasing numbers',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response): Promise<void> => {
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
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

export default app; 
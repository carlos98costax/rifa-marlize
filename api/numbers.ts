import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

const router = express.Router();

// Middleware
router.use(cors());
router.use(express.json());

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

// Initialize numbers on startup
initializeNumbers();

// Routes
router.get('/numbers', async (_req: Request, res: Response): Promise<void> => {
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

router.post('/numbers/purchase', async (req: Request, res: Response): Promise<void> => {
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
    await NumberModel.updateMany(
      { number: { $in: numbers } },
      {
        $set: {
          isAvailable: false,
          purchasedBy: buyer.trim(),
          purchaseDate: now
        }
      }
    );

    res.json({
      message: 'Numbers purchased successfully',
      numbers: numbers,
      buyer: buyer.trim(),
      purchaseDate: now,
      timestamp: new Date().toISOString()
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
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
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
router.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

export default router; 
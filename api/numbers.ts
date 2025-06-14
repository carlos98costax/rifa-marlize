import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

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
const connectWithRetry = async (): Promise<void> => {
  try {
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
    console.log('Connected to MongoDB');
    await initializeNumbers();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
}

connectWithRetry();

// Middleware to ensure database connection
const ensureConnection = async (_req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectWithRetry();
      next();
    } catch (error) {
      console.error('Database connection error:', error);
      res.status(500).json({ error: 'Database connection error' });
    }
  } else {
    next();
  }
}

// Apply middleware to all routes
app.use(ensureConnection);

// Routes
app.get('/api/numbers', async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const numbers = await NumberModel.find().sort({ number: 1 });
    res.json(numbers);
  } catch (error) {
    console.error('Error fetching numbers:', error);
    res.status(500).json({ error: 'Error fetching numbers' });
  }
});

app.post('/api/numbers/purchase', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { numbers, buyerName, password } = req.body

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      res.status(400).json({ error: 'Números inválidos' });
      return;
    }

    if (!buyerName || typeof buyerName !== 'string' || buyerName.trim().length === 0) {
      res.status(400).json({ error: 'Nome do comprador é obrigatório' });
      return;
    }

    if (!password || password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: 'Senha inválida' });
      return;
    }

    // Verificar se os números estão disponíveis
    const existingNumbers = await NumberModel.find({ number: { $in: numbers } });
    const unavailableNumbers = existingNumbers.filter(n => !n.isAvailable);
    
    if (unavailableNumbers.length > 0) {
      res.status(400).json({ 
        error: 'Alguns números já foram vendidos',
        unavailableNumbers: unavailableNumbers.map(n => n.number)
      });
      return;
    }

    // Atualizar os números
    const updatePromises = numbers.map(number => 
      NumberModel.findOneAndUpdate(
        { number },
        { 
          isAvailable: false,
          purchasedBy: buyerName.trim(),
          purchaseDate: new Date()
        },
        { new: true }
      )
    );

    const updatedNumbers = await Promise.all(updatePromises);

    // Buscar todos os números atualizados
    const allNumbers = await NumberModel.find().sort({ number: 1 });

    res.json({
      message: 'Números comprados com sucesso',
      purchasedNumbers: updatedNumbers,
      allNumbers: allNumbers
    });
  } catch (error) {
    console.error('Error purchasing numbers:', error);
    res.status(500).json({ error: 'Erro ao comprar números' });
  }
});

// Health check endpoint
app.get('/api/health', (_req: express.Request, res: express.Response): void => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction): void => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

export default app; 
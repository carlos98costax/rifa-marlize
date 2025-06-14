import express from 'express';
import mongoose from 'mongoose';
import { config } from 'dotenv';
import cors from 'cors';

// Carrega as variáveis de ambiente
config();

const app = express();

// Configuração do CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://rifa-marlizee.vercel.app', 'https://www.rifa-marlizee.vercel.app']
    : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Garante que todas as respostas sejam JSON
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://carlos98costa:1234567890@cluster0.mongodb.net/rifa?retryWrites=true&w=majority';

let isConnected = false;
let connectionPromise: Promise<typeof mongoose> | null = null;

async function connectToDatabase() {
  if (isConnected) {
    console.log('Using existing database connection');
    return;
  }

  if (connectionPromise) {
    console.log('Connection already in progress, waiting...');
    return connectionPromise;
  }

  try {
    console.log('Connecting to MongoDB...');
    connectionPromise = mongoose.connect(MONGODB_URI, {
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
    });

    const conn = await connectionPromise;
    isConnected = true;
    console.log('MongoDB connected successfully');
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    connectionPromise = null;
    isConnected = false;
    throw error;
  }
}

// Middleware to check MongoDB connection
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      error: 'Database connection error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// Modelo do MongoDB
interface INumber {
  id: number;
  buyer: string;
  selected: boolean;
}

const numberSchema = new mongoose.Schema<INumber>({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  buyer: {
    type: String,
    default: ''
  },
  selected: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Define o modelo antes de qualquer uso
const NumberModel = mongoose.model<INumber>('Number', numberSchema);

// Routes
app.get('/api/numbers', async (req, res) => {
  try {
    const numbers = await NumberModel.find().sort({ id: 1 });
    res.json(numbers);
  } catch (error) {
    console.error('Error fetching numbers:', error);
    res.status(500).json({
      error: 'Error fetching numbers',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
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

    const numberDoc = await NumberModel.findOne({ id: number });

    if (!numberDoc) {
      return res.status(404).json({
        error: 'Number not found',
        message: `Number ${number} does not exist`,
        timestamp: new Date().toISOString()
      });
    }

    if (!numberDoc.selected) {
      return res.status(400).json({
        error: 'Number not available',
        message: `Number ${number} is already purchased`,
        timestamp: new Date().toISOString()
      });
    }

    numberDoc.buyer = name;
    numberDoc.selected = false;
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
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
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
      environment: process.env.NODE_ENV || 'development',
      database: {
        state: dbState,
        connected: dbState === 1,
        stateName: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown'
      }
    };
    res.json(status);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err instanceof Error ? err.message : 'Unknown error',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Garante que todas as respostas sejam JSON
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

export default app; 
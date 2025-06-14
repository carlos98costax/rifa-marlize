import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// MongoDB connection with retry logic
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://carlos98costa:1234567890@cluster0.mongodb.net/rifa?retryWrites=true&w=majority';

const connectWithRetry = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
};

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
};

// Apply middleware to all routes
app.use(ensureConnection);

// Get all numbers
app.get('/api/numbers', async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const numbers = await Number.find().sort({ number: 1 });
    res.json(numbers);
  } catch (error) {
    console.error('Error fetching numbers:', error);
    res.status(500).json({ error: 'Error fetching numbers' });
  }
});

// Purchase numbers
app.post('/api/numbers/purchase', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { numbers, buyerName, password } = req.body;

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
    const existingNumbers = await Number.find({ number: { $in: numbers } });
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
      Number.findOneAndUpdate(
        { number },
        { 
          isAvailable: false,
          purchasedBy: buyerName.trim(),
          purchasedAt: new Date()
        },
        { new: true }
      )
    );

    const updatedNumbers = await Promise.all(updatePromises);

    // Buscar todos os números atualizados
    const allNumbers = await Number.find().sort({ number: 1 });

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

export default app; 
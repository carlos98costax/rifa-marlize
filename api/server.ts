import express, { Request, Response, NextFunction } from 'express';
import mongoose, { Document, Model, Schema } from 'mongoose';
import cors from 'cors';
import { config } from 'dotenv';
import * as yup from 'yup';

// Carrega as variáveis de ambiente
config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Conexão com MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI não está definida nas variáveis de ambiente');
  process.exit(1);
}

// Modelo do MongoDB
interface INumber {
  number: number;
  isSelected: boolean;
  selectedAt?: Date;
}

// Create the Number model
const numberSchema = new Schema<INumber>({
  number: { type: Number, required: true, unique: true },
  isSelected: { type: Boolean, default: false },
  selectedAt: { type: Date }
});

const NumberModel = mongoose.model<INumber>('Number', numberSchema);

// Validation schema
const numberValidationSchema: yup.ObjectSchema<any> = yup.object().shape({
  number: yup.number().required().min(1).max(100)
});

// Middleware para verificar senha administrativa
const checkAdminPassword = (req, res, next) => {
  const adminPassword = req.headers['x-admin-password'];
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Senha administrativa inválida' });
  }
  next();
};

// Conecta ao MongoDB antes de iniciar o servidor
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB');

    // Inicializa os números se a coleção estiver vazia
    const count = await NumberModel.countDocuments();
    if (count === 0) {
      console.log('Inicializando números no MongoDB...');
      const numbers = Array.from({ length: 400 }, (_, i) => ({
        number: i + 1,
        isSelected: false
      }));
      await NumberModel.insertMany(numbers);
      console.log('Números inicializados com sucesso');
    }
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
}

// Rotas
app.get('/api/numbers', async (req: Request, res: Response) => {
  try {
    const numbers = await NumberModel.find().sort({ number: 1 });
    res.json(numbers);
  } catch (error) {
    console.error('Erro ao buscar números:', error);
    res.status(500).json({ error: 'Erro ao buscar números' });
  }
});

app.post('/api/purchase', async (req: Request, res: Response) => {
  try {
    const { numbers, buyer, password } = req.body;
    
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'Números inválidos' });
    }
    
    if (!buyer || typeof buyer !== 'string' || buyer.trim() === '') {
      return res.status(400).json({ error: 'Nome do comprador é obrigatório' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Senha de verificação é obrigatória' });
    }

    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Senha de verificação incorreta' });
    }

    // Verifica se algum número já foi vendido
    const soldNumbers = await NumberModel.find({
      number: { $in: numbers },
      isSelected: true
    });

    if (soldNumbers.length > 0) {
      return res.status(400).json({
        error: 'Alguns números já foram vendidos',
        soldNumbers: soldNumbers.map(n => n.number)
      });
    }

    // Atualiza os números
    await NumberModel.updateMany(
      { number: { $in: numbers } },
      { 
        $set: { 
          isSelected: true,
          selectedAt: new Date()
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao processar compra:', error);
    res.status(500).json({ error: 'Erro ao processar compra' });
  }
});

// Endpoint administrativo
app.get('/api/admin/numbers', checkAdminPassword, async (req: Request, res: Response) => {
  try {
    const { buyer, selected } = req.query;
    let query: { buyer?: string; isSelected?: boolean } = {};

    if (buyer) {
      query.buyer = buyer as string;
    }
    if (selected !== undefined) {
      query.isSelected = selected === 'true';
    }

    const numbers = await NumberModel.find(query).sort({ number: 1 });
    
    // Estatísticas
    const total = await NumberModel.countDocuments();
    const sold = await NumberModel.countDocuments({ isSelected: true });
    const available = await NumberModel.countDocuments({ isSelected: false });
    
    res.json({
      numbers,
      stats: {
        total,
        sold,
        available,
        revenue: sold * 20 // R$ 20 por número
      }
    });
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Get selected numbers
app.get('/api/selected', async (_req: Request, res: Response) => {
  try {
    const selectedNumbers = await NumberModel.find({ isSelected: true })
      .sort({ selectedAt: 1 });
    res.json(selectedNumbers);
  } catch (error) {
    console.error('Error fetching selected numbers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset all numbers
app.post('/api/reset', async (_req: Request, res: Response) => {
  try {
    await NumberModel.updateMany(
      { isSelected: true },
      { $set: { isSelected: false, selectedAt: null } }
    );
    res.json({ message: 'All numbers have been reset' });
  } catch (error) {
    console.error('Error resetting numbers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Inicia o servidor apenas em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  connectDB().then(() => {
    app.listen(port, () => {
      console.log(`Servidor rodando na porta ${port}`);
    });
  });
}

// Conecta ao MongoDB em produção
if (process.env.NODE_ENV === 'production') {
  connectDB();
}

// Exporta o app para o Vercel
export default app; 
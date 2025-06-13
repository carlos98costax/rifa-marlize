import express from 'express';
import mongoose from 'mongoose';
import { config } from 'dotenv';

// Carrega as variáveis de ambiente
config();

const app = express();
app.use(express.json());

// Conexão com MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI não está definida nas variáveis de ambiente');
  process.exit(1);
}

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

// Conecta ao MongoDB
async function connectDB() {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('Já conectado ao MongoDB');
      return;
    }

    console.log('Tentando conectar ao MongoDB...');
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5,
      retryWrites: true,
      retryReads: true
    });
    
    console.log('Conectado ao MongoDB com sucesso');

    // Inicializa os números se a coleção estiver vazia
    const count = await NumberModel.countDocuments();
    console.log(`Número de documentos na coleção: ${count}`);
    
    if (count === 0) {
      console.log('Inicializando números no MongoDB...');
      const numbers = Array.from({ length: 400 }, (_, i) => ({
        id: i + 1,
        buyer: '',
        selected: false
      }));
      await NumberModel.insertMany(numbers);
      console.log('Números inicializados com sucesso');
    }
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    throw error;
  }
}

// Middleware para verificar conexão
app.use(async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('Estado da conexão MongoDB:', mongoose.connection.readyState);
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('Erro ao reconectar ao MongoDB:', error);
    res.status(500).json({ 
      error: 'Erro de conexão com o banco de dados',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Rotas
app.get('/api/numbers', async (req, res) => {
  try {
    console.log('Buscando números...');
    const numbers = await NumberModel.find().sort({ id: 1 });
    console.log(`Encontrados ${numbers.length} números`);
    res.json(numbers);
  } catch (error) {
    console.error('Erro ao buscar números:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar números',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/api/numbers/purchase', async (req, res) => {
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
      id: { $in: numbers },
      buyer: { $ne: '' }
    });

    if (soldNumbers.length > 0) {
      return res.status(400).json({
        error: 'Alguns números já foram vendidos',
        soldNumbers: soldNumbers.map(n => n.id)
      });
    }

    // Atualiza os números
    await NumberModel.updateMany(
      { id: { $in: numbers } },
      { 
        $set: { 
          buyer: buyer.trim(),
          selected: true
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao processar compra:', error);
    res.status(500).json({ 
      error: 'Erro ao processar compra',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Inicializa a conexão com o MongoDB
connectDB().catch(error => {
  console.error('Falha ao conectar ao MongoDB:', error);
});

export default app; 
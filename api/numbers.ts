import express from 'express';
import mongoose from 'mongoose';
import { config } from 'dotenv';

// Carrega as variáveis de ambiente
config();

const router = express.Router();

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

const Number = mongoose.model<INumber>('Number', numberSchema);

// Conecta ao MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB');

    // Inicializa os números se a coleção estiver vazia
    const count = await Number.countDocuments();
    if (count === 0) {
      console.log('Inicializando números no MongoDB...');
      const numbers = Array.from({ length: 400 }, (_, i) => ({
        id: i + 1,
        buyer: '',
        selected: false
      }));
      await Number.insertMany(numbers);
      console.log('Números inicializados com sucesso');
    }
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
}

// Conecta ao MongoDB
connectDB();

// Rotas
router.get('/', async (req, res) => {
  try {
    const numbers = await Number.find().sort({ id: 1 });
    res.json(numbers);
  } catch (error) {
    console.error('Erro ao buscar números:', error);
    res.status(500).json({ error: 'Erro ao buscar números' });
  }
});

router.post('/purchase', async (req, res) => {
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
    const soldNumbers = await Number.find({
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
    await Number.updateMany(
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
    res.status(500).json({ error: 'Erro ao processar compra' });
  }
});

export default router; 
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from 'dotenv';

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

// Rotas
app.get('/api/numbers', async (req, res) => {
  try {
    const numbers = await Number.find().sort({ id: 1 });
    res.json(numbers);
  } catch (error) {
    console.error('Erro ao buscar números:', error);
    res.status(500).json({ error: 'Erro ao buscar números' });
  }
});

app.post('/api/purchase', async (req, res) => {
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

// Endpoint administrativo
app.get('/api/admin/numbers', checkAdminPassword, async (req, res) => {
  try {
    const { buyer, selected } = req.query;
    let query: { buyer?: string; selected?: boolean } = {};

    if (buyer) {
      query.buyer = buyer as string;
    }
    if (selected !== undefined) {
      query.selected = selected === 'true';
    }

    const numbers = await Number.find(query).sort({ id: 1 });
    
    // Estatísticas
    const total = await Number.countDocuments();
    const sold = await Number.countDocuments({ buyer: { $ne: '' } });
    const available = await Number.countDocuments({ buyer: '' });
    
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
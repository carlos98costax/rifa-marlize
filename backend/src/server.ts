require('dotenv').config();
const express = require('express')
const cors = require('cors')
const { connectDB, getAllNumbers, purchaseNumbers } = require('./database')

const app = express()
const port = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Middleware para verificar senha administrativa
const checkAdminPassword = (req, res, next) => {
  const adminPassword = req.headers['x-admin-password'];
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Senha administrativa inválida' });
  }
  next();
};

// Conecta ao MongoDB antes de iniciar o servidor
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`)
  })
}).catch(error => {
  console.error('Erro ao iniciar o servidor:', error)
  process.exit(1)
})

// Get all numbers
app.get('/api/numbers', async (req, res) => {
  try {
    const numbers = await getAllNumbers()
    res.json(numbers)
  } catch (error) {
    console.error('Erro ao buscar números:', error)
    res.status(500).json({ error: 'Erro ao buscar números' })
  }
})

// Purchase numbers
app.post('/api/purchase', async (req, res) => {
  try {
    const { numbers, buyer, password } = req.body
    
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'Números inválidos' })
    }
    
    if (!buyer || typeof buyer !== 'string' || buyer.trim() === '') {
      return res.status(400).json({ error: 'Nome do comprador é obrigatório' })
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Senha de verificação é obrigatória' })
    }

    const result = await purchaseNumbers(numbers, buyer.trim(), password)
    
    if (result.error) {
      return res.status(400).json(result)
    }
    
    res.json(result)
  } catch (error) {
    console.error('Erro ao processar compra:', error)
    res.status(500).json({ error: 'Erro ao processar compra' })
  }
})

// Endpoint administrativo para consultar dados
app.get('/api/admin/numbers', checkAdminPassword, async (req, res) => {
  try {
    const { buyer, selected } = req.query;
    let query = {};

    if (buyer) {
      query.buyer = buyer;
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
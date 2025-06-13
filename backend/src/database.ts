const mongoose = require('mongoose');
const Number = require('./models/Number');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://seu_usuario:sua_senha@seu_cluster.mongodb.net/sistema_rifa';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rifa2024'; // Senha padrão, deve ser alterada no .env

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

async function getAllNumbers() {
  try {
    const numbers = await Number.find().sort({ id: 1 });
    return numbers;
  } catch (error) {
    console.error('Erro ao buscar números:', error);
    throw error;
  }
}

async function purchaseNumbers(numbers, buyer, password) {
  try {
    // Verifica a senha
    if (password !== ADMIN_PASSWORD) {
      return {
        error: 'Senha de verificação incorreta'
      };
    }

    // Verifica se algum número já foi vendido
    const soldNumbers = await Number.find({
      id: { $in: numbers },
      buyer: { $ne: '' }
    });

    if (soldNumbers.length > 0) {
      return {
        error: 'Alguns números já foram vendidos',
        soldNumbers: soldNumbers.map(n => n.id)
      };
    }

    // Atualiza os números
    await Number.updateMany(
      { id: { $in: numbers } },
      { 
        $set: { 
          buyer: buyer,
          selected: true
        }
      }
    );

    return { success: true };
  } catch (error) {
    console.error('Erro ao processar compra:', error);
    throw error;
  }
}

module.exports = {
  connectDB,
  getAllNumbers,
  purchaseNumbers
}; 
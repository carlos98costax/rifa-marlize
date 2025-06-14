import app from './api/index.js';
import mongoose from 'mongoose';

const PORT = process.env.PORT || 3001;

// Função para iniciar o servidor
async function startServer() {
  try {
    // Aguardar a conexão com o MongoDB
    if (mongoose.connection.readyState === 0) {
      console.log('Waiting for MongoDB connection...');
      await new Promise(resolve => {
        const checkConnection = () => {
          if (mongoose.connection.readyState === 1) {
            resolve(true);
          } else {
            setTimeout(checkConnection, 1000);
          }
        };
        checkConnection();
      });
    }

    // Iniciar o servidor
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 
import express, { Request, Response, NextFunction } from 'express';
import mongoose, { Schema } from 'mongoose';
import cors from 'cors';
import * as yup from 'yup';

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define the Number schema type
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

// Initialize numbers if they don't exist
async function initializeNumbers(): Promise<void> {
  try {
    const count = await NumberModel.countDocuments();
    if (count === 0) {
      const numbers = Array.from({ length: 100 }, (_, i) => ({
        number: i + 1,
        isSelected: false
      }));
      await NumberModel.insertMany(numbers);
      console.log('Numbers initialized');
    }
  } catch (error) {
    console.error('Error initializing numbers:', error);
  }
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok' });
});

// Get all numbers
app.get('/api/numbers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const numbers = await NumberModel.find().sort({ number: 1 });
    res.json(numbers);
  } catch (error) {
    console.error('Error fetching numbers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Select a number
app.post('/api/numbers/:number', async (req: Request, res: Response): Promise<void> => {
  try {
    const selectedNumber = parseInt(req.params.number);
    
    // Validate the number
    await numberValidationSchema.validate({ number: selectedNumber });

    // Check if number exists and is not selected
    const number = await NumberModel.findOne({ number: selectedNumber });
    if (!number) {
      res.status(404).json({ error: 'Number not found' });
      return;
    }

    const numberDoc = number.toObject();
    if (numberDoc.isSelected) {
      res.status(400).json({ error: 'Number already selected' });
      return;
    }

    // Update the number
    numberDoc.isSelected = true;
    numberDoc.selectedAt = new Date();
    await NumberModel.updateOne({ _id: number._id }, numberDoc);

    res.json(numberDoc);
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Error selecting number:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get selected numbers
app.get('/api/selected', async (_req: Request, res: Response): Promise<void> => {
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
app.post('/api/reset', async (_req: Request, res: Response): Promise<void> => {
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
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  initializeNumbers();
}); 
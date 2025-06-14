import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INumber extends Document {
  number: number;
  isAvailable: boolean;
  purchasedBy: string | null;
  purchasedAt: Date | null;
}

const NumberSchema: Schema = new Schema({
  number: { type: Number, required: true, unique: true },
  isAvailable: { type: Boolean, default: true },
  purchasedBy: { type: String, default: null },
  purchasedAt: { type: Date, default: null }
});

const NumberModel: Model<INumber> = mongoose.models.Number || mongoose.model<INumber>('Number', NumberSchema);

export default NumberModel; 
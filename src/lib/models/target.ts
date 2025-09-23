import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITarget extends Document {
  name: string;
  type: string; // e.g., 'school', 'person', etc.
  description?: string;
  details?: Record<string, any>; // Flexible details for any target type
  content: string[]; // For RAG context
}

const TargetSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  description: { type: String },
  details: { type: Schema.Types.Mixed },
  content: { type: [String], default: [] },
});

export const Target: Model<ITarget> = mongoose.models.Target || mongoose.model<ITarget>('Target', TargetSchema);

export default Target;

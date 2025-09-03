import mongoose, { Document, Schema } from 'mongoose';
import { IMessage as BaseIMessage, IConversation as BaseIConversation } from '@/lib/types/conversation';

export interface IMessage extends BaseIMessage {}

export interface IConversation extends Document, Omit<BaseIConversation, 'userId'> {
  _id: mongoose.Types.ObjectId;
  userId?: string; // Optional for backward compatibility
}

const MessageSchema = new Schema<IMessage>({
  id: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const ConversationSchema = new Schema<IConversation>({
  title: {
    type: String,
    default: 'New Conversation',
  },
  messages: [MessageSchema],
  userId: {
    type: String,
    required: true, // Now required for all conversations in database
  },
  aiProvider: {
    type: String,
    default: 'chat-groq',
  },
}, {
  timestamps: true,
});

// Create indexes for better performance
ConversationSchema.index({ createdAt: -1 });
ConversationSchema.index({ userId: 1, createdAt: -1 });

export const Conversation = mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);

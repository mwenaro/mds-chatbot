// Shared types for conversations that can be used in both client and server components

export interface IMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IConversation {
  userId: string;
  title: string;
  messages: IMessage[];
  aiProvider: string;
  createdAt: Date;
  updatedAt: Date;
}

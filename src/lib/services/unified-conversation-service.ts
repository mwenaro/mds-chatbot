import { IMessage } from '@/lib/types/conversation';
import { ConversationService, ConversationDetail, ConversationSummary } from './conversation-service';
import { GuestConversationService, GuestConversation } from './guest-conversation-service';

export type UnifiedConversation = ConversationDetail | GuestConversation;
export type UnifiedConversationSummary = ConversationSummary | {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  aiProvider: string;
  messageCount: number;
  preview: string;
  isGuest: true;
};

export class UnifiedConversationService {
  
  static async createConversation(
    messages: IMessage[],
    title?: string,
    aiProvider?: string,
    isAuthenticated?: boolean
  ): Promise<UnifiedConversation> {
    if (isAuthenticated) {
      return await ConversationService.createConversation(messages, title, aiProvider);
    } else {
      return GuestConversationService.createConversation(messages, title, aiProvider);
    }
  }

  static async getConversations(
    isAuthenticated: boolean,
    limit = 20,
    offset = 0
  ): Promise<UnifiedConversationSummary[]> {
    if (isAuthenticated) {
      return await ConversationService.getConversations(limit, offset);
    } else {
      const guestConversations = GuestConversationService.getConversations();
      return guestConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        aiProvider: conv.aiProvider,
        messageCount: conv.messages.length,
        preview: conv.messages.find(m => m.role === 'user')?.content?.substring(0, 100) || '',
        isGuest: true as const,
      }));
    }
  }

  static async getConversation(
    id: string,
    isAuthenticated: boolean
  ): Promise<UnifiedConversation | null> {
    if (isAuthenticated) {
      try {
        return await ConversationService.getConversation(id);
      } catch (error) {
        console.error('Error fetching authenticated conversation:', error);
        return null;
      }
    } else {
      const current = GuestConversationService.getCurrentConversation();
      return current?.id === id ? current : null;
    }
  }

  static async updateConversation(
    id: string,
    updates: {
      messages?: IMessage[];
      title?: string;
      aiProvider?: string;
    },
    isAuthenticated: boolean
  ): Promise<UnifiedConversation | null> {
    if (isAuthenticated) {
      try {
        return await ConversationService.updateConversation(id, updates);
      } catch (error) {
        console.error('Error updating authenticated conversation:', error);
        return null;
      }
    } else {
      if (updates.messages) {
        return GuestConversationService.updateMessages(id, updates.messages);
      }
      return null;
    }
  }

  static async saveMessages(
    conversationId: string | null,
    messages: IMessage[],
    isAuthenticated: boolean,
    aiProvider?: string
  ): Promise<UnifiedConversation | null> {
    if (isAuthenticated && conversationId) {
      return await ConversationService.saveMessages(conversationId, messages);
    } else if (!isAuthenticated) {
      if (conversationId) {
        return GuestConversationService.updateMessages(conversationId, messages);
      } else {
        // Create new guest conversation
        const title = this.generateTitle(messages);
        return GuestConversationService.createConversation(messages, title, aiProvider);
      }
    }
    return null;
  }

  static generateTitle(messages: IMessage[]): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      const content = firstUserMessage.content.trim();
      return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }
    return `Conversation ${new Date().toLocaleDateString()}`;
  }

  static clearGuestData(): void {
    GuestConversationService.clearConversation();
  }
}

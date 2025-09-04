import { IMessage } from '@/lib/types/conversation';

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  aiProvider: string;
  messageCount: number;
  preview: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
  aiProvider: string;
}

export class ConversationService {
  
  static async createConversation(
    messages: IMessage[], 
    title?: string, 
    aiProvider?: string
  ): Promise<ConversationDetail> {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        title,
        aiProvider,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create conversation');
    }

    return response.json();
  }

  static async getConversations(limit = 20, offset = 0): Promise<ConversationSummary[]> {
    const response = await fetch(`/api/conversations?limit=${limit}&offset=${offset}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch conversations');
    }

    const data = await response.json();
    return data.conversations;
  }

  static async getConversation(id: string): Promise<ConversationDetail> {
    const response = await fetch(`/api/conversations/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch conversation');
    }

    return response.json();
  }

  static async updateConversation(
    id: string,
    updates: {
      messages?: IMessage[];
      title?: string;
      aiProvider?: string;
    }
  ): Promise<ConversationDetail> {
    const response = await fetch(`/api/conversations/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update conversation');
    }

    return response.json();
  }

  static async deleteConversation(id: string): Promise<void> {
    const response = await fetch(`/api/conversations/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete conversation');
    }
  }

  static async saveMessages(conversationId: string, messages: IMessage[]): Promise<ConversationDetail> {
    return this.updateConversation(conversationId, { messages });
  }

  static generateTitle(messages: IMessage[]): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      const content = firstUserMessage.content.trim();
      return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }
    return `Conversation ${new Date().toLocaleDateString()}`;
  }
}

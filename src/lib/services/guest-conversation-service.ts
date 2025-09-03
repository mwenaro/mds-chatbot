import { IMessage } from '@/lib/types/conversation';
import { getStorageKey, generateGuestId, getGuestSession, setGuestSession } from '@/lib/client-auth-utils';

export interface GuestConversation {
  id: string;
  title: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
  aiProvider: string;
  isGuest: true;
}

export class GuestConversationService {
  private static getStorageKey(key: string): string {
    return getStorageKey(`guest_conversations_${key}`);
  }

  static getCurrentGuestId(): string {
    let guestId = getGuestSession();
    if (!guestId) {
      guestId = generateGuestId();
      setGuestSession(guestId);
    }
    return guestId;
  }

  static saveConversation(conversation: GuestConversation): void {
    if (typeof window === 'undefined') return;
    
    const key = this.getStorageKey('current');
    sessionStorage.setItem(key, JSON.stringify({
      ...conversation,
      updatedAt: new Date(),
    }));
  }

  static getCurrentConversation(): GuestConversation | null {
    if (typeof window === 'undefined') return null;
    
    const key = this.getStorageKey('current');
    const stored = sessionStorage.getItem(key);
    
    if (!stored) return null;
    
    try {
      const conversation = JSON.parse(stored);
      return {
        ...conversation,
        createdAt: new Date(conversation.createdAt),
        updatedAt: new Date(conversation.updatedAt),
      };
    } catch (error) {
      console.error('Error parsing guest conversation:', error);
      return null;
    }
  }

  static createConversation(
    messages: IMessage[],
    title?: string,
    aiProvider?: string
  ): GuestConversation {
    const guestId = this.getCurrentGuestId();
    const conversationId = `${guestId}_${Date.now()}`;
    
    const conversation: GuestConversation = {
      id: conversationId,
      title: title || this.generateTitle(messages),
      messages,
      createdAt: new Date(),
      updatedAt: new Date(),
      aiProvider: aiProvider || 'chat-groq',
      isGuest: true,
    };

    this.saveConversation(conversation);
    return conversation;
  }

  static updateMessages(conversationId: string, messages: IMessage[]): GuestConversation | null {
    const current = this.getCurrentConversation();
    
    if (!current || current.id !== conversationId) {
      return null;
    }

    const updated: GuestConversation = {
      ...current,
      messages,
      updatedAt: new Date(),
    };

    this.saveConversation(updated);
    return updated;
  }

  static clearConversation(): void {
    if (typeof window === 'undefined') return;
    
    const key = this.getStorageKey('current');
    sessionStorage.removeItem(key);
  }

  static generateTitle(messages: IMessage[]): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      const content = firstUserMessage.content.trim();
      return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }
    return `Chat ${new Date().toLocaleDateString()}`;
  }

  // Guest users don't have conversation history - it's session-based only
  static getConversations(): GuestConversation[] {
    const current = this.getCurrentConversation();
    return current ? [current] : [];
  }
}

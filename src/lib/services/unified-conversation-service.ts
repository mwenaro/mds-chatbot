import { IMessage } from '@/lib/types/conversation';
import { ConversationService, ConversationDetail, ConversationSummary } from './conversation-service';
import { GuestConversationService, GuestConversation } from './guest-conversation-service';
import { ResponseValidator, ValidationResult } from './response-validator';
import { AIConfigurationService } from './ai-configuration';

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
    // Validate and potentially modify the last AI response
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant') {
      const validation = ResponseValidator.validateResponse(lastMessage.content);
      
      if (!validation.isValid) {
        console.warn('AI response validation failed:', validation.warnings);
        
        // Add disclaimer to potentially problematic responses
        lastMessage.content = ResponseValidator.addDisclaimerIfNeeded(
          lastMessage.content, 
          validation
        );
      }
      
      // Log validation results for monitoring
      if (validation.warnings.length > 0) {
        console.log('Response validation warnings:', {
          conversationId,
          aiProvider,
          confidence: validation.confidence,
          warnings: validation.warnings
        });
      }
    }

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

  /**
   * Sanitize messages for AI context to prevent hallucination
   */
  static sanitizeMessagesForContext(messages: IMessage[], maxTokens = 4000): IMessage[] {
    // Since IMessage only supports 'user' | 'assistant', we work with those
    // System messages would be handled separately in the API layer
    
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    let currentTokens = 0;
    const sanitizedMessages: IMessage[] = [];
    
    // Add messages from most recent, staying within token limit
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = AIConfigurationService.estimateTokenCount(message.content);
      
      if (currentTokens + messageTokens > maxTokens) {
        break;
      }
      
      sanitizedMessages.unshift(message); // Add to beginning to maintain order
      currentTokens += messageTokens;
    }
    
    return sanitizedMessages;
  }

  /**
   * Validate response and add appropriate disclaimers
   */
  static validateAndEnhanceResponse(response: string, context?: string): {
    content: string;
    validation: ValidationResult;
  } {
    const validation = ResponseValidator.validateResponse(response, context);
    const enhancedContent = ResponseValidator.addDisclaimerIfNeeded(response, validation);
    
    return {
      content: enhancedContent,
      validation
    };
  }

  /**
   * Check if query requires anti-hallucination measures
   */
  static requiresAntiHallucination(query: string): boolean {
    return AIConfigurationService.shouldUseLowHallucinationMode(query);
  }

  /**
   * Prepare messages with anti-hallucination context
   */
  static prepareMessagesWithAntiHallucination(
    messages: IMessage[],
    options?: {
      maxTokens?: number;
      addUncertaintyContext?: boolean;
      validateContent?: boolean;
    }
  ): IMessage[] {
    const opts = {
      maxTokens: 4000,
      addUncertaintyContext: true,
      validateContent: true,
      ...options
    };

    // First sanitize for token limits
   const processedMessages = this.sanitizeMessagesForContext(messages, opts.maxTokens);

    // Add uncertainty context to the last user message if needed
    if (opts.addUncertaintyContext && processedMessages.length > 0) {
      const lastUserMessageIndex = processedMessages.map(m => m.role).lastIndexOf('user');
      if (lastUserMessageIndex !== -1) {
        const lastUserMessage = processedMessages[lastUserMessageIndex];
        if (this.requiresAntiHallucination(lastUserMessage.content)) {
          processedMessages[lastUserMessageIndex] = {
            ...lastUserMessage,
            content: lastUserMessage.content + '\n\nNote: Please be careful about factual accuracy and indicate any uncertainty in your response.'
          };
        }
      }
    }

    return processedMessages;
  }

  static clearGuestData(): void {
    GuestConversationService.clearConversation();
  }
}

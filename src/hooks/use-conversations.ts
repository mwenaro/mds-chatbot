import { useState, useCallback } from 'react';
import { ConversationService, ConversationSummary, ConversationDetail } from '@/lib/services/conversation-service';
import { IMessage } from '@/lib/types/conversation';

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async (limit = 20, offset = 0) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await ConversationService.getConversations(limit, offset);
      setConversations(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const conversation = await ConversationService.getConversation(id);
      setCurrentConversation(conversation);
      return conversation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createConversation = useCallback(async (
    messages: IMessage[],
    title?: string,
    aiProvider?: string
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      const conversation = await ConversationService.createConversation(messages, title, aiProvider);
      setCurrentConversation(conversation);
      // Refresh conversations list
      await loadConversations();
      return conversation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [loadConversations]);

  const updateConversation = useCallback(async (
    id: string,
    updates: {
      messages?: IMessage[];
      title?: string;
      aiProvider?: string;
    }
  ) => {
    try {
      setError(null);
      const conversation = await ConversationService.updateConversation(id, updates);
      setCurrentConversation(conversation);
      // Update in conversations list if it exists
      setConversations(prev => 
        prev.map(conv => 
          conv.id === id 
            ? { 
                ...conv, 
                title: conversation.title, 
                updatedAt: conversation.updatedAt,
                messageCount: conversation.messages.length,
                preview: conversation.messages.find(m => m.role === 'user')?.content?.substring(0, 100) || ''
              }
            : conv
        )
      );
      return conversation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update conversation');
      return null;
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      setError(null);
      await ConversationService.deleteConversation(id);
      setConversations(prev => prev.filter(conv => conv.id !== id));
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
      return false;
    }
  }, [currentConversation]);

  const saveMessages = useCallback(async (conversationId: string, messages: IMessage[]) => {
    return updateConversation(conversationId, { messages });
  }, [updateConversation]);

  const startNewConversation = useCallback(() => {
    setCurrentConversation(null);
    setError(null);
  }, []);

  return {
    conversations,
    currentConversation,
    isLoading,
    error,
    loadConversations,
    loadConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    saveMessages,
    startNewConversation,
  };
}

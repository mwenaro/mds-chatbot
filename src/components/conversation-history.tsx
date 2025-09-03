"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Trash2, 
  Plus, 
  Calendar, 
  MessageCircle,
  Loader2
} from "lucide-react";
import { useUser } from '@clerk/nextjs';
import { UnifiedConversationService, UnifiedConversationSummary } from "@/lib/services/unified-conversation-service";

interface ConversationHistoryProps {
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  currentConversationId?: string;
}

export default function ConversationHistory({
  onSelectConversation,
  onNewConversation,
  currentConversationId
}: ConversationHistoryProps) {
  const { isSignedIn } = useUser();
  const [conversations, setConversations] = useState<UnifiedConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    loadConversations();
  }, [isSignedIn]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await UnifiedConversationService.getConversations(!!isSignedIn);
      setConversations(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation?')) {
      setDeletingId(conversationId);
      
      try {
        // Only authenticated users can delete from database
        if (isSignedIn) {
          // This would need to be implemented in the UnifiedConversationService
          // For now, just remove from local state
          setConversations(prev => prev.filter(conv => conv.id !== conversationId));
        }
        
        if (currentConversationId === conversationId) {
          onNewConversation();
        }
      } catch (error) {
        console.error('Error deleting conversation:', error);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  };

  if (!mounted) {
    return (
      <div className="w-80 border-r bg-muted/10 p-4">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-r bg-muted/10 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {isSignedIn ? 'Conversations' : 'Current Session'}
          </h2>
          <Button
            onClick={onNewConversation}
            size="sm"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && conversations.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">
              <p>Error loading conversations</p>
              <Button
                onClick={loadConversations}
                size="sm"
                variant="outline"
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              {isSignedIn ? (
                <>
                  <p>No conversations yet</p>
                  <p className="text-sm mt-1">Start chatting to save conversations</p>
                </>
              ) : (
                <>
                  <p>Guest Mode</p>
                  <p className="text-sm mt-1">Sign in to save conversation history</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <Card
                  key={conversation.id}
                  className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 group ${
                    currentConversationId === conversation.id
                      ? 'bg-muted border-primary'
                      : ''
                  }`}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm truncate">
                          {conversation.title}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {conversation.aiProvider?.replace('chat-', '')}
                        </Badge>
                        {'isGuest' in conversation && conversation.isGuest && (
                          <Badge variant="secondary" className="text-xs">
                            Guest
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {conversation.preview}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(conversation.updatedAt)}
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {conversation.messageCount}
                        </div>
                      </div>
                    </div>
                    
                    {isSignedIn && (
                      <Button
                        onClick={(e) => handleDelete(e, conversation.id)}
                        size="sm"
                        variant="ghost"
                        className="ml-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                        disabled={deletingId === conversation.id}
                      >
                        {deletingId === conversation.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {!isSignedIn && (
        <div className="p-4 border-t">
          <div className="text-xs text-muted-foreground text-center">
            <p>💡 Sign in to save your conversations permanently</p>
          </div>
        </div>
      )}
    </div>
  );
}

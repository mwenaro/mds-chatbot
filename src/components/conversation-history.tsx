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
  Loader2,
  Search,
  Download,
  Upload
} from "lucide-react";
import { useUser } from '@clerk/nextjs';
import { UnifiedConversationService, UnifiedConversationSummary, UnifiedConversation } from "@/lib/services/unified-conversation-service";
import ConversationSearch from "./conversation-search";
import { ConversationExporter } from "@/lib/conversation-export";

interface ConversationHistoryProps {
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
}

export default function ConversationHistory({
  onSelectConversation,
  currentConversationId
}: ConversationHistoryProps) {
  const { isSignedIn } = useUser();
  const [conversations, setConversations] = useState<UnifiedConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadConversations();
  }, [isSignedIn]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get summaries first
      const summaries = await UnifiedConversationService.getConversations(!!isSignedIn);
      
      // For now, just show summaries. Full conversations can be loaded on demand
      // Convert summaries to conversation format for compatibility
      const conversationList: UnifiedConversation[] = summaries.map(summary => ({
        id: summary.id,
        title: summary.title,
        messages: [], // Will be loaded on demand
        aiProvider: summary.aiProvider || 'unknown',
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt
      }));
      
      setConversations(conversationList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      setDeletingId(conversationId);
      // For now, just remove from local state
      // TODO: Implement deleteConversation in UnifiedConversationService
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = (conversationsToExport: UnifiedConversation[]) => {
    ConversationExporter.downloadConversations(conversationsToExport);
  };

  const handleImport = async (file: File) => {
    try {
      const result = await ConversationExporter.importFromFile(file);
      if (result.success) {
        await loadConversations();
        alert(`Successfully imported ${result.imported} conversations!`);
      } else {
        alert(`Import failed: ${result.errors.join(', ')}`);
      }
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-4 border-red-200 bg-red-50">
        <p className="text-red-800 text-sm">{error}</p>
        <Button onClick={loadConversations} size="sm" className="mt-2">
          Try Again
        </Button>
      </Card>
    );
  }

  if (showSearch) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Search Conversations</h2>
          <Button onClick={() => setShowSearch(false)} size="sm" variant="outline">
            Back
          </Button>
        </div>
        
        <ConversationSearch
          conversations={conversations}
          onSelectConversation={onSelectConversation}
          currentConversationId={currentConversationId}
          onExport={handleExport}
          onImport={handleImport}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Recent Conversations</h2>
        <div className="flex gap-2">
          <Button onClick={() => setShowSearch(true)} size="sm" variant="outline">
            <Search className="h-4 w-4" />
          </Button>
          <Button onClick={() => handleExport(conversations)} size="sm" variant="outline">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {/* Conversations list */}
      {!isLoading && (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {conversations.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm">Start a new chat to see your conversation history here.</p>
              </Card>
            ) : (
              conversations.map((conversation) => (
                <Card
                  key={conversation.id}
                  className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                    currentConversationId === conversation.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium truncate flex-1">{conversation.title}</h3>
                      <div className="flex items-center gap-2">
                        {conversation.aiProvider && (
                          <Badge variant="outline" className="text-xs">
                            {conversation.aiProvider}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDelete(e, conversation.id)}
                          disabled={deletingId === conversation.id}
                        >
                          {deletingId === conversation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(conversation.updatedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {conversation.messages.length} messages
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Filter, 
  Calendar, 
  MessageSquare, 
  Bot,
  Download,
  Upload,
  X,
  SortAsc,
  SortDesc
} from "lucide-react";
import { UnifiedConversation } from "@/lib/services/unified-conversation-service";
import { ConversationExporter } from "@/lib/conversation-export";

interface ConversationSearchProps {
  conversations: UnifiedConversation[];
  onSelectConversation: (id: string) => void;
  currentConversationId?: string;
  onExport?: (conversations: UnifiedConversation[]) => void;
  onImport?: (file: File) => void;
  className?: string;
}

type SortField = 'date' | 'title' | 'messages' | 'provider';
type SortDirection = 'asc' | 'desc';

interface SearchFilters {
  text: string;
  provider: string;
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  minMessages: number;
}

export default function ConversationSearch({
  conversations,
  onSelectConversation,
  currentConversationId,
  onExport,
  onImport,
  className = ""
}: ConversationSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    text: '',
    provider: '',
    dateRange: 'all',
    minMessages: 0
  });
  
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);

  // Get unique providers for filter dropdown
  const availableProviders = useMemo(() => {
    return [...new Set(conversations.map(conv => conv.aiProvider).filter(Boolean))];
  }, [conversations]);

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations.filter(conversation => {
      // Text search (title and message content)
      if (filters.text) {
        const searchText = filters.text.toLowerCase();
        const titleMatch = conversation.title.toLowerCase().includes(searchText);
        const contentMatch = conversation.messages.some(msg => 
          msg.content.toLowerCase().includes(searchText)
        );
        if (!titleMatch && !contentMatch) return false;
      }

      // Provider filter
      if (filters.provider && conversation.aiProvider !== filters.provider) {
        return false;
      }

      // Date range filter
      if (filters.dateRange !== 'all') {
        const now = new Date();
        const convDate = new Date(conversation.updatedAt);
        const daysDiff = Math.floor((now.getTime() - convDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (filters.dateRange) {
          case 'today':
            if (daysDiff > 0) return false;
            break;
          case 'week':
            if (daysDiff > 7) return false;
            break;
          case 'month':
            if (daysDiff > 30) return false;
            break;
          case 'year':
            if (daysDiff > 365) return false;
            break;
        }
      }

      // Minimum messages filter
      if (conversation.messages.length < filters.minMessages) {
        return false;
      }

      return true;
    });

    // Sort conversations
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'date':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'messages':
          comparison = a.messages.length - b.messages.length;
          break;
        case 'provider':
          comparison = (a.aiProvider || '').localeCompare(b.aiProvider || '');
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [conversations, filters, sortField, sortDirection]);

  // Handle sort change
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      text: '',
      provider: '',
      dateRange: 'all',
      minMessages: 0
    });
  };

  // Handle conversation selection for bulk operations
  const toggleConversationSelection = (id: string) => {
    setSelectedConversations(prev => 
      prev.includes(id) 
        ? prev.filter(convId => convId !== id)
        : [...prev, id]
    );
  };

  // Select all filtered conversations
  const selectAllFiltered = () => {
    const allIds = filteredConversations.map(conv => conv.id);
    setSelectedConversations(allIds);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedConversations([]);
  };

  // Export selected conversations
  const exportSelected = () => {
    const selected = conversations.filter(conv => selectedConversations.includes(conv.id));
    if (selected.length > 0) {
      ConversationExporter.downloadConversations(selected);
      onExport?.(selected);
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  // Get conversation preview (first user message)
  const getConversationPreview = (conversation: UnifiedConversation) => {
    const firstUserMessage = conversation.messages.find(msg => msg.role === 'user');
    if (firstUserMessage) {
      return firstUserMessage.content.slice(0, 100) + (firstUserMessage.content.length > 100 ? '...' : '');
    }
    return 'No messages';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filter Header */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={filters.text}
              onChange={(e) => setFilters(prev => ({ ...prev, text: e.target.value }))}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Provider Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Provider</label>
                <select
                  value={filters.provider}
                  onChange={(e) => setFilters(prev => ({ ...prev, provider: e.target.value }))}
                  className="w-full p-2 border rounded-md bg-background"
                >
                  <option value="">All Providers</option>
                  {availableProviders.map(provider => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
                  className="w-full p-2 border rounded-md bg-background"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>
              </div>

              {/* Minimum Messages Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Min Messages</label>
                <Input
                  type="number"
                  min="0"
                  value={filters.minMessages}
                  onChange={(e) => setFilters(prev => ({ ...prev, minMessages: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </Card>
        )}

        {/* Bulk Actions */}
        {selectedConversations.length > 0 && (
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedConversations.length} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportSelected}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Sort Controls */}
        <div className="flex gap-2 flex-wrap">
          {(['date', 'title', 'messages', 'provider'] as SortField[]).map(field => (
            <Button
              key={field}
              variant={sortField === field ? "default" : "outline"}
              size="sm"
              onClick={() => handleSort(field)}
              className="gap-2"
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
              {sortField === field && (
                sortDirection === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
              )}
            </Button>
          ))}
        </div>

        {/* Results Summary */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredConversations.length} of {conversations.length} conversations
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {filteredConversations.map((conversation) => (
            <Card
              key={conversation.id}
              className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                currentConversationId === conversation.id ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedConversations.includes(conversation.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleConversationSelection(conversation.id);
                      }}
                      className="rounded"
                    />
                    <h3 className="font-medium truncate flex-1">{conversation.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {conversation.aiProvider && (
                      <Badge variant="outline" className="text-xs">
                        {conversation.aiProvider}
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">
                  {getConversationPreview(conversation)}
                </p>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {conversation.messages.length} messages
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(new Date(conversation.updatedAt))}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Bulk Actions Bottom */}
      <div className="flex justify-between items-center pt-2 border-t">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAllFiltered}>
            Select All ({filteredConversations.length})
          </Button>
          {onImport && (
            <label>
              <Button variant="outline" size="sm" className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImport(file);
                }}
                className="hidden"
              />
            </label>
          )}
        </div>
        
        {onExport && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onExport(filteredConversations)}
          >
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        )}
      </div>
    </div>
  );
}

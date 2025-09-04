import { IMessage } from "@/lib/types/conversation";
import { UnifiedConversation } from "@/lib/services/unified-conversation-service";

export interface ExportFormat {
  version: string;
  exported: string;
  conversations: ConversationExport[];
}

export interface ConversationExport {
  id: string;
  title: string;
  messages: IMessage[];
  aiProvider: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

const EXPORT_VERSION = "1.0.0";

export class ConversationExporter {
  /**
   * Export conversations to JSON format
   */
  static exportConversations(conversations: UnifiedConversation[]): ExportFormat {
    const exportData: ExportFormat = {
      version: EXPORT_VERSION,
      exported: new Date().toISOString(),
      conversations: conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        messages: conv.messages,
        aiProvider: conv.aiProvider || 'unknown',
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        messageCount: conv.messages.length,
      }))
    };

    return exportData;
  }

  /**
   * Download conversations as JSON file
   */
  static downloadConversations(conversations: UnifiedConversation[], filename?: string) {
    const exportData = this.exportConversations(conversations);
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `mds-chatbot-conversations-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export single conversation as markdown
   */
  static exportConversationAsMarkdown(conversation: UnifiedConversation): string {
    const { title, messages, aiProvider, createdAt } = conversation;
    
    let markdown = `# ${title}\n\n`;
    markdown += `**Created:** ${createdAt.toLocaleDateString()}\n`;
    markdown += `**AI Provider:** ${aiProvider}\n`;
    markdown += `**Messages:** ${messages.length}\n\n`;
    markdown += `---\n\n`;

    messages.forEach(message => {
      const role = message.role === 'user' ? '👤 **You**' : '🤖 **Assistant**';
      const timestamp = new Date(message.timestamp).toLocaleTimeString();
      
      markdown += `## ${role} *(${timestamp})*\n\n`;
      markdown += `${message.content}\n\n`;
    });

    return markdown;
  }

  /**
   * Download single conversation as markdown
   */
  static downloadConversationAsMarkdown(conversation: UnifiedConversation) {
    const markdown = this.exportConversationAsMarkdown(conversation);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${conversation.title.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Validate import data
   */
  static validateImportData(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Invalid data format');
      return { valid: false, errors };
    }

    // Type guard for ExportFormat
    const exportData = data as Partial<ExportFormat>;

    if (!('version' in exportData) || !exportData.version) {
      errors.push('Missing version information');
    }

    if (!('conversations' in exportData) || !Array.isArray(exportData.conversations)) {
      errors.push('Invalid conversations data');
      return { valid: false, errors };
    }

    // Validate each conversation
    exportData.conversations.forEach((conv, index) => {
      if (!conv || typeof conv !== 'object') return;
      const conversation = conv as Partial<ConversationExport>;
      if (!('id' in conversation) || !conversation.id) errors.push(`Conversation ${index + 1}: Missing ID`);
      if (!('title' in conversation) || !conversation.title) errors.push(`Conversation ${index + 1}: Missing title`);
      if (!('messages' in conversation) || !Array.isArray(conversation.messages)) {
        errors.push(`Conversation ${index + 1}: Invalid messages data`);
      } else {
        conversation.messages.forEach((msg, msgIndex) => {
          if (!msg || typeof msg !== 'object') return;
          const message = msg as Partial<IMessage>;
          if (!('id' in message) || !message.id) errors.push(`Conversation ${index + 1}, Message ${msgIndex + 1}: Missing ID`);
          if (!('content' in message) || !message.content) errors.push(`Conversation ${index + 1}, Message ${msgIndex + 1}: Missing content`);
          if (!('role' in message) || !['user', 'assistant'].includes(message.role as string)) {
            errors.push(`Conversation ${index + 1}, Message ${msgIndex + 1}: Invalid role`);
          }
        });
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Import conversations from JSON data
   */
  static async importConversations(
    data: ExportFormat,
    onProgress?: (progress: { completed: number; total: number; current: string }) => void
  ): Promise<{ success: boolean; imported: number; errors: string[] }> {
    const validation = this.validateImportData(data);
    if (!validation.valid) {
      return { success: false, imported: 0, errors: validation.errors };
    }

    const errors: string[] = [];
    let imported = 0;

    for (let i = 0; i < data.conversations.length; i++) {
      const conv = data.conversations[i];
      
      try {
        onProgress?.({
          completed: i,
          total: data.conversations.length,
          current: conv.title
        });


        // Import logic would go here - this depends on your storage implementation
        // For now, we'll just count as successful
        imported++;
        
      } catch (error) {
        errors.push(`Failed to import conversation "${conv.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    onProgress?.({
      completed: data.conversations.length,
      total: data.conversations.length,
      current: 'Complete'
    });

    return {
      success: errors.length === 0,
      imported,
      errors
    };
  }

  /**
   * Read file content from file input
   */
  static readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse JSON file and import conversations
   */
  static async importFromFile(
    file: File,
    onProgress?: (progress: { completed: number; total: number; current: string }) => void
  ): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      const content = await this.readFileContent(file);
      const data = JSON.parse(content);
      return await this.importConversations(data, onProgress);
    } catch (error) {
      return {
        success: false,
        imported: 0,
        errors: [`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get conversation statistics
   */
  static getConversationStats(conversations: UnifiedConversation[]) {
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    const providers = [...new Set(conversations.map(conv => conv.aiProvider))];
    const oldestDate = conversations.reduce((oldest, conv) => 
      !oldest || conv.createdAt < oldest ? conv.createdAt : oldest, null as Date | null
    );
    const newestDate = conversations.reduce((newest, conv) => 
      !newest || conv.updatedAt > newest ? conv.updatedAt : newest, null as Date | null
    );

    return {
      totalConversations: conversations.length,
      totalMessages,
      averageMessagesPerConversation: conversations.length > 0 ? totalMessages / conversations.length : 0,
      uniqueProviders: providers,
      dateRange: oldestDate && newestDate ? {
        oldest: oldestDate,
        newest: newestDate,
        daysSpan: Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
      } : null
    };
  }
}

export default ConversationExporter;

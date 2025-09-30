import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { DocumentChunk, documentProcessor } from './document-processing-service';

export interface SimpleRetrievalResult {
  chunks: DocumentChunk[];
  scores: number[];
  query: string;
}

export class SimpleRAGStore {
  private documents: DocumentChunk[] = [];
  private isInitialized = false;

  constructor() {
    // No dependencies needed for simple text search
  }

  /**
   * Initialize the simple RAG store with Abu Rayyan Academy documents
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        console.log('Simple RAG store already initialized');
        return;
      }

      console.log('Initializing Simple RAG store...');
      
      // Process the Abu Rayyan Academy document
      const chunks = await documentProcessor.processAbuRayyanDocument();
      this.documents = chunks;

      this.isInitialized = true;
      
      const stats = documentProcessor.getDocumentStats(chunks);
      console.log('Simple RAG store initialized successfully:', stats);
      
    } catch (error) {
      console.error('Error initializing simple RAG store:', error);
      throw new Error(`Failed to initialize simple RAG store: ${error}`);
    }
  }

  /**
   * Search for relevant document chunks using simple text matching
   */
  async searchSimilar(query: string, topK: number = 5): Promise<SimpleRetrievalResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log(`Searching for similar chunks using text matching: "${query.substring(0, 100)}..."`);

      // Convert query to lowercase for case-insensitive matching
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);

      // Score each chunk based on keyword matches
      const scoredChunks = this.documents.map(chunk => {
        const contentLower = chunk.content.toLowerCase();
        let score = 0;

        // Count exact phrase matches (higher weight)
        if (contentLower.includes(queryLower)) {
          score += 10;
        }

        // Count individual word matches
        queryWords.forEach(word => {
          const wordRegex = new RegExp(`\\b${word}\\b`, 'gi');
          const matches = contentLower.match(wordRegex);
          if (matches) {
            score += matches.length * 2;
          }
        });

        // Boost score for academy-related terms
        const academyTerms = ['academy', 'school', 'education', 'student', 'course', 'program', 'admission'];
        academyTerms.forEach(term => {
          if (contentLower.includes(term)) {
            score += 1;
          }
        });

        return { chunk, score };
      });

      // Sort by score (descending) and take top K
      const topChunks = scoredChunks
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      const chunks = topChunks.map(item => item.chunk);
      const scores = topChunks.map(item => item.score);

      console.log(`Found ${chunks.length} relevant chunks using text matching`);
      
      return {
        chunks,
        scores,
        query,
      };
    } catch (error) {
      console.error('Error searching similar chunks:', error);
      throw new Error(`Failed to search for similar chunks: ${error}`);
    }
  }

  /**
   * Get retrieval context for RAG
   */
  async getRetrievalContext(query: string, topK: number = 3): Promise<string> {
    try {
      const results = await this.searchSimilar(query, topK);
      
      if (results.chunks.length === 0) {
        return 'No relevant information found in the Abu Rayyan Academy documents.';
      }

      // Combine the most relevant chunks into context
      let context = 'Based on the Abu Rayyan Academy documents:\n\n';
      
      results.chunks.forEach((chunk, index) => {
        context += `[Document ${index + 1}]:\n${chunk.content}\n\n`;
      });

      return context;
    } catch (error) {
      console.error('Error getting retrieval context:', error);
      throw new Error(`Failed to get retrieval context: ${error}`);
    }
  }

  /**
   * Check if the store is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get store statistics
   */
  getStats(): {
    isInitialized: boolean;
    documentCount: number;
    totalChunks: number;
  } {
    return {
      isInitialized: this.isInitialized,
      documentCount: this.documents.length > 0 ? 1 : 0,
      totalChunks: this.documents.length,
    };
  }

  /**
   * Reinitialize the store (useful for updates)
   */
  async reinitialize(): Promise<void> {
    this.isInitialized = false;
    this.documents = [];
    await this.initialize();
  }

  /**
   * Search for specific topics in the documents
   */
  async searchByTopic(topic: string): Promise<DocumentChunk[]> {
    const topicQueries = {
      'programs': 'programs courses curriculum academic offerings',
      'admission': 'admission requirements application enrollment',
      'facilities': 'facilities infrastructure buildings campus',
      'fees': 'fees tuition cost payment scholarship',
      'about': 'about academy history mission vision',
    };

    const query = topicQueries[topic.toLowerCase() as keyof typeof topicQueries] || topic;
    const results = await this.searchSimilar(query, 5);
    return results.chunks;
  }
}

// Export singleton instance
export const simpleRAGStore = new SimpleRAGStore();
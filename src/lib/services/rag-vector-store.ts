import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import { DocumentChunk, documentProcessor } from './document-processing-service';

export interface RetrievalResult {
  chunks: DocumentChunk[];
  scores: number[];
  query: string;
}

export class RAGVectorStore {
  private vectorStore: MemoryVectorStore | null = null;
  private embeddings: OpenAIEmbeddings;
  private documents: DocumentChunk[] = [];
  private isInitialized = false;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small', // More cost-effective embedding model
    });
  }

  /**
   * Initialize the vector store with Abu Rayyan Academy documents
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        console.log('Vector store already initialized');
        return;
      }

      console.log('Initializing RAG vector store...');
      
      // Process the Abu Rayyan Academy document
      const chunks = await documentProcessor.processAbuRayyanDocument();
      this.documents = chunks;

      // Convert chunks to LangChain Document format
      const documents = chunks.map(chunk => new Document({
        pageContent: chunk.content,
        metadata: {
          id: chunk.id,
          source: chunk.metadata.source,
          chunkIndex: chunk.metadata.chunkIndex,
          totalChunks: chunk.metadata.totalChunks,
          wordCount: chunk.metadata.wordCount,
        },
      }));

      // Create vector store from documents
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        documents,
        this.embeddings
      );

      this.isInitialized = true;
      
      const stats = documentProcessor.getDocumentStats(chunks);
      console.log('Vector store initialized successfully:', stats);
      
    } catch (error) {
      console.error('Error initializing vector store:', error);
      throw new Error(`Failed to initialize vector store: ${error}`);
    }
  }

  /**
   * Search for relevant document chunks based on a query
   */
  async searchSimilar(query: string, topK: number = 5): Promise<RetrievalResult> {
    try {
      if (!this.isInitialized || !this.vectorStore) {
        await this.initialize();
      }

      console.log(`Searching for similar chunks: "${query.substring(0, 100)}..."`);

      // Perform similarity search with scores
      const results = await this.vectorStore!.similaritySearchWithScore(query, topK);
      
      // Convert results back to our DocumentChunk format
      const chunks: DocumentChunk[] = [];
      const scores: number[] = [];

      for (const [doc, score] of results) {
        const originalChunk = this.documents.find(chunk => chunk.id === doc.metadata.id);
        if (originalChunk) {
          chunks.push(originalChunk);
          scores.push(score);
        }
      }

      console.log(`Found ${chunks.length} relevant chunks`);
      
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
   * Check if the vector store is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.vectorStore !== null;
  }

  /**
   * Get vector store statistics
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
   * Reinitialize the vector store (useful for updates)
   */
  async reinitialize(): Promise<void> {
    this.isInitialized = false;
    this.vectorStore = null;
    this.documents = [];
    await this.initialize();
  }

  /**
   * Filter chunks by relevance score threshold
   */
  filterByRelevance(results: RetrievalResult, threshold: number = 0.8): RetrievalResult {
    const filteredIndices = results.scores
      .map((score, index) => ({ score, index }))
      .filter(item => item.score >= threshold)
      .map(item => item.index);

    return {
      chunks: filteredIndices.map(i => results.chunks[i]),
      scores: filteredIndices.map(i => results.scores[i]),
      query: results.query,
    };
  }
}

// Export singleton instance
export const ragVectorStore = new RAGVectorStore();
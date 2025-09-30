import mammoth from 'mammoth';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    wordCount: number;
  };
}

export class DocumentProcessingService {
  private textSplitter: RecursiveCharacterTextSplitter;
  
  constructor() {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ".", "!", "?", ";", ":", " ", ""],
    });
  }

  /**
   * Extract text content from a DOCX file
   */
  async extractTextFromDocx(filePath: string): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.error('Error extracting text from DOCX:', error);
      throw new Error(`Failed to extract text from ${filePath}: ${error}`);
    }
  }

  /**
   * Split text into manageable chunks
   */
  async splitTextIntoChunks(text: string, source: string): Promise<DocumentChunk[]> {
    try {
      const chunks = await this.textSplitter.splitText(text);
      
      return chunks.map((chunk, index) => ({
        id: uuidv4(),
        content: chunk.trim(),
        metadata: {
          source,
          chunkIndex: index,
          totalChunks: chunks.length,
          wordCount: chunk.split(/\s+/).length,
        },
      }));
    } catch (error) {
      console.error('Error splitting text into chunks:', error);
      throw new Error(`Failed to split text: ${error}`);
    }
  }

  /**
   * Process a DOCX file and return document chunks
   */
  async processDocxFile(filePath: string): Promise<DocumentChunk[]> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      console.log(`Processing DOCX file: ${filePath}`);
      
      // Extract text from DOCX
      const text = await this.extractTextFromDocx(filePath);
      
      if (!text || text.trim().length === 0) {
        throw new Error('No text content found in the document');
      }

      console.log(`Extracted ${text.length} characters from document`);
      
      // Split into chunks
      const chunks = await this.splitTextIntoChunks(text, path.basename(filePath));
      
      console.log(`Created ${chunks.length} chunks from document`);
      
      return chunks;
    } catch (error) {
      console.error('Error processing DOCX file:', error);
      throw error;
    }
  }

  /**
   * Process the Abu Rayyan Academy document specifically
   */
  async processAbuRayyanDocument(): Promise<DocumentChunk[]> {
    const docPath = path.join(process.cwd(), 'src', 'data', 'Questions about Abu Rayyan Academy.docx');
    return this.processDocxFile(docPath);
  }

  /**
   * Clean and preprocess text content
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Get document statistics
   */
  getDocumentStats(chunks: DocumentChunk[]): {
    totalChunks: number;
    totalWords: number;
    averageWordsPerChunk: number;
    sources: string[];
  } {
    const totalWords = chunks.reduce((sum, chunk) => sum + chunk.metadata.wordCount, 0);
    const sources = [...new Set(chunks.map(chunk => chunk.metadata.source))];
    
    return {
      totalChunks: chunks.length,
      totalWords,
      averageWordsPerChunk: Math.round(totalWords / chunks.length),
      sources,
    };
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessingService();
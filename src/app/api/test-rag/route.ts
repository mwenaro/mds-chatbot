import { NextRequest, NextResponse } from 'next/server';
import { documentProcessor } from '@/lib/services/document-processing-service';
import { ragVectorStore } from '@/lib/services/rag-vector-store';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    console.log('Testing RAG components...');
    
    // Test 1: Check if DOCX file exists
    const docPath = path.join(process.cwd(), 'src', 'data', 'Questions about Abu Rayyan Academy.docx');
    const fileExists = fs.existsSync(docPath);
    
    console.log('DOCX file path:', docPath);
    console.log('File exists:', fileExists);
    
    if (!fileExists) {
      return NextResponse.json({
        error: 'DOCX file not found',
        path: docPath,
        suggestion: 'Please ensure the file exists at the specified path'
      });
    }
    
    // Test 2: Try to process the document
    const chunks = await documentProcessor.processAbuRayyanDocument();
    console.log('Document processed successfully. Chunks:', chunks.length);
    
    // Test 3: Try to initialize vector store
    await ragVectorStore.initialize();
    console.log('Vector store initialized successfully');
    
    // Test 4: Test search
    const results = await ragVectorStore.searchSimilar('What is Abu Rayyan Academy?', 2);
    console.log('Search results:', results.chunks.length);
    
    return NextResponse.json({
      success: true,
      fileExists,
      chunksCount: chunks.length,
      vectorStoreReady: ragVectorStore.isReady(),
      searchResultsCount: results.chunks.length,
      sampleChunk: results.chunks[0]?.content.substring(0, 200) + '...' || 'No chunks found'
    });
    
  } catch (error) {
    console.error('RAG test error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
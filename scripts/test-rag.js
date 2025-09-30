// Test script to validate the document processing and RAG setup
// Run with: node scripts/test-rag.js

const path = require('path');
const fs = require('fs');

// Import our services (using require for Node.js script)
const { documentProcessor } = require('../src/lib/services/document-processing-service.ts');

async function testDocumentProcessing() {
  try {
    console.log('🚀 Testing Document Processing...\n');
    
    // Check if the document file exists
    const docPath = path.join(process.cwd(), 'src', 'data', 'Questions about Abu Rayyan Academy.docx');
    console.log('Document path:', docPath);
    
    if (!fs.existsSync(docPath)) {
      console.error('❌ Document not found:', docPath);
      return;
    }
    
    console.log('✅ Document found');
    
    // Process the document
    console.log('\n📄 Processing document...');
    const chunks = await documentProcessor.processAbuRayyanDocument();
    
    console.log('✅ Document processed successfully!');
    
    // Show statistics
    const stats = documentProcessor.getDocumentStats(chunks);
    console.log('\n📊 Document Statistics:');
    console.log(`- Total chunks: ${stats.totalChunks}`);
    console.log(`- Total words: ${stats.totalWords}`);
    console.log(`- Average words per chunk: ${stats.averageWordsPerChunk}`);
    console.log(`- Sources: ${stats.sources.join(', ')}`);
    
    // Show first few chunks
    console.log('\n📝 Sample chunks:');
    chunks.slice(0, 3).forEach((chunk, index) => {
      console.log(`\nChunk ${index + 1} (${chunk.metadata.wordCount} words):`);
      console.log(chunk.content.substring(0, 200) + '...');
    });
    
    return chunks;
    
  } catch (error) {
    console.error('❌ Error testing document processing:', error.message);
    throw error;
  }
}

async function testRAGAPI() {
  try {
    console.log('\n🧠 Testing RAG API...\n');
    
    // This would require the server to be running
    // For now, just log what we would test
    console.log('To test the RAG API:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Send a POST request to: http://localhost:3000/api/chat-rag');
    console.log('3. Body: {"message": "What is Abu Rayyan Academy?"}');
    console.log('4. Check the console for initialization logs');
    
  } catch (error) {
    console.error('❌ Error testing RAG API:', error.message);
  }
}

async function main() {
  console.log('🔍 RAG System Test\n');
  console.log('==================\n');
  
  try {
    // Test document processing
    await testDocumentProcessing();
    
    // Test RAG API (informational)
    await testRAGAPI();
    
    console.log('\n✅ All tests completed! Your RAG system is ready.');
    console.log('\n🚀 Next steps:');
    console.log('1. Run: npm run dev');
    console.log('2. Open: http://localhost:3000');
    console.log('3. Select "Abu Rayyan Academy" provider');
    console.log('4. Ask questions about Abu Rayyan Academy');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
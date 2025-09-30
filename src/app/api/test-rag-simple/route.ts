import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simple test to see if the endpoint is reachable
    console.log('RAG test endpoint called');
    
    const path = require('path');
    const fs = require('fs');
    
    // Check if the DOCX file exists
    const docPath = path.join(process.cwd(), 'src', 'data', 'Questions about Abu Rayyan Academy.docx');
    const fileExists = fs.existsSync(docPath);
    
    console.log('Checking file at:', docPath);
    console.log('File exists:', fileExists);
    
    if (!fileExists) {
      // List what files are actually in the data directory
      const dataDir = path.join(process.cwd(), 'src', 'data');
      const files = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
      
      return NextResponse.json({
        error: 'DOCX file not found',
        expectedPath: docPath,
        dataDirectory: dataDir,
        filesInDataDir: files,
        workingDirectory: process.cwd()
      });
    }
    
    // Check OpenAI API key
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    
    return NextResponse.json({
      success: true,
      fileExists: true,
      filePath: docPath,
      hasOpenAIKey,
      workingDirectory: process.cwd(),
      message: 'Basic checks passed'
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'basic_test_error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return NextResponse.json({
    message: 'RAG endpoint is reachable',
    method: 'POST'
  });
}
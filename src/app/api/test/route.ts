import { NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

export async function GET() {
  try {
    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }

    // Test basic OpenAI connection (non-streaming)
    const chatModel = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 50,
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: false,
    });

    const response = await chatModel.invoke([
      new HumanMessage("Say 'Hello, test successful!' in exactly those words.")
    ]);

    return NextResponse.json({
      success: true,
      response: response.content,
      apiKeyLength: process.env.OPENAI_API_KEY.length,
      apiKeyStart: process.env.OPENAI_API_KEY.substring(0, 10) + '...',
    });

  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorName: error instanceof Error ? error.name : 'Unknown',
    });
  }
}

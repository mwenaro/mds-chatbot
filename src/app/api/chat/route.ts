import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log('Initializing ChatOpenAI with model:', process.env.OPENAI_MODEL || 'gpt-4o-mini');

    // Initialize ChatOpenAI with streaming enabled
    const chatModel = new ChatOpenAI({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: true,
    });

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Starting stream for message:', message.substring(0, 50) + '...');
          
          // Create the messages array with system message for better responses
          const messages = [
            new SystemMessage("You are a helpful AI assistant. Be conversational, helpful, and provide accurate information."),
            new HumanMessage(message),
          ];
          
          // Stream the response
          const streamingResponse = await chatModel.stream(messages);
          
          let tokenCount = 0;
          for await (const chunk of streamingResponse) {
            tokenCount++;
            const content = chunk.content;
            
            if (content && typeof content === 'string' && content.length > 0) {
              console.log(`Token ${tokenCount}:`, content);
              
              // Format the chunk as Server-Sent Events
              const data = JSON.stringify({ 
                content: content,
                done: false 
              });
              
              // Encode and enqueue the chunk
              controller.enqueue(
                encoder.encode(`data: ${data}\n\n`)
              );
            }
          }
          
          console.log(`Stream completed with ${tokenCount} tokens`);
          
          // Send final message to indicate completion
          const finalData = JSON.stringify({ 
            content: '',
            done: true 
          });
          controller.enqueue(
            encoder.encode(`data: ${finalData}\n\n`)
          );
          
          // Close the stream
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          
          // More detailed error logging
          if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            
            // Check for specific OpenAI errors
            if (error.message.includes('API key')) {
              console.error('API Key issue detected');
            }
            if (error.message.includes('quota') || error.message.includes('billing')) {
              console.error('Billing/quota issue detected');
            }
            if (error.message.includes('model')) {
              console.error('Model issue detected');
            }
          }
          
          // Send error message with more details
          let errorMessage = 'Failed to generate response. ';
          if (error instanceof Error) {
            if (error.message.includes('API key')) {
              errorMessage += 'Invalid API key.';
            } else if (error.message.includes('quota') || error.message.includes('billing')) {
              errorMessage += 'API quota exceeded or billing issue.';
            } else if (error.message.includes('model')) {
              errorMessage += 'Model not available.';
            } else {
              errorMessage += `Error: ${error.message}`;
            }
          } else {
            errorMessage += 'Unknown error occurred.';
          }
          
          const errorData = JSON.stringify({ 
            error: errorMessage,
            done: true 
          });
          controller.enqueue(
            encoder.encode(`data: ${errorData}\n\n`)
          );
          
          controller.close();
        }
      },
    });

    // Return the streaming response with proper headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to process the request' },
      { status: 500 }
    );
  }
}

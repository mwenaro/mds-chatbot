import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { simpleRAGStore } from '@/lib/services/simple-rag-store';

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

    console.log('Simple RAG Query:', message.substring(0, 100) + '...');

    // Initialize the simple RAG store if not already done
    if (!simpleRAGStore.isReady()) {
      console.log('Initializing Simple RAG store...');
      await simpleRAGStore.initialize();
    }

    // Get relevant context from the documents using simple text matching
    const retrievalContext = await simpleRAGStore.getRetrievalContext(message, 3);
    
    console.log('Retrieved context length:', retrievalContext.length);

    // Check if we have OpenAI API key for the LLM
    if (!process.env.OPENAI_API_KEY) {
      // Return a simple response without LLM if no API key
      return NextResponse.json({
        content: `Based on Abu Rayyan Academy documents:\n\n${retrievalContext}`,
        done: true,
        metadata: {
          provider: 'simple-rag',
          contextUsed: true,
          contextLength: retrievalContext.length,
          usingFallback: true
        }
      });
    }

    // Initialize ChatOpenAI with streaming enabled
    const chatModel = new ChatOpenAI({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1500'),
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: true,
    });

    // Create enhanced system message for RAG
    const systemPrompt = `You are an official AI assistant representing Abu Rayyan Academy. You are part of the academy's administration and speak with full authority about the institution.

IMPORTANT GUIDELINES:
1. Respond as an official representative of Abu Rayyan Academy - use "we", "our academy", "at Abu Rayyan Academy"
2. Never say "According to the document" or reference external sources
3. Keep responses concise and natural - don't over-explain simple questions
4. Be welcoming, professional, and helpful
5. Only provide contact information when you genuinely don't know something or when someone specifically asks for contact details

RESPONSE STYLE:
- For simple factual questions: Give direct, brief answers
- For complex questions: Provide more detailed responses
- For unknown information: Politely say you don't have that information and provide contact details
- Avoid unnecessary elaboration or marketing language for basic questions

WHEN TO PROVIDE CONTACT INFO:
- Only when you don't have the information
- When someone asks "how to contact" or "who to speak with"
- When someone needs specific details not in your knowledge
- NOT for every response

TONE:
- Natural and conversational
- Professional but not overly formal
- Confident about academy information
- Concise for simple questions, detailed when needed

Abu Rayyan Academy Information:
${retrievalContext}

Remember: Answer naturally and concisely. You ARE Abu Rayyan Academy's representative.`;

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Starting Simple RAG stream for message:', message.substring(0, 50) + '...');
          
          // Create the messages array with enhanced system message
          const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(message),
          ];
          
          // Stream the response
          const stream = await chatModel.stream(messages);
          
          let fullResponse = '';
          let chunkCount = 0;
          
          for await (const chunk of stream) {
            const content = chunk.content;
            if (content) {
              fullResponse += content;
              chunkCount++;
              
              // Send each chunk to the client
              const chunkData = {
                content,
                done: false,
                metadata: {
                  provider: 'simple-rag-openai',
                  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                  hasContext: retrievalContext.length > 100,
                  chunkCount
                }
              };
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`)
              );
            }
          }
          
          // Send final chunk with completion metadata
          const finalChunk = {
            content: '',
            done: true,
            metadata: {
              provider: 'simple-rag-openai',
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
              totalChunks: chunkCount,
              responseLength: fullResponse.length,
              contextUsed: retrievalContext.length > 100,
              contextLength: retrievalContext.length
            }
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`)
          );
          
          console.log('Simple RAG response completed. Chunks sent:', chunkCount, 'Total length:', fullResponse.length);
          
        } catch (error) {
          console.error('Error in Simple RAG stream:', error);
          
          const errorChunk = {
            content: '',
            done: true,
            error: `Simple RAG Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            metadata: {
              provider: 'simple-rag-openai',
              error: true
            }
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    // Return the streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Simple RAG API Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error in Simple RAG endpoint',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
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
    const systemPrompt = `You are an AI assistant specialized in answering questions about Abu Rayyan Academy. 

You have access to specific documents about Abu Rayyan Academy. Use the provided context to answer questions accurately and comprehensively.

Guidelines:
1. Always prioritize information from the provided context
2. If the context doesn't contain relevant information, clearly state that
3. Be specific and detailed when the context supports it
4. If asked about things not covered in the documents, politely redirect to Abu Rayyan Academy topics
5. Maintain a helpful and professional tone
6. Cite information naturally without being overly formal

Context from Abu Rayyan Academy documents:
${retrievalContext}

---

Please answer the following question based on the context provided above.`;

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
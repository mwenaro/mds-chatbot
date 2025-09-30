import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
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

    // Validate Groq API key
    if (!process.env.GROQ_API_KEY) {
      console.error('Groq API key not found in environment variables');
      return NextResponse.json(
        { error: 'Groq API key not configured' },
        { status: 500 }
      );
    }

    console.log('Groq RAG Query:', message.substring(0, 100) + '...');

    // Initialize the simple RAG store if not already done
    if (!simpleRAGStore.isReady()) {
      console.log('Initializing Simple RAG store for Groq...');
      await simpleRAGStore.initialize();
    }

    // Get relevant context from the documents using simple text matching
    const retrievalContext = await simpleRAGStore.getRetrievalContext(message, 3);
    
    console.log('Retrieved context length:', retrievalContext.length);

    // Initialize Groq client
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
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
          console.log('Starting Groq RAG stream for message:', message.substring(0, 50) + '...');
          
          // Try multiple models in order of preference (current supported models)
          const models = [
            'llama-3.1-8b-instant',
            'mixtral-8x7b-32768',
            'gemma-7b-it'
          ];
          
          let chatCompletion;
          let lastError;
          let usedModel = '';
          
          for (const model of models) {
            try {
              console.log(`Trying Groq model: ${model}`);
              chatCompletion = await groq.chat.completions.create({
                messages: [
                  {
                    role: "system",
                    content: systemPrompt,
                  },
                  {
                    role: "user",
                    content: message,
                  },
                ],
                model: model,
                temperature: 0.7,
                max_tokens: 1500,
                stream: true,
              });
              usedModel = model;
              console.log(`Successfully using model: ${model}`);
              break;
            } catch (modelError) {
              lastError = modelError;
              console.log(`Model ${model} failed, trying next...`, modelError);
              continue;
            }
          }
          
          if (!chatCompletion) {
            throw lastError || new Error('All Groq models failed');
          }
          
          let fullResponse = '';
          let chunkCount = 0;
          
          for await (const chunk of chatCompletion) {
            const content = chunk.choices[0]?.delta?.content || '';
            
            if (content) {
              fullResponse += content;
              chunkCount++;
              
              // Send each chunk to the client
              const chunkData = {
                content,
                done: false,
                metadata: {
                  provider: 'groq-rag',
                  model: usedModel,
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
              provider: 'groq-rag',
              model: usedModel,
              totalChunks: chunkCount,
              responseLength: fullResponse.length,
              contextUsed: retrievalContext.length > 100,
              contextLength: retrievalContext.length
            }
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`)
          );
          
          console.log('Groq RAG response completed. Chunks sent:', chunkCount, 'Total length:', fullResponse.length);
          
        } catch (error) {
          console.error('Error in Groq RAG stream:', error);
          
          const errorChunk = {
            content: '',
            done: true,
            error: `Groq RAG Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            metadata: {
              provider: 'groq-rag',
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
    console.error('Groq RAG API Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error in Groq RAG endpoint',
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
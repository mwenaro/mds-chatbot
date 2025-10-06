import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ragVectorStore } from '@/lib/services/rag-vector-store';
import { AIConfigurationService } from '@/lib/services/ai-configuration';
import { SystemPromptsService } from '@/lib/services/system-prompts';
import { ResponseValidator } from '@/lib/services/response-validator';

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const { message, useAntiHallucination = true } = await req.json();

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

    console.log('RAG Query:', message.substring(0, 100) + '...');

    // Initialize the vector store if not already done
    if (!ragVectorStore.isReady()) {
      console.log('Initializing RAG vector store...');
      await ragVectorStore.initialize();
    }

    // Get relevant context from the documents
    const retrievalContext = await ragVectorStore.getRetrievalContext(message, 3);
    
    console.log('Retrieved context length:', retrievalContext.length);

    // Use anti-hallucination configuration for RAG
    const useCase = useAntiHallucination ? 'factual' : 'balanced';
    const modelConfig = AIConfigurationService.getOpenAIConfig(useCase);

    // Initialize ChatOpenAI with anti-hallucination settings
    const chatModel = new ChatOpenAI(modelConfig);

    // Create enhanced system message for RAG with anti-hallucination measures
    const baseRAGPrompt = SystemPromptsService.getSystemPrompt('rag');
    const systemPrompt = `${baseRAGPrompt}

You are an official AI assistant representing Abu Rayyan Academy. You are part of the academy's administration and speak with full authority about the institution.

CRITICAL ANTI-HALLUCINATION GUIDELINES:
1. ONLY use information from the provided context documents
2. If information is not in the context, clearly state "I don't have that specific information"
3. Never make up details about programs, dates, fees, or procedures
4. Do not invent contact information or URLs
5. When uncertain, recommend contacting the academy directly

RESPONSE GUIDELINES:
- Respond as an official representative using "we", "our academy", "at Abu Rayyan Academy"
- Keep responses concise and natural
- Be welcoming, professional, and helpful
- Only provide contact information when you genuinely don't know something

Abu Rayyan Academy Context Information:
${retrievalContext}

IMPORTANT: Base your response ONLY on the context provided above. If the context doesn't contain sufficient information to answer the question, say so and recommend contacting the academy.`;

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Starting RAG stream for message:', message.substring(0, 50) + '...');
          
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
                  provider: 'rag-openai',
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
          
          // Validate the complete response for hallucinations
          const validation = ResponseValidator.validateResponse(fullResponse, retrievalContext);
          if (!validation.isValid) {
            console.warn('RAG response validation warnings:', validation.warnings);
            
            // Send validation warning as a separate chunk
            const validationData = {
              content: '\n\n*⚠️ Note: Please verify specific details with Abu Rayyan Academy directly, especially dates, fees, or contact information.*',
              done: false,
              metadata: {
                provider: 'rag-openai',
                validation: {
                  confidence: validation.confidence,
                  warnings: validation.warnings
                }
              }
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(validationData)}\n\n`)
            );
          }
          
          // Send final chunk with completion metadata
          const finalChunk = {
            content: '',
            done: true,
            metadata: {
              provider: 'rag-openai',
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
              totalChunks: chunkCount,
              responseLength: fullResponse.length,
              contextUsed: retrievalContext.length > 100,
              contextLength: retrievalContext.length,
              validation: validation.isValid ? undefined : {
                confidence: validation.confidence,
                warnings: validation.warnings
              }
            }
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`)
          );
          
          console.log('RAG response completed. Chunks sent:', chunkCount, 'Total length:', fullResponse.length);
          
        } catch (error) {
          console.error('Error in RAG stream:', error);
          
          const errorChunk = {
            content: '',
            done: true,
            error: `RAG Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            metadata: {
              provider: 'rag-openai',
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
    console.error('RAG API Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error in RAG endpoint',
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
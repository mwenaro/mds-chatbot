import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
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

    console.log('Initializing ChatOpenAI with anti-hallucination config');

    // Use anti-hallucination configuration
    const useCase = useAntiHallucination ? 'factual' : 'balanced';
    const modelConfig = AIConfigurationService.getOpenAIConfig(useCase);
    
    console.log('Model config:', {
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      maxTokens: modelConfig.maxTokens
    });

    // Initialize ChatOpenAI with anti-hallucination settings
    const chatModel = new ChatOpenAI(modelConfig);

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Starting stream for message:', message.substring(0, 50) + '...');
          
          // Detect domain and get appropriate system prompt
          const domain = SystemPromptsService.detectDomain(message);
          const systemPrompt = SystemPromptsService.getDomainPrompt(domain);
          
          // Add uncertainty context if needed
          const enhancedMessage = SystemPromptsService.addUncertaintyContext(message);
          
          // Create the messages array with anti-hallucination system prompt
          const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(enhancedMessage),
          ];
          
          console.log('Using domain-specific prompt for:', domain);
          
          // Stream the response
          const streamingResponse = await chatModel.stream(messages);
          
          let tokenCount = 0;
          let fullResponse = '';
          
          for await (const chunk of streamingResponse) {
            tokenCount++;
            const content = chunk.content;
            
            if (content && typeof content === 'string' && content.length > 0) {
              fullResponse += content;
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
          
          // Validate the complete response
          const validation = ResponseValidator.validateResponse(fullResponse);
          if (!validation.isValid) {
            console.warn('Response validation warnings:', validation.warnings);
            
            // Send validation warning as a separate chunk
            const validationData = JSON.stringify({
              content: '\n\n*⚠️ Note: Please verify the information provided above, especially any specific dates, numbers, or URLs mentioned.*',
              done: false,
              validation: {
                confidence: validation.confidence,
                warnings: validation.warnings
              }
            });
            controller.enqueue(
              encoder.encode(`data: ${validationData}\n\n`)
            );
          }
          
          // Send final message to indicate completion
          const finalData = JSON.stringify({ 
            content: '',
            done: true,
            validation: validation.isValid ? undefined : {
              confidence: validation.confidence,
              warnings: validation.warnings
            }
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

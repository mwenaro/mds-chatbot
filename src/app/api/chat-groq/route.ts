import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { AIConfigurationService } from '@/lib/services/ai-configuration';
import { SystemPromptsService } from '@/lib/services/system-prompts';
import { ResponseValidator } from '@/lib/services/response-validator';

export async function POST(req: NextRequest) {
  try {
    const { message, useAntiHallucination = true } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Groq API key is free - get one at https://console.groq.com
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ 
        error: 'Groq API key not configured. Get a free one at https://console.groq.com' 
      }, { status: 500 });
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // Create streaming response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Try multiple models in order of preference
          const models = [
            'llama-3.1-8b-instant',
            'llama-3.1-70b-versatile', 
            'mixtral-8x7b-32768',
            'gemma-7b-it'
          ];
          
          let completion;
          let lastError;
          
          // Detect domain and get appropriate system prompt
          const domain = SystemPromptsService.detectDomain(message);
          const systemPrompt = SystemPromptsService.getDomainPrompt(domain);
          
          // Add uncertainty context if needed
          const enhancedMessage = SystemPromptsService.addUncertaintyContext(message);
          
          // Get anti-hallucination configuration
          const useCase = useAntiHallucination ? 'factual' : 'balanced';
          const groqConfig = AIConfigurationService.getGroqConfig(useCase);
          
          console.log('Using Groq config:', {
            temperature: groqConfig.temperature,
            max_tokens: groqConfig.max_tokens,
            domain: domain
          });
          
          for (const model of models) {
            try {
              completion = await groq.chat.completions.create({
                messages: [
                  {
                    role: 'system',
                    content: systemPrompt
                  },
                  {
                    role: 'user',
                    content: enhancedMessage,
                  },
                ],
                model: model,
                temperature: groqConfig.temperature,
                max_tokens: groqConfig.max_tokens,
                top_p: groqConfig.top_p,
                frequency_penalty: groqConfig.frequency_penalty,
                presence_penalty: groqConfig.presence_penalty,
                stream: true,
              });
              
              console.log(`Successfully using model: ${model}`);
              break; // Success, exit the loop
            } catch (modelError) {
              lastError = modelError;
              console.log(`Model ${model} failed, trying next...`);
              continue;
            }
          }
          
          if (!completion) {
            throw lastError || new Error('All models failed');
          }

          let fullResponse = '';

          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content;
            
            if (content) {
              fullResponse += content;
              
              const data = JSON.stringify({
                content: content,
                done: false
              });
              
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // Validate the complete response
          const validation = ResponseValidator.validateResponse(fullResponse);
          if (!validation.isValid) {
            console.warn('Groq response validation warnings:', validation.warnings);
            
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

          // Send completion signal
          const finalData = JSON.stringify({
            content: '',
            done: true,
            validation: validation.isValid ? undefined : {
              confidence: validation.confidence,
              warnings: validation.warnings
            }
          });
          controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
          controller.close();

        } catch (error) {
          console.error('Groq error:', error);
          
          let errorMessage = 'Failed to generate response. ';
          if (error instanceof Error) {
            if (error.message.includes('API key')) {
              errorMessage += 'Invalid Groq API key. Get a free one at https://console.groq.com';
            } else if (error.message.includes('quota') || error.message.includes('rate')) {
              errorMessage += 'Rate limit exceeded. Please wait a moment and try again.';
            } else {
              errorMessage += error.message;
            }
          }

          const errorData = JSON.stringify({
            error: errorMessage,
            done: true
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ 
      error: 'Failed to process request' 
    }, { status: 500 });
  }
}

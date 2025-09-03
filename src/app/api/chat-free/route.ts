import { NextRequest, NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Initialize Hugging Face client with your API key for better access
    const hf = new HfInference(process.env.HUGGINGFACE_API_KEY || '');

    // Create streaming response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Starting Hugging Face request for message:', message.substring(0, 50));
          
          // Try simple models that are more likely to work
          const models = [
            'gpt2',
            'microsoft/DialoGPT-medium',
            'microsoft/DialoGPT-small',
          ];
          
          let response;
          let lastError;
          
          for (const modelName of models) {
            try {
              console.log(`Trying model: ${modelName}`);
              
              if (modelName === 'gpt2') {
                response = await hf.textGeneration({
                  model: modelName,
                  inputs: `Human: ${message}\nAI: `,
                  parameters: {
                    max_new_tokens: 100,
                    temperature: 0.8,
                    return_full_text: false,
                    stop: ['Human:', '\n\n'],
                  },
                });
              } else {
                // For DialoGPT models
                response = await hf.textGeneration({
                  model: modelName,
                  inputs: message,
                  parameters: {
                    max_new_tokens: 150,
                    temperature: 0.8,
                    return_full_text: false,
                  },
                });
              }
              
              console.log(`Model ${modelName} succeeded`);
              break;
              
            } catch (modelError) {
              lastError = modelError;
              console.log(`Model ${modelName} failed:`, modelError);
              continue;
            }
          }
          
          if (!response) {
            throw lastError || new Error('All models failed');
          }

          // Since HF doesn't stream by default, we'll simulate streaming
          const text = response.generated_text || '';
          const words = text.split(' ');
          
          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? ' ' : '');
            
            const data = JSON.stringify({
              content: word,
              done: false
            });
            
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            
            // Add small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Send completion signal
          const finalData = JSON.stringify({
            content: '',
            done: true
          });
          controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
          controller.close();

        } catch (error) {
          console.error('Hugging Face error:', error);
          
          const errorData = JSON.stringify({
            error: 'Sorry, the free AI service is temporarily unavailable. Please try the Groq option instead.',
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
      error: 'Failed to process request with free AI service' 
    }, { status: 500 });
  }
}

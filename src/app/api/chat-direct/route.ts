import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create streaming response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: 'You are a helpful AI assistant. Be conversational, helpful, and provide accurate information.' 
              },
              { role: 'user', content: message }
            ],
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
            max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
            stream: true,
          });

          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content;
            
            if (content) {
              const data = JSON.stringify({
                content: content,
                done: false
              });
              
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // Send completion signal
          const finalData = JSON.stringify({
            content: '',
            done: true
          });
          controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
          controller.close();

        } catch (error) {
          console.error('Streaming error:', error);
          
          let errorMessage = 'Failed to generate response. ';
          if (error instanceof Error) {
            if (error.message.includes('API key')) {
              errorMessage += 'Invalid API key.';
            } else if (error.message.includes('quota') || error.message.includes('billing')) {
              errorMessage += 'API quota exceeded.';
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
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

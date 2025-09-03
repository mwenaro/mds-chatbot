import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Create streaming response with a simple mock AI for testing
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Simple response for testing - you can enhance this later
          const responses = [
            "I'm a simple AI assistant. ",
            "I can help you with basic questions. ",
            `You asked: "${message}". `,
            "This is a test response using a simple implementation. ",
            "For better AI responses, try the Groq option which should work reliably."
          ];
          
          for (const response of responses) {
            const data = JSON.stringify({
              content: response,
              done: false
            });
            
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Send completion signal
          const finalData = JSON.stringify({
            content: '',
            done: true
          });
          controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
          controller.close();

        } catch (error) {
          console.error('Simple AI error:', error);
          
          const errorData = JSON.stringify({
            error: 'Simple AI service encountered an error. Please try the Groq option.',
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

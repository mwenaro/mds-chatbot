import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Conversation } from '@/lib/models/conversation';
import { getUserContext } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { messages, title, aiProvider, guestId } = await request.json();
    const userContext = await getUserContext();
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages are required and must be an array' },
        { status: 400 }
      );
    }

    // For guest users, don't save to database - return the conversation data for client-side storage
    if (!userContext.isAuthenticated) {
      return NextResponse.json({
        id: guestId || `guest_${Date.now()}`,
        title: title || 'Guest Conversation',
        messages,
        createdAt: new Date(),
        updatedAt: new Date(),
        aiProvider: aiProvider || 'chat-groq',
        isGuest: true,
      });
    }

    // For authenticated users, save to database
    const conversation = new Conversation({
      title,
      messages,
      aiProvider: aiProvider || 'chat-groq',
      userId: userContext.userId,
    });

    await conversation.save();

    return NextResponse.json({
      id: conversation._id.toString(),
      title: conversation.title,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      aiProvider: conversation.aiProvider,
      isGuest: false,
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext();
    
    // Guest users don't have saved conversations in database
    if (!userContext.isAuthenticated) {
      return NextResponse.json({
        conversations: [],
      });
    }

    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const conversations = await Conversation
      .find({ userId: userContext.userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .skip(offset)
      .select('_id title createdAt updatedAt aiProvider messages')
      .lean();

    return NextResponse.json({
      conversations: conversations.map((conv: Record<string, unknown>) => ({
        id: (conv._id as { toString(): string })?.toString() || '',
        title: conv.title || 'Untitled',
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        aiProvider: conv.aiProvider || 'chat-groq',
        messageCount: Array.isArray(conv.messages) ? conv.messages.length : 0,
        preview: Array.isArray(conv.messages) 
          ? (conv.messages.find((m: Record<string, unknown>) => m.role === 'user') as { content?: string })?.content?.substring(0, 100) || ''
          : '',
      })),
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

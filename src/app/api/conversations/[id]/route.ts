import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Conversation } from '@/lib/models/conversation';
import { getUserContext } from '@/lib/auth-utils';
import mongoose from 'mongoose';


interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userContext = await getUserContext();
    const { id } = await params;
    
    // Guest users can't access saved conversations
    if (!userContext.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await connectToDatabase();
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid conversation ID' },
        { status: 400 }
      );
    }

    const conversation = await Conversation.findOne({ 
      _id: id, 
      userId: userContext.userId 
    }).lean();
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const typedConversation = conversation as Record<string, unknown>;

    return NextResponse.json({
      id: (typedConversation._id as { toString(): string })?.toString() || '',
      title: typedConversation.title || 'Untitled',
      messages: typedConversation.messages || [],
      createdAt: typedConversation.createdAt,
      updatedAt: typedConversation.updatedAt,
      aiProvider: typedConversation.aiProvider || 'chat-groq',
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    
    const { id } = await params;
    const { messages, title, aiProvider } = await request.json();
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid conversation ID' },
        { status: 400 }
      );
    }

    const updateData: { messages?: unknown[]; title?: string; aiProvider?: string } = {};
    if (messages !== undefined) updateData.messages = messages;
    if (title !== undefined) updateData.title = title;
    if (aiProvider !== undefined) updateData.aiProvider = aiProvider;

    const conversation = await Conversation.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).lean();
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const typedConversation = conversation as Record<string, unknown>;

    return NextResponse.json({
      id: (typedConversation._id as { toString(): string })?.toString() || '',
      title: typedConversation.title || 'Untitled',
      messages: typedConversation.messages || [],
      createdAt: typedConversation.createdAt,
      updatedAt: typedConversation.updatedAt,
      aiProvider: typedConversation.aiProvider || 'chat-groq',
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    
    const { id } = await params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid conversation ID' },
        { status: 400 }
      );
    }

    const conversation = await Conversation.findByIdAndDelete(id);
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}

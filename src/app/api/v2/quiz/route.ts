import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Target from '@/lib/models/target';

// Only answer quizzes about the configured target
const TARGET_NAME = 'abu-rayyan'; // You can make this dynamic later

export async function POST(req: NextRequest) {
  await connectToDatabase();
  const { question } = await req.json();

  // Check if question is about the target
  if (!question || !question.toLowerCase().includes(TARGET_NAME.toLowerCase())) {
    return NextResponse.json({
      answer: `Sorry, I can only answer quizzes about ${TARGET_NAME}. Please ask about that target.`,
      allowed: false,
    });
  }

  // Fetch target data from DB
  const target = await Target.findOne({ name: TARGET_NAME });
  if (!target) {
    return NextResponse.json({
      answer: `No data found for target '${TARGET_NAME}'. Please contact admin.`,
      allowed: false,
    });
  }

  // Here you would use RAG logic to answer based on target.details and target.content
  // For now, just echo the details and content
  return NextResponse.json({
    answer: `Here's what I know about ${TARGET_NAME}:\nDetails: ${JSON.stringify(target.details, null, 2)}\nContent: ${target.content?.join("\n")}`,
    allowed: true,
  });
}

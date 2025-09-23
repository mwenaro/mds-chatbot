import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Target from '@/lib/models/target';

export async function POST(req: NextRequest) {
  await connectToDatabase();
  const { name, description, data } = await req.json();
  if (!name || !data) {
    return NextResponse.json({ error: 'Name and data are required.' }, { status: 400 });
  }
  // Upsert target
  const target = await Target.findOneAndUpdate(
    { name },
    { description, data },
    { upsert: true, new: true }
  );
  return NextResponse.json({ success: true, target });
}

export async function PUT(req: NextRequest) {
  await connectToDatabase();
  const { name, description, data } = await req.json();
  if (!name) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }
  const target = await Target.findOneAndUpdate(
    { name },
    { description, data },
    { new: true }
  );
  return NextResponse.json({ success: true, target });
}

export async function GET() {
  await connectToDatabase();
  const targets = await Target.find();
  return NextResponse.json({ targets });
}

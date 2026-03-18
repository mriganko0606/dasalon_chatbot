import { NextResponse } from 'next/server';
import { chatbotService } from '@/lib/chatbot/service';

export async function POST(req: Request) {
  try {
    console.log('Sync request received...');
    const result = await chatbotService.syncDocumentation();
    console.log('Sync completed successfully.');
    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('FATAL SYNC ERROR:', error);
    // Return a structured error response
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}

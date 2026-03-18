import { NextResponse } from 'next/server';
import { chatbotService } from '@/lib/chatbot/service';

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const result = await chatbotService.sendMessage(message, history || []);
    
    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('CHATBOT ROUTE ERROR:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error',
      stack: error.stack
    }, { status: 500 });
  }
}

// Support preflight OPTIONS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

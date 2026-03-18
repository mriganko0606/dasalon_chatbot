import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { vectorStore } from './vector-store';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatbotService {
  private genAI: GoogleGenerativeAI;
  private helpContent: string = '';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.genAI = new GoogleGenerativeAI(apiKey || 'dummy-key');
    this.loadHelpContent();
  }

  private loadHelpContent() {
    try {
      const helpContentPath = path.join(process.cwd(), 'data', 'help-content.json');
      if (fs.existsSync(helpContentPath)) {
        const data = JSON.parse(fs.readFileSync(helpContentPath, 'utf8'));
        this.helpContent = data.map((p: any) => `ARTICLE: ${p.title}\nURL: ${p.url}\nCONTENT: ${p.content}`).join('\n\n---\n\n');
      }
    } catch (error) {
      console.error('Error loading help content:', error);
    }
  }

  private async getRelevantContext(query: string): Promise<string> {
    try {
      const embeddingModel = this.genAI.getGenerativeModel({ model: 'gemini-embedding-2-preview' });
      const result = await embeddingModel.embedContent(query);
      const queryEmbedding = result.embedding.values;

      const results = await vectorStore.search(queryEmbedding, 5);

      if (results.length === 0) return this.helpContent;

      return results
        .map((d) => `FROM: ${d.title} (${d.url})\nCONTENT: ${d.content}`)
        .join('\n\n---\n\n');
    } catch (error) {
      console.error('Vector search error:', error);
      return this.helpContent;
    }
  }

  async sendMessage(userMessage: string, history: ChatMessage[] = []) {
    const relevantContext = await this.getRelevantContext(userMessage);

    const systemPrompt = `
      You are "daSalon Assistant", an expert AI support agent for the daSalon platform.
      
      CONTEXT FOR YOUR ANSWERS:
      You have access to the official daSalon documentation chunks below. Use them to provide accurate and helpful answers.
      
      RULES:
      1. Use the provided documentation context to answer queries.
      2. If the answer is not in the context, politely state you're not sure.
      3. Keep answers concise, professional, and friendly with markdown formatting.
      4. Include relevant URLs if available in the context.
      
      DOCUMENTATION CONTEXT:
      ${relevantContext}
    `;

    const chatHistory: Content[] = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }],
    }));

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemPrompt }],
      },
    });

    const chat = model.startChat({
      history: chatHistory,
    });

    try {
      const result = await chat.sendMessage(userMessage);
      const responseText = result.response.text();

      return {
        message: responseText,
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      throw new Error(`Failed to get response from AI: ${error.message}`);
    }
  }

  private async chunkText(text: string, size: number = 1000): Promise<string[]> {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      let end = start + size;
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        if (lastPeriod > start) end = lastPeriod + 1;
      }
      chunks.push(text.substring(start, end).trim());
      start = end;
    }
    return chunks;
  }

  async syncDocumentation() {
    const BASE_URL = 'https://help.dasalon.com';
    const CATEGORIES = [
      '',
      '/dashboard',
      '/calendar',
      '/calendar/appointments/create-appointment',
      '/calendar/appointments/edit-appointment',
      '/calendar/appointments/reschedule-appointment',
      '/calendar/appointments/cancel-appointment',
      '/calendar/appointments/complete-appointment',
      '/calendar/appointments/no-show-appointment',
      '/calendar/appointments/delete-appointment',
      '/calendar/cal/filter',
      '/calendar/cal/daterange',
      '/calendar/cal/day',
      '/calendar/cal/appoint',
      '/sales',
      '/sales/point-of-sales/createsale',
      '/sales/point-of-sales/searchfilter',
      '/sales/point-of-sales/refundsale',
      '/sales/point-of-sales/voidsale',
      '/sales/point-of-sales/editsale',
      '/sales/point-of-sales/shareinvoice',
      '/sales/point-of-sales/viewsale',
      '/sales/salecategory/servicesale',
      '/sales/salecategory/packagesale',
      '/sales/salecategory/bookalooksale',
      '/sales/salecategory/productsale',
      '/sales/sale-offer/vouchersale',
      '/sales/sale-offer/membershipsale',
      '/sales/sale-offer/giftcardsale',
      '/catalog',
      '/client',
      '/staff',
      '/offer',
      '/payment',
      '/promote',
      '/report',
      '/review',
      '/settings',
    ];
    const embeddingModel = this.genAI.getGenerativeModel({ model: 'gemini-embedding-2-preview' });

    console.log(`Starting documentation sync for ${CATEGORIES.length} cats...`);
    await vectorStore.clear();

    let syncedCount = 0;
    let errorCount = 0;

    for (const cat of CATEGORIES) {
      const url = `${BASE_URL}${cat}`;
      try {
        console.log(`Syncing ${url}...`);
        const { data } = await axios.get(url, { timeout: 15000 });
        
        // Simple HTML stripping using regex
        const titleMatch = data.match(/<h1[^>]*>([^<]+)<\/h1>/i) || data.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : url;
        
        // Strip scripts, styles, and tags
        const content = data
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (content.length > 50) {
          const chunks = await this.chunkText(content);
          for (const chunk of chunks) {
            if (chunk.length < 50) continue;
            try {
              const embRes = await embeddingModel.embedContent(chunk);
              await vectorStore.add({
                content: chunk,
                title,
                url,
                embedding: embRes.embedding.values,
                createdAt: new Date(),
              });
            } catch (e: any) {
                console.error('Chunk embedding error:', e.message);
            }
          }
          syncedCount++;
        }
      } catch (err: any) {
        errorCount++;
        console.error(`Failed to sync ${url}:`, err.message);
      }
    }
    
    vectorStore.save();
    return { success: true, synced: syncedCount, failed: errorCount };
  }

  // Helper method for startup sync that won't run repeatedly during dev HMR
  async autoSyncOnStartup() {
    const globalAny: any = global;
    if (globalAny.__DOCS_SYNCED__) return;
    
    console.log('🚀 Triggering automatic documentation sync...');
    globalAny.__DOCS_SYNCED__ = true;
    
    try {
      await this.syncDocumentation();
    } catch (err) {
      console.error('Auto-sync failed:', err);
      // Allow retry if it failed
      globalAny.__DOCS_SYNCED__ = false;
    }
  }
}

export const chatbotService = new ChatbotService();

// Trigger auto-sync in background
chatbotService.autoSyncOnStartup().catch(console.error);

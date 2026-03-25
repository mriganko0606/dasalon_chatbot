'use client'

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm the daSalon Assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const response = await axios.post('/api/v1/chatbot', {
        message: userMsg,
        history: messages
      });

      const aiMsg = response.data.data.message;
      setMessages(prev => [...prev, { role: 'assistant', content: aiMsg }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen flex-col items-center justify-center p-4 bg-[#0a0a0f]">
      {/* Background blobs for premium look */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full -z-10 animate-pulse"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full -z-10"></div>

      <div className="glass-card flex h-[90vh] w-full max-w-2xl flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/10 p-5 bg-white/5">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <span className="text-xl font-bold">d</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">daSalon Assistant</h1>
              <div className="flex items-center space-x-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs text-white/40 font-medium">Always here to help</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setMessages([{ role: 'assistant', content: "Chat reset. How else can I assist you?" }])}
            className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/60"
          >
            Clear Chat
          </button>
        </header>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth custom-scrollbar"
        >
          {messages.map((m, i) => (
            <div 
              key={i} 
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div className={`message-bubble shadow-sm ${m.role === 'user' ? 'message-user' : 'message-ai'}`}>
                {m.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex flex-col items-start animate-pulse">
              <div className="message-bubble message-ai flex space-x-2 items-center">
                <span className="w-1.5 h-1.5 bg-white/40 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-white/40 rounded-full"></span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <footer className="p-5 border-t border-white/10 bg-black/40">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="relative flex items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question about daSalon..."
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-5 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-white placeholder-white/30"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all font-medium text-sm shadow-lg shadow-indigo-500/20"
            >
              {loading ? '...' : 'Send'}
            </button>
          </form>
          <p className="mt-3 text-[10px] text-center text-white/20 uppercase tracking-widest font-bold">
            Powered by Google Gemini RAG
          </p>
        </footer>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </main>
  );
}

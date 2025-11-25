import React, { useState, useRef, useEffect } from 'react';
import { getGeminiChatResponse, getFastJobTips } from '../services/gemini';
import { ChatMessage } from '../types';

const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hi! I can help you find jobs nearby (Maps) or research companies (Search). What do you need?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState('');

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load a quick tip on mount
  useEffect(() => {
    getFastJobTips("resume writing").then(setTip).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Determine tools based on keywords (naive router)
      const useMaps = input.toLowerCase().includes('near') || input.toLowerCase().includes('map') || input.toLowerCase().includes('location');
      const useSearch = true; // Always default to search enabled for grounding

      // Format history
      const history = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
      }));

      const response = await getGeminiChatResponse(input, history, { search: useSearch, maps: useMaps });
      
      const text = response.text || "I couldn't generate a response.";
      
      // Process grounding chunks if available
      let groundingInfo = "";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
         chunks.forEach((chunk: any) => {
             if (chunk.web?.uri) {
                 groundingInfo += `\n[Source: ${chunk.web.title}](${chunk.web.uri})`;
             }
             if (chunk.maps?.placeId) { // Basic map check
                 groundingInfo += `\n[Map Location: ${chunk.maps.title}]`;
             }
         });
      }

      setMessages(prev => [...prev, { role: 'model', text: text + (groundingInfo ? `\n\nSources:${groundingInfo}` : "") }]);

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-[600px] overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-slate-800">Job Assistant</h3>
                <p className="text-xs text-slate-500">Powered by Gemini Flash • Search & Maps Enabled</p>
            </div>
            {tip && (
                <div className="hidden md:block text-xs bg-yellow-50 text-yellow-800 px-3 py-1 rounded-full border border-yellow-100 max-w-xs truncate">
                    💡 Tip: {tip.slice(0, 50)}...
                </div>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30" ref={scrollRef}>
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                        msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            {loading && (
                 <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                 </div>
            )}
        </div>

        <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask about companies, jobs nearby..."
                    className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
  );
};

export default Assistant;

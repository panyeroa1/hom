import React, { useState, useRef, useEffect, useCallback } from 'react';
import ListingCard from './components/ListingCard';
import ListingDetails from './components/ListingDetails';
import MatchAnalyzer from './components/MatchAnalyzer';
import LiveInterview from './components/LiveInterview';
import { searchListings } from './services/mockDb';
import { parseUserUtterance, createAudioContext } from './services/gemini';
import { ApartmentSearchFilters, Listing } from './types';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';

// --- Helpers ---
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// --- Tool Definition ---
const updateFiltersTool: FunctionDeclaration = {
  name: 'updateSearchFilters',
  description: 'Update the apartment search filters based on user request and return the number of listings found.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      city: { type: Type.STRING, description: 'City name (e.g. Ieper)' },
      minPrice: { type: Type.NUMBER, description: 'Minimum price in Euros' },
      maxPrice: { type: Type.NUMBER, description: 'Maximum price in Euros' },
      minSize: { type: Type.NUMBER, description: 'Minimum size in square meters' },
      bedrooms: { type: Type.NUMBER, description: 'Number of bedrooms' },
      petsAllowed: { type: Type.BOOLEAN, description: 'Whether pets are required' },
      type: { type: Type.STRING, enum: ['apartment', 'house', 'studio'], description: 'Type of property' },
      sortBy: { type: Type.STRING, enum: ["price_asc", "price_desc", "size", "default"] }
    },
  },
};

type ViewState = 'homes' | 'resume' | 'interview';

// --- Main Authenticated App Content ---
const AuthenticatedApp: React.FC = () => {
  const { user, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>('homes');

  // --- State for Homes ---
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [filters, setFilters] = useState<ApartmentSearchFilters>({ sortBy: 'default' });
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [userTranscript, setUserTranscript] = useState(''); 
  const [assistantReply, setAssistantReply] = useState('Tap the mic to meet Homie!');
  
  // Live API State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [volume, setVolume] = useState(0);

  // --- Refs ---
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const activeSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const filtersRef = useRef(filters); 

  // --- Effects ---
  useEffect(() => {
    loadListings(filters);
  }, []);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const loadListings = async (currentFilters: ApartmentSearchFilters) => {
    setIsLoadingListings(true);
    try {
        const results = await searchListings(currentFilters);
        setListings(results);
        return results;
    } finally {
        setIsLoadingListings(false);
    }
  };

  // --- Live API Logic ---
  const startLiveSession = async () => {
    try {
      setConnectionStatus('connecting');
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      // 1. Setup Audio Contexts
      inputAudioContextRef.current = createAudioContext(16000);
      outputAudioContextRef.current = createAudioContext(24000);
      
      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();

      const ai = new GoogleGenAI({ apiKey });

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Live Session Socket Opened');
          },
          onmessage: async (message: LiveServerMessage) => {
             // 1. Handle Tools
             if (message.toolCall) {
                const functionResponses: any[] = [];
                for (const fc of message.toolCall.functionCalls) {
                   if (fc.name === 'updateSearchFilters') {
                      const args = fc.args as any;
                      console.log("Tool called:", args);
                      
                      const newFilters = { ...filtersRef.current, ...args };
                      setFilters(newFilters);
                      const results = await loadListings(newFilters);
                      
                      functionResponses.push({
                        id: fc.id,
                        name: fc.name,
                        response: { result: `Filters updated. Found ${results.length} listings.` }
                      });
                   }
                }
                
                if (functionResponses.length > 0 && activeSessionRef.current) {
                    activeSessionRef.current.sendToolResponse({ functionResponses });
                }
             }

             // 2. Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputAudioContextRef.current) {
                const ctx = outputAudioContextRef.current;
                
                const bytes = base64ToBytes(base64Audio);
                const dataInt16 = new Int16Array(bytes.buffer);
                
                const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
                const channelData = buffer.getChannelData(0);
                for(let i=0; i<dataInt16.length; i++) {
                    channelData[i] = dataInt16[i] / 32768.0;
                }

                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                
                const currentTime = ctx.currentTime;
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                }
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                
                sourcesRef.current.add(source);
                source.addEventListener('ended', () => sourcesRef.current.delete(source));
                
                setAssistantReply("Homie is speaking...");
             }

             // 3. Handle Interruption
             if (message.serverContent?.interrupted) {
                 console.log("Interrupted");
                 sourcesRef.current.forEach(s => s.stop());
                 sourcesRef.current.clear();
                 nextStartTimeRef.current = 0;
             }
          },
          onclose: () => {
             console.log("Session Closed");
             cleanupAudio();
             setIsLiveActive(false);
             setConnectionStatus('idle');
             setAssistantReply("Session ended.");
          },
          onerror: (err: any) => {
             console.error("Live Error", err);
             cleanupAudio();
             setIsLiveActive(false);
             setConnectionStatus('error');
             setAssistantReply("Connection error.");
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            tools: [{ functionDeclarations: [updateFiltersTool] }],
            systemInstruction: `
              You are 'Homie', a dynamic, funny, and helpful real estate agent.
              You MUST speak first. Introduce yourself warmly immediately.
              
              Persona:
              - Friendly, slightly chaotic but competent.
              - Use Flemish/Dutch flair in English (e.g., "Allez," "Right?", "Zeg").
              - Occasional *cough* "sorry" in your speech.
              
              Task:
              - Help the user find an apartment by asking questions.
              - Use the 'updateSearchFilters' tool when the user specifies criteria.
            `,
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
            }
        }
      };

      const session = await ai.live.connect(config);
      activeSessionRef.current = session;
      setConnectionStatus('connected');
      setIsLiveActive(true);
      setAssistantReply("Homie is listening...");

      // Kickstart conversation if model doesn't start automatically
      session.sendRealtimeInput({
          content: [{ text: "Hello! Please introduce yourself to me." }]
      });

      // 4. Start Audio Input Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      if (!inputAudioContextRef.current) return;
      const source = inputAudioContextRef.current.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          
          let sum = 0;
          for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
          const rms = Math.sqrt(sum / inputData.length);
          setVolume(prev => prev * 0.8 + rms * 10 * 0.2);

          const l = inputData.length;
          const int16 = new Int16Array(l);
          for (let i = 0; i < l; i++) {
            int16[i] = inputData[i] * 32768;
          }
          
          if (activeSessionRef.current) {
              const base64Data = bytesToBase64(new Uint8Array(int16.buffer));
              activeSessionRef.current.sendRealtimeInput({
                media: { mimeType: 'audio/pcm;rate=16000', data: base64Data }
              });
          }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContextRef.current.destination);

    } catch (e) {
      console.error(e);
      setConnectionStatus('error');
      setAssistantReply("Could not connect.");
    }
  };

  const cleanupAudio = () => {
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
        processorRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
    }
    if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
    activeSessionRef.current = null;
  };

  const stopLiveSession = useCallback(() => {
    cleanupAudio();
    setIsLiveActive(false);
    setConnectionStatus('idle');
    setVolume(0);
    setAssistantReply("Session ended.");
  }, []);

  const handleMicClick = () => {
     if (isLiveActive) {
        stopLiveSession();
     } else {
        startLiveSession();
     }
  };

  const handleTextSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!userTranscript.trim()) return;
      try {
         const nluResult = await parseUserUtterance(userTranscript, filters, listings);
         if (nluResult.intent === 'ASK_DETAILS' && nluResult.targetListingId) {
            const target = listings.find(l => l.id === nluResult.targetListingId);
            if (target) setSelectedListing(target);
         } else {
             const newFilters = { ...filters, ...nluResult.filters };
             setFilters(newFilters);
             await loadListings(newFilters);
         }
         setAssistantReply(nluResult.assistantReply);
         setUserTranscript('');
      } catch(err) {
          console.error(err);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center transition-all">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('homes')}>
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight hidden sm:block">Match-It</h1>
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
            <button 
                onClick={() => setCurrentView('homes')} 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'homes' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
                Homes
            </button>
            <button 
                onClick={() => setCurrentView('resume')} 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'resume' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
                Resume Check
            </button>
            <button 
                onClick={() => setCurrentView('interview')} 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'interview' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
                Live Interview
            </button>
        </div>

        <div className="flex items-center gap-4">
            {currentView === 'homes' && (
                <div className="flex items-center gap-3 hidden md:flex">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors select-none">
                        <input 
                            type="checkbox" 
                            checked={filters.petsAllowed === true} 
                            onChange={(e) => {
                                const newFilters = { ...filters, petsAllowed: e.target.checked ? true : undefined };
                                setFilters(newFilters);
                                loadListings(newFilters);
                            }}
                            className="w-4 h-4 accent-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                        />
                        <span>Pets</span>
                    </label>
                    <select 
                        value={filters.sortBy || 'default'} 
                        onChange={(e) => {
                            const newFilters = { ...filters, sortBy: e.target.value as ApartmentSearchFilters['sortBy'] };
                            setFilters(newFilters);
                            loadListings(newFilters);
                        }}
                        className="bg-slate-100 text-slate-700 text-sm font-medium px-3 py-2 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer outline-none"
                    >
                        <option value="default">Relevance</option>
                        <option value="price_asc">Price: Low to High</option>
                        <option value="price_desc">Price: High to Low</option>
                    </select>
                </div>
            )}
            
            <div className="border-l border-slate-200 pl-4 ml-2">
                <button 
                    onClick={signOut}
                    className="text-slate-500 hover:text-red-600 transition-colors"
                    title="Sign Out"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                    </svg>
                </button>
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col justify-center py-8 relative">
        
        {currentView === 'resume' && (
            <div className="max-w-4xl mx-auto w-full px-6">
                <MatchAnalyzer />
            </div>
        )}

        {currentView === 'interview' && (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-slate-500 mb-4">Click below to start an AI Job Interview</p>
                    <button 
                        onClick={() => setIsLiveActive(true)} // In a real app, you might trigger the LiveInterview modal differently
                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                        Launch Interview Mode
                    </button>
                    <p className="text-xs text-slate-400 mt-2">(Use the modal interface for full features)</p>
                </div>
                {/* Render Live Interview Modal always if this view is active for demo purposes, or manage via state */}
                <LiveInterview onClose={() => setCurrentView('homes')} />
            </div>
        )}

        {currentView === 'homes' && (
            <>
                {/* Assistant Bubble */}
                <div className="max-w-xl mx-auto mb-8 px-6 text-center">
                    <div className={`
                        inline-block bg-white border shadow-sm rounded-2xl rounded-bl-none px-6 py-4 text-slate-700 text-lg leading-relaxed animate-fade-in relative overflow-hidden transition-all duration-300
                        ${isLiveActive ? 'border-indigo-400 shadow-indigo-100 scale-105' : 'border-indigo-100'}
                    `}>
                        {isLiveActive ? (
                        <div className="flex flex-col items-center min-w-[200px]">
                            <div className="flex items-center justify-center gap-1.5 h-8 mb-2">
                                {[...Array(5)].map((_, i) => (
                                    <div 
                                        key={i} 
                                        className="w-1.5 bg-indigo-500 rounded-full transition-all duration-75"
                                        style={{ 
                                            height: `${Math.max(20, Math.min(100, Math.random() * 40 + volume * 200))}%`,
                                            opacity: 0.5 + (volume * 0.5)
                                        }}
                                    ></div>
                                ))}
                            </div>
                            <p className="text-indigo-600 font-medium text-sm animate-pulse">{assistantReply}</p>
                        </div>
                        ) : (
                            assistantReply
                        )}
                    </div>
                </div>

                {/* Listings Carousel */}
                <div className="w-full overflow-x-auto pb-12 pt-4 px-6 snap-x snap-mandatory scrollbar-hide">
                    {isLoadingListings ? (
                        <div className="flex gap-6 w-max mx-auto px-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex-shrink-0 w-80 bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 h-[340px] animate-pulse">
                                    <div className="h-48 bg-slate-200 w-full"></div>
                                    <div className="p-4 space-y-3">
                                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : listings.length === 0 ? (
                        <div className="text-center text-slate-400 py-12">
                            <p>No listings found. Try adjusting your search.</p>
                        </div>
                    ) : (
                        <div className="flex gap-6 w-max mx-auto px-4">
                            {listings.map(listing => (
                                <ListingCard 
                                    key={listing.id} 
                                    listing={listing} 
                                    onClick={(l) => setSelectedListing(l)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </>
        )}
      </main>

      {/* Bottom Control Bar (Only for Homes View) */}
      {currentView === 'homes' && (
          <div className="sticky bottom-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 pb-8 pt-4 px-4 z-30">
            <div className="max-w-2xl mx-auto flex items-center gap-4">
                <form onSubmit={handleTextSearch} className="flex-grow relative group">
                    <input 
                        type="text" 
                        value={userTranscript}
                        onChange={(e) => setUserTranscript(e.target.value)}
                        placeholder={isLiveActive ? "Listening..." : "Type or tap the mic..."}
                        disabled={isLiveActive}
                        className="w-full bg-slate-100 text-slate-900 placeholder:text-slate-500 rounded-full py-4 pl-6 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50"
                    />
                    <button type="submit" disabled={isLiveActive} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white rounded-full shadow-sm text-indigo-600 opacity-0 group-focus-within:opacity-100 transition-opacity">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                    </button>
                </form>

                <button 
                    onClick={handleMicClick}
                    className={`
                        relative flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 z-10
                        ${isLiveActive 
                            ? 'bg-white border-4 border-red-500 shadow-xl scale-110' 
                            : 'bg-indigo-600 shadow-indigo-500/30 hover:bg-indigo-700 shadow-lg hover:scale-105'
                        }
                        ${connectionStatus === 'connecting' ? 'animate-pulse cursor-wait' : ''}
                    `}
                >
                    {isLiveActive && (
                        <>
                            <span className="absolute inset-0 rounded-full border-2 border-red-400 opacity-70 animate-ping"></span>
                            <span 
                                className="absolute inset-0 rounded-full border-4 border-red-200 opacity-50 transition-transform duration-100 ease-out"
                                style={{ transform: `scale(${1 + volume * 1.5})` }}
                            ></span>
                        </>
                    )}

                    {isLiveActive ? (
                        <div className="w-5 h-5 bg-red-500 rounded-sm relative z-20"></div>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white relative z-20">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                        </svg>
                    )}
                </button>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2 font-medium">
                {connectionStatus === 'connecting' ? 'Connecting to Homie...' : isLiveActive ? 'Tap to Stop' : 'Tap for Live Agent'}
            </p>
        </div>
      )}
      
      {selectedListing && (
          <ListingDetails 
              listing={selectedListing} 
              onClose={() => setSelectedListing(null)} 
          />
      )}

    </div>
  );
};

// --- Container App ---
const App: React.FC = () => {
    return (
        <AuthProvider>
            <AuthConsumer />
        </AuthProvider>
    );
};

const AuthConsumer: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                 <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

    if (!user) {
        return <AuthScreen />;
    }

    return <AuthenticatedApp />;
};

export default App;
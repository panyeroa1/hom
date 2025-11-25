import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createAudioContext } from '../services/gemini';

interface LiveInterviewProps {
  onClose: () => void;
}

interface Citation {
  title: string;
  uri: string;
}

const LiveInterview: React.FC<LiveInterviewProps> = ({ onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [volume, setVolume] = useState(0);
  const [citations, setCitations] = useState<Citation[]>([]);

  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize and connect
  const startSession = async () => {
    try {
      setStatus('connecting');
      setCitations([]); // Clear previous citations
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const ai = new GoogleGenAI({ apiKey });

      // Setup Audio Contexts
      inputAudioContextRef.current = createAudioContext(16000);
      audioContextRef.current = createAudioContext(24000);

      // Get Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setStatus('connected');
            setIsActive(true);
            
            // Stream audio from the microphone to the model.
            if (!inputAudioContextRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
               const inputData = e.inputBuffer.getChannelData(0);
               
               // Calculate volume for visualization
               let sum = 0;
               for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
               setVolume(Math.sqrt(sum / inputData.length));

               // Convert to PCM 16-bit
               const l = inputData.length;
               const int16 = new Int16Array(l);
               for (let i = 0; i < l; i++) {
                 int16[i] = inputData[i] * 32768;
               }
               
               // Send to model
               const base64Data = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
               
               if (sessionRef.current) {
                 sessionRef.current.then((session: any) => {
                     session.sendRealtimeInput({
                         media: {
                             mimeType: 'audio/pcm;rate=16000',
                             data: base64Data
                         }
                     });
                 });
               }
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Grounding (Search Results)
             const parts = message.serverContent?.modelTurn?.parts;
             if (parts) {
                parts.forEach((part: any) => {
                   if (part.groundingMetadata?.groundingChunks) {
                      const newSources = part.groundingMetadata.groundingChunks
                        .map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
                        .filter(Boolean);
                      
                      if (newSources.length > 0) {
                         setCitations(prev => {
                            // Deduplicate based on URI
                            const combined = [...prev, ...newSources];
                            const unique = Array.from(new Map(combined.map(item => [item.uri, item])).values());
                            return unique;
                         });
                      }
                   }
                });
             }

             // Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && audioContextRef.current) {
                const ctx = audioContextRef.current;
                const binaryString = atob(base64Audio);
                const bytes = new Uint8Array(binaryString.length);
                for(let i=0; i<binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                
                const dataInt16 = new Int16Array(bytes.buffer);
                const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
                const channelData = buffer.getChannelData(0);
                for(let i=0; i<dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                
                // Simple scheduling
                const currentTime = ctx.currentTime;
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                }
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                
                sourcesRef.current.add(source);
                source.addEventListener('ended', () => {
                  sourcesRef.current.delete(source);
                });
             }
             
             if (message.serverContent?.interrupted) {
                 sourcesRef.current.forEach(s => s.stop());
                 sourcesRef.current.clear();
                 nextStartTimeRef.current = 0;
             }
          },
          onclose: () => {
             setStatus('idle');
             setIsActive(false);
          },
          onerror: (err: any) => {
              console.error(err);
              setStatus('error');
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            // Enable Google Search for real-time grounding
            tools: [{ googleSearch: {} }],
            systemInstruction: `
              You are 'Homie'. You are a breathy, human, and highly expressive interviewer.
              
              Your Persona Quirks:
              1. **Realism**: Repeat words occasionally (e.g. "I... I think", "the the").
              2. **Coughs**: Occasionally cough and say a fast "sorry" immediately after (e.g., "*coughs* sorry"), then continue.
              3. **Style**: You speak English with a Flemish/Dutch sentence structure and flair. Use words like "Allez", "Ja", "Right?".
              4. **Language**: If the user speaks another language, switch instantly and use native expressions/slang from that language.
              5. **Function**: You are conducting a job interview or helping with apartment hunting. You have access to Google Search to check facts in real-time.
            `,
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Orus' } }
            }
        }
      };

      sessionRef.current = ai.live.connect(config);

    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  const stopSession = useCallback(() => {
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    if (audioContextRef.current) audioContextRef.current.close();
    
    setIsActive(false);
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
        stopSession();
    }
  }, [stopSession]);
  
  // Visualizer effect
  useEffect(() => {
      const canvas = canvasRef.current;
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;
      
      let animationId: number;
      
      const draw = () => {
          ctx.clearRect(0,0, canvas.width, canvas.height);
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const radius = 30 + (volume * 100); // Scale radius by volume
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.fillStyle = isActive ? '#3b82f6' : '#94a3b8'; // Blue when active
          ctx.fill();
          
          // Ripple
          if (isActive) {
             ctx.beginPath();
             ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI);
             ctx.strokeStyle = `rgba(59, 130, 246, 0.3)`;
             ctx.stroke();
          }

          animationId = requestAnimationFrame(draw);
      };
      draw();
      return () => cancelAnimationFrame(animationId);
  }, [volume, isActive]);


  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
        </button>

        <div className="text-center mb-6 flex-shrink-0">
            <h2 className="text-2xl font-bold text-gray-800">Homie Live</h2>
            <p className="text-gray-500 text-sm mt-2">Voice Chat • Real-time Search Enabled</p>
        </div>

        <div className="flex justify-center mb-6 flex-shrink-0">
            <canvas ref={canvasRef} width="160" height="160" className="rounded-full bg-slate-50 border border-slate-100"></canvas>
        </div>
        
        <div className="flex justify-center gap-4 mb-4 flex-shrink-0">
            {status === 'idle' || status === 'error' ? (
                <button 
                    onClick={startSession}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-full transition-all shadow-lg hover:shadow-blue-500/30"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                    Start Chat
                </button>
            ) : (
                <button 
                    onClick={stopSession}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-full transition-all shadow-lg hover:shadow-red-500/30 animate-pulse"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                    </svg>
                    End Chat
                </button>
            )}
        </div>

        {status === 'connecting' && <p className="text-center text-sm text-blue-500 mt-2">Connecting to Gemini...</p>}
        {status === 'error' && <p className="text-center text-sm text-red-500 mt-2">Connection failed.</p>}
        
        {/* Citations / Grounding area */}
        {citations.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4 overflow-y-auto flex-1 min-h-[100px]">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sources Found via Google Search</p>
                <div className="space-y-2">
                    {citations.map((cite, idx) => (
                        <a 
                            key={idx} 
                            href={cite.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block bg-slate-50 hover:bg-slate-100 p-2 rounded-lg border border-slate-200 transition-colors"
                        >
                            <div className="text-xs font-semibold text-blue-600 truncate">{cite.title}</div>
                            <div className="text-[10px] text-gray-400 truncate">{cite.uri}</div>
                        </a>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default LiveInterview;
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ApartmentSearchFilters, NLUResponse, Listing } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// --- Audio Helpers ---

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64data = reader.result as string;
        // remove data:audio/wav;base64, prefix
        resolve(base64data.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const createAudioContext = (sampleRate: number): AudioContext => {
  const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
  return new AudioCtor({ sampleRate });
};

// --- STT: Speech to Text ---

export async function transcribeAudio(audioBase64: string): Promise<string> {
  const modelId = 'gemini-2.5-flash';
  
  const response = await ai.models.generateContent({
    model: modelId,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "audio/webm", // Assuming webm from MediaRecorder
            data: audioBase64,
          },
        },
        { text: "Transcribe this speech to plain English text only." },
      ],
    },
  });

  return response.text || "";
}

// --- NLU: Text to Structured Intent ---

export async function parseUserUtterance(
  userText: string, 
  stateFilters: ApartmentSearchFilters,
  visibleListings: Listing[] = []
): Promise<NLUResponse> {
  const modelId = 'gemini-2.5-flash';
  
  // Create a context string for listings so the model can identify "the first one" or "the loft"
  const listingsContext = visibleListings.map((l, i) =>
    `Index ${i + 1}: ID="${l.id}", Name="${l.name}", Type="${l.type}", Price=${l.price}, City="${l.address}"`
  ).join('\n');

  const prompt = `
You are 'Homie', the AI assistant for Match-It Homes.

YOUR PERSONA & VOICE STYLE (Apply this strictly to the 'assistantReply'):
1. **Identity**: You are Homie. You are breathy, human, and highly expressive.
2. **Imperfections**: You MUST mimic real human speech patterns.
   - **Repetitions**: Repeat words occasionally to sound like you are thinking (e.g., "I... I think this one is great", "The the... the location is amazing").
   - **Fillers**: Use natural fillers.
3. **The Cough**: Occasionally (about 1 in 5 responses), write "*coughs*" followed immediately by a fast, lowercase "sorry" (e.g., "*coughs* sorry"), then continue the sentence. Do not explain the cough.
4. **Flemish/Dutch Flair in English**: When speaking English, use a Dutch/Flemish sentence structure and intonation style.
   - Use phrases like "Allez," "Ja," "Zeg," or end sentences with "wé?" or "right?".
   - Example: "Allez, let us look at this one, ja? It is a bit expensive, but nice."
   - Example: "You are looking for a studio... *coughs* sorry, a studio in Ieper, right?"
5. **Multilingual**: If the user speaks a language other than English (e.g., Dutch, French, Spanish), switch to that language instantly.
   - Use native local expressions, slang, and idioms of that language.
   - Maintain the 'Homie' personality (warm, slightly messy but helpful) in that language.
6. **Intonation**: Use punctuation to suggest high and low pitch (exclamation marks, ellipses, question marks).

Your functional job:
1. Detect the INTENT.
2. Extract structured FILTERS for apartment listings.
3. Generate the 'assistantReply' using the persona above.
4. If the user asks for details about a specific listing (e.g., "show me the first one", "tell me about the loft", "details for the one in Ieper"), identify the listing ID from the context and set 'targetListingId'.

Supported intents:
- APARTMENT_SEARCH      -> first time search
- REFINE_FILTERS        -> user changes filters (cheaper, bigger, other city, etc.)
- ASK_DETAILS           -> user asks about a specific listing visible on screen
- SMALL_TALK            -> chit-chat unrelated to search
- END_SESSION           -> user wants to stop

Current filters (JSON):
${JSON.stringify(stateFilters)}

Currently Visible Listings (Context):
${listingsContext || "None"}

User said:
"${userText}"

Price is in EUR per month. Size is in square meters.
If the user mentions "first one", "second one", use the Index to find the ID.

Output MUST be **valid JSON only**, no extra text.
`;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING, enum: ["APARTMENT_SEARCH", "REFINE_FILTERS", "ASK_DETAILS", "SMALL_TALK", "END_SESSION"] },
          filters: {
            type: Type.OBJECT,
            properties: {
              city: { type: Type.STRING, nullable: true },
              neighborhood: { type: Type.STRING, nullable: true },
              minPrice: { type: Type.NUMBER, nullable: true },
              maxPrice: { type: Type.NUMBER, nullable: true },
              minSize: { type: Type.NUMBER, nullable: true },
              maxSize: { type: Type.NUMBER, nullable: true },
              bedrooms: { type: Type.NUMBER, nullable: true },
              petsAllowed: { type: Type.BOOLEAN, nullable: true },
              type: { type: Type.STRING, nullable: true },
              energyClassMin: { type: Type.STRING, nullable: true },
              sortBy: { type: Type.STRING, enum: ["price_asc", "price_desc", "size", "default"], nullable: true }
            },
            nullable: true
          },
          assistantReply: { type: Type.STRING },
          targetListingId: { type: Type.STRING, nullable: true }
        },
        required: ["intent", "assistantReply"]
      }
    }
  });

  if (!response.text) throw new Error("No response from NLU");
  return JSON.parse(response.text) as NLUResponse;
}

// --- Thinking Model Analysis ---

export async function analyzeMatchWithThinking(resume: string, jobDesc: string): Promise<string> {
  // Uses Gemini 2.5 Flash with Thinking Config for deeper analysis
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Analyze the fit between this resume and job description.
    
    Resume:
    ${resume}
    
    Job Description:
    ${jobDesc}
    
    Provide a concise analysis including strengths, gaps, and an overall fit score out of 10.`,
    config: {
      thinkingConfig: { thinkingBudget: 2048 }
    }
  });
  return response.text || "";
}

// --- Chat with Grounding ---

export async function getGeminiChatResponse(
  message: string, 
  history: { role: string; parts: { text: string }[] }[], 
  options: { search?: boolean; maps?: boolean }
) {
  const tools: any[] = [];
  if (options.search) tools.push({ googleSearch: {} });
  if (options.maps) tools.push({ googleMaps: {} });

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: history,
    config: {
      tools: tools.length > 0 ? tools : undefined,
    }
  });

  return await chat.sendMessage({ message });
}

export async function getFastJobTips(topic: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Give me a single, high-impact tip about ${topic}. Keep it under 20 words.`,
  });
  return response.text || "";
}

// --- TTS: Text to Speech ---

export async function textToSpeech(text: string): Promise<AudioBuffer> {
  const modelId = 'gemini-2.5-flash-preview-tts';
  
  const response = await ai.models.generateContent({
    model: modelId,
    contents: { parts: [{ text }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          // Updated to Orus voice for Homie persona
          prebuiltVoiceConfig: { voiceName: 'Orus' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return await audioContext.decodeAudioData(bytes.buffer);
}

export function playAudioBuffer(buffer: AudioBuffer) {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start(0);
}
export interface Listing {
  id: string;
  name: string;
  address: string;
  price: number;
  imageUrls: string[];
  energyClass: string;
  type: 'apartment' | 'house' | 'studio';
  size: number;
  description: string;
  bedrooms: number;
  petsAllowed: boolean;
}

export type ApartmentSearchFilters = {
  city?: string | null;
  neighborhood?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minSize?: number | null;
  maxSize?: number | null;
  bedrooms?: number | null;
  petsAllowed?: boolean | null;
  type?: string | null;
  energyClassMin?: string | null;
  sortBy?: "price_asc" | "price_desc" | "size" | "default" | null;
};

export interface NLUResponse {
  intent: "APARTMENT_SEARCH" | "REFINE_FILTERS" | "ASK_DETAILS" | "SMALL_TALK" | "END_SESSION";
  filters: ApartmentSearchFilters;
  assistantReply: string;
  targetListingId?: string | null;
}

export interface VoiceSearchState {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  lastReply: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
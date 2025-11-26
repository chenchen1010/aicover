
export interface TextLayout {
  main_text: string;
  sub_text: string;
  design_note: string;
  tags: string; // New field for SEO tags
}

export interface StrategyRecommendation {
  style_recommendation: string;
  reasoning: string;
  gemini_image_prompt: string;
  text_layout_guide: TextLayout;
}

export interface CoverResult extends StrategyRecommendation {
  generatedImage?: string; // Base64 string
  isGeneratingImage: boolean;
  imageError?: string;
  finalPrompt?: string; // The actual full prompt used for generation (editable)
}

export interface StoredImage {
  preview: string;
  base64: string;
  mimeType: string;
}

export interface HistoryItem {
  id: string;
  topic: string;
  timestamp: number;
  results: CoverResult[];
  // Support multiple images, keep referenceImage optional for backward compatibility if needed temporarily
  referenceImages: StoredImage[]; 
}

// Global augmentation for AI Studio key selection
declare global {
  // The environment apparently already declares `window.aistudio` with type `AIStudio`.
  // We augment the `AIStudio` interface to ensure it has the methods we need.
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}

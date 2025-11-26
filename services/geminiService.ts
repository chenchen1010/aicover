
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { StrategyRecommendation } from "../types";

// Helper to get a fresh client instance (important for key updates)
const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper for delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Step 1: Analyze the topic and generate strategies (Text/Logic)
 * Uses gemini-3-pro-preview for complex reasoning.
 */
export const generateStrategies = async (topic: string): Promise<StrategyRecommendation[]> => {
  const ai = getClient();
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [{
      role: "user",
      parts: [{ text: `Topic: ${topic}` }]
    }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            style_recommendation: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            gemini_image_prompt: { type: Type.STRING },
            text_layout_guide: {
              type: Type.OBJECT,
              properties: {
                main_text: { type: Type.STRING },
                sub_text: { type: Type.STRING },
                design_note: { type: Type.STRING },
                tags: { type: Type.STRING },
              },
              required: ["main_text", "sub_text", "design_note", "tags"],
            },
          },
          required: ["style_recommendation", "reasoning", "gemini_image_prompt", "text_layout_guide"],
        },
      },
    },
  });

  let text = response.text;
  if (!text) throw new Error("No response from Gemini Logic");
  
  // Clean potential markdown code blocks (Gemini sometimes wraps JSON in ```json ... ```)
  if (text.startsWith('```')) {
    text = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  try {
    return JSON.parse(text) as StrategyRecommendation[];
  } catch (e) {
    console.error("Failed to parse JSON", text);
    throw new Error("Invalid JSON response from Gemini");
  }
};

interface ReferenceImage {
  data: string; // Base64 string (raw, no prefix)
  mimeType: string;
}

/**
 * Step 2: Generate the image based on the prompt (Image)
 * Tries gemini-3-pro-image-preview first.
 * Fallbacks to gemini-2.5-flash-image if permission denied (403).
 */
export const generateCoverImage = async (prompt: string, referenceImage?: ReferenceImage): Promise<string> => {
  const ai = getClient();
  const maxRetries = 2; // Reduced retries since we have a fallback

  // Construct contents
  const parts: any[] = [{ text: prompt }];
  
  // If reference image exists, add it to parts
  if (referenceImage) {
    parts.push({
      inlineData: {
        mimeType: referenceImage.mimeType,
        data: referenceImage.data
      }
    });
  }

  // Attempt 1: Try High Quality Model
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4", 
          imageSize: "1K" // Supported only in Pro
        }
      }
    });
    return extractImageFromResponse(response);
  } catch (err: any) {
    console.warn("Pro model failed, checking error type...", err);
    
    // Check if error is 403 Permission Denied or 404 Not Found (if model not available to user)
    const isPermissionError = err.message?.includes("403") || err.message?.includes("PERMISSION_DENIED") || err.status === 403;
    const isNotFoundError = err.message?.includes("404") || err.status === 404;

    if (isPermissionError || isNotFoundError) {
       console.log("Falling back to Flash model due to permissions/availability.");
       // Fallback to Flash Model
       // Note: Flash does not support 'imageSize'
       const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "3:4",
            // No imageSize
          }
        }
      });
      return extractImageFromResponse(response);
    } else {
      // If it's another error (like server overload), verify if we should retry or throw
      throw err;
    }
  }
};

const extractImageFromResponse = (response: any): string => {
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }
  throw new Error("No image data found in response");
};

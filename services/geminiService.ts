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
              },
              required: ["main_text", "sub_text", "design_note"],
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

/**
 * Step 2: Generate the image based on the prompt (Image)
 * Uses gemini-3-pro-image-preview for high quality output.
 * Includes Retry Logic for stability.
 */
export const generateCoverImage = async (prompt: string): Promise<string> => {
  const ai = getClient();
  const maxRetries = 3;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "3:4", 
            imageSize: "1K"
          }
        }
      });

      // Extract image
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return part.inlineData.data;
        }
      }
      
      throw new Error("No image data found in response");

    } catch (err: any) {
      console.warn(`Image generation attempt ${attempt + 1} failed:`, err);
      lastError = err;
      
      // If it's the last attempt, don't wait, just throw
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s...
        await wait(1000 * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error("Image generation failed after retries");
};
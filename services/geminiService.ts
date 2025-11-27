import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI
// Using process.env.API_KEY as per coding guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const GeminiService = {
  /**
   * Generates a short, concise WhatsApp message.
   */
  generateMessage: async (
    residentName: string,
    category: string,
    staffNotes: string
  ): Promise<string> => {
    // API Key is assumed to be valid and available as per guidelines.

    // STRICT RULE: If staff did not provide notes, do NOT generate any AI text.
    // This applies to ALL categories (Breakfast, Lunch, Vitals, etc.).
    // Returning an empty string ensures only the image is sent.
    if (!staffNotes || staffNotes.trim().length === 0) {
        return ""; 
    }

    // If notes exist, ask AI to simply polish/correct them.
    const prompt = `
      You are a care home assistant. 
      Refine the following raw notes from staff into a professional, warm, and concise WhatsApp message for the family of resident "${residentName}".
      
      Context:
      - Category: ${category}
      - Raw Input: "${staffNotes}"
      
      Rules:
      - Fix grammar and spelling.
      - Keep it short (max 1-2 sentences).
      - Maintain the original meaning strictly.
      - NO headers, NO hashtags, NO "Hello family".
      - Just the message text.
    `;

    try {
      // Using gemini-2.5-flash as the standard for text tasks
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text || staffNotes;
    } catch (error) {
      console.error("Error generating AI message:", error);
      // Fallback to original notes if AI fails
      return staffNotes;
    }
  }
};
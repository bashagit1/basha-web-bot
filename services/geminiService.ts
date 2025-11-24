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

    // 1. Logic for General Update:
    // If it is 'General Update' and there are NO staff notes, do not generate a message.
    // This allows staff to just upload a photo without AI inventing text.
    if (category === 'General Update' && (!staffNotes || staffNotes.trim().length === 0)) {
        return ""; // Return empty string. The logging system will skip sending text if this is empty.
    }

    let specificInstruction = "";

    // 2. Logic to determine the strictness of the prompt
    if (category === 'Vital Signs' || category === 'Glucose') {
      specificInstruction = "Strictly write ONE short line. State that checks were done and status is stable (unless notes say otherwise). Example: 'Vital signs checked - everything looks normal.'";
    } else if (staffNotes && staffNotes.trim().length > 0) {
      specificInstruction = "The staff provided a specific note. Polish it to be professional and grammatically correct, but keep it VERY short. Do not add extra fluff. Max 1 sentence.";
    } else {
      // Default for Meals without notes
      specificInstruction = `Write a very brief 1-sentence update about ${category}. Keep it under 12 words. Example: '${residentName} had a good appetite for breakfast.'`;
    }

    const prompt = `
      You are a care home assistant. Write a WhatsApp message for the family of "${residentName}".
      
      Context:
      - Category: ${category}
      - Raw Input: "${staffNotes}"
      
      Constraint: ${specificInstruction}
      
      Output Rules:
      - NO headers.
      - NO "Hello family".
      - NO hashtags.
      - Just the message text.
    `;

    try {
      // Using gemini-2.5-flash as the standard for text tasks
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text || `Update: ${category} checked. ${staffNotes}`;
    } catch (error) {
      console.error("Error generating AI message:", error);
      return `Update for ${residentName}: ${category}. ${staffNotes}`;
    }
  }
};
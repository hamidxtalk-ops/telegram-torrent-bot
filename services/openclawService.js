/**
 * OpenClaw Service
 * Handles natural language task processing using Gemini
 */

import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Parses user input to determine intent and extract data
 */
export async function processAssistantRequest(text, userId) {
    if (!GEMINI_API_KEY) return { type: 'error', message: 'API key not configured' };

    try {
        const now = new Date().toISOString();
        const prompt = `
        You are an intelligent assistant named "Super Helper". 
        The current time is: ${now}.
        
        Analyze this user request: "${text}"
        
        Determine the intent and return a JSON object.
        
        POSSIBLE INTENTS:
        1. "reminder": User wants to be reminded of something.
           Identify: "task" (what to do) and "time" (ISO 8601 format when to remind).
        2. "search": User wants to search for information.
           Identify: "query".
        3. "chat": General talk or question.
           Identify: "response" (Your friendly answer).
        
        RULES:
        - For reminders, calculate the absolute time in ISO format based on relative terms like "in 5 minutes" or "tomorrow at 10am".
        - If the request is ambiguous, ask for clarification in a "chat" response.
        - Respond ONLY in JSON format.
        
        JSON STRUCTURE:
        {
            "intent": "reminder|search|chat",
            "data": {
                "task": "...",
                "time": "...",
                "query": "...",
                "response": "..."
            }
        }
        `;

        const response = await axios.post(GEMINI_ENDPOINT, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleanJson = aiText.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error('Assistant Processing Error:', error.message);
        return { intent: 'chat', data: { response: 'Sorry, I had trouble processing that request.' } };
    }
}

/**
 * Performs a broad web-style search using Gemini's knowledge
 */
export async function performAISearch(query) {
    if (!GEMINI_API_KEY) return 'Search service unavailable.';

    try {
        const prompt = `
        You are a highly capable search engine assistant. 
        Research and provide a detailed answer for the following query:
        "${query}"
        
        Provide the answer in Persian (Farsi) but keep Technical terms or English names in brackets.
        Give a comprehensive, helpful, and accurate summary.
        `;

        const response = await axios.post(GEMINI_ENDPOINT, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No information found.';
    } catch (error) {
        console.error('AI Search Error:', error.message);
        return 'Failed to perform search.';
    }
}

export default {
    processAssistantRequest,
    performAISearch
};

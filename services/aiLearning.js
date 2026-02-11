/**
 * AI Learning Service
 * Uses Google Gemini to explain movie dialogues and idioms
 */

import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Explains a piece of movie dialogue in a language learning context
 */
export async function explainDialogue(text, movieTitle = 'Unknown Movie', persona = 'Teacher') {
    if (!GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY not found in environment variables');
        return { error: 'API key not configured' };
    }

    let personaInstruction = 'You are a bilingual language teacher (English and Persian).';

    if (persona && persona !== 'Teacher') {
        personaInstruction = `
        You are acting as **${persona}**. 
        You MUST speak in the style, tone, and vocabulary of this character while teaching English to a Persian speaker.
        Use their famous catchphrases or mannerisms, but ensure the educational value remains high.
        Start the response with a characteristic greeting from this persona.
        `;
    }

    try {
        const prompt = `
        ${personaInstruction}
        I will give you a dialogue snippet from the movie "${movieTitle}".
        Your task is to:
        1. Provide the Farsi (Persian) translation of the text.
        2. Identify important English vocabulary (words or idioms) from the text.
        3. Explain the grammar/idioms.
        4. Provide a "Pro Tip".

        DIALOGUE:
        "${text}"
        
        RETURN A JSON OBJECT WITH THIS STRUCTURE (Do not use Markdown for the whole response, just JSON):
        {
            "translation": "Persian translation",
            "vocab": [
                { "word": "English Word/Phrase", "definition": "Persian Definition" },
                { "word": "Another Word", "definition": "Meaning" }
            ],
            "explanation_markdown": "The full formatted explanation in Markdown as before (Translation + Educational Points + Pro Tip). Use emoji and bold text."
        }
        `;

        const response = await axios.post(GEMINI_ENDPOINT, {
            contents: [{
                parts: [{ text: prompt }]
            }]
        });

        const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiText) {
            throw new Error('Empty response from AI');
        }

        const cleanJson = aiText.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error('AI Explanation Error:', error.response?.data || error.message);
        return { error: 'Failed to generate explanation. Please try again later.' };
    }
}

/**
 * Generates a comprehensive categorized learning plan for a movie
 */
export async function getComprehensiveLearningData(movieTitle) {
    if (!GEMINI_API_KEY) return { error: 'API Key Missing' };

    try {
        const prompt = `
        You are a cinema-obsessed English teacher for Persian speakers.
        Analyze the movie "${movieTitle}" and provide a learning guide.
        
        Return a JSON object with this exact structure:
        {
            "movie": "${movieTitle}",
            "overview": "Single sentence summary of why this movie is good for learning.",
            "sections": [
                {
                    "title": "🗣️ Key Dialogues",
                    "id": "dialogue",
                    "items": [
                        { "text": "Original English sentence", "translated": "Persian translation", "note": "Brief context" }
                    ]
                },
                {
                    "title": "🤘 Slang & Idioms",
                    "id": "slang",
                    "items": [
                        { "text": "Slang phrase", "translated": "Persian meaning", "note": "How to use it" }
                    ]
                },
                {
                    "title": "🧠 Grammar & Patterns",
                    "id": "grammar",
                    "items": [
                        { "text": "Grammar structure", "translated": "Explain in Persian", "note": "Example" }
                    ]
                },
                {
                    "title": "🎬 Movie Trivia",
                    "id": "trivia",
                    "items": [
                        { "text": "Interesting fact about the movie in Persian", "translated": "", "note": "" }
                    ]
                }
            ]
        }
        
        Provide 2-3 items for each section. Keep translations accurate and notes helpful for a student.
        Respond ONLY with JSON. No Markdown.
        `;

        const response = await axios.post(GEMINI_ENDPOINT, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const jsonText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleansedJson = jsonText.replace(/```json|```/g, '').trim();
        return JSON.parse(cleansedJson);
    } catch (error) {
        console.error('Comprehensive Learning Error:', error.message);
        return { error: 'Failed to generate comprehensive data' };
    }
}

/**
 * Generates a list of "Learning Moments" or key phrases for a movie
 */
export async function getLearningMoments(movieTitle) {
    // We can now just use a subset of comprehensive data or keep this simple
    const data = await getComprehensiveLearningData(movieTitle);
    if (data.sections && data.sections[0]) {
        return data.sections[0].items.map(i => i.text);
    }
    return [];
}


/**
 * Detects movie from media (image, audio, or video)
 */
export async function recognizeMedia(fileBuffer, mimeType) {
    if (!GEMINI_API_KEY) {
        return { error: 'API key not configured' };
    }

    try {
        console.log(`🤖 Analyzing media: ${mimeType}`);

        // Convert buffer to base64
        const base64Data = fileBuffer.toString('base64');

        const prompt = `
        ACT AS A MOVIE RECOGNITION EXPERT (SUPER VISION MODE).
        Analyze this media (image/audio/video) with extreme precision to identify the movie or TV show.
        
        STEP 1: PERFORM OCR
        Scan for any text, subtitles, or watermarks. If text is found, cross-reference it with movie dialogues and titles.
        
        STEP 2: IDENTIFY VISUAL ANCHORS
        Identify actors, unique costumes, props, character names, or specific cinematography styles.
        
        STEP 3: PROBABILITY ASSESSMENT
        Based on the above, determine the exact movie/show.
        
        JSON OUTPUT REQUIREMENT (MANDATORY):
        - If confidence > 80%, return:
        {
            "found": true,
            "title": "Exact Title",
            "year": "Year",
            "confidence": 0.XX,
            "reasoning": "Identify why (e.g., 'OCR detected subtitle X', 'Visual match for Actor Y in costume Z')",
            "actors": ["Actor 1", "Actor 2"]
        }
        
        - If NOT confident, return:
        {
            "found": false,
            "reason": "Explain what you saw but why it wasn't enough for identification"
        }
        
        RETURN ONLY RAW JSON. NO MARKDOWN.
        `;

        const response = await axios.post(GEMINI_ENDPOINT, {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }]
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error('Empty AI response');

        const cleanJson = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error('Media Recognition Error:', error.response?.data || error.message);
        return { error: 'Failed to recognize media', found: false };
    }
}

/**
 * Searches for a movie based on a semantic description (OpenClaw style)
 */
export async function searchByContext(query) {
    if (!GEMINI_API_KEY) return { found: false };

    try {
        const prompt = `
        You are a movie expert. The user is describing a movie scene or theme.
        Description: "${query}"
        
        Identify the movie and, if possible, the specific quote or scene they are referring to.
        
        Return JSON:
        {
            "found": true,
            "title": "Movie Title",
            "year": "Year",
            "confidence": 0.9,
            "quote": "The specific quote if relevant, or null",
            "reason": "Why you matched this movie"
        }
        
        If unsure, set found: false.
        `;

        const response = await axios.post(GEMINI_ENDPOINT, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleanJson = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error('Context Search Error:', error.message);
        return { found: false };
    }
}

/**
 * Analyzes audio pronunciation (Standard or Shadowing)
 */
export async function analyzePronunciation(audioBuffer, targetText, mimeType = 'audio/ogg', mode = 'standard') {
    if (!GEMINI_API_KEY) return { error: 'API key missing' };

    try {
        const base64Audio = audioBuffer.toString('base64');

        let prompt;
        if (mode === 'shadowing') {
            prompt = `
            You are a drama coach. The user is trying to "Shadow" (mimic) this movie line: "${targetText}".
            
            Listen to their audio and compare it to how a native actor would say it.
            Focus on:
            1. Intonation (rise/fall of voice)
            2. Rhythm and Stress
            3. Emotion
            
            Return JSON:
            {
                "score": 85,
                "feedback": "Great acting! Try to sound more angry on the word 'Never'.",
                "transcription": "What you heard"
            }
            `;
        } else {
            prompt = `
            Listen to this audio recording of a student trying to say the phrase: "${targetText}".
            
            Evaluate their pronunciation accuracy.
            1. Give a score from 0 to 100.
            2. Identify which words were mispronounced.
            3. Provide specific advice on how to improve.
            
            Return JSON:
            {
                "score": 85,
                "feedback": "Good effort! You missed the 'th' sound in 'the'.",
                "transcription": "What you heard"
            }
            `;
        }

        const response = await axios.post(GEMINI_ENDPOINT, {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Audio
                        }
                    }
                ]
            }]
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleanJson = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error('Pronunciation Error:', error);
        return { error: 'Failed to analyze audio' };
    }
}

/**
 * Chat with a specific persona (Roleplay)
 */
export async function chatWithPersona(persona, userInput, history) {
    if (!GEMINI_API_KEY) return '❌ AI API key missing.';

    try {
        // Construct prompt with history
        let conversation = '';
        if (history && history.length > 0) {
            history.forEach(turn => {
                const role = turn.role === 'user' ? 'Student' : persona;
                const text = turn.parts[0].text;
                conversation += `${role}: ${text}\n`;
            });
        }

        conversation += `Student: ${userInput}\n${persona}:`;

        const prompt = `
        You are roleplaying as **${persona}**.
        
        Instructions:
        1. Stay in character 100% of the time.
        2. Keep responses concise (1-3 sentences) to keep the conversation flowing.
        3. Correct the student's English mistakes subtly if they make any, but don't break character.
        4. If the student sends [User sent Audio], pretend you heard them and respond naturally to the context.
        
        Current Conversation:
        ${conversation}
        
        Response:
        `;

        const response = await axios.post(GEMINI_ENDPOINT, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || '...';
    } catch (error) {
        console.error('Roleplay Error:', error.message);
        return '❌ Error in roleplay service.';
    }
}

/**
 * Universal Image Analysis for Phase 4
 */
export async function analyzeImage(fileBuffer, mode) {
    if (!GEMINI_API_KEY) return '❌ API Key Missing';

    try {
        const base64Data = fileBuffer.toString('base64');
        let prompt = '';

        switch (mode) {
            case 'casting':
                prompt = `
                Analyze the person's face in this image.
                1. Estimate age, emotion, and key facial features.
                2. Identify which famous actor/actress they look like (Celebrity Lookalike).
                3. Suggest 3 movie roles they would fit in (e.g., "The quirky best friend", "The villain").
                4. Give a "Casting Director's Note".
                
                Format as Markdown:
                🎭 **Casting Call Results**
                👤 **Lookalike:** [Name]
                🎬 **Perfect Roles:** ...
                📝 **Director's Note:** ...
                `;
                break;
            case 'wardrobe':
                prompt = `
                Analyze the clothing and style in this image.
                1. Identify the key fashion items (Jacket, Scarf, etc.).
                2. Describe the "Aesthetic" (e.g., Cyberpunk, Vintage 70s).
                3. Suggest where to buy similar items (Generic suggestions like "Try Zara or Vintage Shops").
                4. Give a "Style Score" /10.
                
                Format as Markdown:
                👗 **Wardrobe Analysis**
                🧥 **Key Items:** ...
                🎨 **Aesthetic:** ...
                🛍️ **Shopping Guide:** ...
                `;
                break;
            case 'location':
                prompt = `
                Analyze the location/scenery in this image.
                1. Identify the likely real-world location (or movie set).
                2. If it's a famous movie scene, name the movie.
                3. Describe the atmosphere.
                4. Suggest a travel destination that looks like this.
                
                Format as Markdown:
                📍 **Location Scout**
                🌍 **Place:** ...
                🎬 **Movie Vibes:** ...
                ✈️ **Travel Tip:** ...
                `;
                break;
            case 'analysis':
                prompt = `
                Perform a deep Film School analysis of this image.
                1. Composition & Framing.
                2. Lighting (Chiaroscuro, High key, etc.).
                3. Color Palette & Symbolism.
                4. Director's Intent.
                
                Format as Markdown:
                🎓 **Film School Analysis**
                📸 **Shot:** ...
                💡 **Lighting:** ...
                🎨 **Color:** ...
                🎥 **Director's Vision:** ...
                `;
                break;
            default:
                prompt = 'Analyze this image and describe it.';
        }

        const response = await axios.post(GEMINI_ENDPOINT, {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: 'image/jpeg', // Assuming jpeg for simplicity, or pass actual type
                            data: base64Data
                        }
                    }
                ]
            }]
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || 'FAILED';

    } catch (error) {
        console.error('Vision Analysis Error:', error.message);
        return '❌ Error analyzing image.';
    }
}

export default {
    explainDialogue,
    getLearningMoments,
    recognizeMedia,
    searchByContext,
    analyzePronunciation,
    chatWithPersona,
    analyzeImage
};

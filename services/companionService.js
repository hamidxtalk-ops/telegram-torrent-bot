/**
 * Companion Service
 * Manages the user's personal AI companion (My Movie Mate)
 */

import db from '../database/sqlite.js';
import ai from './aiLearning.js';

const COMPANION_DEFAULTS = {
    name: 'MovieMate',
    gender: 'Female',
    personality: 'Friendly & Encouraging', // Witty, Strict, etc.
    relationship_level: 1, // XP with companion
    voice_mode: false
};

/**
 * Get or create companion profile
 */
export function getCompanionProfile(userId) {
    const data = db.getCompanionData(userId);
    if (!data) {
        return { ...COMPANION_DEFAULTS };
    }
    return data;
}

/**
 * Update companion profile
 */
export function updateCompanionProfile(userId, updates) {
    const current = getCompanionProfile(userId);
    const newData = { ...current, ...updates };
    db.setCompanionData(userId, newData);
    return newData;
}

/**
 * Chat with companion
 * Wrapper around AI to inject specific persona details
 */
export async function chatWithCompanion(userId, userMessage, history) {
    const profile = getCompanionProfile(userId);

    // Construct the persona instruction
    const personaDescription = `
    Name: ${profile.name}
    Gender: ${profile.gender}
    Personality: ${profile.personality}
    Relationship Level: ${profile.relationship_level}
    
    You are the user's personal movie companion and language tutor.
    Your name is ${profile.name}.
    You are ${profile.gender} and your personality is ${profile.personality}.
    
    Goal:
    1. Chat about movies and life.
    2. Correct their English mistakes gently.
    3. Be supportive and engaging.
    4. If 'Call Mode' is active, keep responses short and conversational like a voice note.
    `;

    // We reuse the generic chatWithPersona but pass our custom description as the "Persona Name"
    // Wait, chatWithPersona takes a simple string. We might need a more flexible method or just pass this huge string.
    // Let's modify aiLearning or just pass the description as the persona "Character".

    // Actually, distinct from roleplay (which is temporary), this is persistent.
    // Let's call ai.chatWithPersona but pass the description as the 'persona' argument key,
    // assuming the prompt logic can handle a full description.

    // The current aiLearning.chatWithPersona puts the "persona" variable into:
    // "You are roleplaying as **${persona}**."
    // So passing the description might work if formatted right.

    return await ai.chatWithPersona(personaDescription, userMessage, history);
}

export default {
    getCompanionProfile,
    updateCompanionProfile,
    chatWithCompanion
};

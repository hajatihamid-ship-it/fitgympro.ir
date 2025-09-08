// This file manages the global state of the application in a centralized way.
// FIX: Import GoogleGenAI from "@google/genai" as per guidelines.
import { GoogleGenAI } from "@google/genai";

interface AppState {
    currentUser: string | null;
    genAI: GoogleGenAI | null;
}

const state: AppState = {
    currentUser: null,
    genAI: null,
};

export function getCurrentUser(): string | null {
    return state.currentUser;
}

export function setCurrentUser(username: string | null): void {
    state.currentUser = username;
}

export function getGenAI(): GoogleGenAI {
    if (!state.genAI) {
        // FIX: Update to use new GoogleGenAI({ apiKey: ... }) constructor per guidelines.
        state.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return state.genAI!;
}
// src/config/genai.js
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error('⚠️ ERROR: La variable GEMINI_API_KEY no está definida en el archivo .env');
}

// Inicialización oficial del cliente Google Gen AI
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// LISTA DE MODELOS RECOMENDADOS (En orden de prioridad)
// Usamos alias dinámicos y modelos 3.x Flash Lite estables
export const MODEL_CANDIDATES = [
  'gemini-flash-latest',     // Auto-actualizable por Google (Nunca vence)
  'gemini-3.5-flash-lite',    // Modelo super rápido de alta disponibilidad
  'gemini-3.1-flash-lite'     // Respaldo de alta eficiencia
];
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory first, then root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const port = parseInt(process.env.PORT || '3001', 10);
const nodeEnv = process.env.NODE_ENV || 'development';
const supabaseUrl = process.env.SUPABASE_URL || 'https://rduxyhkwgykejczxircd.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const rawCors = process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173';
const corsOrigins = rawCors.split(',').map(s => s.trim()).filter(Boolean);

// Enforce single Gemini model throughout the entire application
export const MANDATORY_GEMINI_MODEL = 'gemini-3.5-transcribe-live';

const geminiApiKey = process.env.GEMINI_API_KEY || '';
const geminiModel = MANDATORY_GEMINI_MODEL;

export const config = {
  port,
  nodeEnv,
  supabaseUrl,
  supabaseAnonKey,
  geminiApiKey,
  geminiModel,
  corsOrigins,
  isProduction: nodeEnv === 'production',
};

// Validate critical configuration on startup
export function validateConfig() {
  const missing: string[] = [];
  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.supabaseAnonKey && config.isProduction) missing.push('SUPABASE_ANON_KEY');

  if (missing.length > 0) {
    console.warn(`[Config Warning] Missing environment variables: ${missing.join(', ')}`);
  }

  // Model enforcement validation & diagnostics (without logging secrets or audio)
  console.log(`[Model Enforcement] Active Gemini Model: ${MANDATORY_GEMINI_MODEL}`);
  console.log(`[Model Enforcement] Purpose: Real-time Live Audio Transcription ONLY`);
  console.log(`[Model Enforcement] Text generation LLM calls (gemini-3.8-flash, etc.): DISABLED`);
}

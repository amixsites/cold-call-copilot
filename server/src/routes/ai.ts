import { Router, type Response } from 'express';
import { type AuthenticatedRequest } from '../middleware/auth.js';
import { config } from '../config/env.js';

export const aiRouter = Router();

// GET /api/ai/health - Diagnostic endpoint reporting Gemini configuration without exposing the secret key
aiRouter.get('/health', (_req: AuthenticatedRequest, res: Response): void => {
  const apiKey = config.geminiApiKey;
  const isConfigured = Boolean(
    apiKey &&
    apiKey !== 'your_actual_gemini_api_key_here' &&
    !apiKey.includes('placeholder') &&
    apiKey.length > 20
  );

  res.status(200).json({
    status: 'ok',
    configured: isConfigured,
    model: config.geminiModel,
    purpose: 'Real-time Live Audio Streaming Speech-to-Text Only',
    textGenerationDisabled: true,
    provider: 'google-genai',
    message: isConfigured
      ? 'Gemini 3.5 Transcribe Live is operational for streaming speech-to-text. Text generation LLMs (including gemini-3.8-flash) are deactivated.'
      : 'Gemini API key is not configured or set to placeholder.',
    timestamp: new Date().toISOString(),
  });
});

// POST /api/ai/call-assist - Authenticated call assistance endpoint (Disabled to dedicate quota exclusively to gemini-3.5-transcribe-live)
aiRouter.post('/call-assist', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    disabled: true,
    unavailable: true,
    message: 'AI Suggestions are disabled. Gemini API is exclusively dedicated to gemini-3.5-transcribe-live real-time audio transcription.',
    modelEnforced: config.geminiModel,
    data: null,
  });
});


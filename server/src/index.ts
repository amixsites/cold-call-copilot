import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { prospectsRouter } from './routes/prospects.js';
import { callsRouter } from './routes/calls.js';
import { followUpsRouter } from './routes/followups.js';
import { aiRouter } from './routes/ai.js';
import http from 'http';
import { liveTranscriptionService } from './services/liveTranscriptionService.js';

// Validate environment variables on launch
validateConfig();

const app = express();

// 1. Basic Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// 2. CORS Policy restricted to configured origins and Vercel domains
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const isAllowed = 
        config.corsOrigins.includes(origin) || 
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        !config.isProduction;

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy violation: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. JSON body parser with size limit to prevent payload flooding
app.use(express.json({ limit: '1mb' }));

// 4. Safe Request Logger (never logs auth headers or body payloads)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Keep logs clean and avoid leaking sensitive call discovery notes
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// 5. Unauthenticated Public Routes
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Cold Call Copilot API & WebSocket Server',
    version: '1.0.0',
    health: '/api/health',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});
app.use('/api', healthRouter);
app.use('/', healthRouter);

// 6. Authenticated Protected API Routes (Enforces Supabase Auth & PostgreSQL RLS)
app.use('/api/prospects', requireAuth, prospectsRouter);
app.use('/api/calls', requireAuth, callsRouter);
app.use('/api/followups', requireAuth, followUpsRouter);
app.use('/api/ai', requireAuth, aiRouter);

// 7. Not Found & Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// 8. Start HTTP Server with WebSocket Support for Live Transcription
const server = http.createServer(app);
liveTranscriptionService.initialize(server);

if (process.env.NODE_ENV !== 'test') {
  server.listen(config.port, () => {
    console.log(`[Cold Call Copilot API] Server listening on port ${config.port} (env: ${config.nodeEnv})`);
    console.log(`[CORS] Configured origins: ${config.corsOrigins.join(', ')}`);
  });
}

export { app, server };

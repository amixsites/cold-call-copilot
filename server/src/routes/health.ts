import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { config } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response): Promise<void> => {
  let dbStatus = {
    connected: false,
    hasServiceRoleKey: Boolean(config.supabaseServiceRoleKey),
    prospectsCount: 0,
    callsCount: 0,
    error: undefined as string | undefined,
  };

  const activeKey = config.supabaseServiceRoleKey || config.supabaseAnonKey;
  if (config.supabaseUrl && activeKey) {
    try {
      const client = createClient(config.supabaseUrl, activeKey, {
        auth: { persistSession: false },
        realtime: { transport: WebSocket as any },
      });

      const [prospectsRes, callsRes] = await Promise.all([
        client.from('prospects').select('id', { count: 'exact', head: true }),
        client.from('calls').select('id', { count: 'exact', head: true }),
      ]);

      if (!prospectsRes.error && !callsRes.error) {
        dbStatus.connected = true;
        dbStatus.prospectsCount = prospectsRes.count || 0;
        dbStatus.callsCount = callsRes.count || 0;
      } else {
        dbStatus.error = prospectsRes.error?.message || callsRes.error?.message;
      }
    } catch (err: any) {
      dbStatus.error = err?.message || 'Database connection error';
    }
  }

  res.status(200).json({
    status: 'ok',
    service: 'Cold Call Copilot API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
  });
});

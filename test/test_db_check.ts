import { createClient } from '@supabase/supabase-js';
import WebSocket from './../server/node_modules/ws/index.js';
import fs from 'fs';

const env = fs.readFileSync('server/.env', 'utf-8');
const lines: Record<string, string> = {};
for (const line of env.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    lines[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
  }
}

const url = lines.SUPABASE_URL;
const anonKey = lines.SUPABASE_ANON_KEY;
const serviceKey = lines.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log('Testing against Supabase URL:', url);

  console.log('--- 1. Query with ANON KEY (unauthenticated) ---');
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    realtime: { transport: WebSocket as any },
  });
  const { data: pAnon, error: pAnonErr } = await anonClient.from('prospects').select('*');
  console.log('Anon prospects count:', pAnon?.length, 'error:', pAnonErr ? pAnonErr.message : null);
  const { data: cAnon, error: cAnonErr } = await anonClient.from('calls').select('*');
  console.log('Anon calls count:', cAnon?.length, 'error:', cAnonErr ? cAnonErr.message : null);

  console.log('--- 2. Query with SERVICE ROLE KEY ---');
  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
    realtime: { transport: WebSocket as any },
  });
  const { data: pAdmin, error: pAdminErr } = await adminClient.from('prospects').select('*');
  console.log('Admin prospects count:', pAdmin?.length, 'error:', pAdminErr ? pAdminErr.message : null);
  if (pAdmin) {
    console.log('Admin Prospects:', pAdmin.map(p => ({ id: p.id, company: p.company_name, user_id: p.user_id })));
  }
  const { data: cAdmin, error: cAdminErr } = await adminClient.from('calls').select('*');
  console.log('Admin calls count:', cAdmin?.length, 'error:', cAdminErr ? cAdminErr.message : null);
  if (cAdmin) {
    console.log('Admin Calls:', cAdmin.map(c => ({ id: c.id, company: c.company_name, user_id: c.user_id })));
  }
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});

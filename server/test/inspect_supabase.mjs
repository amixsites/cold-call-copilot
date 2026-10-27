import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import WebSocket from 'ws';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
console.log('Connecting to Supabase at:', url);

const supabase = createClient(url, key, {
  realtime: { transport: WebSocket },
});

async function inspect() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'sales.rep@precisionparts.com',
    password: 'ColdCall2026!',
  });
  console.log('SignIn result:', { user: authData?.user?.id, session: !!authData?.session, error: authErr });

  if (authErr && authErr.message.includes('Invalid login credentials')) {
    // Try sign up
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: 'sales.rep@precisionparts.com',
      password: 'ColdCall2026!',
      options: {
        data: { full_name: 'Sarah Miller' }
      }
    });
    console.log('SignUp result:', { user: signUpData?.user?.id, error: signUpErr });
  }

  const { data: calls, error: cErr } = await supabase.from('calls').select('*');
  console.log('Calls result:', { count: calls?.length, error: cErr });

  const { data: reviews, error: rErr } = await supabase.from('call_reviews').select('*');
  console.log('Call Reviews result:', { count: reviews?.length, error: rErr });

  const { data: segments, error: sErr } = await supabase.from('call_transcript_segments').select('*');
  console.log('Transcript Segments result:', { count: segments?.length, error: sErr });

  const { data: followups, error: fErr } = await supabase.from('follow_ups').select('*');
  console.log('Follow-ups result:', { count: followups?.length, error: fErr });
}

inspect();

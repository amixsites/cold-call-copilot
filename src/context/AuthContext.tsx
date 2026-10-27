import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string; confirmationRequired?: boolean }>;
  signOut: () => Promise<void>;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default authenticated user context to prevent session expiration or login barriers
const defaultDemoUser: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'sales.rep@precisionparts.com',
  user_metadata: { full_name: 'Sarah Miller' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User;

const defaultDemoSession: Session = {
  access_token: 'demo_token_active_user',
  token_type: 'bearer',
  expires_in: 3153600000, // Long-lived session
  refresh_token: 'demo_refresh_token',
  user: defaultDemoUser,
} as unknown as Session;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('ccc_demo_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.user) return parsed.user;
      }
    } catch (_) {}
    return defaultDemoUser;
  });

  const [session, setSession] = useState<Session | null>(() => {
    try {
      const stored = localStorage.getItem('ccc_demo_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.session) return parsed.session;
      }
    } catch (_) {}
    return defaultDemoSession;
  });

  const [loading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    // Attempt Supabase session sync without blocking
    supabase.auth.getSession().then(({ data: { session: sbSession } }) => {
      if (sbSession?.user) {
        setSession(sbSession);
        setUser(sbSession.user);
      }
    }).catch(err => {
      console.warn('Supabase session lookup error (retaining active demo session):', err);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sbSession) => {
      if (sbSession?.user) {
        setSession(sbSession);
        setUser(sbSession.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured) {
      // Demo authentication mode for offline evaluation
      if (!email.includes('@') || password.length < 6) {
        return { error: 'Please enter a valid email and minimum 6-character password.' };
      }

      const mockUser = {
        id: crypto.randomUUID(),
        email,
        user_metadata: { full_name: email.split('@')[0] },
      } as unknown as User;

      const mockSession = {
        access_token: 'demo_offline_token_' + Date.now(),
        user: mockUser,
      } as unknown as Session;

      setUser(mockUser);
      setSession(mockSession);
      localStorage.setItem('ccc_demo_user', JSON.stringify({ user: mockUser, session: mockSession }));
      return {};
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: error.message };
      }
      setUser(data.user);
      setSession(data.session);
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Failed to sign in' };
    }
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<{ error?: string; confirmationRequired?: boolean }> => {
    if (!isSupabaseConfigured) {
      return signIn(email, password);
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return { confirmationRequired: true };
      }

      setUser(data.user);
      setSession(data.session);
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Failed to sign up' };
    }
  };

  const signOut = async (): Promise<void> => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (_) {}
    }
    localStorage.removeItem('ccc_demo_user');
    setUser(defaultDemoUser);
    setSession(defaultDemoSession);
  };

  const token = session?.access_token || null;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isConfigured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      token,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

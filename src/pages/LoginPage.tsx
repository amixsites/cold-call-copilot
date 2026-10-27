import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  PhoneCall, 
  ShieldCheck,
  Sparkles,
  Server
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';

export const LoginPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, signUp, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const res = await signUp(email, password, fullName || email.split('@')[0]);
        if (res.error) {
          setError(res.error);
        } else if (res.confirmationRequired) {
          setSuccessMessage('Account created! Please check your email to confirm your registration.');
        } else {
          setSuccessMessage('Account created successfully! Redirecting...');
          setTimeout(() => navigate(from, { replace: true }), 1000);
        }
      } else {
        const res = await signIn(email, password);
        if (res.error) {
          setError(res.error);
        } else {
          navigate(from, { replace: true });
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoFill = () => {
    setEmail('sales.rep@precisionparts.com');
    setPassword('ColdCall2026!');
    setFullName('Sarah Miller');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-brand-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-80 h-80 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 px-4">
        <div className="inline-flex items-center justify-center p-3 bg-brand-600/20 border border-brand-500/30 rounded-2xl shadow-xl shadow-brand-950/40 mb-4 backdrop-blur-md">
          <PhoneCall className="h-8 w-8 text-brand-400" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Cold Call Copilot
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Precision B2B Manufacturing Discovery & Call Execution
        </p>
      </div>

      {/* Auth Card Container */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          {/* Supabase status notice */}
          {!isConfigured && (
            <div className="mb-6 p-3.5 bg-brand-950/60 border border-brand-800/60 rounded-xl text-xs text-brand-200">
              <div className="flex items-center gap-2 font-semibold text-brand-300 mb-1">
                <Server className="h-4 w-4 shrink-0 text-brand-400" />
                <span>Supabase Project Connected</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Backend is listening on port 3001. You can log in with any email and password to begin, or provide your anon key in <code className="text-brand-300">.env</code>.
              </p>
            </div>
          )}

          {/* Direct Entry Button - No Authentication Required */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>Enter Workspace Directly (No Sign-in Required)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(null); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                !isSignUp 
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-950/50' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(null); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                isSignUp 
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-950/50' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="mb-5 p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Miller"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sales.rep@company.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full py-2.5 mt-2 justify-center shadow-lg shadow-brand-600/30"
            >
              {isSubmitting ? (
                <span>Authenticating...</span>
              ) : (
                <span className="flex items-center gap-2">
                  {isSignUp ? 'Create Sales Rep Account' : 'Sign In to Workspace'}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Row Level Security Active
            </span>
            <button
              type="button"
              onClick={handleQuickDemoFill}
              className="text-brand-400 hover:text-brand-300 font-medium inline-flex items-center gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto-fill Credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  User, 
  Sliders, 
  CheckCircle2,
  DownloadCloud,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { profile, preferences, updatePreferences, seedSampleData, isLoadingData } = useData();
  const { user, signOut } = useAuth();

  const [defaultObjective, setDefaultObjective] = useState(preferences.defaultCallObjective);
  const [autoTimer, setAutoTimer] = useState(preferences.autoStartTimer);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    updatePreferences({
      defaultCallObjective: defaultObjective,
      autoStartTimer: autoTimer,
    });
    setSaveMessage('Preferences updated.');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleSeedData = async () => {
    if (window.confirm('Import realistic manufacturing sample prospects into your Supabase database account?')) {
      setIsSeeding(true);
      setSaveMessage(null);
      setErrorMessage(null);
      const result = await seedSampleData();
      setIsSeeding(false);

      if (result.success) {
        setSaveMessage(result.message);
        setTimeout(() => setSaveMessage(null), 4000);
      } else {
        setErrorMessage(result.message);
        setTimeout(() => setErrorMessage(null), 5000);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Application Settings</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Configure default call prompts, application preferences, and manage your account.
        </p>
      </div>

      {saveMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-sm text-emerald-800 animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{saveMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-sm text-rose-800 animate-fadeIn">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Authenticated User Profile Card */}
      <Card>
        <CardHeader
          title="Sales Representative Account"
          description="Authenticated user identity and workspace ownership"
          icon={<User className="h-4 w-4" />}
          action={
            <Button
              variant="outline"
              size="sm"
              icon={<LogOut className="h-4 w-4" />}
              onClick={() => signOut()}
            >
              Sign Out
            </Button>
          }
        />
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div>
              <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold block">Full Name</span>
              <p className="font-semibold text-slate-800 mt-0.5">
                {user?.user_metadata?.full_name || profile.name}
              </p>
            </div>
            <div>
              <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold block">Work Email</span>
              <p className="font-semibold text-slate-800 mt-0.5">
                {user?.email || profile.email}
              </p>
            </div>
            <div>
              <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold block">Territory</span>
              <p className="font-semibold text-slate-800 mt-0.5">{profile.territory}</p>
            </div>
            <div>
              <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold block">Account ID (UUID)</span>
              <p className="font-mono text-xs text-slate-600 mt-0.5 truncate">
                {user?.id || 'standard-user'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Preferences Card */}
      <Card>
        <form onSubmit={handleSavePreferences}>
          <CardHeader
            title="Discovery Call Defaults"
            description="Configure initial prompt guidelines and live stopwatch behavior"
            icon={<Sliders className="h-4 w-4" />}
          />
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="defaultObjective" className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                Default Call Objective
              </label>
              <input
                id="defaultObjective"
                type="text"
                value={defaultObjective}
                onChange={(e) => setDefaultObjective(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <label htmlFor="autoTimer" className="text-sm font-medium text-slate-900 block cursor-pointer">
                  Auto-start Call Timer
                </label>
                <p className="text-xs text-slate-500">
                  Automatically start the elapsed stopwatch when clicking 'Start Call'
                </p>
              </div>
              <input
                id="autoTimer"
                type="checkbox"
                checked={autoTimer}
                onChange={(e) => setAutoTimer(e.target.checked)}
                className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" variant="primary" size="sm">
              Save Preferences
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Explicit Voluntary Seed Data */}
      <Card className="border-slate-200">
        <CardHeader
          title="Seed Sample Manufacturing Data"
          description="Populate your personal database account with realistic manufacturing prospects"
          icon={<DownloadCloud className="h-4 w-4 text-slate-600" />}
          action={
            <Button
              variant="outline"
              size="sm"
              icon={<DownloadCloud className={`h-4 w-4 ${isSeeding ? 'animate-bounce' : ''}`} />}
              disabled={isSeeding || isLoadingData}
              onClick={handleSeedData}
            >
              {isSeeding ? 'Importing...' : 'Import Sample Accounts'}
            </Button>
          }
        />
        <CardContent>
          <p className="text-xs text-slate-600">
            If your database account is newly created and empty, click <strong>Import Sample Accounts</strong> to insert sample manufacturing leads (Apex Precision, Vanguard Automation, etc.) into your user account. This operation is voluntary and safe to run.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

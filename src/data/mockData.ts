/**
 * Cold Call Copilot — Application Defaults
 * 
 * All business entities (Prospects, Calls, Follow-ups, Transcripts, Reviews)
 * are strictly persistent and sourced from Supabase.
 * Zero hardcoded mock records or fake IDs.
 */

import { Prospect, CallRecord, FollowUp, UserProfile, AppPreferences } from '../types';

export const initialProspects: Prospect[] = [];
export const initialCalls: CallRecord[] = [];
export const initialFollowUps: FollowUp[] = [];

export const initialProfile: UserProfile = {
  name: 'Alex Mercer',
  title: 'Senior Manufacturing Account Executive',
  email: 'alex.mercer@industrialpartners.example.com',
  territory: 'Great Lakes & Midwest Industrial Corridor',
  company: 'Industrial Solution Dynamics',
};

export const initialPreferences: AppPreferences = {
  defaultCallObjective: 'Discover production bottlenecks, tool wear or supplier delivery issues',
  defaultDiscoveryQuestions: [
    'What is your target machine utilization vs. actual spindle uptime?',
    'Where in the plant are scrap or rework costs highest right now?',
    'How do lead times from your primary raw material suppliers compare to six months ago?',
    'Who on your engineering or operations team evaluates new shop floor solutions?'
  ],
  autoStartTimer: true,
  highlightOverdueDays: 1,
};

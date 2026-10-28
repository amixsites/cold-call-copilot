import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Prospect,
  CallRecord,
  FollowUp,
  UserProfile,
  AppPreferences,
  ProspectStatus,
  CallStageNumber,
  StageEvent,
  CallAiReview,
  CallLifecycleState
} from '../types';
import {
  initialProspects,
  initialCalls,
  initialFollowUps,
  initialProfile,
  initialPreferences
} from '../data/mockData';
import { isOverdue } from '../lib/dateUtils';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

export interface DashboardMetrics {
  totalProspects: number;
  inDiscussionProspects: number;
  qualifiedProspects: number;
  callsPlanned: number;
  callsInProgress: number;
  followUpsDue: number;
  followUpsOverdue: number;
  completedCallsCount: number;
}

interface DataContextType {
  prospects: Prospect[];
  calls: CallRecord[];
  followUps: FollowUp[];
  profile: UserProfile;
  preferences: AppPreferences;
  metrics: DashboardMetrics;
  isLoadingData: boolean;
  apiError: string | null;
  clearApiError: () => void;
  refetchData: () => Promise<void>;

  // Prospect actions
  addProspect: (data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>) => Prospect;
  updateProspect: (id: string, data: Partial<Prospect>) => void;
  deleteProspect: (id: string) => void;
  getProspectById: (id: string) => Prospect | undefined;

  // Call actions
  callLifecycleState: CallLifecycleState;
  activeCallId: string | null;
  isCallMode: boolean;
  setCallLifecycleState: (state: CallLifecycleState) => void;
  setActiveCallId: (id: string | null) => void;
  addCallRecord: (data: Omit<CallRecord, 'id' | 'createdAt' | 'updatedAt'>) => CallRecord;
  updateCallRecord: (id: string, data: Partial<CallRecord>) => void;
  saveCallDraftOrComplete: (call: Partial<CallRecord> & { prospectId: string; companyName: string }) => CallRecord;
  createCallRecordAsync: (data: Partial<CallRecord> & { prospectId: string; companyName: string }) => Promise<CallRecord>;
  saveCallDraftAsync: (call: Partial<CallRecord> & { prospectId: string; companyName: string }) => Promise<CallRecord>;
  recordStageEvent: (callId: string, event: { stageNumber: CallStageNumber; eventType: string; eventLabel: string; id?: string }) => Promise<StageEvent>;
  removeStageEvent: (callId: string, eventId: string, stageNumber?: number, eventType?: string) => Promise<void>;
  getCallById: (id: string) => CallRecord | undefined;

  // AI Post-Call Review actions
  getCallReview: (callId: string) => Promise<CallAiReview | null>;
  generateCallReview: (callId: string) => Promise<CallAiReview>;
  updateCallReview: (callId: string, data: { suggestedFollowUpMessage?: string }) => Promise<CallAiReview>;

  // Follow-up actions
  addFollowUp: (data: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>) => FollowUp;
  updateFollowUp: (id: string, data: Partial<FollowUp>) => void;
  toggleFollowUpComplete: (id: string) => void;
  deleteFollowUp: (id: string) => void;

  // Preferences & voluntary sample seed
  updatePreferences: (data: Partial<AppPreferences>) => void;
  seedSampleData: () => Promise<{ success: boolean; message: string }>;
  resetToSampleData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();

  const [prospects, setProspects] = useState<Prospect[]>(initialProspects);
  const [calls, setCalls] = useState<CallRecord[]>(initialCalls);
  const [followUps, setFollowUps] = useState<FollowUp[]>(initialFollowUps);
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [preferences, setPreferences] = useState<AppPreferences>(initialPreferences);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Focus Mode & Call Lifecycle authoritative state
  const [callLifecycleState, setCallLifecycleState] = useState<CallLifecycleState>('idle');
  const [activeCallId, setActiveCallIdState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('ccc_active_call_id') || null;
    } catch {
      return null;
    }
  });

  const setActiveCallId = useCallback((id: string | null) => {
    setActiveCallIdState(id);
    try {
      if (id) {
        sessionStorage.setItem('ccc_active_call_id', id);
      } else {
        sessionStorage.removeItem('ccc_active_call_id');
      }
    } catch (_) {}
  }, []);

  const isCallMode = callLifecycleState === 'active' || callLifecycleState === 'ending';

  const safeSetApiError = useCallback((msg: string) => {
    const lower = msg.toLowerCase();
    if (
      lower.includes('session') ||
      lower.includes('auth') ||
      lower.includes('sign in') ||
      lower.includes('unauthorized') ||
      lower.includes('expired')
    ) {
      return;
    }
    setApiError(msg);
  }, []);

  // Fetch all persisted records from the Express backend
  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    setApiError(null);

    try {
      const [prospectsRes, callsRes, followUpsRes] = await Promise.allSettled([
        api.prospects.getAll(),
        api.calls.getAll(),
        api.followups.getAll(),
      ]);

      const errors: string[] = [];
      let currentCalls: CallRecord[] = [];

      if (prospectsRes.status === 'fulfilled') {
        setProspects(Array.isArray(prospectsRes.value) ? prospectsRes.value : []);
      } else {
        const msg = prospectsRes.reason?.message || 'Failed to fetch prospects';
        errors.push(msg);
        console.warn('[DataContext] Prospects fetch failed:', msg);
      }

      if (callsRes.status === 'fulfilled') {
        currentCalls = Array.isArray(callsRes.value) ? callsRes.value : [];
        setCalls(currentCalls);
      } else {
        const msg = callsRes.reason?.message || 'Failed to fetch calls';
        errors.push(msg);
        console.warn('[DataContext] Calls fetch failed:', msg);
      }

      if (followUpsRes.status === 'fulfilled') {
        setFollowUps(Array.isArray(followUpsRes.value) ? followUpsRes.value : []);
      } else {
        const msg = followUpsRes.reason?.message || 'Failed to fetch follow-ups';
        errors.push(msg);
        console.warn('[DataContext] Follow-ups fetch failed:', msg);
      }

      if (errors.length > 0) {
        safeSetApiError(`Database connection error: ${errors[0]}`);
      }

      // Authoritative call state restoration across page refreshes
      try {
        const storedActiveCallId = sessionStorage.getItem('ccc_active_call_id');
        if (storedActiveCallId) {
          const verifiedActiveCall = currentCalls.find(
            c => c.id === storedActiveCallId && c.callStatus === 'In Progress'
          );
          if (verifiedActiveCall) {
            setActiveCallIdState(verifiedActiveCall.id);
            setCallLifecycleState('active');
          } else if (callsRes.status === 'fulfilled') {
            sessionStorage.removeItem('ccc_active_call_id');
            setActiveCallIdState(null);
            setCallLifecycleState('idle');
          }
        }
      } catch (_) {}

      if (user && (user.user_metadata?.full_name || user.email)) {
        setProfile(prev => ({
          ...prev,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || prev.name,
          email: user.email || prev.email,
        }));
      }
    } catch (err: any) {
      console.warn('[DataContext] Failed to fetch data from backend:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [user, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived dashboard metrics (calculated reactively from active records)
  const pendingFollowUps = followUps.filter(f => f.status === 'Pending');
  const overdueFollowUps = pendingFollowUps.filter(f => isOverdue(f.dueDate, f.status));

  const callsPlanned = prospects.filter(p => p.status === 'New' || p.status === 'Attempted').length +
    pendingFollowUps.filter(f => f.task.toLowerCase().includes('call')).length;

  const callsInProgress = calls.filter(c => c.callStatus === 'In Progress').length;
  const completedCallsCount = calls.filter(c => c.callStatus === 'Completed').length;

  const metrics: DashboardMetrics = {
    totalProspects: prospects.length,
    inDiscussionProspects: prospects.filter(p => p.status === 'In Discussion').length,
    qualifiedProspects: prospects.filter(p => p.status === 'Qualified').length,
    callsPlanned,
    callsInProgress,
    followUpsDue: pendingFollowUps.length,
    followUpsOverdue: overdueFollowUps.length,
    completedCallsCount,
  };

  // 1. Prospect Handlers
  const addProspect = (data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>): Prospect => {
    const optimisticId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newProspect: Prospect = {
      ...data,
      id: optimisticId,
      createdAt: now,
      updatedAt: now,
    };

    setProspects(prev => [newProspect, ...prev]);

    // Asynchronously persist to backend database
    api.prospects.create({ ...data, id: optimisticId } as any).then(created => {
      setProspects(prev => prev.map(p => (p.id === optimisticId ? created : p)));
    }).catch(err => {
      console.error('Failed to create prospect via API:', err);
      safeSetApiError(`Failed to save prospect: ${err.message}`);
    });

    return newProspect;
  };

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const updateProspect = (id: string, data: Partial<Prospect>) => {
    if (!UUID_REGEX.test(id)) {
      const errMsg = `Failed to update prospect: invalid input syntax for type uuid: "${id}". Expected a valid database UUID.`;
      console.error(errMsg);
      safeSetApiError(errMsg);
      return;
    }

    const now = new Date().toISOString();
    setProspects(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, ...data, updatedAt: now };
      }
      return p;
    }));

    // Cascade name updates locally for immediate consistency
    if (data.companyName || data.contactName !== undefined) {
      setCalls(prev => prev.map(c => {
        if (c.prospectId === id) {
          return {
            ...c,
            companyName: data.companyName || c.companyName,
            contactName: data.contactName !== undefined ? data.contactName : c.contactName,
            updatedAt: now,
          };
        }
        return c;
      }));

      setFollowUps(prev => prev.map(f => {
        if (f.prospectId === id) {
          return {
            ...f,
            companyName: data.companyName || f.companyName,
            contactName: data.contactName !== undefined ? data.contactName : f.contactName,
            updatedAt: now,
          };
        }
        return f;
      }));
    }

    // Persist update via API
    api.prospects.update(id, data).catch(err => {
      console.error('Failed to update prospect via API:', err);
      safeSetApiError(`Failed to update prospect: ${err.message}`);
    });
  };

  const deleteProspect = (id: string) => {
    if (!UUID_REGEX.test(id)) {
      const errMsg = `Failed to delete prospect: invalid input syntax for type uuid: "${id}". Expected a valid database UUID.`;
      console.error(errMsg);
      safeSetApiError(errMsg);
      return;
    }

    setProspects(prev => prev.filter(p => p.id !== id));
    setCalls(prev => prev.map(c => {
      if (c.prospectId === id) {
        return { ...c, companyName: `${c.companyName} (Archived Account)` };
      }
      return c;
    }));
    setFollowUps(prev => prev.filter(f => f.prospectId !== id));

    api.prospects.delete(id).catch(err => {
      console.error('Failed to delete prospect via API:', err);
      safeSetApiError(`Failed to delete prospect: ${err.message}`);
      fetchData(); // Rollback on failure
    });
  };

  const getProspectById = (id: string): Prospect | undefined => {
    return prospects.find(p => p.id === id);
  };

  // 2. Call Handlers
  const addCallRecord = (data: Omit<CallRecord, 'id' | 'createdAt' | 'updatedAt'>): CallRecord => {
    const optimisticId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newCall: CallRecord = {
      ...data,
      id: optimisticId,
      createdAt: now,
      updatedAt: now,
    };

    setCalls(prev => [newCall, ...prev]);

    // Update prospect status / last contact date
    const nowFormatted = now.split('T')[0];
    let nextStatus: ProspectStatus | undefined = undefined;
    if (data.outcome === 'Connected - Interested') nextStatus = 'Qualified';
    else if (data.outcome === 'Connected - Follow-up Needed' || data.outcome === 'Connected - Follow-up Required') nextStatus = 'In Discussion';
    else if (data.outcome === 'Connected - Not Interested') nextStatus = 'Unqualified';
    else if (data.outcome === 'No Answer / Voicemail' || data.outcome === 'Left Voicemail' || data.outcome === 'Gatekeeper Blocked') nextStatus = 'Attempted';

    if (data.prospectId) {
      updateProspect(data.prospectId, {
        lastContactDate: nowFormatted,
        ...(nextStatus ? { status: nextStatus } : {})
      });
    }

    // Auto-create follow-up if next action is specified
    if (data.nextAction && data.nextAction.trim() !== '') {
      const followUpDueDate = data.followUpDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
      addFollowUp({
        prospectId: data.prospectId,
        companyName: data.companyName,
        contactName: data.contactName,
        callId: optimisticId,
        task: data.nextAction,
        dueDate: followUpDueDate,
        priority: data.outcome === 'Connected - Interested' ? 'High' : 'Medium',
        status: 'Pending',
        notes: `Scheduled from discovery call on ${nowFormatted}. Objective: ${data.callObjective}`
      });
    }

    // Persist via API
    api.calls.create({ ...data, id: optimisticId } as any).then(created => {
      setCalls(prev => prev.map(c => (c.id === optimisticId ? created : c)));
    }).catch(err => {
      console.error('Failed to create call via API:', err);
      safeSetApiError(`Failed to save call record: ${err.message}`);
    });

    return newCall;
  };

  const updateCallRecord = (id: string, data: Partial<CallRecord>) => {
    const now = new Date().toISOString();
    setCalls(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, ...data, updatedAt: now };
      }
      return c;
    }));

    api.calls.update(id, data).catch(err => {
      console.error('Failed to update call via API:', err);
      safeSetApiError(`Failed to update call: ${err.message}`);
    });
  };

  const saveCallDraftOrComplete = (callData: Partial<CallRecord> & { prospectId: string; companyName: string }): CallRecord => {
    const now = new Date().toISOString();
    const existingCall = callData.id ? calls.find(c => c.id === callData.id) : undefined;

    if (existingCall) {
      const updated: CallRecord = {
        ...existingCall,
        ...callData,
        updatedAt: now,
      };
      setCalls(prev => prev.map(c => (c.id === existingCall.id ? updated : c)));

      // If completing, update prospect status and linked follow-ups
      if (updated.callStatus === 'Completed') {
        const nowFormatted = now.split('T')[0];
        let nextStatus: ProspectStatus | undefined = undefined;
        if (updated.outcome === 'Connected - Interested') nextStatus = 'Qualified';
        else if (updated.outcome === 'Connected - Follow-up Needed' || updated.outcome === 'Connected - Follow-up Required') nextStatus = 'In Discussion';
        else if (updated.outcome === 'Connected - Not Interested') nextStatus = 'Unqualified';
        else if (updated.outcome === 'No Answer / Voicemail' || updated.outcome === 'Left Voicemail' || updated.outcome === 'Gatekeeper Blocked') nextStatus = 'Attempted';

        updateProspect(updated.prospectId, {
          lastContactDate: nowFormatted,
          ...(nextStatus ? { status: nextStatus } : {})
        });

        if (updated.nextAction && updated.nextAction.trim() !== '') {
          const existingFu = followUps.find(f => f.callId === updated.id);
          const followUpDueDate = updated.followUpDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];

          if (existingFu) {
            updateFollowUp(existingFu.id, {
              task: updated.nextAction,
              dueDate: followUpDueDate,
            });
          } else {
            addFollowUp({
              prospectId: updated.prospectId,
              companyName: updated.companyName,
              contactName: updated.contactName,
              callId: updated.id,
              task: updated.nextAction,
              dueDate: followUpDueDate,
              priority: updated.outcome === 'Connected - Interested' ? 'High' : 'Medium',
              status: 'Pending',
              notes: `Scheduled from discovery call on ${nowFormatted}. Objective: ${updated.callObjective}`
            });
          }
        }
      }

      api.calls.update(existingCall.id, callData).catch(err => {
        console.error('Failed to update call draft via API:', err);
        safeSetApiError(`Failed to update call: ${err.message}`);
      });

      return updated;
    } else {
      return addCallRecord({
        prospectId: callData.prospectId,
        companyName: callData.companyName,
        contactName: callData.contactName,
        callDate: callData.callDate || now,
        durationSeconds: callData.durationSeconds || 0,
        callStatus: callData.callStatus || 'Not Started',
        callObjective: callData.callObjective || 'General manufacturing discovery',
        preparationNotes: callData.preparationNotes,
        businessProblemNotes: callData.businessProblemNotes,
        evidenceNotes: callData.evidenceNotes,
        unknownsNotes: callData.unknownsNotes,
        objectionsNotes: callData.objectionsNotes,
        questionsToAsk: callData.questionsToAsk,
        notes: callData.notes || '',
        outcome: callData.outcome,
        nextAction: callData.nextAction,
        followUpDate: callData.followUpDate,
      });
    }
  };

  const getCallById = (id: string): CallRecord | undefined => {
    return calls.find(c => c.id === id);
  };

  const createCallRecordAsync = async (
    data: Partial<CallRecord> & { prospectId: string; companyName: string }
  ): Promise<CallRecord> => {
    if (data.prospectId && !UUID_REGEX.test(data.prospectId)) {
      throw new Error(`Invalid prospect identifier: "${data.prospectId}" is not a valid UUID.`);
    }

    const now = new Date().toISOString();
    const payload = {
      ...data,
      callDate: data.callDate || now,
      callStatus: data.callStatus || 'In Progress',
      callObjective: data.callObjective || 'General manufacturing discovery',
      activeStage: data.activeStage || 1,
      furthestStageReached: data.furthestStageReached || 1,
      durationSeconds: data.durationSeconds || 0,
      prospectWords: data.prospectWords || '',
      quoteStatus: data.quoteStatus || 'not_reached',
      stageNotes: data.stageNotes || {},
      stageEvents: data.stageEvents || [],
    };

    const persisted = await api.calls.create(payload as any);
    setCalls(prev => {
      const exists = prev.some(c => c.id === persisted.id);
      if (exists) {
        return prev.map(c => (c.id === persisted.id ? persisted : c));
      }
      return [persisted, ...prev];
    });

    if (data.prospectId) {
      updateProspect(data.prospectId, {
        lastContactDate: now.split('T')[0],
      });
    }

    if (persisted.callStatus === 'In Progress') {
      setActiveCallId(persisted.id);
      setCallLifecycleState('active');
    }

    return persisted;
  };

  const saveCallDraftAsync = async (
    callData: Partial<CallRecord> & { prospectId: string; companyName: string }
  ): Promise<CallRecord> => {
    if (!callData.id) {
      return createCallRecordAsync(callData);
    }

    const now = new Date().toISOString();
    const updated = await api.calls.update(callData.id, callData);
    setCalls(prev => prev.map(c => (c.id === callData.id ? { ...c, ...updated } : c)));

    if (updated.callStatus === 'Completed') {
      setActiveCallId(null);
      setCallLifecycleState('completed');

      const nowFormatted = now.split('T')[0];
      let nextStatus: ProspectStatus | undefined = undefined;
      if (updated.outcome === 'Connected - Interested') nextStatus = 'Qualified';
      else if (updated.outcome === 'Connected - Follow-up Needed' || updated.outcome === 'Connected - Follow-up Required') nextStatus = 'In Discussion';
      else if (updated.outcome === 'Connected - Not Interested') nextStatus = 'Unqualified';
      else if (updated.outcome === 'No Answer / Voicemail' || updated.outcome === 'Left Voicemail' || updated.outcome === 'Gatekeeper Blocked') nextStatus = 'Attempted';

      updateProspect(updated.prospectId, {
        lastContactDate: nowFormatted,
        ...(nextStatus ? { status: nextStatus } : {})
      });

      if (updated.nextAction && updated.nextAction.trim() !== '') {
        const existingFu = followUps.find(f => f.callId === updated.id);
        const followUpDueDate = updated.followUpDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];

        if (existingFu) {
          updateFollowUp(existingFu.id, {
            task: updated.nextAction,
            dueDate: followUpDueDate,
          });
        } else {
          addFollowUp({
            prospectId: updated.prospectId,
            companyName: updated.companyName,
            contactName: updated.contactName,
            callId: updated.id,
            task: updated.nextAction,
            dueDate: followUpDueDate,
            priority: updated.outcome === 'Connected - Interested' ? 'High' : 'Medium',
            status: 'Pending',
            notes: `Scheduled from discovery call on ${nowFormatted}. Objective: ${updated.callObjective}`
          });
        }
      }
    }

    return updated;
  };

  const recordStageEvent = async (
    callId: string,
    event: { stageNumber: CallStageNumber; eventType: string; eventLabel: string; id?: string }
  ): Promise<StageEvent> => {
    const res = await api.calls.addEvent(callId, event);
    setCalls(prev => prev.map(c => {
      if (c.id === callId) {
        const events = c.stageEvents || [];
        const exists = events.some(e => e.stageNumber === event.stageNumber && e.eventType === event.eventType);
        if (exists) return c;
        return {
          ...c,
          stageEvents: [...events, res],
        };
      }
      return c;
    }));
    return res;
  };

  const removeStageEvent = async (
    callId: string,
    eventId: string,
    stageNumber?: number,
    eventType?: string
  ): Promise<void> => {
    if (stageNumber && eventType) {
      await api.calls.deleteEventByKey(callId, stageNumber, eventType);
    } else {
      await api.calls.deleteEvent(callId, eventId);
    }
    setCalls(prev => prev.map(c => {
      if (c.id === callId) {
        const events = (c.stageEvents || []).filter(e => {
          if (stageNumber && eventType) {
            return !(e.stageNumber === stageNumber && e.eventType === eventType);
          }
          return e.id !== eventId;
        });
        return { ...c, stageEvents: events };
      }
      return c;
    }));
  };

  // AI Post-Call Review Handlers
  const getCallReview = async (callId: string): Promise<CallAiReview | null> => {
    try {
      return await api.calls.getReview(callId);
    } catch (err) {
      console.warn('[DataContext] Failed to get call review:', err);
      return null;
    }
  };

  const generateCallReview = async (callId: string): Promise<CallAiReview> => {
    const review = await api.calls.generateReview(callId);
    setCalls(prev => prev.map(c => (c.id === callId ? { ...c, hasReview: true } : c)));
    return review;
  };

  const updateCallReview = async (
    callId: string,
    data: { suggestedFollowUpMessage?: string }
  ): Promise<CallAiReview> => {
    return await api.calls.updateReview(callId, data);
  };

  // 3. Follow-up Handlers
  const addFollowUp = (data: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>): FollowUp => {
    const optimisticId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newFollowUp: FollowUp = {
      ...data,
      id: optimisticId,
      createdAt: now,
      updatedAt: now,
    };

    setFollowUps(prev => [newFollowUp, ...prev]);

    api.followups.create({ ...data, id: optimisticId } as any).then(created => {
      setFollowUps(prev => prev.map(f => (f.id === optimisticId ? created : f)));
    }).catch(err => {
      console.error('Failed to create follow-up via API:', err);
      safeSetApiError(`Failed to create follow-up: ${err.message}`);
    });

    return newFollowUp;
  };

  const updateFollowUp = (id: string, data: Partial<FollowUp>) => {
    const now = new Date().toISOString();
    setFollowUps(prev => prev.map(f => (f.id === id ? { ...f, ...data, updatedAt: now } : f)));

    api.followups.update(id, data).catch(err => {
      console.error('Failed to update follow-up via API:', err);
      safeSetApiError(`Failed to update follow-up: ${err.message}`);
    });
  };

  const toggleFollowUpComplete = (id: string) => {
    const now = new Date().toISOString();
    const item = followUps.find(f => f.id === id);
    if (!item) return;

    const nextStatus = item.status === 'Completed' ? 'Pending' : 'Completed';
    const completedAt = nextStatus === 'Completed' ? now : undefined;

    setFollowUps(prev => prev.map(f => {
      if (f.id === id) {
        return {
          ...f,
          status: nextStatus,
          completedAt,
          updatedAt: now,
        };
      }
      return f;
    }));

    api.followups.update(id, {
      status: nextStatus,
      completedAt: completedAt || null as any,
    }).catch(err => {
      console.error('Failed to toggle follow-up complete via API:', err);
      safeSetApiError(`Failed to update task status: ${err.message}`);
    });
  };

  const deleteFollowUp = (id: string) => {
    setFollowUps(prev => prev.filter(f => f.id !== id));
    api.followups.delete(id).catch(err => {
      console.error('Failed to delete follow-up via API:', err);
      safeSetApiError(`Failed to delete follow-up: ${err.message}`);
    });
  };

  // 4. Preferences & Seed Options
  const updatePreferences = (data: Partial<AppPreferences>) => {
    setPreferences(prev => ({ ...prev, ...data }));
  };

  // Voluntary explicit seed into user's database account
  const seedSampleData = async (): Promise<{ success: boolean; message: string }> => {
    return { success: true, message: 'Sample data seeding is disabled. All prospects are persistent and managed in Supabase.' };
  };

  const resetToSampleData = () => {
    setProspects([]);
    setCalls([]);
    setFollowUps([]);
  };

  return (
    <DataContext.Provider value={{
      prospects,
      calls,
      followUps,
      profile,
      preferences,
      metrics,
      isLoadingData,
      apiError,
      clearApiError: () => setApiError(null),
      refetchData: fetchData,
      callLifecycleState,
      activeCallId,
      isCallMode,
      setCallLifecycleState,
      setActiveCallId,
      addProspect,
      updateProspect,
      deleteProspect,
      getProspectById,
      addCallRecord,
      updateCallRecord,
      saveCallDraftOrComplete,
      createCallRecordAsync,
      saveCallDraftAsync,
      recordStageEvent,
      removeStageEvent,
      getCallById,
      getCallReview,
      generateCallReview,
      updateCallReview,
      addFollowUp,
      updateFollowUp,
      toggleFollowUpComplete,
      deleteFollowUp,
      updatePreferences,
      seedSampleData,
      resetToSampleData,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

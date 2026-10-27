import { 
  Prospect, 
  CallRecord, 
  FollowUp, 
  StageEvent, 
  CallAiReview,
  LiveCallAiSuggestionPayload,
  LiveCallAiSuggestionInput,
  LiveTranscriptSegment,
  RealTimeCoachingSuggestion,
  RealTimeCoachingInput,
} from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export class ApiError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function getAccessToken(): Promise<string | null> {
  if (isSupabaseConfigured) {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  // Check demo session
  const stored = localStorage.getItem('ccc_demo_user');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed?.session?.access_token || null;
    } catch (_) {}
  }

  // Return active demo token fallback
  return 'demo_token_active_user';
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      `Network connection to API server failed at ${url}. Please ensure backend is running.`,
      0,
      err
    );
  }

  let body: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  if (!response.ok) {
    const errorMessage = typeof body === 'object' && body?.error 
      ? body.error 
      : `HTTP ${response.status}: ${response.statusText}`;
    throw new ApiError(errorMessage, response.status, body);
  }

  return (body?.data !== undefined ? body.data : body) as T;
}

export const api = {
  // System Health
  health: {
    check: () => request<{ status: string; service: string; version: string }>('/api/health'),
  },

  // Prospects API
  prospects: {
    getAll: (params?: { search?: string; status?: string; industry?: string }) => {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.status) query.append('status', params.status);
      if (params?.industry) query.append('industry', params.industry);
      const q = query.toString();
      return request<Prospect[]>(`/api/prospects${q ? `?${q}` : ''}`);
    },
    getById: (id: string) => request<Prospect>(`/api/prospects/${id}`),
    create: (data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>) =>
      request<Prospect>('/api/prospects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Prospect>) =>
      request<Prospect>(`/api/prospects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/prospects/${id}`, {
        method: 'DELETE',
      }),
  },

  // Calls API
  calls: {
    getAll: (params?: { prospectId?: string; status?: string; outcome?: string; search?: string }) => {
      const query = new URLSearchParams();
      if (params?.prospectId) query.append('prospectId', params.prospectId);
      if (params?.status) query.append('status', params.status);
      if (params?.outcome) query.append('outcome', params.outcome);
      if (params?.search) query.append('search', params.search);
      const q = query.toString();
      return request<CallRecord[]>(`/api/calls${q ? `?${q}` : ''}`);
    },
    getById: (id: string) => request<CallRecord>(`/api/calls/${id}`),
    create: (data: Partial<CallRecord> & { companyName: string }) =>
      request<CallRecord>('/api/calls', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<CallRecord>) =>
      request<CallRecord>(`/api/calls/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/calls/${id}`, {
        method: 'DELETE',
      }),
    getEvents: (callId: string) =>
      request<StageEvent[]>(`/api/calls/${callId}/events`),
    addEvent: (callId: string, event: { stageNumber: number; eventType: string; eventLabel: string; id?: string }) =>
      request<StageEvent>(`/api/calls/${callId}/events`, {
        method: 'POST',
        body: JSON.stringify(event),
      }),
    deleteEvent: (callId: string, eventId: string) =>
      request<{ success: boolean; message: string }>(`/api/calls/${callId}/events/${eventId}`, {
        method: 'DELETE',
      }),
    deleteEventByKey: (callId: string, stageNumber: number, eventType: string) =>
      request<{ success: boolean; message: string }>(
        `/api/calls/${callId}/events?stageNumber=${stageNumber}&eventType=${encodeURIComponent(eventType)}`,
        { method: 'DELETE' }
      ),
    getReview: (callId: string) =>
      request<CallAiReview | null>(`/api/calls/${callId}/review`),
    generateReview: (callId: string, data?: { transcriptSegments?: any[] }) =>
      request<CallAiReview>(`/api/calls/${callId}/review`, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      }),
    updateReview: (callId: string, data: { suggestedFollowUpMessage?: string }) =>
      request<CallAiReview>(`/api/calls/${callId}/review`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getSuggestions: (callId?: string, data?: Partial<LiveCallAiSuggestionInput>, signal?: AbortSignal) => {
      const endpoint = callId ? `/api/calls/${callId}/suggestions` : '/api/calls/suggestions';
      return request<LiveCallAiSuggestionPayload>(endpoint, {
        method: 'POST',
        body: JSON.stringify(data || {}),
        signal,
      });
    },
    getCoaching: (callId: string) =>
      request<RealTimeCoachingSuggestion | null>(`/api/calls/${callId}/coaching`),
    requestCoaching: (callId: string, data?: Partial<RealTimeCoachingInput>, signal?: AbortSignal) => {
      const endpoint = callId ? `/api/calls/${callId}/coaching` : '/api/calls/coaching';
      return request<RealTimeCoachingSuggestion>(endpoint, {
        method: 'POST',
        body: JSON.stringify(data || {}),
        signal,
      });
    },
    getTranscript: (callId: string) =>
      request<LiveTranscriptSegment[]>(`/api/calls/${callId}/transcript`),
    addTranscriptSegment: (callId: string, segment: Partial<LiveTranscriptSegment> & { text: string }) =>
      request<LiveTranscriptSegment>(`/api/calls/${callId}/transcript`, {
        method: 'POST',
        body: JSON.stringify(segment),
      }),
    updateTranscriptSpeaker: (callId: string, segmentId: string, speaker: string) =>
      request<LiveTranscriptSegment>(`/api/calls/${callId}/transcript/${segmentId}/speaker`, {
        method: 'PATCH',
        body: JSON.stringify({ speaker }),
      }),
  },

  // AI Assistant API
  ai: {
    getHealth: () =>
      request<{ status: string; configured: boolean; model: string; provider: string; message: string }>('/api/ai/health'),
    callAssist: (data: Partial<LiveCallAiSuggestionInput>, signal?: AbortSignal) =>
      request<LiveCallAiSuggestionPayload>('/api/ai/call-assist', {
        method: 'POST',
        body: JSON.stringify(data || {}),
        signal,
      }),
    requestCoaching: (data: Partial<RealTimeCoachingInput>, signal?: AbortSignal) =>
      request<RealTimeCoachingSuggestion>('/api/calls/coaching', {
        method: 'POST',
        body: JSON.stringify(data || {}),
        signal,
      }),
  },

  // Follow-ups API
  followups: {
    getAll: (params?: { status?: string; priority?: string; prospectId?: string; callId?: string }) => {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.priority) query.append('priority', params.priority);
      if (params?.prospectId) query.append('prospectId', params.prospectId);
      if (params?.callId) query.append('callId', params.callId);
      const q = query.toString();
      return request<FollowUp[]>(`/api/followups${q ? `?${q}` : ''}`);
    },
    getById: (id: string) => request<FollowUp>(`/api/followups/${id}`),
    create: (data: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>) =>
      request<FollowUp>('/api/followups', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<FollowUp>) =>
      request<FollowUp>(`/api/followups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/followups/${id}`, {
        method: 'DELETE',
      }),
  },
};

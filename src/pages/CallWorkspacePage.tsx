import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  Save, 
  Clock, 
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Loader2, 
  Calendar,
  Sparkles,
  PhoneCall,
  History,
  X,
  Mic,
  MicOff
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { 
  CallStatus, 
  CallOutcome, 
  CallStageNumber, 
  QuoteStatus, 
  EndingReason, 
  StageEvent, 
  StageActionTap,
  CallRecord,
  FollowUp,
  FollowUpPriority,
  LiveCallAiSuggestionPayload,
  LiveTranscriptSegment,
  RealTimeCoachingSuggestion,
  RecognitionStatus,
} from '../types';
import { useData } from '../context/DataContext';
import { formatDuration } from '../lib/dateUtils';
import { STAGES_CONFIG, getStageConfig, QUOTE_STATUS_OPTIONS } from '../data/stageDefinitions';
import { StageStepper } from '../components/workspace/StageStepper';
import { StageActionTaps } from '../components/workspace/StageActionTaps';
import { LiveTranscriptPanel } from '../components/workspace/LiveTranscriptPanel';
import { EndCallModal } from '../components/workspace/EndCallModal';
import { CallReviewModal } from '../components/workspace/CallReviewModal';
import { FollowUpModal } from '../components/followups/FollowUpModal';
import { AiSuggestionsPanel } from '../components/workspace/AiSuggestionsPanel';
import { GeminiLiveAudioClient } from '../lib/geminiLiveAudio';
import { api } from '../lib/api';

type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export const CallWorkspacePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { 
    prospects, 
    calls, 
    followUps,
    preferences, 
    callLifecycleState,
    activeCallId: contextActiveCallId,
    isCallMode,
    setCallLifecycleState,
    setActiveCallId: setContextActiveCallId,
    createCallRecordAsync,
    saveCallDraftAsync,
    recordStageEvent,
    removeStageEvent,
    addFollowUp,
    updateFollowUp
  } = useData();

  // Selected Prospect State
  const prospectIdFromQuery = searchParams.get('prospectId');
  const [selectedProspectId, setSelectedProspectId] = useState<string>(
    prospectIdFromQuery || (prospects.length > 0 ? prospects[0].id : '')
  );

  useEffect(() => {
    if (prospectIdFromQuery && prospects.some(p => p.id === prospectIdFromQuery)) {
      setSelectedProspectId(prospectIdFromQuery);
    } else if ((!selectedProspectId || !prospects.some(p => p.id === selectedProspectId)) && prospects.length > 0) {
      setSelectedProspectId(prospects[0].id);
    }
  }, [prospects, prospectIdFromQuery, selectedProspectId]);

  const selectedProspect = prospects.find(p => p.id === selectedProspectId);

  // Active Call Session Identifier
  const [activeCallId, setActiveCallId] = useState<string | null>(contextActiveCallId || null);

  // Call Status & Timer State
  const [callStatus, setCallStatus] = useState<CallStatus>('Not Started');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Eight-Stage Call Progression State
  const [activeStage, setActiveStage] = useState<CallStageNumber>(1);
  const [furthestStageReached, setFurthestStageReached] = useState<CallStageNumber>(1);

  // Live Call Data Draft
  const [prospectWords, setProspectWords] = useState<string>('');
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('not_reached');
  const [stageEvents, setStageEvents] = useState<StageEvent[]>([]);
  const [stageNotes, setStageNotes] = useState<Record<number, string>>({});
  const [callObjective, setCallObjective] = useState<string>('');
  const [outcome, setOutcome] = useState<CallOutcome>('Connected - Follow-up Required');
  const [nextAction, setNextAction] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string>('');

  // UI, Feedback & Persistence State
  const [isEndCallModalOpen, setIsEndCallModalOpen] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isStartingCall, setIsStartingCall] = useState<boolean>(false);
  const [isEndingCall, setIsEndingCall] = useState<boolean>(false);
  const [lastCompletedCall, setLastCompletedCall] = useState<CallRecord | null>(null);

  // AI Suggestions Panel State (Legacy)
  const [aiSuggestions, setAiSuggestions] = useState<LiveCallAiSuggestionPayload | null>(null);
  const [_isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [_aiError, setAiError] = useState<string | null>(null);
  const [isMobileAiOpen, setIsMobileAiOpen] = useState<boolean>(false);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  // Real-Time AI Coaching State
  const [coachingSuggestion, setCoachingSuggestion] = useState<RealTimeCoachingSuggestion | null>(null);
  const [isLoadingCoaching, setIsLoadingCoaching] = useState<boolean>(false);
  const [coachingError, setCoachingError] = useState<string | null>(null);
  const [coachingLastUpdated, setCoachingLastUpdated] = useState<string | null>(null);
  const [coachingCooldown, setCoachingCooldown] = useState<boolean>(false);
  const [coachingStatusMessage, setCoachingStatusMessage] = useState<string | null>(null);
  const coachingRequestIdRef = useRef<number>(0);
  const coachingDebounceTimerRef = useRef<any>(null);
  const lastProcessedTranscriptIdRef = useRef<string | null>(null);
  const fetchRealTimeCoachingRef = useRef<((options?: {
    force?: boolean;
    triggerSegment?: LiveTranscriptSegment;
    customSegments?: LiveTranscriptSegment[];
    isCorrectionRefresh?: boolean;
    statusMessage?: string;
  }) => Promise<void>) | null>(null);
  // Live Speech Recognition & Transcript State
  const [transcriptSegments, setTranscriptSegments] = useState<LiveTranscriptSegment[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [recognitionStatus, setRecognitionStatus] = useState<RecognitionStatus>('idle');
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [secondaryRailTab, setSecondaryRailTab] = useState<'stage' | 'ai'>('stage');
  const [speakerPauseThreshold, setSpeakerPauseThreshold] = useState<number>(1.5);
  const [isSpeakerSwitchPending, setIsSpeakerSwitchPending] = useState<boolean>(false);
  const speechAdapterRef = useRef<GeminiLiveAudioClient | null>(null);
  const mainContentScrollRef = useRef<HTMLDivElement>(null);

  // Stage 7/8 Follow-up Workflow State
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState<boolean>(false);
  const [followUpModalPrefill, setFollowUpModalPrefill] = useState<{
    task?: string;
    dueDate?: string;
    priority?: FollowUpPriority;
    notes?: string;
    initialData?: FollowUp | null;
  }>({});

  // Debounced auto-save timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aiDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active Stage Definition
  const currentStageConfig = getStageConfig(activeStage);

  // Sync selected prospect with URL query
  useEffect(() => {
    if (selectedProspectId) {
      setSearchParams({ prospectId: selectedProspectId }, { replace: true });
    }
  }, [selectedProspectId, setSearchParams]);

  // Load prospect initial context or resume existing in-progress call
  useEffect(() => {
    if (selectedProspect && callStatus === 'Not Started') {
      const existingInProgress = calls.find(
        c => c.prospectId === selectedProspect.id && c.callStatus === 'In Progress'
      );

      if (existingInProgress) {
        setActiveCallId(existingInProgress.id);
        setContextActiveCallId(existingInProgress.id);
        setCallStatus('In Progress');
        setCallLifecycleState('active');
        setActiveStage(existingInProgress.activeStage || 1);
        setFurthestStageReached(existingInProgress.furthestStageReached || 1);
        setCallObjective(existingInProgress.callObjective || '');
        setProspectWords(existingInProgress.prospectWords || '');
        setQuoteStatus(existingInProgress.quoteStatus || 'not_reached');
        setStageEvents(existingInProgress.stageEvents || []);
        setStageNotes(existingInProgress.stageNotes || {});
        setOutcome(existingInProgress.outcome || 'Connected - Follow-up Required');
        setNextAction(existingInProgress.nextAction || '');
        setFollowUpDate(existingInProgress.followUpDate || '');
        setElapsedSeconds(existingInProgress.durationSeconds || 0);

        // Fetch fresh event data from backend to ensure full restoration
        api.calls.getEvents(existingInProgress.id).then(events => {
          if (Array.isArray(events) && events.length > 0) {
            setStageEvents(events);
          }
        }).catch(() => {});
      } else {
        setActiveCallId(null);
        setContextActiveCallId(null);
        setCallStatus('Not Started');
        setActiveStage(1);
        setFurthestStageReached(1);
        setCallObjective(
          selectedProspect.notes
            ? `Discover manufacturing bottlenecks: ${selectedProspect.notes.split('.')[0]}`
            : preferences.defaultCallObjective || 'Manufacturing operations discovery'
        );
        setProspectWords('');
        setQuoteStatus('not_reached');
        setStageEvents([]);
        setStageNotes({});
        setOutcome('Connected - Follow-up Required');
        setNextAction('');

        // Default follow-up date: 2 business days from now
        const now = new Date();
        const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
        const yyyy = nextDate.getFullYear();
        const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
        const dd = String(nextDate.getDate()).padStart(2, '0');
        setFollowUpDate(`${yyyy}-${mm}-${dd}`);

        setElapsedSeconds(0);
        setIsTimerRunning(false);
      }
      setSaveState('saved');
      setSaveErrorMessage(null);
    }
  }, [selectedProspect?.id, preferences.defaultCallObjective, calls, setCallLifecycleState, setContextActiveCallId]);

  // Live timer interval
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  // Navigation guard against accidental page closure during live call
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (callStatus === 'In Progress' && saveState === 'unsaved') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [callStatus, saveState]);

  // Core persistence function connecting workspace to backend database
  const persistCallState = useCallback(async (overrides?: Partial<CallRecord>): Promise<CallRecord | null> => {
    if (!selectedProspect) return null;

    setSaveState('saving');
    setSaveErrorMessage(null);

    const payload: Partial<CallRecord> & { prospectId: string; companyName: string } = {
      id: activeCallId || undefined,
      prospectId: selectedProspect.id,
      companyName: selectedProspect.companyName,
      contactName: selectedProspect.contactName,
      durationSeconds: elapsedSeconds,
      callStatus: callStatus === 'Not Started' ? 'In Progress' : callStatus,
      callObjective: callObjective.trim() || 'Manufacturing discovery',
      activeStage,
      furthestStageReached,
      prospectWords,
      quoteStatus,
      stageEvents,
      stageNotes,
      outcome,
      nextAction: nextAction.trim() || undefined,
      followUpDate: nextAction.trim() ? followUpDate : undefined,
      ...overrides,
    };

    try {
      const saved = await saveCallDraftAsync(payload);
      if (!activeCallId && saved.id) {
        setActiveCallId(saved.id);
        setContextActiveCallId(saved.id);
      }
      setSaveState('saved');
      return saved;
    } catch (err: any) {
      console.error('Failed to save call state to database:', err);
      setSaveState('error');
      setSaveErrorMessage(err?.message || 'Database write failed. Draft preserved locally.');
      return null;
    }
  }, [
    activeCallId,
    selectedProspect,
    elapsedSeconds,
    callStatus,
    callObjective,
    activeStage,
    furthestStageReached,
    prospectWords,
    quoteStatus,
    stageEvents,
    stageNotes,
    outcome,
    nextAction,
    followUpDate,
    saveCallDraftAsync,
    setContextActiveCallId,
  ]);

  // Schedule debounced auto-save for user text typing (quote & notes)
  const triggerDebouncedAutoSave = useCallback(() => {
    setSaveState('unsaved');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      persistCallState();
    }, 1200);
  }, [persistCallState]);

  // AI Suggestions are permanently deactivated to protect gemini-3.5-transcribe-live quota
  const fetchSuggestions = useCallback((..._args: any[]) => {
    setAiSuggestions(null);
    setAiError(null);
    setIsLoadingAi(false);
  }, []);

  const triggerDebouncedAiRefresh = useCallback(() => {}, []);

  // Real-Time AI Coaching fetcher
  const fetchRealTimeCoaching = useCallback(async (options?: {
    force?: boolean;
    triggerSegment?: LiveTranscriptSegment;
    customSegments?: LiveTranscriptSegment[];
    isCorrectionRefresh?: boolean;
    statusMessage?: string;
  }) => {
    const currentCallId = activeCallId || activeCallIdRef.current;
    if (!currentCallId) return;

    // Rate limiting cooldown check unless forced by user click or speaker correction
    if (!options?.force && coachingCooldown) {
      return;
    }

    const requestId = ++coachingRequestIdRef.current;
    setIsLoadingCoaching(true);
    setCoachingStatusMessage(options?.statusMessage || 'Analyzing');
    setCoachingError(null);

    // Apply 2.5s cooldown to prevent flood
    setCoachingCooldown(true);
    setTimeout(() => setCoachingCooldown(false), 2500);

    try {
      const currentStageDef = getStageConfig(activeStage);
      const stageName = currentStageDef?.name || `Stage ${activeStage}`;

      // Use customSegments if provided (e.g. 2-segment window on correction), otherwise recent 8
      const recentHistory = options?.customSegments || transcriptSegments.slice(-8);
      const latestSeg = recentHistory.length > 0 ? recentHistory[recentHistory.length - 1] : null;

      const result = await api.calls.requestCoaching(currentCallId, {
        callId: currentCallId,
        companyName: selectedProspect?.companyName || 'Target Company',
        contactName: selectedProspect?.contactName,
        industry: selectedProspect?.industry,
        manufacturingType: selectedProspect?.manufacturingType,
        prospectNotes: selectedProspect?.notes,
        activeStage,
        stageName,
        callObjective: callObjective || currentStageDef?.purpose,
        recentSegments: recentHistory.map(s => ({
          speaker: s.speaker,
          text: s.text,
          timestamp: s.timestamp,
          segmentId: s.segmentId || s.id,
          speaker_source: s.speaker_source,
          is_manual: s.is_manual,
        })),
        latestStatement: latestSeg?.text,
        latestSpeaker: latestSeg?.speaker,
        isCorrectionRefresh: Boolean(options?.isCorrectionRefresh),
        stageEvents: stageEvents.filter(e => e.stageNumber === activeStage),
        stageNotes,
        prospectWords,
        quoteStatus,
        sourceSegmentId: options?.triggerSegment?.segmentId || options?.triggerSegment?.id || latestSeg?.segmentId || latestSeg?.id,
      });

      // Guard against stale asynchronous responses
      if (requestId === coachingRequestIdRef.current && result) {
        setCoachingSuggestion(result);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setCoachingLastUpdated(timeStr);
      }
    } catch (err: any) {
      if (requestId === coachingRequestIdRef.current) {
        console.warn('Real-time coaching request notice:', err);
        setCoachingError(err?.message || 'Unable to generate coaching suggestion at this moment.');
      }
    } finally {
      if (requestId === coachingRequestIdRef.current) {
        setIsLoadingCoaching(false);
        setCoachingStatusMessage(null);
      }
    }
  }, [
    activeCallId,
    coachingCooldown,
    selectedProspect,
    activeStage,
    callObjective,
    transcriptSegments,
    stageNotes,
    stageEvents,
    prospectWords,
    quoteStatus,
  ]);

  // Keep ref up to date
  useEffect(() => {
    fetchRealTimeCoachingRef.current = fetchRealTimeCoaching;
  }, [fetchRealTimeCoaching]);

  // Load saved transcript segments and coaching suggestion when call is active
  useEffect(() => {
    if (activeCallId) {
      api.calls.getTranscript(activeCallId)
        .then(segments => {
          if (Array.isArray(segments) && segments.length > 0) {
            setTranscriptSegments(segments);
          }
        })
        .catch(err => console.warn('Could not load call transcripts:', err));

      api.calls.getCoaching(activeCallId)
        .then(cached => {
          if (cached) {
            setCoachingSuggestion(cached);
            setCoachingLastUpdated('Restored from call');
          }
        })
        .catch(err => console.warn('Could not load call coaching cache:', err));
    }
  }, [activeCallId]);

  // Cleanup speech adapter and coaching timers on unmount
  useEffect(() => {
    return () => {
      speechAdapterRef.current?.destroy();
      if (aiDebounceTimerRef.current) clearTimeout(aiDebounceTimerRef.current);
      if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();
      if (coachingDebounceTimerRef.current) clearTimeout(coachingDebounceTimerRef.current);
    };
  }, []);

  // Insert suggested response into active call notes
  const handleInsertSuggestionIntoNotes = useCallback((text: string) => {
    setStageNotes(prev => {
      const current = prev[activeStage] || '';
      const separator = current.trim().length > 0 ? '\n' : '';
      const updated = {
        ...prev,
        [activeStage]: `${current}${separator}[AI Coach]: "${text}"`,
      };
      return updated;
    });
    triggerDebouncedAutoSave();
  }, [activeStage, triggerDebouncedAutoSave]);

  // Active Call ID Ref to prevent stale closures in async WebSocket listeners
  const activeCallIdRef = useRef<string | null>(activeCallId);
  useEffect(() => {
    activeCallIdRef.current = activeCallId;
  }, [activeCallId]);

  // Handler when speech recognition finalizes a segment
  const handleFinalTranscriptSegment = useCallback((segment: LiveTranscriptSegment) => {
    const targetCallId = activeCallId || activeCallIdRef.current || segment.callId;

    setTranscriptSegments(prev => {
      // Requirement 5: If segment already exists and has been manually corrected, preserve it
      const existing = prev.find(s => s.segmentId === segment.segmentId || s.id === segment.segmentId);
      if (existing && (existing.speaker_source === 'manual' || existing.is_manual)) {
        return prev;
      }

      // Prevent duplicate segments by segmentId or identical text within 3s
      if (prev.some(s => s.segmentId === segment.segmentId || (s.text.trim().toLowerCase() === segment.text.trim().toLowerCase() && Math.abs(new Date(s.timestamp).getTime() - new Date(segment.timestamp).getTime()) < 3000))) {
        return prev;
      }
      const updated = [...prev, { ...segment, callId: targetCallId || undefined }];

      // Persist segment to database/backend
      if (targetCallId) {
        api.calls.addTranscriptSegment(targetCallId, segment).catch(err => {
          console.warn('Failed to persist transcript segment:', err);
        });
      }

      return updated;
    });

    // Trigger debounced real-time coaching for meaningful statements
    const cleanText = segment.text.trim();
    const words = cleanText.split(/\s+/).filter(Boolean);
    const isMeaningful = words.length >= 2 && !/^(ok|yeah|yes|no|hello|hi|um|uh|right)\.?$/i.test(cleanText);

    if (isMeaningful && segment.segmentId !== lastProcessedTranscriptIdRef.current) {
      lastProcessedTranscriptIdRef.current = segment.segmentId;
      if (coachingDebounceTimerRef.current) {
        clearTimeout(coachingDebounceTimerRef.current);
      }
      coachingDebounceTimerRef.current = setTimeout(() => {
        fetchRealTimeCoachingRef.current?.({ triggerSegment: segment });
      }, 1000);
    }
  }, [activeCallId]);

  const onFinalSegmentRef = useRef<(seg: LiveTranscriptSegment) => void>(handleFinalTranscriptSegment);
  useEffect(() => {
    onFinalSegmentRef.current = handleFinalTranscriptSegment;
  }, [handleFinalTranscriptSegment]);

  // Configurable Pause Threshold Change Handler
  const handlePauseThresholdChange = useCallback((seconds: number) => {
    setSpeakerPauseThreshold(seconds);
    if (speechAdapterRef.current) {
      speechAdapterRef.current.setPauseThreshold(seconds);
    }
  }, []);

  const getOrCreateSpeechAdapter = useCallback(() => {
    if (!speechAdapterRef.current) {
      speechAdapterRef.current = new GeminiLiveAudioClient({
        onInterimText: (text) => setInterimTranscript(text),
        onFinalSegment: (seg) => onFinalSegmentRef.current(seg),
        onStatusChange: (status, errMsg) => {
          setRecognitionStatus(status);
          if (errMsg) setRecognitionError(errMsg);
          else if (status === 'listening' || status === 'receiving_speech') setRecognitionError(null);
        },
        onError: (err) => setRecognitionError(err),
        onSpeakerChangePending: (pending) => setIsSpeakerSwitchPending(pending),
        pauseThresholdSeconds: speakerPauseThreshold,
      });
    }
    return speechAdapterRef.current;
  }, [speakerPauseThreshold]);

  // Toggle microphone listening with Gemini Live Audio Client
  const handleToggleListening = useCallback(async () => {
    const adapter = getOrCreateSpeechAdapter();

    const isCurrentlyActive = 
      recognitionStatus === 'listening' || 
      recognitionStatus === 'receiving_speech' || 
      recognitionStatus === 'processing_transcript';

    if (isCurrentlyActive) {
      adapter.stop();
      setRecognitionStatus('stopped');
      setIsSpeakerSwitchPending(false);
    } else {
      setRecognitionError(null);
      const targetCallId = activeCallId || (selectedProspect ? `live-call-${selectedProspect.id}` : 'live-call');
      await adapter.start(targetCallId);
    }
  }, [recognitionStatus, activeCallId, selectedProspect, getOrCreateSpeechAdapter]);

  // Copy transcript segment into stage scratchpad notes
  const handleCopyToNotes = useCallback((text: string) => {
    setStageNotes(prev => {
      const current = prev[activeStage] || '';
      const separator = current.trim().length > 0 ? '\n' : '';
      const updated = {
        ...prev,
        [activeStage]: `${current}${separator}${text}`,
      };
      persistCallState({ stageNotes: updated });
      return updated;
    });
    setSaveSuccessMessage('Transcript segment copied to Stage Notes!');
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  }, [activeStage, persistCallState]);

  // Set transcript segment as verbatim prospect quote
  const handleSetAsProspectWords = useCallback((text: string) => {
    setProspectWords(text);

    // Auto-classify quote status if operational problem keywords present
    const lower = text.toLowerCase();
    const indicatesNeed = lower.includes('problem') || lower.includes('bottleneck') || lower.includes('scrap') || lower.includes('downtime') || lower.includes('chatter') || lower.includes('issue') || lower.includes('broken');
    const newStatus: QuoteStatus = indicatesNeed ? 'need_stated' : quoteStatus === 'not_reached' ? 'unclear' : quoteStatus;

    if (newStatus !== quoteStatus) {
      setQuoteStatus(newStatus);
    }

    persistCallState({ prospectWords: text, quoteStatus: newStatus });
    fetchSuggestions(activeStage, stageEvents, text, newStatus);
    setSaveSuccessMessage('Set as Prospect Verbatim Quote!');
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  }, [activeStage, quoteStatus, stageEvents, persistCallState, fetchSuggestions]);

  // Toggle speaker on a segment with immediate UI update, DB persistence, and AI coaching refresh
  const handleToggleSpeaker = useCallback((segmentId: string, nextSpeaker: 'agent' | 'prospect' | 'rep' | 'unknown') => {
    const targetCallId = activeCallId || activeCallIdRef.current;
    let nextSegments: LiveTranscriptSegment[] = [];
    let correctedIdx = -1;
    let correctedSegment: LiveTranscriptSegment | null = null;

    // 1. Immediately update local UI state with manual speaker marker
    setTranscriptSegments(prev => {
      nextSegments = prev.map((s, idx) => {
        if (s.id === segmentId || s.segmentId === segmentId) {
          correctedIdx = idx;
          const updated = {
            ...s,
            speaker: nextSpeaker as any,
            speaker_source: 'manual' as const,
            is_manual: true,
          };
          correctedSegment = updated;
          return updated;
        }
        return s;
      });
      return nextSegments;
    });

    // 2. Persist corrected speaker label to backend/database
    if (targetCallId) {
      api.calls.updateTranscriptSpeaker(targetCallId, segmentId, nextSpeaker).catch(err => {
        console.warn('Failed to persist speaker correction to backend:', err);
      });
    }

    // 3. Re-analyze the two most recent finalized transcript segments including corrected segment
    // Section 2: If corrected segment is within the last 2 segments, send last 2 finalized segments.
    // If older, include 2 most recent ending at corrected segment plus immediately following segment.
    const allSegments = nextSegments.length > 0 ? nextSegments : transcriptSegments;
    const finalIdx = correctedIdx >= 0
      ? correctedIdx
      : allSegments.findIndex(s => s.id === segmentId || s.segmentId === segmentId);

    let contextSegments: LiveTranscriptSegment[] = [];
    if (allSegments.length <= 2) {
      contextSegments = allSegments;
    } else if (finalIdx >= allSegments.length - 2) {
      contextSegments = allSegments.slice(-2);
    } else {
      const startIdx = Math.max(0, finalIdx - 1);
      const endIdx = Math.min(allSegments.length, finalIdx + 2);
      contextSegments = allSegments.slice(startIdx, endIdx);
    }

    // 4. Trigger fresh coaching suggestion
    if (fetchRealTimeCoachingRef.current) {
      fetchRealTimeCoachingRef.current({
        force: true,
        customSegments: contextSegments,
        triggerSegment: correctedSegment || undefined,
        isCorrectionRefresh: true,
        statusMessage: 'Re-analyzing conversation...',
      });
    }
  }, [activeCallId, transcriptSegments]);

  // Clear live transcript segments
  const handleClearTranscript = useCallback(() => {
    setTranscriptSegments([]);
    setInterimTranscript('');
  }, []);

  // Start live call session with real database record
  const handleStartCall = async () => {
    if (!selectedProspect || isStartingCall) return;

    setIsStartingCall(true);
    setSaveErrorMessage(null);
    setSaveState('saving');
    setCallLifecycleState('starting');

    try {
      const initialCall = await createCallRecordAsync({
        prospectId: selectedProspect.id,
        companyName: selectedProspect.companyName,
        contactName: selectedProspect.contactName,
        callDate: new Date().toISOString(),
        durationSeconds: 0,
        callStatus: 'In Progress',
        callObjective: callObjective.trim() || 'Manufacturing discovery',
        activeStage: 1,
        furthestStageReached: 1,
        prospectWords: '',
        quoteStatus: 'not_reached',
        stageEvents: [],
        stageNotes: {},
        outcome: 'Connected - Follow-up Required',
      });

      setActiveCallId(initialCall.id);
      setContextActiveCallId(initialCall.id);
      setCallStatus('In Progress');
      setIsTimerRunning(true);
      setActiveStage(1);
      setFurthestStageReached(1);
      setProspectWords('');
      setQuoteStatus('not_reached');
      setStageEvents([]);
      setStageNotes({});
      setTranscriptSegments([]);
      setInterimTranscript('');
      setLastCompletedCall(null);
      setCoachingSuggestion(null);
      setCoachingError(null);
      setCoachingLastUpdated(null);
      lastProcessedTranscriptIdRef.current = null;
      setSaveState('saved');
      setCallLifecycleState('active'); // Swapping to Call Mode immediately
      setSaveSuccessMessage('Call session started. Live Focus Mode active.');
      setTimeout(() => setSaveSuccessMessage(null), 3000);

      // Load initial stage 1 suggestions
      fetchSuggestions(1, [], '', 'not_reached', {}, []);

      // Auto-start Gemini Live microphone streaming
      const adapter = getOrCreateSpeechAdapter();
      adapter.start(initialCall.id).catch(err => {
        console.warn('Gemini Live auto-start notice:', err);
      });
    } catch (err: any) {
      console.error('Failed to initialize call session:', err);
      setSaveState('error');
      setCallLifecycleState('error');
      setSaveErrorMessage(err?.message || 'Could not start call. Backend could not persist record. Please retry.');
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleToggleTimer = () => {
    setIsTimerRunning(prev => !prev);
  };

  // Mandatory Scroll Reset (Phase 5):
  // Reset main stage-content scroll container to top whenever activeStage changes
  useEffect(() => {
    if (mainContentScrollRef.current) {
      mainContentScrollRef.current.scrollTop = 0;
    }
  }, [activeStage]);

  // Stage Stepper Navigation (Safe backward and forward to visited stages)
  const handleSelectStage = async (stageNum: CallStageNumber) => {
    setActiveStage(stageNum);
    if (mainContentScrollRef.current) {
      mainContentScrollRef.current.scrollTop = 0;
    }
    requestAnimationFrame(() => {
      if (mainContentScrollRef.current) {
        mainContentScrollRef.current.scrollTop = 0;
      }
    });
    fetchSuggestions(stageNum);
    fetchRealTimeCoachingRef.current?.({ force: true });
    if (callStatus === 'In Progress') {
      await persistCallState({
        activeStage: stageNum,
        furthestStageReached,
      });
    }
  };

  // Move to next sequential stage
  const handleNextStage = async () => {
    if (activeStage < 8) {
      const nextStage = (activeStage + 1) as CallStageNumber;
      const nextFurthest = nextStage > furthestStageReached ? nextStage : furthestStageReached;
      const nextQuoteStatus = (nextStage === 5 && quoteStatus === 'not_reached') ? 'need_stated' : quoteStatus;

      setActiveStage(nextStage);
      setFurthestStageReached(nextFurthest);
      if (nextStage === 5 && quoteStatus === 'not_reached') {
        setQuoteStatus('need_stated');
      }

      if (mainContentScrollRef.current) {
        mainContentScrollRef.current.scrollTop = 0;
      }
      requestAnimationFrame(() => {
        if (mainContentScrollRef.current) {
          mainContentScrollRef.current.scrollTop = 0;
        }
      });

      fetchSuggestions(nextStage, stageEvents, prospectWords, nextQuoteStatus);
      fetchRealTimeCoachingRef.current?.({ force: true });

      if (callStatus === 'In Progress') {
        await persistCallState({
          activeStage: nextStage,
          furthestStageReached: nextFurthest,
          quoteStatus: nextQuoteStatus,
        });
      }
    } else {
      // Stage 8 wrap-up triggers pre-call-ending Gemini Review modal
      handleOpenReviewModal();
    }
  };

  // Move to previous stage
  const handlePrevStage = async () => {
    if (activeStage > 1) {
      const prevStage = (activeStage - 1) as CallStageNumber;
      setActiveStage(prevStage);
      if (mainContentScrollRef.current) {
        mainContentScrollRef.current.scrollTop = 0;
      }
      requestAnimationFrame(() => {
        if (mainContentScrollRef.current) {
          mainContentScrollRef.current.scrollTop = 0;
        }
      });
      fetchSuggestions(prevStage);
      if (callStatus === 'In Progress') {
        await persistCallState({
          activeStage: prevStage,
          furthestStageReached,
        });
      }
    }
  };

  // Stage Action Tap Toggle with Database Persistence & Instant AI Refresh
  const handleToggleEvent = async (tap: StageActionTap) => {
    const existingIndex = stageEvents.findIndex(
      e => e.stageNumber === activeStage && e.eventType === tap.id
    );

    let updatedEvents: StageEvent[] = [];

    if (existingIndex >= 0) {
      const existing = stageEvents[existingIndex];
      updatedEvents = stageEvents.filter((_, idx) => idx !== existingIndex);
      setStageEvents(updatedEvents);

      if (activeCallId) {
        try {
          await removeStageEvent(activeCallId, existing.id, activeStage, tap.id);
        } catch (err) {
          console.warn('Failed to delete stage event:', err);
        }
      }
      persistCallState({ stageEvents: updatedEvents });
      fetchSuggestions(activeStage, updatedEvents);
    } else {
      const newEventId = crypto.randomUUID();
      const newEvent: StageEvent = {
        id: newEventId,
        stageNumber: activeStage,
        eventType: tap.id,
        eventLabel: tap.label,
        timestamp: new Date().toISOString(),
      };
      updatedEvents = [...stageEvents, newEvent];
      setStageEvents(updatedEvents);

      if (activeCallId) {
        try {
          await recordStageEvent(activeCallId, newEvent);
        } catch (err) {
          console.warn('Failed to insert stage event:', err);
        }
      }
      if (activeStage === 7 && !isDncRequested() && tap.id !== 'no_next_step') {
        if (!nextAction.trim()) {
          setNextAction(`${tap.label} — ${selectedProspect?.contactName || selectedProspect?.companyName}`);
        }
      }

      persistCallState({ stageEvents: updatedEvents });
      fetchSuggestions(activeStage, updatedEvents);
    }
  };

  // Check if prospect requested Do Not Contact or has strict DNC restriction
  const isDncRequested = useCallback((): boolean => {
    return (
      stageEvents.some(e => e.eventType === 'do_not_contact_requested') ||
      selectedProspect?.status === 'Unqualified'
    );
  }, [stageEvents, selectedProspect]);

  // Open prefilled follow-up modal linked to current call
  const handleOpenFollowUpModal = (tap?: StageActionTap) => {
    if (isDncRequested()) return;

    const existingLinked = activeCallId ? followUps.find(f => f.callId === activeCallId) : null;
    if (existingLinked) {
      setFollowUpModalPrefill({
        initialData: existingLinked,
      });
      setIsFollowUpModalOpen(true);
      return;
    }

    let prefilledTask = '';
    if (tap) {
      prefilledTask = `${tap.label} — ${selectedProspect?.contactName || selectedProspect?.companyName}`;
    } else if (nextAction.trim()) {
      prefilledTask = nextAction.trim();
    } else {
      const stage7Event = stageEvents.find(e => e.stageNumber === 7 && e.eventType !== 'no_next_step');
      if (stage7Event) {
        prefilledTask = `${stage7Event.eventLabel} — ${selectedProspect?.contactName || selectedProspect?.companyName}`;
      } else {
        prefilledTask = `Follow-up with ${selectedProspect?.contactName || selectedProspect?.companyName}`;
      }
    }

    const notesParts: string[] = [];
    if (stageNotes[7]?.trim()) {
      notesParts.push(`Stage 7 Next Step Note: ${stageNotes[7].trim()}`);
    }
    if (stageNotes[8]?.trim()) {
      notesParts.push(`Stage 8 Close Note: ${stageNotes[8].trim()}`);
    }
    if (prospectWords?.trim()) {
      notesParts.push(`Prospect's Words: "${prospectWords.trim()}"`);
    }

    const isHighPriority = tap?.id === 'meeting_agreed' || tap?.id === 'callback_agreed';

    setFollowUpModalPrefill({
      task: prefilledTask,
      dueDate: followUpDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      priority: isHighPriority ? 'High' : 'Medium',
      notes: notesParts.join('\n\n'),
      initialData: null,
    });
    setIsFollowUpModalOpen(true);
  };

  const handleFollowUpSubmit = async (data: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (followUpModalPrefill.initialData) {
        await api.followups.update(followUpModalPrefill.initialData.id, data);
        updateFollowUp(followUpModalPrefill.initialData.id, data);
      } else {
        const payload = {
          ...data,
          callId: activeCallId || undefined,
        };
        const created = await api.followups.create(payload as any);
        addFollowUp(created);
      }
      setNextAction(data.task);
      setFollowUpDate(data.dueDate);
      persistCallState({
        nextAction: data.task,
        followUpDate: data.dueDate,
      });
      setSaveSuccessMessage(`Linked follow-up "${data.task}" scheduled successfully!`);
      setTimeout(() => setSaveSuccessMessage(null), 3500);
      setIsFollowUpModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save follow-up:', err);
      throw err;
    }
  };

  // Prospect verbatim words change (with debounced save & debounced AI refresh)
  const handleProspectWordsChange = (val: string) => {
    setProspectWords(val);
    triggerDebouncedAutoSave();
    triggerDebouncedAiRefresh();
  };

  // Quote status tag change (with immediate persistence & AI refresh)
  const handleQuoteStatusChange = (status: QuoteStatus) => {
    setQuoteStatus(status);
    persistCallState({ quoteStatus: status });
    fetchSuggestions(activeStage, stageEvents, prospectWords, status);
  };

  // Per-stage note change (with debounced save & debounced AI refresh)
  const handleStageNoteChange = (note: string) => {
    const updatedNotes = {
      ...stageNotes,
      [activeStage]: note,
    };
    setStageNotes(updatedNotes);
    triggerDebouncedAutoSave();
    triggerDebouncedAiRefresh();
  };

  // Manual Draft Save Button Handler
  const handleSaveDraft = async () => {
    const saved = await persistCallState();
    if (saved) {
      setSaveSuccessMessage('Call draft successfully saved to database.');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    }
  };

  // Pre-Call-Ending Gemini Review Modal Handler
  const handleOpenReviewModal = async () => {
    if (isEndingCall) return;
    // Safely stop microphone streaming to finalize pending speech chunks
    if (recognitionStatus === 'listening' || recognitionStatus === 'receiving_speech' || recognitionStatus === 'processing_transcript') {
      if (speechAdapterRef.current) {
        try {
          speechAdapterRef.current.stop();
        } catch (e) {
          console.warn('Error stopping speech adapter on review:', e);
        }
      }
    }
    // Flush draft to database so backend has current transcript and events
    try {
      await persistCallState();
    } catch (err) {
      console.warn('Could not auto-flush call state before review:', err);
    }
    setIsReviewModalOpen(true);
  };

  // Universal End Call Confirmation Handler (Accessible at all 8 stages)
  const handleConfirmEndCall = async ({
    endingStage,
    endingReason,
    outcome: finalOutcome,
    finalNotes,
  }: {
    endingStage: CallStageNumber;
    endingReason: EndingReason;
    outcome: CallOutcome;
    finalNotes?: string;
  }) => {
    if (!selectedProspect) return;

    setIsEndingCall(true);
    setSaveErrorMessage(null);
    setSaveState('saving');
    setCallLifecycleState('ending');

    const consolidatedNotes = [
      finalNotes ? `Final Summary: ${finalNotes}` : null,
      prospectWords ? `Prospect's Words: "${prospectWords}" (${quoteStatus})` : null,
      stageNotes[activeStage] ? `Stage ${activeStage} Note: ${stageNotes[activeStage]}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      const saved = await persistCallState({
        callStatus: 'Completed',
        endingStage, // Stores the EXACT stage where the call ended
        endingReason,
        outcome: finalOutcome,
        notes: consolidatedNotes || 'Call completed normally.',
        endedAt: new Date().toISOString(),
      });

      if (!saved) {
        throw new Error('Database did not return confirmation of completion.');
      }

      if (speechAdapterRef.current) {
        speechAdapterRef.current.stop();
      }

      setIsTimerRunning(false);
      setCallStatus('Completed');
      setLastCompletedCall(saved);
      setIsEndCallModalOpen(false);
      setIsReviewModalOpen(false);
      setSaveState('saved');
      setCallLifecycleState('completed'); // Normal mode layout restored immediately
      setSaveSuccessMessage(`Call successfully saved! Ended at Stage ${endingStage}: ${currentStageConfig.name}`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to end and save call:', err);
      setSaveState('error');
      setCallLifecycleState('active'); // Preserve active call state on failure so rep can retry
      setSaveErrorMessage(err?.message || 'Failed to save completed call to database. Your draft is preserved. Please retry.');
    } finally {
      setIsEndingCall(false);
    }
  };

  // Next Stage label computation
  const getNextStageLabel = (): string => {
    if (activeStage === 8) {
      return 'Complete Call Wrap-Up';
    }
    const nextConfig = STAGES_CONFIG.find(s => s.stageNumber === activeStage + 1);
    return nextConfig ? `Next: Stage ${nextConfig.stageNumber} — ${nextConfig.shortName}` : 'Next Stage';
  };

  // If no prospect is found in the workspace
  if (!selectedProspect) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <EmptyState
          icon={<Building2 className="w-12 h-12 text-slate-400" />}
          title="No prospects found"
          description="Create a prospect to get started."
          action={
            <Button variant="primary" onClick={() => navigate('/prospects')}>
              Create Prospect
            </Button>
          }
        />
      </div>
    );
  }

  // ==========================================================================
  // VIEW A: FOCUS CALL MODE (DISTRACTION-FREE LIVE INTERFACE)
  // ==========================================================================
  if (isCallMode) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)] sm:h-[calc(100vh-2.5rem)] text-slate-800 overflow-hidden">
        {/* Compact Enterprise Active Call Header (48-52px tall, single horizontal row) */}
        <header className="bg-white border border-slate-200/90 rounded-lg px-3 sm:px-4 py-1.5 mb-2 shadow-3xs shrink-0 flex items-center justify-between gap-2.5 h-12 sm:h-13">
          {/* Left section: Company, Active Indicator, Timer, Contact, Phone, Location (Single Row) */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 overflow-x-auto scrollbar-none py-0.5">
            {/* Company Name */}
            <h1 className="text-sm font-bold text-slate-900 tracking-tight shrink-0">
              {selectedProspect.companyName}
            </h1>

            <span className="text-slate-300 select-none">·</span>

            {/* Active Call Badge */}
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Call Active
            </span>

            {/* Elapsed Timer & Pause/Resume */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-xs text-slate-700 shrink-0">
              <Clock className="w-3 h-3 text-indigo-600" />
              <span>{formatDuration(elapsedSeconds)}</span>
              <button
                type="button"
                onClick={handleToggleTimer}
                className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                title={isTimerRunning ? 'Pause Call Timer' : 'Resume Timer'}
                aria-label={isTimerRunning ? 'Pause timer' : 'Resume timer'}
              >
                {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Contact Name & Role */}
            {selectedProspect.contactName && (
              <>
                <span className="text-slate-300 select-none">·</span>
                <span className="flex items-center gap-1 text-xs font-medium text-slate-700 shrink-0">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>{selectedProspect.contactName}</span>
                  {selectedProspect.jobTitle && (
                    <span className="text-slate-400 font-normal">({selectedProspect.jobTitle})</span>
                  )}
                </span>
              </>
            )}

            {/* Phone */}
            {selectedProspect.phone && (
              <>
                <span className="text-slate-300 select-none hidden md:inline">·</span>
                <a
                  href={`tel:${selectedProspect.phone}`}
                  className="hidden md:flex items-center gap-1 font-mono text-xs text-indigo-600 hover:underline shrink-0"
                  title="Prospect phone target"
                >
                  <Phone className="w-3 h-3 text-indigo-500" />
                  <span>{selectedProspect.phone}</span>
                </a>
              </>
            )}

            {/* Location */}
            {selectedProspect.location && (
              <>
                <span className="text-slate-300 select-none hidden lg:inline">·</span>
                <span className="hidden lg:flex items-center gap-1 text-xs text-slate-500 shrink-0">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{selectedProspect.location}</span>
                </span>
              </>
            )}
          </div>

          {/* Right section: Connection Status, Start/Stop Listening Action, Save Draft, End Call */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Listening / Connection Status Indicator */}
            <div className="flex items-center">
              {recognitionStatus === 'listening' || recognitionStatus === 'receiving_speech' || recognitionStatus === 'processing_transcript' ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Listening
                </span>
              ) : recognitionStatus === 'connecting' || recognitionStatus === 'requesting_permission' ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 animate-pulse">
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-sky-600" />
                  Connecting
                </span>
              ) : recognitionStatus === 'error' || recognitionStatus === 'permission_denied' || recognitionStatus === 'connection_lost' ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200">
                  Error
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Stopped
                </span>
              )}
            </div>

            {/* Single Compact Start/Stop Listening Primary Action Button */}
            <button
              type="button"
              onClick={handleToggleListening}
              disabled={recognitionStatus === 'connecting' || recognitionStatus === 'requesting_permission'}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all shadow-3xs cursor-pointer ${
                recognitionStatus === 'listening' || recognitionStatus === 'receiving_speech' || recognitionStatus === 'processing_transcript'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              } ${(recognitionStatus === 'connecting' || recognitionStatus === 'requesting_permission') ? 'opacity-60 cursor-wait' : ''}`}
              title={recognitionStatus === 'listening' ? 'Stop Listening' : 'Start Listening'}
            >
              {recognitionStatus === 'connecting' || recognitionStatus === 'requesting_permission' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Connecting</span>
                </>
              ) : recognitionStatus === 'listening' || recognitionStatus === 'receiving_speech' || recognitionStatus === 'processing_transcript' ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Stop Listening</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Start Listening</span>
                </>
              )}
            </button>

            {/* Persistence State Badge */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-slate-200 bg-slate-50">
              {saveState === 'saving' && (
                <>
                  <Loader2 className="w-3 h-3 text-indigo-600 animate-spin" />
                  <span className="text-indigo-700">Saving...</span>
                </>
              )}
              {saveState === 'saved' && (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700">Saved</span>
                </>
              )}
              {saveState === 'unsaved' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-amber-700">Unsaved</span>
                </>
              )}
              {saveState === 'error' && (
                <>
                  <AlertCircle className="w-3 h-3 text-rose-600" />
                  <span className="text-rose-700">Save Failed</span>
                </>
              )}
            </div>

            {/* Save Draft */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saveState === 'saving'}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 transition-colors cursor-pointer disabled:opacity-50 shadow-3xs"
              title="Save current progress draft to database"
            >
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>Save Draft</span>
            </button>

            {/* Mobile AI / Transcript Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileAiOpen(true)}
              className="lg:hidden flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer"
              title="Open Controls & AI Copilot"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Menu</span>
            </button>

            {/* Finish Call & Review Button (Replaces direct End Call, triggers Gemini Review workflow) */}
            <button
              type="button"
              onClick={handleOpenReviewModal}
              disabled={isEndingCall}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-colors shadow-3xs cursor-pointer shrink-0"
              title="Finish Call & Review Session"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Finish Call & Review</span>
              <span className="sr-only">End Call</span>
            </button>
          </div>
        </header>

        {/* Save error banner if active */}
        {saveErrorMessage && (
          <div className="mb-2 p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between gap-2 shadow-3xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="truncate">{saveErrorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => persistCallState()}
              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* 8-Stage Compact Stepper Rail */}
        <div className="mb-2 shrink-0">
          <StageStepper
            activeStage={activeStage}
            furthestStageReached={furthestStageReached}
            onSelectStage={handleSelectStage}
            disabled={false}
          />
        </div>

        {/* Two-Column Responsive Workspace Grid (Left ~70% Main Stage Workspace / Right ~30% Live Transcript) */}
        <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 flex-1 min-h-0 overflow-hidden">
          {/* Main Primary Workspace (Stage Workflow, Quick Actions, Notes, Next Stage): ~70% width */}
          <div className="w-full lg:w-[70%] flex flex-col h-full min-h-0 overflow-hidden">
            {/* View Switcher: Stage Workflow & AI Copilot */}
            <div className="flex items-center justify-between bg-slate-100/90 p-1 rounded-lg border border-slate-200 shrink-0 mb-1.5">
              <div className="flex items-center gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSecondaryRailTab('stage')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer text-center ${
                    secondaryRailTab === 'stage'
                      ? 'bg-white text-indigo-700 shadow-3xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Stage Workflow
                </button>
                <button
                  type="button"
                  onClick={() => setSecondaryRailTab('ai')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer text-center ${
                    secondaryRailTab === 'ai'
                      ? 'bg-white text-indigo-700 shadow-3xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>AI Live Coach</span>
                  {isLoadingCoaching && <Loader2 className="w-3 h-3 text-indigo-600 animate-spin" />}
                  {coachingSuggestion && !isLoadingCoaching && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  )}
                </button>
              </div>
            </div>

            {secondaryRailTab === 'stage' ? (
              <>
                {/* Scrollable Stage Content Area */}
                <div
                  ref={mainContentScrollRef}
                  className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-300"
                >
                  {/* Stage Objective & Instruction Block */}
                  <div className="bg-white border border-slate-200/90 rounded-lg px-3 py-2 shadow-3xs shrink-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight truncate">
                        Stage {activeStage} of 8 · {currentStageConfig.name}
                      </h2>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                        {activeStage}/8
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-snug">
                      {currentStageConfig.purpose}
                    </p>
                  </div>

                  {/* Real-Time Live Coaching Quick-Bar if Available */}
                  {coachingSuggestion && (
                    <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-indigo-50/60 border border-indigo-200/90 rounded-lg p-2.5 shadow-3xs flex items-start justify-between gap-2 animate-in fade-in">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-white border border-indigo-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            AI Coach Suggestion
                          </span>
                          {coachingSuggestion.objection && (
                            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded truncate">
                              Objection: {coachingSuggestion.objection}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-900 leading-snug">
                          "{coachingSuggestion.suggested_response}"
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (coachingSuggestion.suggested_response) {
                              navigator.clipboard.writeText(coachingSuggestion.suggested_response);
                            }
                          }}
                          className="px-2 py-1 text-[11px] font-bold rounded bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 cursor-pointer shadow-3xs"
                          title="Copy suggested response"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => setSecondaryRailTab('ai')}
                          className="px-2 py-1 text-[11px] font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-3xs"
                          title="Open full AI Coach panel"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions (Action Taps) — PRIMARY FOCUS */}
                  <div className="bg-white border border-slate-200/90 rounded-lg p-3 sm:p-3.5 shadow-3xs">
                    <StageActionTaps
                      stageNumber={activeStage}
                      actionTaps={currentStageConfig.actionTaps}
                      selectedEvents={stageEvents}
                      onToggleEvent={handleToggleEvent}
                      disabled={false}
                    />
                  </div>

                  {/* Stage 7/8 Follow-up Commitment Workflow Banner */}
                  {(activeStage === 7 || activeStage === 8) && (
                    <div className="animate-in fade-in duration-200">
                      {isDncRequested() ? (
                        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-1.5 text-amber-900 text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">DNC Active: </span>
                            <span>Respect boundary.</span>
                          </div>
                        </div>
                      ) : (
                        (() => {
                          const linkedFollowUp = activeCallId ? followUps.find(f => f.callId === activeCallId) : null;
                          return (
                            <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                                <span className="font-medium text-slate-800 truncate">
                                  {linkedFollowUp 
                                    ? `Task: ${linkedFollowUp.task}` 
                                    : 'Commitment step ready'}
                                </span>
                              </div>
                              <Button
                                variant={linkedFollowUp ? 'outline' : 'primary'}
                                size="sm"
                                onClick={() => handleOpenFollowUpModal()}
                                className="shrink-0 text-xs py-1 px-2.5"
                              >
                                {linkedFollowUp ? 'Edit' : 'Schedule'}
                              </Button>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}

                  {/* Prospect's Verbatim Words Card */}
                  <div className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-3xs space-y-2">
                    <div>
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        Prospect's Words
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Capture authentic prospect statements without paraphrase or assumptions.
                      </p>
                    </div>

                    <textarea
                      rows={2}
                      value={prospectWords}
                      onChange={(e) => handleProspectWordsChange(e.target.value)}
                      placeholder="Capture the prospect's exact words..."
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900 placeholder-slate-400 transition-colors resize-none"
                    />

                    {/* Quote Classification Selector */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Quote Classification:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {QUOTE_STATUS_OPTIONS.map(opt => {
                          const isSelected = quoteStatus === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleQuoteStatusChange(opt.id)}
                              className={`px-2 py-1 rounded text-center border text-[11px] font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 border-indigo-400 text-indigo-900 ring-1 ring-indigo-300 font-semibold shadow-3xs'
                                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                              }`}
                            >
                              <div className="truncate">{opt.label.split('(')[0].trim()}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Call Notes Directly Visible */}
                  <div className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-3xs space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Call Notes
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Autosaved
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={stageNotes[activeStage] || ''}
                      onChange={(e) => handleStageNoteChange(e.target.value)}
                      placeholder="Record key observations, technical details, objections, and agreed next steps..."
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900 placeholder-slate-400 transition-colors resize-y min-h-[60px]"
                    />
                  </div>
                </div>

                {/* Stepper Navigation Footer Buttons (Pinned at Bottom of Main Workspace) */}
                <div className="bg-white border border-slate-200/90 rounded-lg px-3 py-2 mt-2 flex items-center justify-between shrink-0 shadow-3xs">
                  <Button
                    variant="outline"
                    onClick={handlePrevStage}
                    disabled={activeStage === 1}
                    icon={<ChevronLeft className="w-3.5 h-3.5" />}
                    className="border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-xs py-1.5 px-3"
                  >
                    Previous Stage
                  </Button>

                  <Button
                    variant="primary"
                    onClick={handleNextStage}
                    className="font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs text-xs py-1.5 px-3.5"
                  >
                    <span>{getNextStageLabel()}</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </>
            ) : (
              <AiSuggestionsPanel
                coachingSuggestion={coachingSuggestion}
                suggestions={aiSuggestions}
                isLoading={isLoadingCoaching}
                error={coachingError}
                onRefresh={() => fetchRealTimeCoachingRef.current?.({ force: true })}
                onInsertIntoNotes={handleInsertSuggestionIntoNotes}
                activeStage={activeStage}
                activeStageName={currentStageConfig.shortName}
                lastUpdated={coachingLastUpdated}
                refreshCooldown={coachingCooldown}
                statusMessage={coachingStatusMessage || undefined}
                className="flex-1 min-h-0"
              />
            )}
          </div>

          {/* Right Column: Compact Live Transcript Panel (~30% width) */}
          <div className="w-full lg:w-[30%] flex flex-col h-full min-h-0 overflow-hidden">
            <LiveTranscriptPanel
              segments={transcriptSegments}
              interimText={interimTranscript}
              recognitionStatus={recognitionStatus}
              errorMessage={recognitionError}
              onToggleListening={handleToggleListening}
              onCopyToNotes={handleCopyToNotes}
              onSetAsProspectWords={handleSetAsProspectWords}
              onToggleSpeaker={handleToggleSpeaker}
              onClearTranscript={handleClearTranscript}
              activeStageName={currentStageConfig.name}
              className="flex-1 min-h-0"
              pauseThreshold={speakerPauseThreshold}
              onPauseThresholdChange={handlePauseThresholdChange}
              isSpeakerSwitchPending={isSpeakerSwitchPending}
            />
          </div>
        </div>

        {/* Mobile AI / Transcript Drawer */}
        {/* Mobile Secondary Controls Drawer */}
        {isMobileAiOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg h-[85vh] sm:h-[80vh] bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
              <div className="p-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSecondaryRailTab('stage')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      secondaryRailTab === 'stage'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Stage Workflow
                  </button>
                  <button
                    type="button"
                    onClick={() => setSecondaryRailTab('ai')}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      secondaryRailTab === 'ai'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    <span>AI Coach</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileAiOpen(false)}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 cursor-pointer"
                  title="Close Drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 min-h-0 p-3 overflow-hidden flex flex-col">
                {secondaryRailTab === 'ai' ? (
                  <AiSuggestionsPanel
                    coachingSuggestion={coachingSuggestion}
                    suggestions={aiSuggestions}
                    isLoading={isLoadingCoaching}
                    error={coachingError}
                    onRefresh={() => fetchRealTimeCoachingRef.current?.({ force: true })}
                    onInsertIntoNotes={handleInsertSuggestionIntoNotes}
                    activeStage={activeStage}
                    activeStageName={currentStageConfig.shortName}
                    lastUpdated={coachingLastUpdated}
                    refreshCooldown={coachingCooldown}
                    statusMessage={coachingStatusMessage || undefined}
                    isMobileDrawer={true}
                    onCloseMobileDrawer={() => setIsMobileAiOpen(false)}
                    className="h-full"
                  />
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                    {/* Stage Objective & Instruction */}
                    <div className="bg-white border border-slate-200/90 rounded-lg px-2.5 py-1.5 shadow-3xs">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h2 className="text-xs font-bold text-slate-900 tracking-tight truncate">
                          Stage {activeStage}: {currentStageConfig.name}
                        </h2>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200 shrink-0">
                          {activeStage}/8
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        {currentStageConfig.purpose}
                      </p>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5 shadow-3xs">
                      <StageActionTaps
                        stageNumber={activeStage}
                        actionTaps={currentStageConfig.actionTaps}
                        selectedEvents={stageEvents}
                        onToggleEvent={handleToggleEvent}
                        disabled={false}
                      />
                    </div>

                    {/* Prospect's Words */}
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5 shadow-3xs space-y-1.5">
                      <label htmlFor="mobile-prospect-words" className="text-xs font-bold text-slate-800">
                        Prospect's Words
                      </label>
                      <input
                        id="mobile-prospect-words"
                        type="text"
                        value={prospectWords}
                        onChange={e => handleProspectWordsChange(e.target.value)}
                        placeholder="Capture the prospect's exact words..."
                        className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Stage Notes */}
                    <div className="bg-white border border-slate-200/90 rounded-lg p-2.5 shadow-3xs space-y-1.5">
                      <label htmlFor="mobile-stage-notes" className="text-xs font-bold text-slate-800">
                        Call Notes
                      </label>
                      <textarea
                        id="mobile-stage-notes"
                        rows={3}
                        value={stageNotes[activeStage] || ''}
                        onChange={e => handleStageNoteChange(e.target.value)}
                        placeholder="Record key observations, technical details, objections, and agreed next steps..."
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    {/* Stage Navigation Buttons */}
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200">
                      <Button
                        variant="outline"
                        onClick={handlePrevStage}
                        disabled={activeStage === 1}
                        size="sm"
                      >
                        Previous Stage
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleNextStage}
                        size="sm"
                      >
                        {getNextStageLabel()}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pre-Call-Ending Gemini Review Workflow Modal */}
        {activeCallId && selectedProspect && (
          <CallReviewModal
            isOpen={isReviewModalOpen}
            callId={activeCallId}
            activeStage={activeStage}
            activeStageName={currentStageConfig.name}
            furthestStageReached={furthestStageReached}
            durationSeconds={elapsedSeconds}
            companyName={selectedProspect.companyName}
            contactName={selectedProspect.contactName}
            prospectWords={prospectWords}
            quoteStatus={quoteStatus}
            transcriptSegments={transcriptSegments}
            initialOutcome={outcome}
            onCancel={() => setIsReviewModalOpen(false)}
            onConfirmEnd={handleConfirmEndCall}
          />
        )}

        {/* Universal End Call Confirmation Modal (Fallback) */}
        <EndCallModal
          isOpen={isEndCallModalOpen}
          activeStage={activeStage}
          activeStageName={currentStageConfig.name}
          furthestStageReached={furthestStageReached}
          durationSeconds={elapsedSeconds}
          companyName={selectedProspect.companyName}
          contactName={selectedProspect.contactName}
          prospectWords={prospectWords}
          eventsCount={stageEvents.length}
          initialOutcome={outcome}
          isSaving={isEndingCall}
          onCancel={() => setIsEndCallModalOpen(false)}
          onConfirmEnd={handleConfirmEndCall}
        />

        {/* Prefilled Linked Follow-Up Modal */}
        <FollowUpModal
          isOpen={isFollowUpModalOpen}
          onClose={() => setIsFollowUpModalOpen(false)}
          onSubmit={handleFollowUpSubmit}
          initialData={followUpModalPrefill.initialData}
          defaultProspectId={selectedProspect.id}
          defaultCallId={activeCallId || undefined}
          defaultTask={followUpModalPrefill.task}
          defaultDueDate={followUpModalPrefill.dueDate}
          defaultPriority={followUpModalPrefill.priority}
          defaultNotes={followUpModalPrefill.notes}
          title={followUpModalPrefill.initialData ? 'Edit Linked Follow-up Task' : 'Schedule Call Follow-up Task'}
          description={`Linked directly to call record for ${selectedProspect.companyName}.`}
        />
      </div>
    );
  }

  // ==========================================================================
  // VIEW B: NORMAL MODE (BEFORE AND AFTER A CALL)
  // ==========================================================================
  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-16">
      {/* Save Success Banner */}
      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Save Error Banner with Retry */}
      {saveErrorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="truncate">{saveErrorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => persistCallState()}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Save</span>
          </button>
        </div>
      )}

      {/* Completed Call Saved Summary Card (Shown when a call was finalized) */}
      {lastCompletedCall && (
        <div className="bg-white border-2 border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Call Saved & Completed Successfully
                </h3>
                <p className="text-xs text-slate-500">
                  Target: {lastCompletedCall.companyName} • {lastCompletedCall.contactName || 'Unspecified Contact'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/history')}
                className="font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <History className="w-3.5 h-3.5 mr-1.5" />
                <span>View AI Review in History</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLastCompletedCall(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Ended At Stage</span>
              <span className="font-bold text-slate-800">
                Stage {lastCompletedCall.endingStage || lastCompletedCall.activeStage || 1}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Outcome</span>
              <span className="font-bold text-slate-800 truncate block">
                {lastCompletedCall.outcome || 'Not Specified'}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Duration</span>
              <span className="font-bold text-slate-800 font-mono">
                {formatDuration(lastCompletedCall.durationSeconds)}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Ending Reason</span>
              <span className="font-bold text-slate-800 truncate block">
                {lastCompletedCall.endingReason || 'normal_completion'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Normal Mode Header Bar: Prospect Selector & Start Call Action */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Prospect Selection Dropdown & Identity */}
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 text-indigo-600 font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedProspectId}
                  onChange={(e) => setSelectedProspectId(e.target.value)}
                  className="font-bold text-slate-900 bg-transparent text-sm sm:text-base border-b border-dashed border-slate-300 hover:border-slate-500 focus:outline-hidden focus:border-indigo-600 cursor-pointer pr-4 py-0.5"
                >
                  {prospects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.companyName} {p.contactName ? `(${p.contactName})` : ''}
                    </option>
                  ))}
                </select>
                <Badge variant="neutral">Normal Mode ({callLifecycleState})</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                {selectedProspect.contactName && (
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {selectedProspect.contactName} {selectedProspect.jobTitle ? `• ${selectedProspect.jobTitle}` : ''}
                  </span>
                )}
                {selectedProspect.phone && (
                  <span className="flex items-center gap-1 font-mono text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {selectedProspect.phone}
                  </span>
                )}
                {selectedProspect.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedProspect.location}
                  </span>
                )}
                <span className="text-indigo-600 font-medium">
                  {selectedProspect.industry}
                  {selectedProspect.manufacturingType ? ` • ${selectedProspect.manufacturingType}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Prominent Start Call Button */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="primary"
              onClick={handleStartCall}
              disabled={isStartingCall}
              icon={isStartingCall ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              size="lg"
              className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md text-sm px-5"
            >
              {isStartingCall ? 'Starting Live Session...' : 'Start Call (Focus Mode)'}
            </Button>
          </div>
        </div>
      </div>

      {/* Normal Mode Pre-Call Preparation & Discovery Strategy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 Columns): Preparation Tools, Objectives & Stage Framework Preview */}
        <div className="lg:col-span-8 space-y-4">
          {/* Discovery Objective & Strategy Card */}
          <Card>
            <CardHeader
              title="Call Preparation & Discovery Objective"
              description="Define manufacturing operational goals and operational hypotheses before launching the call."
            />
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Discovery Objective for this Account:
                </label>
                <input
                  type="text"
                  value={callObjective}
                  onChange={(e) => {
                    setCallObjective(e.target.value);
                    triggerDebouncedAutoSave();
                  }}
                  placeholder="e.g., Uncover shop floor CNC spindle downtime or tooling scrap rates"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>

              {selectedProspect.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Verified Account Intelligence:</span>
                  </div>
                  <p className="leading-relaxed">{selectedProspect.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 8-Stage Methodology Framework Preview */}
          <Card>
            <CardHeader
              title="8-Stage Cold Call Methodology Framework"
              description="Review the progression stages that will guide your live call."
            />
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {STAGES_CONFIG.map(stage => (
                  <div key={stage.stageNumber} className="p-3 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold flex items-center justify-center text-xs">
                        {stage.stageNumber}
                      </span>
                      <span className="font-bold text-slate-900">{stage.name}</span>
                    </div>
                    <p className="text-slate-500 line-clamp-2 text-[11px] leading-snug">
                      {stage.purpose}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (4 Columns): Manufacturing Context & Previous History */}
        <div className="lg:col-span-4 space-y-4">
          {/* Account Profile Card */}
          <Card>
            <CardHeader
              title="Manufacturing Profile"
              description="Key operating details for this lead"
            />
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Industry</span>
                <span className="font-semibold text-slate-800">{selectedProspect.industry}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Machining Type</span>
                <span className="font-semibold text-slate-800">{selectedProspect.manufacturingType || 'Discrete CNC'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Headcount</span>
                <span className="font-semibold text-slate-800">{selectedProspect.employeeCount || '25-100'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Current Status</span>
                <Badge variant="neutral">{selectedProspect.status}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Launch Call Banner */}
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-emerald-50 rounded-2xl border border-indigo-200 text-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <PhoneCall className="w-4 h-4 text-indigo-600" />
              <span>Ready to Call?</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Clicking <strong>Start Call</strong> launches distraction-free Focus Mode. Sidebars and navbars hide automatically so you can focus entirely on the prospect.
            </p>
            <Button
              variant="primary"
              onClick={handleStartCall}
              disabled={isStartingCall}
              className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="w-4 h-4 mr-1.5" />
              <span>Start Call Now</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

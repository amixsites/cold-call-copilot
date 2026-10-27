export type ProspectStatus = 
  | 'New'
  | 'Attempted'
  | 'In Discussion'
  | 'Qualified'
  | 'Unqualified'
  | 'Archived';

export type CallStatus = 
  | 'Not Started'
  | 'In Progress'
  | 'Completed';

export type CallOutcome =
  | 'Connected - Interested'
  | 'Connected - Follow-up Required'
  | 'Connected - Follow-up Needed'
  | 'Connected - Not Interested'
  | 'No Answer / Voicemail'
  | 'Left Voicemail'
  | 'Gatekeeper Blocked'
  | 'Wrong Contact / Number'
  | 'Callback Requested';

export type FollowUpStatus = 
  | 'Pending'
  | 'Completed'
  | 'Cancelled';

export type FollowUpPriority = 
  | 'High'
  | 'Medium'
  | 'Low';

export interface Prospect {
  id: string;
  companyName: string;
  contactName?: string;
  jobTitle?: string;
  industry: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  employeeCount?: string;
  manufacturingType?: string;
  status: ProspectStatus;
  notes?: string;
  lastContactDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallRecord {
  id: string;
  prospectId: string;
  companyName: string;
  contactName?: string;
  callDate: string; // ISO date string
  durationSeconds: number;
  callStatus: CallStatus;
  callObjective: string;
  preparationNotes?: string;
  businessProblemNotes?: string;
  evidenceNotes?: string;
  unknownsNotes?: string;
  objectionsNotes?: string;
  questionsToAsk?: string[];
  notes: string;
  outcome?: CallOutcome;
  nextAction?: string;
  followUpDate?: string;
  activeStage?: CallStageNumber;
  furthestStageReached?: CallStageNumber;
  endingStage?: CallStageNumber;
  endingReason?: EndingReason;
  prospectWords?: string;
  quoteStatus?: QuoteStatus;
  stageNotes?: Record<number, string>;
  stageEvents?: StageEvent[];
  hasReview?: boolean;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallAiReview {
  id?: string;
  callId: string;
  callSummary: string;
  whatWentWell: string[];
  missedOpportunities: string[];
  prospectNeedOrGoal: string;
  objectionAnalysis?: string;
  recommendedNextAction: string;
  suggestedFollowUpMessage?: string;
  coachingFeedback: string[];
  evidenceAndLimitations: string;
  modelUsed?: string;
  sourceCallUpdatedAt?: string;
  isOutdated?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FollowUp {
  id: string;
  prospectId: string;
  companyName: string;
  contactName?: string;
  callId?: string;
  task: string;
  dueDate: string; // YYYY-MM-DD
  priority: FollowUpPriority;
  status: FollowUpStatus;
  notes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  name: string;
  title: string;
  email: string;
  territory: string;
  company: string;
}

export interface AppPreferences {
  defaultCallObjective: string;
  defaultDiscoveryQuestions: string[];
  autoStartTimer: boolean;
  highlightOverdueDays: number;
}

// ============================================================================
// Eight-Stage Cold Call Copilot Domain Types
// ============================================================================

export type CallStageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type QuoteStatus = 
  | 'need_stated'
  | 'goal_stated'
  | 'no_need_stated'
  | 'unclear'
  | 'not_reached';

export type EndingReason = 
  | 'normal_completion'
  | 'prospect_ended'
  | 'caller_ended'
  | 'gatekeeper_block'
  | 'wrong_number'
  | 'busy_callback'
  | 'line_dropped'
  | 'not_interested'
  | 'do_not_call';

export interface StageEvent {
  id: string;
  stageNumber: CallStageNumber;
  eventType: string;
  eventLabel: string;
  timestamp: string;
}

export interface StagePromptExample {
  label: string;
  text: string;
  sourceRef: string;
}

export interface StageActionTap {
  id: string;
  label: string;
  category?: string;
}

export interface StageDefinition {
  stageNumber: CallStageNumber;
  name: string;
  shortName: string;
  purpose: string;
  actionTaps: StageActionTap[];
  promptExamples?: StagePromptExample[];
}

export interface LiveCallDraft {
  id: string;
  prospectId: string;
  companyName: string;
  contactName?: string;
  activeStage: CallStageNumber;
  furthestStageReached: CallStageNumber;
  endingStage?: CallStageNumber;
  endingReason?: EndingReason;
  outcome?: CallOutcome;
  prospectWords: string;
  quoteStatus: QuoteStatus;
  stageNotes: Record<number, string>;
  stageEvents: StageEvent[];
  callObjective: string;
  nextAction?: string;
  followUpDate?: string;
  durationSeconds: number;
  callStatus: CallStatus;
}

// ============================================================================
// Phase 4.1 Focus Mode & Live AI Suggestions Types
// ============================================================================

export type CallLifecycleState = 
  | 'idle' 
  | 'starting' 
  | 'active' 
  | 'ending' 
  | 'completed' 
  | 'error';

export interface ProspectSignal {
  type: 'positive' | 'negative' | 'uncertain';
  signal: string;
  evidence: string;
}

export interface ObjectionHandlingSuggestion {
  objectionCategory: string;
  suggestion: string;
}

export interface AccountContextFacts {
  companyName: string;
  facts: string[];
}

export interface LiveCallAiSuggestionPayload {
  // Section 2 structured response fields
  suggestedQuestion?: string;
  keyInformationToDiscover?: string;
  potentialObjection?: {
    objection: string;
    suggestedResponse: string;
  } | null;
  confirmedStatements?: string[];
  potentialBuyingSignals?: Array<{
    signal: string;
    inferred: true;
  }>;
  stageTransitionRecommendation?: {
    recommendedStage: number;
    reason: string;
  } | null;

  // Compatible frontend fields
  suggestedNextQuestion: string;
  listenFor: string[];
  prospectSignals: ProspectSignal[];
  objectionHandling?: ObjectionHandlingSuggestion | null;
  recommendedAction: string;
  accountContext: AccountContextFacts;
  source: 'ai' | 'heuristic-fallback';
}

export interface LiveTranscriptSegment {
  id: string;
  segmentId: string;
  callId?: string;
  text: string;
  speaker: 'agent' | 'prospect' | 'rep' | 'unknown' | 'Agent' | 'Prospect';
  isFinal: boolean;
  timestamp: string;
  createdAt?: string;
  speaker_source?: 'automatic' | 'manual';
  is_manual?: boolean;
}

export type RecognitionStatus = 
  | 'idle' 
  | 'connecting'
  | 'requesting_permission' 
  | 'listening' 
  | 'receiving_speech'
  | 'processing_transcript' 
  | 'stopped' 
  | 'permission_denied'
  | 'unavailable'
  | 'connection_lost'
  | 'error' 
  | 'unsupported';

export interface LiveCallAiSuggestionInput {
  callId?: string;
  activeCallId?: string;
  companyName: string;
  contactName?: string;
  industry?: string;
  manufacturingType?: string;
  prospectNotes?: string;
  discoveryNotes?: string;
  activeStage: CallStageNumber;
  currentStage?: CallStageNumber;
  stageName: string;
  callObjective?: string;
  prospectWords?: string;
  quoteStatus?: QuoteStatus;
  recentSegments?: LiveTranscriptSegment[];
  stageEvents?: StageEvent[];
  stageNotes?: Record<number, string>;
}

// ============================================================================
// Real-Time LLM Coaching Types
// ============================================================================

export interface RealTimeCoachingSuggestion {
  id?: string;
  callId?: string;
  suggested_response: string;
  detected_intent: string;
  objection: string | null;
  buying_signals: string[];
  follow_up_question: string;
  recommended_action: string;
  confidence: number;
  stageNumber?: number;
  sourceSegmentId?: string;
  modelUsed?: string;
  createdAt?: string;
}

export interface RealTimeCoachingInput {
  callId: string;
  companyName: string;
  contactName?: string;
  industry?: string;
  manufacturingType?: string;
  prospectNotes?: string;
  activeStage: CallStageNumber;
  stageName: string;
  callObjective?: string;
  recentSegments: Array<{ speaker?: string; text: string; timestamp?: string; segmentId?: string }>;
  prospectWords?: string;
  quoteStatus?: string;
  stageEvents?: Array<{ stageNumber: number; eventType: string; eventLabel?: string; timestamp?: string }>;
  stageNotes?: Record<number, string>;
  sourceSegmentId?: string;
  isCorrectionRefresh?: boolean;
  latestSpeaker?: string;
  latestStatement?: string;
}




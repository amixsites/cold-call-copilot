import { Router, Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { 
  generateCallAiReview, 
  generateLiveCallAiSuggestions, 
  LiveCallAiSuggestionInput 
} from '../services/geminiService.js';
import {
  generateRealTimeCoaching,
  CoachingInput,
  CoachingSuggestion,
} from '../services/coachingService.js';

export const callsRouter = Router();

const VALID_STATUSES = ['Not Started', 'In Progress', 'Completed'];
const VALID_OUTCOMES = [
  'Connected - Interested',
  'Connected - Follow-up Required',
  'Connected - Follow-up Needed',
  'Connected - Not Interested',
  'No Answer / Voicemail',
  'Left Voicemail',
  'Gatekeeper Blocked',
  'Wrong Contact / Number',
  'Callback Requested',
  'Interested',
  'Follow-up Needed',
  'Not Interested',
  'Lost',
  'Won',
];

const VALID_QUOTE_STATUSES = [
  'need_stated',
  'goal_stated',
  'no_need_stated',
  'unclear',
  'not_reached',
];

const VALID_ENDING_REASONS = [
  'normal_completion',
  'prospect_ended',
  'caller_ended',
  'gatekeeper_block',
  'wrong_number',
  'busy_callback',
  'line_dropped',
  'not_interested',
  'do_not_call',
];

// In-memory resilient state for offline/fallback mode
interface FallbackEvent {
  id: string;
  call_id: string;
  user_id: string;
  stage_number: number;
  event_key: string;
  event_label: string;
  event_type: string;
  created_at: string;
}

interface FallbackTranscriptSegment {
  id: string;
  call_id: string;
  user_id: string;
  segment_id: string;
  text: string;
  speaker: string;
  speaker_source?: string;
  is_final: boolean;
  timestamp: string;
  created_at: string;
}

const fallbackCalls = new Map<string, any>();
const fallbackEvents = new Map<string, FallbackEvent[]>();
const fallbackReviews = new Map<string, any>();
const fallbackTranscripts = new Map<string, FallbackTranscriptSegment[]>();

function toFrontendTranscriptSegment(row: any) {
  const speakerSource = String(row.speaker_source || (row.is_manual ? 'manual' : 'automatic'));
  return {
    id: String(row.id || row.segment_id),
    callId: String(row.call_id || ''),
    segmentId: String(row.segment_id || row.id || ''),
    text: String(row.text || ''),
    speaker: String(row.speaker || 'unknown'),
    speaker_source: speakerSource,
    is_manual: speakerSource === 'manual' || Boolean(row.is_manual),
    isFinal: row.is_final !== undefined ? Boolean(row.is_final) : true,
    timestamp: String(row.timestamp || row.created_at || new Date().toISOString()),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function toFrontendReview(row: any, callUpdatedAt?: string) {
  const isOutdated = callUpdatedAt && row.source_call_updated_at 
    ? new Date(callUpdatedAt).getTime() > new Date(row.source_call_updated_at).getTime()
    : false;

  return {
    id: String(row.id),
    callId: String(row.call_id),
    callSummary: String(row.call_summary || ''),
    whatWentWell: Array.isArray(row.what_went_well) ? row.what_went_well : [],
    missedOpportunities: Array.isArray(row.missed_opportunities) ? row.missed_opportunities : [],
    prospectNeedOrGoal: String(row.prospect_need_or_goal || ''),
    objectionAnalysis: row.objection_analysis ? String(row.objection_analysis) : undefined,
    recommendedNextAction: String(row.recommended_next_action || ''),
    suggestedFollowUpMessage: row.suggested_follow_up_message ? String(row.suggested_follow_up_message) : undefined,
    coachingFeedback: Array.isArray(row.coaching_feedback) ? row.coaching_feedback : [],
    evidenceAndLimitations: String(row.evidence_and_limitations || ''),
    modelUsed: String(row.model_used || 'gemini-3.5-flash-lite'),
    sourceCallUpdatedAt: row.source_call_updated_at ? String(row.source_call_updated_at) : undefined,
    isOutdated,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    // Master prompt structured fields
    prospectNeeds: String(row.prospect_needs || row.prospect_need_or_goal || ''),
    objections: String(row.objections || row.objection_analysis || 'No objections raised'),
    interestLevel: row.interest_level || { level: 'Neutral', explanation: 'Qualification in progress.' },
    callOutcome: String(row.call_outcome || 'Follow-up required'),
    areasForImprovement: Array.isArray(row.areas_for_improvement)
      ? row.areas_for_improvement
      : (Array.isArray(row.coaching_feedback) ? row.coaching_feedback : []),
  };
}

function toFrontendEvent(row: any) {
  return {
    id: String(row.id),
    stageNumber: Number(row.stage_number),
    eventType: String(row.event_key || row.event_type || ''),
    eventLabel: String(row.event_label || ''),
    timestamp: String(row.created_at || row.timestamp || new Date().toISOString()),
  };
}

function toFrontendCall(row: any, events: any[] = []) {
  const mergedEvents = events.length > 0 
    ? events.map(toFrontendEvent) 
    : (Array.isArray(row.stage_events) ? row.stage_events.map(toFrontendEvent) : []);

  const hasReview = fallbackReviews.has(String(row.id)) || Boolean(row.has_review);

  return {
    id: String(row.id),
    prospectId: row.prospect_id ? String(row.prospect_id) : undefined,
    companyName: String(row.company_name || ''),
    contactName: row.contact_name ? String(row.contact_name) : undefined,
    callDate: String(row.call_date || new Date().toISOString()),
    durationSeconds: Number(row.duration_seconds) || 0,
    callStatus: String(row.call_status || 'In Progress'),
    status: String(row.call_status || 'In Progress'),
    callObjective: String(row.call_objective || ''),
    questionsToAsk: Array.isArray(row.agenda) ? row.agenda : [],
    preparationNotes: row.pre_call_notes ? String(row.pre_call_notes) : undefined,
    businessProblemNotes: row.problems_notes ? String(row.problems_notes) : undefined,
    evidenceNotes: row.evidence_notes ? String(row.evidence_notes) : undefined,
    unknownsNotes: row.unknowns_notes ? String(row.unknowns_notes) : undefined,
    objectionsNotes: row.objections_notes ? String(row.objections_notes) : undefined,
    notes: String(row.general_notes || ''),
    outcome: row.outcome ? String(row.outcome) : undefined,
    nextAction: row.next_action ? String(row.next_action) : undefined,
    followUpDate: row.follow_up_date ? String(row.follow_up_date) : undefined,
    // Eight-stage lifecycle fields
    activeStage: Number(row.active_stage || 1),
    furthestStageReached: Number(row.furthest_stage_reached || 1),
    endingStage: row.ending_stage ? Number(row.ending_stage) : undefined,
    endingReason: row.ending_reason ? String(row.ending_reason) : undefined,
    prospectWords: String(row.prospect_words || ''),
    quoteStatus: String(row.quote_status || 'not_reached'),
    stageNotes: row.stage_notes && typeof row.stage_notes === 'object' ? row.stage_notes : {},
    stageEvents: mergedEvents,
    hasReview,
    startedAt: row.started_at ? String(row.started_at) : undefined,
    endedAt: row.ended_at ? String(row.ended_at) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function toDbCall(data: any, userId: string) {
  const dbObj: Record<string, any> = { user_id: userId };
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (data.id && UUID_REGEX.test(data.id)) {
    dbObj.id = data.id;
  }
  
  if (data.prospectId !== undefined) {
    dbObj.prospect_id = data.prospectId && UUID_REGEX.test(data.prospectId) ? data.prospectId : null;
  }
  if (data.companyName !== undefined) dbObj.company_name = String(data.companyName).trim();
  if (data.contactName !== undefined) dbObj.contact_name = data.contactName ? String(data.contactName).trim() : null;
  if (data.callDate !== undefined) dbObj.call_date = data.callDate;
  if (data.durationSeconds !== undefined) dbObj.duration_seconds = parseInt(data.durationSeconds, 10) || 0;
  if (data.callStatus !== undefined) dbObj.call_status = data.callStatus;
  else if (data.status !== undefined) dbObj.call_status = data.status;
  else dbObj.call_status = 'In Progress';
  if (data.callObjective !== undefined) dbObj.call_objective = String(data.callObjective).trim();
  if (data.questionsToAsk !== undefined) dbObj.agenda = Array.isArray(data.questionsToAsk) ? data.questionsToAsk : [];
  if (data.preparationNotes !== undefined) dbObj.pre_call_notes = data.preparationNotes ? String(data.preparationNotes) : null;
  if (data.notes !== undefined) dbObj.general_notes = String(data.notes || '');
  if (data.businessProblemNotes !== undefined) dbObj.problems_notes = data.businessProblemNotes ? String(data.businessProblemNotes) : null;
  if (data.evidenceNotes !== undefined) dbObj.evidence_notes = data.evidenceNotes ? String(data.evidenceNotes) : null;
  if (data.unknownsNotes !== undefined) dbObj.unknowns_notes = data.unknownsNotes ? String(data.unknownsNotes) : null;
  if (data.objectionsNotes !== undefined) dbObj.objections_notes = data.objectionsNotes ? String(data.objectionsNotes) : null;
  if (data.outcome !== undefined) dbObj.outcome = data.outcome || null;
  if (data.nextAction !== undefined) dbObj.next_action = data.nextAction ? String(data.nextAction).trim() : null;
  if (data.followUpDate !== undefined) dbObj.follow_up_date = data.followUpDate || null;
  if (data.startedAt !== undefined) dbObj.started_at = data.startedAt || null;
  if (data.endedAt !== undefined) dbObj.ended_at = data.endedAt || null;

  // Eight-stage specific fields
  if (data.activeStage !== undefined) {
    dbObj.active_stage = Math.max(1, Math.min(8, parseInt(data.activeStage, 10) || 1));
  }
  if (data.furthestStageReached !== undefined) {
    dbObj.furthest_stage_reached = Math.max(1, Math.min(8, parseInt(data.furthestStageReached, 10) || 1));
  }
  if (data.endingStage !== undefined) {
    dbObj.ending_stage = data.endingStage ? Math.max(1, Math.min(8, parseInt(data.endingStage, 10))) : null;
  }
  if (data.endingReason !== undefined) {
    dbObj.ending_reason = data.endingReason || null;
  }
  if (data.prospectWords !== undefined) {
    dbObj.prospect_words = String(data.prospectWords || '');
  }
  if (data.quoteStatus !== undefined) {
    dbObj.quote_status = data.quoteStatus || 'not_reached';
  }
  if (data.stageNotes !== undefined) {
    dbObj.stage_notes = typeof data.stageNotes === 'object' && data.stageNotes ? data.stageNotes : {};
  }

  return dbObj;
}

// GET /api/calls - List user's calls
callsRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const { prospectId, status, outcome, search } = req.query;

    let callsList: any[] = [];

    if (supabase) {
      try {
        let query = supabase.from('calls').select('*').order('call_date', { ascending: false });

        if (prospectId && typeof prospectId === 'string') {
          query = query.eq('prospect_id', prospectId);
        }

        if (status && typeof status === 'string' && status !== 'All') {
          query = query.eq('call_status', status);
        }

        if (outcome && typeof outcome === 'string' && outcome !== 'All') {
          query = query.eq('outcome', outcome);
        }

        const { data, error } = await query;
        if (!error && data) {
          callsList = data;
        }
      } catch (_) {
        // Fallback to in-memory store
      }
    }

    // Merge fallback calls if any
    if (callsList.length === 0 && fallbackCalls.size > 0) {
      callsList = Array.from(fallbackCalls.values());
      if (prospectId && typeof prospectId === 'string') {
        callsList = callsList.filter(c => c.prospect_id === prospectId);
      }
      if (status && typeof status === 'string' && status !== 'All') {
        callsList = callsList.filter(c => c.call_status === status);
      }
      if (outcome && typeof outcome === 'string' && outcome !== 'All') {
        callsList = callsList.filter(c => c.outcome === outcome);
      }
    }

    let results = callsList.map(c => toFrontendCall(c, fallbackEvents.get(c.id) || []));

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      results = results.filter(
        c => c.companyName.toLowerCase().includes(q) || (c.contactName && c.contactName.toLowerCase().includes(q))
      );
    }

    res.status(200).json({ success: true, data: results });
  } catch (err: any) {
    res.status(200).json({ success: true, data: [] });
  }
});

// GET /api/calls/:id - Get single call with its events
callsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);

    let callData: any = null;
    let eventsData: any[] = fallbackEvents.get(id) || [];

    if (supabase) {
      try {
        const { data, error } = await supabase.from('calls').select('*').eq('id', id).single();
        if (!error && data) {
          callData = data;
        }

        // Also attempt fetching events from database
        const { data: dbEvents, error: evError } = await supabase
          .from('call_stage_events')
          .select('*')
          .eq('call_id', id)
          .order('created_at', { ascending: true });

        if (!evError && dbEvents && dbEvents.length > 0) {
          eventsData = dbEvents;
        }
      } catch (_) {}
    }

    if (!callData && fallbackCalls.has(id)) {
      callData = fallbackCalls.get(id);
    }

    if (!callData) {
      res.status(404).json({ success: false, error: 'Call record not found' });
      return;
    }

    res.status(200).json({ success: true, data: toFrontendCall(callData, eventsData) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch call' });
  }
});

// POST /api/calls - Create new call
callsRouter.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const body = req.body;

    if (!body.companyName || typeof body.companyName !== 'string' || body.companyName.trim() === '') {
      res.status(400).json({ success: false, error: 'Company name is required for call record' });
      return;
    }

    const postStatusVal = body.callStatus || body.status;
    if (postStatusVal && !VALID_STATUSES.includes(postStatusVal)) {
      res.status(400).json({ success: false, error: `Invalid call status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    if (body.activeStage !== undefined) {
      const stageNum = Number(body.activeStage);
      if (!Number.isInteger(stageNum) || stageNum < 1 || stageNum > 8) {
        res.status(400).json({ success: false, error: 'activeStage must be an integer between 1 and 8' });
        return;
      }
    }

    if (body.furthestStageReached !== undefined) {
      const stageNum = Number(body.furthestStageReached);
      if (!Number.isInteger(stageNum) || stageNum < 1 || stageNum > 8) {
        res.status(400).json({ success: false, error: 'furthestStageReached must be an integer between 1 and 8' });
        return;
      }
    }

    if (body.endingStage !== undefined && body.endingStage !== null) {
      const stageNum = Number(body.endingStage);
      if (!Number.isInteger(stageNum) || stageNum < 1 || stageNum > 8) {
        res.status(400).json({ success: false, error: 'endingStage must be an integer between 1 and 8' });
        return;
      }
    }

    if (body.outcome && !VALID_OUTCOMES.includes(body.outcome)) {
      res.status(400).json({ success: false, error: 'Invalid call outcome' });
      return;
    }

    if (body.quoteStatus && !VALID_QUOTE_STATUSES.includes(body.quoteStatus)) {
      res.status(400).json({ success: false, error: `Invalid quote status. Must be one of: ${VALID_QUOTE_STATUSES.join(', ')}` });
      return;
    }

    if (body.endingReason && !VALID_ENDING_REASONS.includes(body.endingReason)) {
      res.status(400).json({ success: false, error: `Invalid ending reason. Must be one of: ${VALID_ENDING_REASONS.join(', ')}` });
      return;
    }

    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    const insertData = toDbCall(body, userId);
    
    // Ensure genuine UUID ID
    const generatedId = insertData.id || crypto.randomUUID();
    insertData.id = generatedId;
    const nowIso = new Date().toISOString();
    insertData.created_at = insertData.created_at || nowIso;
    insertData.updated_at = nowIso;

    let savedCall: any = null;

    if (supabase) {
      try {
        const { data, error } = await supabase.from('calls').insert(insertData).select().single();
        if (!error && data) {
          savedCall = data;
        }
      } catch (_) {}
    }

    if (!savedCall) {
      // Store in memory
      fallbackCalls.set(generatedId, insertData);
      savedCall = insertData;
    }

    // If initial stage events are provided with the call, persist them
    if (Array.isArray(body.stageEvents) && body.stageEvents.length > 0) {
      const callEvents: FallbackEvent[] = body.stageEvents.map((ev: any) => ({
        id: String(ev.id || crypto.randomUUID()),
        call_id: generatedId,
        user_id: userId,
        stage_number: Number(ev.stageNumber || 1),
        event_key: String(ev.eventType || ev.eventKey || 'action'),
        event_label: String(ev.eventLabel || ev.label || ''),
        event_type: 'action_tap',
        created_at: String(ev.timestamp || new Date().toISOString()),
      }));
      fallbackEvents.set(generatedId, callEvents);
    }

    const responseEvents = fallbackEvents.get(generatedId) || [];
    res.status(201).json({ success: true, data: toFrontendCall(savedCall, responseEvents) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to create call record' });
  }
});

// PATCH /api/calls/:id - In-place update of call record
callsRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);
    const body = req.body;

    const patchStatusVal = body.callStatus || body.status;
    if (patchStatusVal !== undefined && !VALID_STATUSES.includes(patchStatusVal)) {
      res.status(400).json({ success: false, error: `Invalid call status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    if (body.activeStage !== undefined) {
      const stageNum = Number(body.activeStage);
      if (!Number.isInteger(stageNum) || stageNum < 1 || stageNum > 8) {
        res.status(400).json({ success: false, error: 'activeStage must be an integer between 1 and 8' });
        return;
      }
    }

    if (body.furthestStageReached !== undefined) {
      const stageNum = Number(body.furthestStageReached);
      if (!Number.isInteger(stageNum) || stageNum < 1 || stageNum > 8) {
        res.status(400).json({ success: false, error: 'furthestStageReached must be an integer between 1 and 8' });
        return;
      }
    }

    if (body.endingStage !== undefined && body.endingStage !== null) {
      const stageNum = Number(body.endingStage);
      if (!Number.isInteger(stageNum) || stageNum < 1 || stageNum > 8) {
        res.status(400).json({ success: false, error: 'endingStage must be an integer between 1 and 8' });
        return;
      }
    }

    if (body.outcome !== undefined && body.outcome !== null && !VALID_OUTCOMES.includes(body.outcome)) {
      res.status(400).json({ success: false, error: 'Invalid call outcome' });
      return;
    }

    if (body.quoteStatus !== undefined && !VALID_QUOTE_STATUSES.includes(body.quoteStatus)) {
      res.status(400).json({ success: false, error: `Invalid quote status. Must be one of: ${VALID_QUOTE_STATUSES.join(', ')}` });
      return;
    }

    if (body.endingReason !== undefined && body.endingReason !== null && !VALID_ENDING_REASONS.includes(body.endingReason)) {
      res.status(400).json({ success: false, error: `Invalid ending reason. Must be one of: ${VALID_ENDING_REASONS.join(', ')}` });
      return;
    }

    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    const updateData = toDbCall(body, userId);
    delete updateData.user_id;
    updateData.updated_at = new Date().toISOString();

    let updatedCall: any = null;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('calls')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          updatedCall = data;
        }
      } catch (_) {}
    }

    // Update in-memory fallback
    const existingFallback = fallbackCalls.get(id) || {};
    const mergedFallback = {
      ...existingFallback,
      id,
      ...updateData,
    };
    fallbackCalls.set(id, mergedFallback);

    if (!updatedCall) {
      updatedCall = mergedFallback;
    }

    // If stageEvents passed in update, sync them
    if (Array.isArray(body.stageEvents)) {
      const callEvents: FallbackEvent[] = body.stageEvents.map((ev: any) => ({
        id: String(ev.id || crypto.randomUUID()),
        call_id: id,
        user_id: userId,
        stage_number: Number(ev.stageNumber || 1),
        event_key: String(ev.eventType || ev.eventKey || 'action'),
        event_label: String(ev.eventLabel || ev.label || ''),
        event_type: 'action_tap',
        created_at: String(ev.timestamp || new Date().toISOString()),
      }));
      fallbackEvents.set(id, callEvents);
    }

    const responseEvents = fallbackEvents.get(id) || [];
    res.status(200).json({ success: true, data: toFrontendCall(updatedCall, responseEvents) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update call record' });
  }
});

// DELETE /api/calls/:id - Delete call record
callsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);

    if (supabase) {
      try {
        await supabase.from('calls').delete().eq('id', id);
        await supabase.from('call_stage_events').delete().eq('call_id', id);
        await supabase.from('call_transcript_segments').delete().eq('call_id', id);
      } catch (_) {}
    }

    fallbackCalls.delete(id);
    fallbackEvents.delete(id);
    fallbackTranscripts.delete(id);

    res.status(200).json({ success: true, message: 'Call record deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to delete call record' });
  }
});

// ============================================================================
// STAGE EVENTS API (POST /api/calls/:id/events, GET /api/calls/:id/events, DELETE)
// ============================================================================

// GET /api/calls/:id/events - List all saved stage events for a call
callsRouter.get('/:id/events', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);

    let events: any[] = [];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('call_stage_events')
          .select('*')
          .eq('call_id', id)
          .order('created_at', { ascending: true });

        if (!error && data) {
          events = data;
        }
      } catch (_) {}
    }

    if (events.length === 0 && fallbackEvents.has(id)) {
      events = fallbackEvents.get(id) || [];
    }

    res.status(200).json({
      success: true,
      data: events.map(toFrontendEvent),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch stage events' });
  }
});

// POST /api/calls/:id/events - Create or record a stage action event
callsRouter.post('/:id/events', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);
    const body = req.body;

    const stageNumber = parseInt(body.stageNumber, 10);
    if (!stageNumber || stageNumber < 1 || stageNumber > 8) {
      res.status(400).json({ success: false, error: 'Valid stageNumber (1 to 8) is required' });
      return;
    }

    const eventKey = String(body.eventType || body.eventKey || '').trim();
    if (!eventKey) {
      res.status(400).json({ success: false, error: 'eventType is required' });
      return;
    }

    const eventLabel = String(body.eventLabel || body.label || eventKey).trim();
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    const eventId = body.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
      ? String(body.id)
      : crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // Check for duplicate in fallback cache
    const currentEvents = fallbackEvents.get(id) || [];
    const duplicate = currentEvents.find(
      e => e.stage_number === stageNumber && e.event_key === eventKey
    );

    if (duplicate) {
      // Return existing without duplicate insert
      res.status(200).json({
        success: true,
        data: toFrontendEvent(duplicate),
        deduplicated: true,
      });
      return;
    }

    const newEvent: FallbackEvent = {
      id: eventId,
      call_id: id,
      user_id: userId,
      stage_number: stageNumber,
      event_key: eventKey,
      event_label: eventLabel,
      event_type: String(body.eventType || 'action_tap'),
      created_at: nowIso,
    };

    let savedEvent = newEvent;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('call_stage_events')
          .insert({
            id: eventId,
            call_id: id,
            user_id: userId,
            stage_number: stageNumber,
            event_key: eventKey,
            event_label: eventLabel,
            event_type: 'action_tap',
            created_at: nowIso,
          })
          .select()
          .single();

        if (!error && data) {
          savedEvent = data;
        }
      } catch (_) {}
    }

    // Persist to fallback store
    currentEvents.push(newEvent);
    fallbackEvents.set(id, currentEvents);

    res.status(201).json({
      success: true,
      data: toFrontendEvent(savedEvent),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to record stage event' });
  }
});

// DELETE /api/calls/:id/events/:eventId - Remove or deselect a stage action event
callsRouter.delete('/:id/events/:eventId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);
    const eventId = String(req.params.eventId);

    if (supabase) {
      try {
        await supabase
          .from('call_stage_events')
          .delete()
          .eq('id', eventId)
          .eq('call_id', id);
      } catch (_) {}
    }

    if (fallbackEvents.has(id)) {
      const list = fallbackEvents.get(id) || [];
      fallbackEvents.set(id, list.filter(e => e.id !== eventId));
    }

    res.status(200).json({ success: true, message: 'Stage event removed successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to remove stage event' });
  }
});

// DELETE /api/calls/:id/events (query by stageNumber & eventType)
callsRouter.delete('/:id/events', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);
    const { stageNumber, eventType } = req.query;

    if (!stageNumber || !eventType) {
      res.status(400).json({ success: false, error: 'stageNumber and eventType query parameters are required' });
      return;
    }

    const stageNum = parseInt(String(stageNumber), 10);
    const key = String(eventType);

    if (supabase) {
      try {
        await supabase
          .from('call_stage_events')
          .delete()
          .eq('call_id', id)
          .eq('stage_number', stageNum)
          .eq('event_key', key);
      } catch (_) {}
    }

    if (fallbackEvents.has(id)) {
      const list = fallbackEvents.get(id) || [];
      fallbackEvents.set(
        id,
        list.filter(e => !(e.stage_number === stageNum && e.event_key === key))
      );
    }

    res.status(200).json({ success: true, message: 'Stage event removed successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to remove stage event' });
  }
});

// ============================================================================
// LIVE TRANSCRIPT SEGMENTS API (GET /api/calls/:id/transcript, POST)
// ============================================================================

// GET /api/calls/:id/transcript - List all saved transcript segments for a call
callsRouter.get('/:id/transcript', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);

    let segments: any[] = [];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('call_transcript_segments')
          .select('*')
          .eq('call_id', id)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          segments = data;
        }
      } catch (_) {}
    }

    if (segments.length === 0 && fallbackTranscripts.has(id)) {
      segments = fallbackTranscripts.get(id) || [];
    }

    res.status(200).json({
      success: true,
      data: segments.map(toFrontendTranscriptSegment),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch transcript segments' });
  }
});

// POST /api/calls/:id/transcript - Append or upsert finalized transcript segments
callsRouter.post('/:id/transcript', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    const body = req.body || {};

    // Support single segment or array of segments
    const incomingSegments: any[] = Array.isArray(body.segments)
      ? body.segments
      : [body];

    if (incomingSegments.length === 0 || !incomingSegments[0]?.text) {
      res.status(400).json({ success: false, error: 'At least one transcript segment with text is required.' });
      return;
    }

    const currentSegments = fallbackTranscripts.get(id) || [];
    const savedSegments: any[] = [];

    for (const seg of incomingSegments) {
      const segmentId = String(seg.segmentId || seg.id || crypto.randomUUID());
      const text = String(seg.text || '').trim();
      if (!text) continue;

      const speaker = String(seg.speaker || 'unknown');
      const isFinal = seg.isFinal !== undefined ? Boolean(seg.isFinal) : true;
      const timestamp = String(seg.timestamp || new Date().toISOString());
      const nowIso = new Date().toISOString();

      const newSegmentRecord: FallbackTranscriptSegment = {
        id: crypto.randomUUID(),
        call_id: id,
        user_id: userId,
        segment_id: segmentId,
        text,
        speaker,
        is_final: isFinal,
        timestamp,
        created_at: nowIso,
      };

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('call_transcript_segments')
            .upsert(
              {
                call_id: id,
                user_id: userId,
                segment_id: segmentId,
                text,
                speaker,
                is_final: isFinal,
                timestamp,
                created_at: nowIso,
              },
              { onConflict: 'call_id,segment_id' }
            )
            .select()
            .single();

          if (!error && data) {
            savedSegments.push(toFrontendTranscriptSegment(data));
          } else {
            savedSegments.push(toFrontendTranscriptSegment(newSegmentRecord));
          }
        } catch (_) {
          savedSegments.push(toFrontendTranscriptSegment(newSegmentRecord));
        }
      } else {
        savedSegments.push(toFrontendTranscriptSegment(newSegmentRecord));
      }

      // Upsert into in-memory fallback list to prevent duplicate segments
      const existingIdx = currentSegments.findIndex(s => s.segment_id === segmentId);
      if (existingIdx >= 0) {
        // Requirement 5: Never overwrite a manually corrected speaker label with automatic stream
        const isManual = currentSegments[existingIdx].speaker_source === 'manual';
        currentSegments[existingIdx] = {
          ...currentSegments[existingIdx],
          text,
          speaker: isManual ? currentSegments[existingIdx].speaker : speaker,
          speaker_source: isManual ? 'manual' : String(seg.speaker_source || 'automatic'),
          is_final: isFinal,
          timestamp,
        };
      } else {
        currentSegments.push(newSegmentRecord);
      }
    }

    fallbackTranscripts.set(id, currentSegments);

    res.status(201).json({
      success: true,
      data: savedSegments.length === 1 ? savedSegments[0] : savedSegments,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to persist transcript segment' });
  }
});

// ============================================================================
// SPEAKER CORRECTION API (PATCH /api/calls/:id/transcript/:segmentId/speaker)
// ============================================================================
const handleSpeakerCorrection = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const callId = String(req.params.id);
    const segmentId = String(req.params.segmentId);
    const body = req.body || {};
    const rawSpeaker = typeof body.speaker === 'string' ? body.speaker.trim() : '';

    if (!rawSpeaker) {
      res.status(400).json({ success: false, error: 'A valid speaker string (Agent or Prospect) is required.' });
      return;
    }

    const lower = rawSpeaker.toLowerCase();
    if (lower !== 'agent' && lower !== 'prospect' && lower !== 'rep') {
      res.status(400).json({ success: false, error: `Invalid speaker "${rawSpeaker}". Must be "Agent" or "Prospect".` });
      return;
    }

    const normalizedSpeaker = lower === 'agent' || lower === 'rep' ? 'agent' : 'prospect';

    let updatedRecord: any = null;

    // 1. Update in-memory fallbackTranscripts for this call
    const currentList = fallbackTranscripts.get(callId) || [];
    const existingIndex = currentList.findIndex(s => s.segment_id === segmentId || s.id === segmentId);
    if (existingIndex >= 0) {
      currentList[existingIndex] = {
        ...currentList[existingIndex],
        speaker: normalizedSpeaker,
        speaker_source: 'manual',
      };
      fallbackTranscripts.set(callId, currentList);
      updatedRecord = currentList[existingIndex];
    }

    // 2. Persist to Supabase if available
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('call_transcript_segments')
          .update({
            speaker: normalizedSpeaker,
            speaker_source: 'manual',
          })
          .eq('call_id', callId)
          .or(`segment_id.eq.${segmentId},id.eq.${segmentId}`)
          .select()
          .maybeSingle();

        if (!error && data) {
          updatedRecord = data;
        } else if (error) {
          // If speaker_source column doesn't exist yet in database, fallback to updating speaker only
          const retry = await supabase
            .from('call_transcript_segments')
            .update({ speaker: normalizedSpeaker })
            .eq('call_id', callId)
            .or(`segment_id.eq.${segmentId},id.eq.${segmentId}`)
            .select()
            .maybeSingle();

          if (retry.data) {
            updatedRecord = { ...retry.data, speaker_source: 'manual' };
          }
        }
      } catch (dbErr) {
        console.warn('Database error while updating speaker label:', dbErr);
      }
    }

    if (!updatedRecord) {
      res.status(404).json({ success: false, error: 'Transcript segment not found for this call.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: toFrontendTranscriptSegment(updatedRecord),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update transcript segment speaker' });
  }
};

callsRouter.patch('/:id/transcript/:segmentId/speaker', handleSpeakerCorrection);
callsRouter.patch('/:id/transcripts/:segmentId/speaker', handleSpeakerCorrection);

// POST /api/calls/:id/review - Generate & save Gemini AI post-call review
callsRouter.post('/:id/review', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';

    // 1. Fetch Call Record
    let callData: any = null;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('calls').select('*').eq('id', id).single();
        if (!error && data) callData = data;
      } catch (_) {}
    }
    if (!callData && fallbackCalls.has(id)) {
      callData = fallbackCalls.get(id);
    }
    if (!callData) {
      res.status(404).json({ success: false, error: 'Call record not found' });
      return;
    }

    if (callData.call_status === 'Not Started') {
      res.status(400).json({ success: false, error: 'Cannot generate AI review for a call that has not started. Please conduct discovery first.' });
      return;
    }

    // 2. Fetch Stage Events
    let eventsData: any[] = [];
    if (supabase) {
      try {
        const { data: dbEvents, error: evError } = await supabase
          .from('call_stage_events')
          .select('*')
          .eq('call_id', id)
          .order('created_at', { ascending: true });
        if (!evError && dbEvents) eventsData = dbEvents;
      } catch (_) {}
    }
    if (eventsData.length === 0 && fallbackEvents.has(id)) {
      eventsData = fallbackEvents.get(id) || [];
    }

    const formattedEvents = eventsData.map(e => ({
      stageNumber: Number(e.stage_number),
      eventType: String(e.event_key || e.event_type || ''),
      eventLabel: String(e.event_label || ''),
      timestamp: String(e.created_at || ''),
    }));

    // 2.5 Fetch Transcript Segments for real conversation analysis
    let transcriptSegments: any[] = [];
    if (Array.isArray(req.body?.transcriptSegments) && req.body.transcriptSegments.length > 0) {
      transcriptSegments = req.body.transcriptSegments;
    } else if (supabase) {
      try {
        const { data: dbSegments, error: segError } = await supabase
          .from('call_transcript_segments')
          .select('*')
          .eq('call_id', id)
          .order('created_at', { ascending: true });
        if (!segError && dbSegments) transcriptSegments = dbSegments;
      } catch (_) {}
    }
    if (transcriptSegments.length === 0 && fallbackTranscripts.has(id)) {
      transcriptSegments = fallbackTranscripts.get(id) || [];
    }

    // 3. Invoke Gemini AI Review Service
    const reviewInput = {
      id: String(callData.id),
      companyName: String(callData.company_name || 'Manufacturing Account'),
      contactName: callData.contact_name ? String(callData.contact_name) : undefined,
      callDate: String(callData.call_date || new Date().toISOString()),
      durationSeconds: Number(callData.duration_seconds) || 0,
      callStatus: String(callData.call_status || 'In Progress'),
      callObjective: callData.call_objective ? String(callData.call_objective) : undefined,
      activeStage: Number(callData.active_stage || 1),
      furthestStageReached: Number(callData.furthest_stage_reached || 1),
      endingStage: callData.ending_stage ? Number(callData.ending_stage) : undefined,
      endingReason: callData.ending_reason ? String(callData.ending_reason) : undefined,
      outcome: callData.outcome ? String(callData.outcome) : undefined,
      prospectWords: callData.prospect_words ? String(callData.prospect_words) : undefined,
      quoteStatus: callData.quote_status ? String(callData.quote_status) : undefined,
      stageNotes: callData.stage_notes && typeof callData.stage_notes === 'object' ? callData.stage_notes : {},
      stageEvents: formattedEvents,
      transcriptSegments: transcriptSegments.map(s => ({
        speaker: s.speaker,
        text: s.text,
        timestamp: s.timestamp || s.created_at,
      })),
    };

    const reviewPayload = await generateCallAiReview(reviewInput);

    // 4. Persist Review Record
    const reviewRecord = {
      id: crypto.randomUUID(),
      call_id: id,
      user_id: userId,
      call_summary: reviewPayload.callSummary,
      what_went_well: reviewPayload.whatWentWell,
      missed_opportunities: reviewPayload.missedOpportunities,
      prospect_need_or_goal: reviewPayload.prospectNeedOrGoal,
      objection_analysis: reviewPayload.objectionAnalysis || null,
      recommended_next_action: reviewPayload.recommendedNextAction,
      suggested_follow_up_message: reviewPayload.suggestedFollowUpMessage || null,
      coaching_feedback: reviewPayload.coachingFeedback,
      evidence_and_limitations: reviewPayload.evidenceAndLimitations,
      model_used: reviewPayload.modelUsed,
      source_call_updated_at: callData.updated_at || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let savedReview: any = null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('call_reviews')
          .upsert(reviewRecord, { onConflict: 'call_id' })
          .select()
          .single();
        if (!error && data) savedReview = data;
      } catch (_) {}
    }

    if (!savedReview) {
      fallbackReviews.set(id, reviewRecord);
      savedReview = reviewRecord;
    } else {
      fallbackReviews.set(id, savedReview);
    }

    res.status(200).json({
      success: true,
      data: toFrontendReview(savedReview, callData.updated_at),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to generate call AI review' });
  }
});

// GET /api/calls/:id/review - Retrieve saved review
callsRouter.get('/:id/review', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);

    // Fetch call to check updated_at for outdated comparison
    let callData: any = null;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('calls').select('*').eq('id', id).single();
        if (!error && data) callData = data;
      } catch (_) {}
    }
    if (!callData && fallbackCalls.has(id)) {
      callData = fallbackCalls.get(id);
    }

    let reviewData: any = null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('call_reviews')
          .select('*')
          .eq('call_id', id)
          .maybeSingle();
        if (!error && data) reviewData = data;
      } catch (_) {}
    }

    if (!reviewData && fallbackReviews.has(id)) {
      reviewData = fallbackReviews.get(id);
    }

    if (!reviewData) {
      res.status(200).json({ success: true, data: null });
      return;
    }

    res.status(200).json({
      success: true,
      data: toFrontendReview(reviewData, callData?.updated_at),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch call review' });
  }
});

// PATCH /api/calls/:id/review - Update suggested message or review details
callsRouter.patch('/:id/review', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const supabase = req.supabase;
    const id = String(req.params.id);
    const body = req.body;

    let reviewData: any = null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('call_reviews')
          .select('*')
          .eq('call_id', id)
          .maybeSingle();
        if (!error && data) reviewData = data;
      } catch (_) {}
    }
    if (!reviewData && fallbackReviews.has(id)) {
      reviewData = fallbackReviews.get(id);
    }

    if (!reviewData) {
      res.status(404).json({ success: false, error: 'Review not found for this call' });
      return;
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.suggestedFollowUpMessage !== undefined) {
      updates.suggested_follow_up_message = body.suggestedFollowUpMessage ? String(body.suggestedFollowUpMessage).trim() : null;
    }

    let updatedReview: any = null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('call_reviews')
          .update(updates)
          .eq('call_id', id)
          .select()
          .single();
        if (!error && data) updatedReview = data;
      } catch (_) {}
    }

    if (!updatedReview) {
      const merged = { ...reviewData, ...updates };
      fallbackReviews.set(id, merged);
      updatedReview = merged;
    } else {
      fallbackReviews.set(id, updatedReview);
    }

    res.status(200).json({
      success: true,
      data: toFrontendReview(updatedReview),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update review' });
  }
});

// Helper for stage names
const LIVE_STAGE_NAMES: Record<number, string> = {
  1: 'Opening',
  2: 'Purpose',
  3: 'Permission',
  4: 'Their Business',
  5: 'Their Need in Their Words',
  6: 'Objection',
  7: 'Next Step',
  8: 'Close',
};

// Handler logic for live suggestions
async function handleLiveSuggestions(req: AuthenticatedRequest, res: Response, callId?: string) {
  try {
    const supabase = req.supabase;
    const body = req.body || {};

    let callData: any = null;
    if (callId) {
      if (supabase) {
        try {
          const { data } = await supabase.from('calls').select('*').eq('id', callId).single();
          if (data) callData = data;
        } catch (_) {}
      }
      if (!callData && fallbackCalls.has(callId)) {
        callData = fallbackCalls.get(callId);
      }
    }

    const prospectId = body.prospectId || callData?.prospect_id;
    let prospectData: any = null;
    if (prospectId) {
      if (supabase) {
        try {
          const { data } = await supabase.from('prospects').select('*').eq('id', prospectId).single();
          if (data) prospectData = data;
        } catch (_) {}
      }
    }

    let formattedEvents: any[] = [];
    if (Array.isArray(body.stageEvents)) {
      formattedEvents = body.stageEvents;
    } else if (callId) {
      if (supabase) {
        try {
          const { data: dbEvents } = await supabase
            .from('stage_events')
            .select('*')
            .eq('call_id', callId)
            .order('created_at', { ascending: true });
          if (dbEvents && dbEvents.length > 0) {
            formattedEvents = dbEvents.map(toFrontendEvent);
          }
        } catch (_) {}
      }
      if (formattedEvents.length === 0 && fallbackEvents.has(callId)) {
        formattedEvents = (fallbackEvents.get(callId) || []).map(toFrontendEvent);
      }
    }

    // Extract recent transcript segments
    let segments: any[] = [];
    if (Array.isArray(body.recentSegments)) {
      segments = body.recentSegments;
    } else if (callId) {
      if (supabase) {
        try {
          const { data: dbSegments } = await supabase
            .from('call_transcript_segments')
            .select('*')
            .eq('call_id', callId)
            .order('created_at', { ascending: true })
            .limit(10);
          if (dbSegments && dbSegments.length > 0) {
            segments = dbSegments.map(toFrontendTranscriptSegment);
          }
        } catch (_) {}
      }
      if (segments.length === 0 && fallbackTranscripts.has(callId)) {
        segments = (fallbackTranscripts.get(callId) || []).map(toFrontendTranscriptSegment);
      }
    }

    const activeStage = Math.max(1, Math.min(8, Number(body.activeStage || callData?.active_stage || 1)));

    const suggestionInput: LiveCallAiSuggestionInput = {
      callId,
      companyName: body.companyName || callData?.company_name || prospectData?.company_name || 'Manufacturing Target',
      contactName: body.contactName || callData?.contact_name || prospectData?.contact_name,
      industry: body.industry || prospectData?.industry,
      manufacturingType: body.manufacturingType || prospectData?.manufacturing_type,
      prospectNotes: body.prospectNotes || prospectData?.notes,
      activeStage,
      currentStage: activeStage,
      stageName: body.stageName || LIVE_STAGE_NAMES[activeStage] || `Stage ${activeStage}`,
      callObjective: body.callObjective || callData?.call_objective,
      prospectWords: body.prospectWords !== undefined ? String(body.prospectWords) : (callData?.prospect_words || ''),
      quoteStatus: body.quoteStatus !== undefined ? String(body.quoteStatus) : (callData?.quote_status || 'not_reached'),
      recentSegments: segments,
      stageEvents: formattedEvents,
      stageNotes: body.stageNotes || callData?.stage_notes || {},
    };

    const suggestions = await generateLiveCallAiSuggestions(suggestionInput);

    res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (err: any) {
    console.error('Failed to generate live suggestions:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to generate live suggestions' });
  }
}

// POST /api/calls/suggestions - Live suggestions without saved call ID (pre-flight or initial)
callsRouter.post('/suggestions', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  await handleLiveSuggestions(req, res);
});

// POST /api/calls/:id/suggestions - Live suggestions for active call session
callsRouter.post('/:id/suggestions', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  await handleLiveSuggestions(req, res, id);
});

// ============================================================================
// Real-Time LLM Coaching Endpoints & Handlers
// ============================================================================

// In-memory resilient store for coaching suggestions (offline / fallback mode)
const fallbackCoaching = new Map<string, CoachingSuggestion[]>();

async function handleCoaching(req: AuthenticatedRequest, res: Response, callId?: string) {
  try {
    const supabase = req.supabase;
    const body = req.body || {};
    const effectiveCallId = callId || body.callId || 'active-call-session';

    let callData: any = null;
    if (callId) {
      if (supabase) {
        try {
          const { data } = await supabase.from('calls').select('*').eq('id', callId).single();
          if (data) callData = data;
        } catch (_) {}
      }
      if (!callData && fallbackCalls.has(callId)) {
        callData = fallbackCalls.get(callId);
      }
    }

    const prospectId = body.prospectId || callData?.prospect_id;
    let prospectData: any = null;
    if (prospectId) {
      if (supabase) {
        try {
          const { data } = await supabase.from('prospects').select('*').eq('id', prospectId).single();
          if (data) prospectData = data;
        } catch (_) {}
      }
    }

    // Load recent transcript segments
    let segments: any[] = [];
    if (Array.isArray(body.recentSegments) && body.recentSegments.length > 0) {
      segments = body.recentSegments;
    } else if (callId) {
      if (supabase) {
        try {
          const { data: dbSegments } = await supabase
            .from('call_transcript_segments')
            .select('*')
            .eq('call_id', callId)
            .order('created_at', { ascending: true })
            .limit(15);
          if (dbSegments && dbSegments.length > 0) {
            segments = dbSegments.map(toFrontendTranscriptSegment);
          }
        } catch (_) {}
      }
      if (segments.length === 0 && fallbackTranscripts.has(callId)) {
        segments = (fallbackTranscripts.get(callId) || []).map(toFrontendTranscriptSegment);
      }
    }

    // Format events
    let formattedEvents: any[] = [];
    if (Array.isArray(body.stageEvents)) {
      formattedEvents = body.stageEvents;
    } else if (callId) {
      if (supabase) {
        try {
          const { data: dbEvents } = await supabase
            .from('stage_events')
            .select('*')
            .eq('call_id', callId)
            .order('created_at', { ascending: true });
          if (dbEvents && dbEvents.length > 0) {
            formattedEvents = dbEvents.map(toFrontendEvent);
          }
        } catch (_) {}
      }
      if (formattedEvents.length === 0 && fallbackEvents.has(callId)) {
        formattedEvents = (fallbackEvents.get(callId) || []).map(toFrontendEvent);
      }
    }

    if (segments.length === 0 && (body.latestStatement || body.prospectWords)) {
      const text = String(body.latestStatement || body.prospectWords).trim();
      const speaker = body.latestSpeaker || 'prospect';
      segments = [{ speaker, text, timestamp: new Date().toISOString() }];
    }

    const activeStage = Math.max(1, Math.min(8, Number(body.activeStage || callData?.active_stage || 1)));

    const coachingInput: CoachingInput = {
      callId: effectiveCallId,
      companyName: body.companyName || callData?.company_name || prospectData?.company_name || 'Manufacturing Target',
      contactName: body.contactName || callData?.contact_name || prospectData?.contact_name,
      industry: body.industry || prospectData?.industry,
      manufacturingType: body.manufacturingType || prospectData?.manufacturing_type,
      prospectNotes: body.prospectNotes || prospectData?.notes,
      activeStage,
      stageName: body.stageName || LIVE_STAGE_NAMES[activeStage] || `Stage ${activeStage}`,
      callObjective: body.callObjective || callData?.call_objective,
      latestStatement: body.latestStatement,
      latestSpeaker: body.latestSpeaker,
      recentSegments: segments,
      prospectWords: body.prospectWords !== undefined ? String(body.prospectWords) : (callData?.prospect_words || ''),
      quoteStatus: body.quoteStatus !== undefined ? String(body.quoteStatus) : (callData?.quote_status || 'not_reached'),
      stageEvents: formattedEvents,
      stageNotes: body.stageNotes || callData?.stage_notes || {},
      sourceSegmentId: body.sourceSegmentId,
    };

    const coaching = await generateRealTimeCoaching(coachingInput);

    // Persist to Supabase if available
    if (supabase && callId) {
      try {
        await supabase.from('call_coaching_suggestions').insert({
          call_id: callId,
          user_id: req.user?.id || null,
          stage_number: activeStage,
          suggested_response: coaching.suggested_response,
          detected_intent: coaching.detected_intent,
          objection: coaching.objection,
          buying_signals: coaching.buying_signals,
          follow_up_question: coaching.follow_up_question,
          recommended_action: coaching.recommended_action,
          confidence: coaching.confidence,
          source_segment_id: coaching.sourceSegmentId || null,
          model_used: coaching.modelUsed,
        });
      } catch (dbErr) {
        console.warn('[handleCoaching] Supabase insert warning (retaining in-memory fallback):', dbErr);
      }
    }

    // Always update fallback map
    const existing = fallbackCoaching.get(effectiveCallId) || [];
    fallbackCoaching.set(effectiveCallId, [...existing, coaching]);

    res.status(200).json({
      success: true,
      data: coaching,
    });
  } catch (err: any) {
    console.error('Failed to generate real-time coaching:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to generate real-time coaching' });
  }
}

// POST /api/calls/coaching - Real-time coaching without saved call ID (pre-call or initial)
callsRouter.post('/coaching', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  await handleCoaching(req, res);
});

// POST /api/calls/:id/coaching - Real-time coaching for active call
callsRouter.post('/:id/coaching', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  await handleCoaching(req, res, id);
});

// GET /api/calls/:id/coaching - Retrieve coaching history for call
callsRouter.get('/:id/coaching', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const supabase = req.supabase;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('call_coaching_suggestions')
        .select('*')
        .eq('call_id', id)
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        res.status(200).json({
          success: true,
          data: data.map((d: any) => ({
            id: d.id,
            callId: d.call_id,
            suggested_response: d.suggested_response,
            detected_intent: d.detected_intent,
            objection: d.objection,
            buying_signals: d.buying_signals || [],
            follow_up_question: d.follow_up_question,
            recommended_action: d.recommended_action,
            confidence: Number(d.confidence || 0.85),
            stageNumber: d.stage_number,
            sourceSegmentId: d.source_segment_id,
            modelUsed: d.model_used,
            createdAt: d.created_at,
          })),
        });
        return;
      }
    } catch (_) {}
  }

  const inMemory = fallbackCoaching.get(id) || [];
  res.status(200).json({ success: true, data: inMemory });
});

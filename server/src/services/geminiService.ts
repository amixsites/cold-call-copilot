// Gemini API Review Generation Service via @google/genai (Flash-Lite text model)
// Streaming audio transcription is handled by gemini-3.5-transcribe-live
import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';

export interface CallReviewPayload {
  callSummary: string;
  whatWentWell: string[];
  missedOpportunities: string[];
  prospectNeedOrGoal: string;
  objectionAnalysis?: string;
  recommendedNextAction: string;
  suggestedFollowUpMessage?: string;
  coachingFeedback: string[];
  evidenceAndLimitations: string;
  modelUsed: string;
  // Master Prompt specific fields
  prospectNeeds?: string;
  objections?: string;
  interestLevel?: {
    level: 'Interested' | 'Neutral' | 'Not Interested' | 'Unclear';
    explanation: string;
  } | string;
  callOutcome?: string;
  areasForImprovement?: string[];
}

export interface CallReviewInput {
  id: string;
  companyName: string;
  contactName?: string;
  callDate: string;
  durationSeconds: number;
  callStatus: string;
  callObjective?: string;
  activeStage: number;
  furthestStageReached: number;
  endingStage?: number;
  endingReason?: string;
  outcome?: string;
  prospectWords?: string;
  quoteStatus?: string;
  stageNotes?: Record<number, string>;
  stageEvents?: Array<{
    stageNumber: number;
    eventType: string;
    eventLabel?: string;
    timestamp: string;
  }>;
  transcriptSegments?: Array<{
    speaker?: string;
    text: string;
    timestamp?: string;
  }>;
}

// Stage name lookup
const STAGE_NAMES: Record<number, string> = {
  1: 'Opening',
  2: 'Purpose',
  3: 'Permission',
  4: 'Their Business',
  5: 'Their Need in Their Words',
  6: 'Objection',
  7: 'Next Step',
  8: 'Close',
};

// 9-category objection taxonomy lookup
const OBJECTION_TAXONOMY: Record<string, string> = {
  timing_or_capacity: 'Timing or capacity constraint',
  existing_internal_process: 'Existing internal process',
  existing_provider_or_alternative: 'Existing provider / Rate contract',
  wrong_contact_or_authority: 'Wrong contact / No authority',
  poor_fit_or_scope: 'Poor fit / Scope mismatch',
  commercial_intent_unclear: 'Commercial intent / ROI unclear',
  explicit_not_interested: 'Explicitly not interested',
  do_not_contact_requested: 'Do not contact requested',
  other_or_unclear: 'Other / Unclear objection',
};

// Helper to construct structured prompt
function constructReviewPrompt(call: CallReviewInput): string {
  const endingStage = call.endingStage || call.activeStage;
  const furthestStage = call.furthestStageReached || call.activeStage;
  const quote = call.prospectWords && call.prospectWords.trim() ? `"${call.prospectWords.trim()}"` : 'None recorded';
  const quoteStatus = call.quoteStatus || 'not_reached';
  const endingReason = call.endingReason || 'normal_completion';
  const outcome = call.outcome || 'Pending';

  // Format stage events
  const eventsList = (call.stageEvents || [])
    .map(e => `- [Stage ${e.stageNumber} — ${STAGE_NAMES[e.stageNumber] || 'Stage'}] Action: ${e.eventLabel || e.eventType} (${e.timestamp})`)
    .join('\n');

  // Format stage notes
  const notesEntries = Object.entries(call.stageNotes || {})
    .filter(([_, note]) => note && typeof note === 'string' && note.trim().length > 0)
    .map(([stageNum, note]) => `- Stage ${stageNum} (${STAGE_NAMES[Number(stageNum)] || 'Stage'}): ${note.trim()}`)
    .join('\n');

  return `You are an elite B2B Cold Call Sales Coach and Manufacturing Discovery Analyst evaluating a live cold-call record.

=== STRICT DATA-INTEGRITY RULES ===
1. Base your evaluation ONLY on the recorded facts provided below.
2. DO NOT fabricate, invent, or assume any information that was not recorded.
3. The call reached Stage ${furthestStage} and ended at Stage ${endingStage}. Review it STRICTLY within the scope of stages actually attempted (Stages 1 to ${furthestStage}).
4. NEVER criticize the caller for not completing or reaching stages after Stage ${furthestStage}.
5. The prospect's verbatim quote is: ${quote} (Classification: ${quoteStatus}). NEVER modify, paraphrase, or hallucinate prospect quotes.
6. If the call was terminated early (e.g. gatekeeper block, wrong number, prospect hung up), focus coaching on early-stage mechanics.
7. If the prospect requested "do_not_call" or "do_not_contact_requested", DO NOT recommend further persuasion; recommend respecting the boundary.
8. In "evidenceAndLimitations", clearly distinguish between recorded data facts and coaching inferences, noting any data gaps.

=== CALL DATA RECORD ===
- Target Account: ${call.companyName}
- Target Contact: ${call.contactName || 'Unspecified'}
- Call Date: ${call.callDate}
- Duration: ${call.durationSeconds} seconds (${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s)
- Call Status: ${call.callStatus}
- Call Objective: ${call.callObjective || 'Discovery'}
- Furthest Stage Reached: Stage ${furthestStage} (${STAGE_NAMES[furthestStage]})
- Ending Stage: Stage ${endingStage} (${STAGE_NAMES[endingStage]})
- Ending Reason: ${endingReason}
- Final Recorded Outcome: ${outcome}
- Prospect's Words: ${quote}
- Quote Status Classification: ${quoteStatus}

=== RECORDED STAGE ACTION TAPS ===
${eventsList || 'No structured action taps recorded.'}

=== RECORDED STAGE NOTES ===
${notesEntries || 'No freeform stage notes recorded.'}

=== INSTRUCTIONS FOR STRUCTURED JSON OUTPUT ===
Respond ONLY with a valid JSON object matching this exact schema:
{
  "callSummary": "A concise 2-3 sentence overview grounded strictly in the recorded call data.",
  "whatWentWell": ["Specific effective choice 1 supported by data", "Specific choice 2 supported by data"],
  "missedOpportunities": ["Practical refinement for stages reached (Stages 1-${furthestStage}) only"],
  "prospectNeedOrGoal": "Summary of expressed need, goal, lack of need, or uncertainty based on recorded evidence.",
  "objectionAnalysis": "Analysis of recorded objection (if any) using the 9-category taxonomy, or null if no objection was recorded.",
  "recommendedNextAction": "Practical, concrete next step based on actual outcome and ending details.",
  "suggestedFollowUpMessage": "A professional, editable draft message/email tailored to this interaction (or null if DNC).",
  "coachingFeedback": ["Actionable coaching tip 1", "Actionable coaching tip 2"],
  "evidenceAndLimitations": "Clear distinction of facts vs interpretations and statement of review limitations."
}`;
}

// Fallback heuristic reviewer for offline mode, testing, or when Gemini API key is unavailable
export function generateFallbackReview(call: CallReviewInput): CallReviewPayload {
  const furthestStage = call.furthestStageReached || call.activeStage || 1;
  const endingStage = call.endingStage || call.activeStage || 1;
  const stageName = STAGE_NAMES[endingStage] || `Stage ${endingStage}`;
  const quote = call.prospectWords && call.prospectWords.trim() ? call.prospectWords.trim() : null;
  const quoteStatus = call.quoteStatus || 'not_reached';
  const endingReason = call.endingReason || 'normal_completion';
  const isDnc = endingReason === 'do_not_call' || (call.stageEvents || []).some(e => e.eventType === 'do_not_contact_requested');

  const whatWentWell: string[] = [];
  const missedOpportunities: string[] = [];
  const coachingFeedback: string[] = [];

  // Grounded observations based on stages actually reached
  if (furthestStage >= 1) {
    whatWentWell.push(`Initiated contact and navigated Stage 1 (Opening) for ${call.companyName}.`);
  }
  if (furthestStage >= 2) {
    whatWentWell.push('Presented concise purpose line and checked operational relevance in Stage 2.');
  }
  if (furthestStage >= 4) {
    whatWentWell.push(`Engaged prospect on manufacturing operational context up to Stage ${furthestStage}.`);
  }
  if (quote && quoteStatus === 'need_stated') {
    whatWentWell.push(`Successfully captured verbatim prospect pain point: "${quote.substring(0, 70)}..."`);
  }

  // Missed opportunities strictly within reached stages
  if (furthestStage <= 2 && endingReason === 'gatekeeper_block') {
    missedOpportunities.push('Consider asking for the plant tooling desk by title or desk extension rather than individual name to bypass the front switchboard.');
    coachingFeedback.push('Leverage shift handover timing (e.g. 7:30 AM or 3:30 PM) when gatekeepers are less restrictive.');
    coachingFeedback.push('Mention a peer manufacturing reference or specific machine brand to build switchboard credibility.');
  } else if (furthestStage <= 3 && endingReason === 'busy_callback') {
    missedOpportunities.push('Agree on an exact callback window rather than leaving the retry open-ended.');
    coachingFeedback.push('When prospect indicates they are on the shop floor, propose a specific 15-minute slot tomorrow morning.');
    coachingFeedback.push('Send a brief calendar placeholder or WhatsApp note to anchor the agreed callback time.');
  } else if (furthestStage >= 5 && !quote) {
    missedOpportunities.push('Prospect words field was empty despite reaching Stage 5. Log authentic verbatim quotes before proceeding.');
    coachingFeedback.push('Capture exact prospect wording in quotation marks to avoid sales paraphrase bias.');
    coachingFeedback.push('Ask open-ended bottleneck discovery questions before advancing to proposal stages.');
  } else {
    missedOpportunities.push(`Refine cadence for transition from Stage ${furthestStage} to agreed next steps.`);
    coachingFeedback.push('Focus discovery questions on scrap rates, machine downtime, and tool changeover cycles.');
    coachingFeedback.push('Quantify the operational financial impact early to build stronger commercial urgency.');
  }

  // Objection analysis
  let objectionAnalysis: string | undefined = undefined;
  const objectionEvent = (call.stageEvents || []).find(e => e.stageNumber === 6 || OBJECTION_TAXONOMY[e.eventType]);
  if (objectionEvent) {
    const categoryName = OBJECTION_TAXONOMY[objectionEvent.eventType] || objectionEvent.eventType;
    objectionAnalysis = `Recorded objection: "${categoryName}". When manufacturing prospects cite ${categoryName.toLowerCase()}, validate their operational schedule before proposing an alternative review.`;
  } else if (endingReason === 'not_interested') {
    objectionAnalysis = 'Prospect indicated no current interest. Respect the stance without arguing, and tag for periodic re-qualification.';
  }

  // Next action & follow-up message
  let recommendedNextAction = 'Document findings and review manufacturing profile.';
  let suggestedFollowUpMessage: string | undefined = undefined;

  if (isDnc) {
    recommendedNextAction = 'Honor prospect removal request immediately. Mark account as Do Not Contact.';
    suggestedFollowUpMessage = undefined;
  } else if (endingReason === 'busy_callback') {
    recommendedNextAction = 'Set callback reminder in calendar for the requested follow-up time.';
    suggestedFollowUpMessage = `Hi ${call.contactName || 'there'}, thanks for taking my call briefly. Understood you were on the plant floor. I will follow up as requested. Best regards.`;
  } else if (furthestStage >= 7) {
    recommendedNextAction = 'Deliver agreed documentation and schedule discovery deep-dive.';
    suggestedFollowUpMessage = `Hi ${call.contactName || 'there'}, thank you for sharing your manufacturing context regarding ${call.companyName}. Attached is the brief overview we discussed. Looking forward to our next conversation.`;
  } else {
    recommendedNextAction = `Follow up per agreed milestone or re-engage after operational cycle.`;
    suggestedFollowUpMessage = `Hi ${call.contactName || 'there'}, following up on our call today regarding precision tooling performance at ${call.companyName}. Happy to share how peer machine shops handle similar challenges.`;
  }

  const needSummary = quote 
    ? `Prospect explicitly voiced: "${quote}" (Status: ${quoteStatus}).`
    : `No specific need statement logged (Quote status: ${quoteStatus}).`;

  return {
    callSummary: `Call with ${call.companyName}${call.contactName ? ` (${call.contactName})` : ''} progressed to Stage ${furthestStage} (${STAGE_NAMES[furthestStage]}) and ended at Stage ${endingStage} (${stageName}) with outcome "${call.outcome || 'Not specified'}" and ending reason "${endingReason}".`,
    whatWentWell: whatWentWell.length > 0 ? whatWentWell : ['Attempted cold call discovery according to structured workflow.'],
    missedOpportunities,
    prospectNeedOrGoal: needSummary,
    objectionAnalysis,
    recommendedNextAction,
    suggestedFollowUpMessage,
    coachingFeedback,
    evidenceAndLimitations: `Review based on ${call.durationSeconds}s call record reaching Stage ${furthestStage}. Stage events: ${(call.stageEvents || []).length} logged. Analysis strictly reflects entered data without external assumptions. (Generated via fallback coaching engine).`,
    modelUsed: 'heuristic-coach-fallback',
    // Master prompt structured fields
    prospectNeeds: needSummary,
    objections: objectionAnalysis || 'No specific objection logged during session.',
    interestLevel: {
      level: quoteStatus === 'need_stated' || furthestStage >= 7 ? 'Interested' : (endingReason === 'prospect_ended' ? 'Not Interested' : 'Neutral'),
      explanation: quote ? `Based on quote "${quote.substring(0, 40)}..."` : 'Based on recorded stage progression.',
    },
    callOutcome: call.outcome || (furthestStage >= 7 ? 'Follow-up required' : 'No clear outcome'),
    areasForImprovement: coachingFeedback.length > 0 ? coachingFeedback : (missedOpportunities.length > 0 ? missedOpportunities : ['Focus on asking open-ended questions in early stages.']),
  };
}

/**
 * Main AI Post-Call Review Generator
 * Uses Gemini Flash-Lite model (gemini-3.5-flash-lite) for low-cost, accurate structured review.
 * Server-configurable via GEMINI_REVIEW_MODEL environment variable.
 */
export async function generateCallAiReview(call: CallReviewInput): Promise<CallReviewPayload> {
  const reviewModel = process.env.GEMINI_REVIEW_MODEL || 'gemini-3.5-flash-lite';

  // If Gemini API key is configured, invoke the model
  if (config.geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

      // Format verbatim conversation transcript
      const transcriptText = (call.transcriptSegments && call.transcriptSegments.length > 0)
        ? call.transcriptSegments.map(s => {
            const speaker = s.speaker === 'prospect' ? 'Prospect' : 'Agent';
            const time = s.timestamp ? ` [${new Date(s.timestamp).toLocaleTimeString()}]` : '';
            return `${speaker}${time}: "${s.text}"`;
          }).join('\n')
        : (call.prospectWords ? `Prospect Quote: "${call.prospectWords}"` : 'No verbatim audio transcript recorded.');

      const prompt = `You are an elite B2B Cold Call Sales Coach and Manufacturing Discovery Analyst evaluating a live cold call record.

=== TARGET ACCOUNT & CALL METADATA ===
- Company: ${call.companyName}
- Contact: ${call.contactName || 'Unspecified'}
- Duration: ${call.durationSeconds} seconds
- Furthest Stage Reached: Stage ${call.furthestStageReached || 1} (${STAGE_NAMES[call.furthestStageReached || 1] || 'Stage'})
- Ending Stage: Stage ${call.endingStage || call.activeStage || 1} (${STAGE_NAMES[call.endingStage || call.activeStage || 1] || 'Stage'})
- Ending Reason: ${call.endingReason || 'Normal'}
- Recorded Outcome: ${call.outcome || 'Unspecified'}
- Verbatim Quote: ${call.prospectWords || 'None'} (Status: ${call.quoteStatus || 'not_reached'})

=== VERBATIM CALL TRANSCRIPT ===
${transcriptText}

=== RECORDED STAGE ACTION TAPS ===
${(call.stageEvents || []).map(e => `- Stage ${e.stageNumber}: ${e.eventLabel || e.eventType}`).join('\n') || 'None recorded'}

=== RECORDED STAGE NOTES ===
${Object.entries(call.stageNotes || {}).map(([k, v]) => `- Stage ${k}: ${v}`).join('\n') || 'None recorded'}

=== STRICT EVIDENCE RULES ===
1. Base your evaluation strictly on the conversation transcript and recorded facts above.
2. DO NOT fabricate or assume information that was not said. If missing, state "Unknown" or "Not mentioned".
3. Interest Level must be one of: "Interested", "Neutral", "Not Interested", or "Unclear".
4. Call Outcome must be one of: "Meeting booked", "Follow-up required", "Interested", "Not interested", or "No clear outcome". Do not claim a meeting was booked unless confirmed in transcript.
5. Provide 1 to 3 actionable suggestions for improvement.
6. Provide a professional, editable follow-up message draft tailored to the call.

Respond ONLY with a valid JSON object matching this schema:
{
  "callSummary": "A concise description of what happened during the call.",
  "prospectNeeds": "The needs, pain points, and goals explicitly expressed by the prospect (or 'Unknown / Not mentioned').",
  "objections": "Objections or concerns raised during the conversation (or 'None recorded').",
  "interestLevel": {
    "level": "Interested" | "Neutral" | "Not Interested" | "Unclear",
    "explanation": "Brief evidence-based explanation."
  },
  "callOutcome": "Meeting booked" | "Follow-up required" | "Interested" | "Not interested" | "No clear outcome",
  "recommendedNextAction": "A practical follow-up action grounded in the conversation.",
  "areasForImprovement": ["Actionable suggestion 1", "Actionable suggestion 2"],
  "whatWentWell": ["Positive choice 1 supported by data", "Positive choice 2 supported by data"],
  "missedOpportunities": ["Refinement for stages reached"],
  "suggestedFollowUpMessage": "Professional, editable follow-up message draft.",
  "evidenceAndLimitations": "Clear distinction of facts vs interpretations and review limitations."
}`;

      const res = await ai.models.generateContent({
        model: reviewModel,
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      });

      let raw = res.text?.trim() || '';
      if (raw.startsWith('```json')) {
        raw = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (raw.startsWith('```')) {
        raw = raw.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        raw = raw.substring(firstBrace, lastBrace + 1);
      }
      const parsed = JSON.parse(raw);

      const objectionEvent = (call.stageEvents || []).find(e => e.stageNumber === 6 || (e.eventType && OBJECTION_TAXONOMY[e.eventType]));
      const taxonomyName = objectionEvent ? (OBJECTION_TAXONOMY[objectionEvent.eventType] || objectionEvent.eventType) : '';

      let finalObjectionAnalysis = String(parsed.objections || parsed.objectionAnalysis || 'No major objection recorded during session.');
      if (taxonomyName && !finalObjectionAnalysis.toLowerCase().includes(taxonomyName.toLowerCase())) {
        finalObjectionAnalysis = `Recorded objection: "${taxonomyName}". ${finalObjectionAnalysis}`;
      }

      return {
        callSummary: String(parsed.callSummary || `Call review for ${call.companyName}`),
        whatWentWell: Array.isArray(parsed.whatWentWell) && parsed.whatWentWell.length > 0
          ? parsed.whatWentWell
          : [`Navigated discovery up to Stage ${call.furthestStageReached || 1} for ${call.companyName}.`],
        missedOpportunities: Array.isArray(parsed.missedOpportunities) && parsed.missedOpportunities.length > 0
          ? parsed.missedOpportunities
          : [`Identify deeper operational constraints early.`],
        prospectNeedOrGoal: String(parsed.prospectNeeds || parsed.prospectNeedOrGoal || call.prospectWords || 'Operational discovery in progress.'),
        objectionAnalysis: finalObjectionAnalysis,
        recommendedNextAction: String(parsed.recommendedNextAction || 'Schedule follow-up touchpoint within 2 business days.'),
        suggestedFollowUpMessage: parsed.suggestedFollowUpMessage || null,
        coachingFeedback: Array.isArray(parsed.areasForImprovement) && parsed.areasForImprovement.length > 0
          ? parsed.areasForImprovement
          : (Array.isArray(parsed.coachingFeedback) ? parsed.coachingFeedback : ['Maintain discovery momentum on next call.']),
        evidenceAndLimitations: String(parsed.evidenceAndLimitations || `Review grounded in recorded session (${call.durationSeconds}s, Stage ${call.furthestStageReached || 1}).`),
        modelUsed: reviewModel,
        prospectNeeds: String(parsed.prospectNeeds || parsed.prospectNeedOrGoal || 'Not mentioned'),
        objections: finalObjectionAnalysis,
        interestLevel: parsed.interestLevel || { level: 'Neutral', explanation: 'Initial qualification in progress.' },
        callOutcome: String(parsed.callOutcome || call.outcome || 'Follow-up required'),
        areasForImprovement: Array.isArray(parsed.areasForImprovement) && parsed.areasForImprovement.length > 0
          ? parsed.areasForImprovement
          : ['Focus on asking open-ended questions in early stages.'],
      };
    } catch (err: any) {
      console.warn(`[GeminiReview] Model ${reviewModel} call failed (${err.message}). Using local analytics fallback.`);
      const fallback = generateFallbackReview(call);
      fallback.modelUsed = `local-analytics-engine (fallback: ${err.message?.substring(0, 40) || 'API error'})`;
      return fallback;
    }
  }

  // Fallback if no API key
  const fallback = generateFallbackReview(call);
  fallback.modelUsed = 'local-analytics-engine';
  return fallback;
}

// ============================================================================
// Phase 4.1 Live Call AI Suggestions Service
// ============================================================================

export interface TranscriptSegmentInput {
  id?: string;
  segmentId?: string;
  text: string;
  timestamp?: string;
  speaker?: string;
  isFinal?: boolean;
}

export interface LiveCallAiSuggestionInput {
  callId?: string;
  activeCallId?: string;
  activeStage?: number;
  currentStage?: number;
  stageName?: string;
  companyName: string;
  contactName?: string;
  industry?: string;
  manufacturingType?: string;
  prospectNotes?: string;
  discoveryNotes?: string;
  callObjective?: string;
  prospectWords?: string;
  quoteStatus?: string;
  recentSegments?: TranscriptSegmentInput[];
  stageEvents?: Array<{
    stageNumber: number;
    eventType: string;
    eventLabel?: string;
    timestamp?: string;
  }>;
  stageNotes?: Record<number, string>;
}

export interface LiveCallAiSuggestionPayload {
  // Section 2 structured response fields
  suggestedQuestion: string;
  keyInformationToDiscover: string;
  potentialObjection: {
    objection: string;
    suggestedResponse: string;
  } | null;
  confirmedStatements: string[];
  potentialBuyingSignals: Array<{
    signal: string;
    inferred: true;
  }>;
  recommendedAction: string;
  stageTransitionRecommendation: {
    recommendedStage: number;
    reason: string;
  } | null;

  // Compatible frontend fields
  suggestedNextQuestion: string;
  listenFor: string[];
  prospectSignals: Array<{
    type: 'positive' | 'negative' | 'uncertain';
    signal: string;
    evidence: string;
  }>;
  objectionHandling?: {
    objectionCategory: string;
    suggestion: string;
  } | null;
  accountContext: {
    companyName: string;
    facts: string[];
  };
  source: 'ai' | 'heuristic-fallback';
}

const STAGE_QUESTIONS: Record<number, { question: string; listenFor: string[]; action: string }> = {
  1: {
    question: 'Did I catch you in the middle of a shift setup or floor meeting?',
    listenFor: ['Ambient background noise on the plant floor', 'Directness of greeting', 'Time pressure / shift timing'],
    action: 'State the 20-second purpose line and check manufacturing relevance.',
  },
  2: {
    question: 'We help precision machine shops eliminate tooling changeover bottlenecks — does tool wear affect your cycle times?',
    listenFor: ['Mention of existing contract suppliers', 'Cycle time scrap complaints', 'Tooling crib management setup'],
    action: 'Verify if tooling scrap or machine downtime is an active priority.',
  },
  3: {
    question: 'Do you have 90 seconds to see if this matches your machining lines before we decide if a follow-up makes sense?',
    listenFor: ['Permission granted vs hurried hesitation', 'Gatekeeper authority', 'Openness to brief technical discovery'],
    action: 'Acknowledge time constraint and smoothly transition into operational questions.',
  },
  4: {
    question: 'What kind of CNC equipment and materials are your machinists running on your primary production lines?',
    listenFor: ['Machine brands (Haas, Mazak, DMG Mori)', 'High-mix low-volume vs production runs', 'Shift handovers and batch sizes'],
    action: 'Uncover specific operational bottlenecks in machine spindle uptime or scrap rates.',
  },
  5: {
    question: 'When scrap parts or unexpected spindle downtime spike, where is the operational bottleneck felt first?',
    listenFor: ['Specific scrap rate percentages or rework hours', 'Customer lead time delays', 'Root causes (tool breakage, vibration)'],
    action: 'Capture the prospect\'s authentic verbatim words in the quote field.',
  },
  6: {
    question: 'What would be your primary reservation about reviewing how peer machine shops cut tooling changeover times?',
    listenFor: ['Contract lock-in with existing distributor', 'Internal tool regrinding capability', 'Purchasing authorization process'],
    action: 'Tag the objection using the 9-category taxonomy and validate operational priority.',
  },
  7: {
    question: 'Would it make sense to review a sample tooling wear report with your shop foreman next Tuesday at 10 AM?',
    listenFor: ['Specific calendar availability', 'Who else participates in technical decisions', 'Commitment level'],
    action: 'Lock in a concrete date and follow-up action commitment.',
  },
  8: {
    question: 'Is there anyone from maintenance or procurement who should join our brief 15-minute tooling overview?',
    listenFor: ['Purchasing hierarchy and sign-off hurdles', 'Direct contact details', 'Implementation timeline'],
    action: 'Summarize agreed commitments and prepare to finalize call wrap-up.',
  },
};

const OBJECTION_SUGGESTIONS: Record<string, string> = {
  timing_or_capacity: 'Understood you\'re running at capacity right now. When shift handovers stabilize next month, what would make a 10-minute tooling review worth your time?',
  existing_internal_process: 'Makes sense that your operators handle maintenance internally. Many plants keep an external benchmark specifically for high-wear tooling.',
  existing_provider_or_alternative: 'Most precision shops we work with also have a primary distributor. They rely on us as a specialized secondary source for hard-to-machine alloys.',
  wrong_contact_or_authority: 'Understood. Who on the plant floor manages tooling procurement, CNC programming, or plant maintenance?',
  poor_fit_or_scope: 'Fair enough. If tolerances, heat-treated alloys, or spindle vibration ever become an issue, we can always revisit.',
  commercial_intent_unclear: 'Completely fair. We don\'t discuss pricing until we verify whether scrap rates are costing you measurable hours.',
  explicit_not_interested: 'Understood. Thank you for your candor today. I will respect your preference and note our file accordingly.',
  do_not_contact_requested: 'I respect your request immediately. I will place your account on our Do Not Contact list.',
  other_or_unclear: 'Could you share a little more about what specifically makes this a challenging fit right now?',
};

export function generateFallbackLiveSuggestions(input: LiveCallAiSuggestionInput): LiveCallAiSuggestionPayload {
  const stageNum = Math.max(1, Math.min(8, input.currentStage || input.activeStage || 1));
  const stageData = STAGE_QUESTIONS[stageNum] || STAGE_QUESTIONS[1];

  // Derive prospect signals grounded in actual recorded data
  const signals: Array<{ type: 'positive' | 'negative' | 'uncertain'; signal: string; evidence: string }> = [];
  const confirmedStatements: string[] = [];
  const buyingSignals: Array<{ signal: string; inferred: true }> = [];

  const events = input.stageEvents || [];
  const quote = input.prospectWords && input.prospectWords.trim() ? input.prospectWords.trim() : null;
  const quoteStatus = input.quoteStatus || 'not_reached';

  // Process recent transcript segments
  const segments = input.recentSegments || [];
  if (segments.length > 0) {
    const recentProspectSegments = segments.filter(s => s.speaker === 'prospect' || !s.speaker);
    for (const seg of recentProspectSegments.slice(-3)) {
      if (seg.text && seg.text.trim().length > 5) {
        confirmedStatements.push(seg.text.trim());
      }
    }
  }

  if (quote && confirmedStatements.indexOf(quote) === -1) {
    confirmedStatements.push(quote);
  }

  // Check for positive signals in recorded events
  const positiveEvents = events.filter(e => 
    ['interest_confirmed', 'cad_model_offered', 'machine_spec_provided', 'budget_available', 'shift_details_shared', 'follow_up_accepted'].includes(e.eventType)
  );
  if (positiveEvents.length > 0) {
    const eventSummary = positiveEvents.map(e => e.eventLabel || e.eventType).join(', ');
    signals.push({
      type: 'positive',
      signal: `Prospect engaged constructively: ${eventSummary}`,
      evidence: `Recorded in Stage ${positiveEvents[0].stageNumber} Action Taps`,
    });
    buyingSignals.push({
      signal: `Operational receptivity indicated via ${eventSummary}`,
      inferred: true,
    });
  }

  // Quote status signals
  if (quote && (quoteStatus === 'need_stated' || quoteStatus === 'goal_stated')) {
    signals.push({
      type: 'positive',
      signal: `Explicit operational need voiced: "${quote.substring(0, 60)}..."`,
      evidence: `Prospect verbatim quote (Status: ${quoteStatus})`,
    });
    buyingSignals.push({
      signal: `Voiced operational pain regarding "${quote.substring(0, 50)}..."`,
      inferred: true,
    });
  } else if (quote && quoteStatus === 'no_need_stated') {
    signals.push({
      type: 'negative',
      signal: `Prospect indicated no current need: "${quote.substring(0, 60)}..."`,
      evidence: `Prospect verbatim quote (Status: ${quoteStatus})`,
    });
  } else if (quote && quoteStatus === 'unclear') {
    signals.push({
      type: 'uncertain',
      signal: 'Prospect statement is ambiguous; requires operational clarification',
      evidence: `Prospect verbatim quote (Status: unclear)`,
    });
  }

  // Objection signals
  const objectionEvent = events.find(e => OBJECTION_TAXONOMY[e.eventType] || e.stageNumber === 6);
  let potentialObjection: { objection: string; suggestedResponse: string } | null = null;
  let objectionHandling: { objectionCategory: string; suggestion: string } | null = null;

  if (objectionEvent) {
    const categoryName = OBJECTION_TAXONOMY[objectionEvent.eventType] || objectionEvent.eventType;
    const responseText = OBJECTION_SUGGESTIONS[objectionEvent.eventType] || OBJECTION_SUGGESTIONS.other_or_unclear;
    signals.push({
      type: 'negative',
      signal: `Objection voiced: ${categoryName}`,
      evidence: `Recorded Action Tap in Stage ${objectionEvent.stageNumber}`,
    });
    objectionHandling = {
      objectionCategory: categoryName,
      suggestion: responseText,
    };
    potentialObjection = {
      objection: categoryName,
      suggestedResponse: responseText,
    };
  }

  // Default signal if no events or quotes logged yet
  if (signals.length === 0) {
    signals.push({
      type: 'uncertain',
      signal: 'Initial stage underway — awaiting first prospect response signal',
      evidence: `Stage ${stageNum} (${input.stageName || `Stage ${stageNum}`}) in progress`,
    });
  }

  // Known account context facts
  const facts: string[] = [];
  if (input.industry) facts.push(`Industry: ${input.industry}`);
  if (input.manufacturingType) facts.push(`Machining Type: ${input.manufacturingType}`);
  if (input.contactName) facts.push(`Primary Contact: ${input.contactName}`);
  const discoveryNotes = input.discoveryNotes || input.prospectNotes;
  if (discoveryNotes) {
    const firstSentence = discoveryNotes.split('.')[0];
    if (firstSentence) facts.push(`Profile: ${firstSentence.trim()}`);
  }
  if (facts.length === 0) {
    facts.push('Target Account in Manufacturing Directory');
  }

  let stageTransitionRecommendation: { recommendedStage: number; reason: string } | null = null;
  if (stageNum === 1 && positiveEvents.length > 0) {
    stageTransitionRecommendation = { recommendedStage: 2, reason: 'Purpose acknowledged; transition to technical discovery' };
  } else if (stageNum === 4 && quote && (quoteStatus === 'need_stated' || quoteStatus === 'goal_stated')) {
    stageTransitionRecommendation = { recommendedStage: 5, reason: 'Specific operational need voiced; advance to capture verbatim need' };
  } else if (stageNum === 6 && positiveEvents.some(e => e.eventType === 'follow_up_accepted')) {
    stageTransitionRecommendation = { recommendedStage: 7, reason: 'Objection addressed; propose concrete next step calendar invite' };
  }

  return {
    suggestedQuestion: stageData.question,
    keyInformationToDiscover: stageData.listenFor.join('; '),
    potentialObjection,
    confirmedStatements,
    potentialBuyingSignals: buyingSignals,
    recommendedAction: stageData.action,
    stageTransitionRecommendation,
    suggestedNextQuestion: stageData.question,
    listenFor: stageData.listenFor,
    prospectSignals: signals.slice(0, 3),
    objectionHandling,
    accountContext: {
      companyName: input.companyName,
      facts,
    },
    source: 'heuristic-fallback',
  };
}

/**
 * Live Call AI Suggestions Service
 * Disabled: Text generation models (including gemini-3.8-flash) are permanently deactivated.
 * All Gemini API activity is strictly restricted to gemini-3.5-transcribe-live real-time audio transcription.
 */
export async function generateLiveCallAiSuggestions(input: LiveCallAiSuggestionInput): Promise<LiveCallAiSuggestionPayload & { disabled: boolean; unavailable?: boolean; message: string }> {
  return {
    suggestedQuestion: '',
    keyInformationToDiscover: '',
    potentialObjection: null,
    confirmedStatements: [],
    potentialBuyingSignals: [],
    recommendedAction: '',
    stageTransitionRecommendation: null,
    suggestedNextQuestion: '',
    listenFor: [],
    prospectSignals: [],
    objectionHandling: null,
    accountContext: {
      companyName: input.companyName,
      facts: [],
    },
    source: 'heuristic-fallback',
    disabled: true,
    unavailable: true,
    message: 'AI Suggestions disabled. Dedicated to gemini-3.5-transcribe-live transcription.',
  };
}



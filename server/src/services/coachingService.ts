import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';

export interface CoachingInput {
  callId?: string;
  companyName?: string;
  contactName?: string;
  industry?: string;
  manufacturingType?: string;
  prospectNotes?: string;
  activeStage?: number;
  stageName?: string;
  stageObjective?: string;
  callObjective?: string;
  latestStatement?: string;
  latestSpeaker?: string;
  prospectInfo?: {
    companyName?: string;
    contactName?: string;
    title?: string;
    industry?: string;
    notes?: string;
    equipmentList?: string;
    materialTypes?: string;
    annualScrapRate?: number;
  };
  recentSegments?: Array<{
    speaker?: string;
    text: string;
    timestamp?: string;
    segmentId?: string;
    id?: string;
  }>;
  prospectWords?: string;
  quoteStatus?: string;
  stageEvents?: Array<{
    stageNumber: number;
    eventType: string;
    eventLabel?: string;
    timestamp?: string;
  }>;
  stageNotes?: Record<string | number, string>;
  sourceSegmentId?: string;
}

export interface CoachingSuggestion {
  id?: string;
  callId: string;
  suggested_response: string;
  detected_intent: string;
  objection: string | null;
  buying_signals: string[];
  follow_up_question: string;
  recommended_action: string;
  confidence: number;
  stageNumber: number;
  sourceSegmentId?: string;
  modelUsed: string;
  createdAt: string;
}

export type RealTimeCoachingInput = CoachingInput;
export type RealTimeCoachingSuggestion = CoachingSuggestion;

const STAGE_OBJECTIVES: Record<number, { name: string; goal: string; defaultAdvice: string }> = {
  1: {
    name: 'Opening',
    goal: 'Confirm identity, break preoccupation respectfully, and state company context.',
    defaultAdvice: 'Confirm identity with a brief, polite greeting and establish why you are reaching out.',
  },
  2: {
    name: 'Purpose',
    goal: 'State reason for the call concisely and check operational relevance.',
    defaultAdvice: 'Mention your focus on reducing CNC downtime and lead times, then check if that resonates.',
  },
  3: {
    name: 'Permission',
    goal: 'Secure 60 seconds to explain or agree on a better time.',
    defaultAdvice: 'Ask for just 60 seconds to see if a brief discussion is worth their time.',
  },
  4: {
    name: 'Their Business',
    goal: 'Explore plant capacity, tooling setup, scrap bottlenecks, or supplier turnaround.',
    defaultAdvice: 'Ask open-ended discovery questions about machine spindle utilization or part cycle times.',
  },
  5: {
    name: 'Their Need in Their Words',
    goal: 'Capture the prospect\'s authentic problem statements in their exact words.',
    defaultAdvice: 'Acknowledge their exact pain point and ask how much that bottleneck affects delivery schedules.',
  },
  6: {
    name: 'Objection Handling',
    goal: 'Acknowledge constraints (timing, incumbent vendor, budget) without arguing.',
    defaultAdvice: 'Empathize with their current setup and explore what an ideal improvement would look like.',
  },
  7: {
    name: 'Next Step Agreement',
    goal: 'Propose a low-commitment follow-up (technical review, CAD review, callback).',
    defaultAdvice: 'Suggest a focused 15-minute engineering review next Tuesday to compare tolerances.',
  },
  8: {
    name: 'Close Call',
    goal: 'Confirm date, time, attendees, and contact info clearly before ending.',
    defaultAdvice: 'Confirm who else from the shop floor should join and send a calendar placeholder.',
  },
};

// Grounded fallback coaching when LLM is offline or in test environments
export function generateFallbackCoaching(input: CoachingInput): CoachingSuggestion {
  const stage = input.activeStage || 1;
  const stageInfo = STAGE_OBJECTIVES[stage] || STAGE_OBJECTIVES[1];
  
  // Look at the latest statement across recentSegments, latestStatement, or prospectWords
  const recent = input.recentSegments || [];
  const latestSegment = recent.length > 0 ? recent[recent.length - 1] : null;
  const latestText = (
    latestSegment?.text || 
    input.latestStatement || 
    input.prospectWords || 
    ''
  ).toLowerCase();

  let suggestedResponse = '';
  let detectedIntent = 'General inquiry / discovery progression';
  let objection: string | null = null;
  const buyingSignals: string[] = [];
  let followUpQuestion = '';
  let recommendedAction = stageInfo.defaultAdvice;

  const company = input.companyName || input.prospectInfo?.companyName || 'your facility';
  const contact = input.contactName || input.prospectInfo?.contactName;
  const industry = input.industry || input.prospectInfo?.industry || 'manufacturing';

  // Detect common manufacturing objections or hesitation
  if (
    latestText.includes('another provider') || 
    latestText.includes('current vendor') || 
    latestText.includes('already have') || 
    latestText.includes('already use') || 
    latestText.includes('supplier') || 
    latestText.includes('switching')
  ) {
    objection = 'Existing provider / Switching difficulty';
    detectedIntent = 'Satisfied with existing supplier / Switching friction';
    suggestedResponse = 'I understand. What works best with your current provider, and is there anything you would like to improve?';
    followUpQuestion = 'What would need to improve for you to consider another solution or evaluate a backup vendor?';
    recommendedAction = 'Position as a secondary vendor or overflow capacity rather than replacing their primary supplier.';
  } else if (
    latestText.includes('expensive') || 
    latestText.includes('budget') || 
    latestText.includes('too high') || 
    (latestText.includes('cost') && latestText.includes('much'))
  ) {
    objection = 'Price / Budget constraint';
    detectedIntent = 'Price sensitivity / Budget restriction';
    suggestedResponse = 'I hear you. If price is the main concern, what unit economics or scrap-reduction target would we need to hit to make the numbers work?';
    followUpQuestion = 'Are you looking for fixed-lot discounts or volume amortization across multiple releases?';
    recommendedAction = 'Emphasize total cost of quality and reduced scrap rates over bare unit machine time.';
  } else if (
    latestText.includes('busy') || 
    latestText.includes('not a good time') || 
    latestText.includes('bad time') || 
    latestText.includes('in a meeting') || 
    latestText.includes('middle of a shift') || 
    latestText.includes('send me an email') || 
    latestText.includes('send an email') ||
    latestText.includes('send me some info')
  ) {
    objection = 'Timing / Send information brush-off';
    detectedIntent = 'Preoccupied with immediate shop floor responsibilities';
    suggestedResponse = 'I completely understand you\'re in the middle of a shift. Would tomorrow morning around 9:30 AM be better for a 2-minute catchup?';
    followUpQuestion = 'Can I send a brief calendar invite so you have my direct details?';
    recommendedAction = 'Lock in a specific 15-minute callback window rather than leaving it open-ended.';
  } else if (
    latestText.includes('tolerance') || 
    latestText.includes('titanium') || 
    latestText.includes('bracket') || 
    latestText.includes('5-axis') || 
    latestText.includes('haas')
  ) {
    buyingSignals.push('Inquiring about precision tolerances and machining capability');
    detectedIntent = 'Technical feasibility evaluation';
    suggestedResponse = 'We guarantee ±0.0002" tolerances on our 5-axis Haas CNC equipment, with typical turnaround in under 14 days.';
    followUpQuestion = 'What surface finish or GD&T callout do your prints require on those parts?';
    recommendedAction = 'Offer a quick review of part drawings (STEP or PDF) for manufacturability feedback.';
  } else if (
    latestText.includes('not interested') || 
    latestText.includes('don\'t need') || 
    latestText.includes('no need')
  ) {
    objection = 'Explicitly not interested';
    detectedIntent = 'Disinterest / Skepticism on cold outreach';
    suggestedResponse = 'Fair enough. Most plant managers we speak with felt the same until they faced lead-time spikes on precision tooling.';
    followUpQuestion = 'Would you be open to keeping our line card on file for when an emergency turnaround comes up?';
    recommendedAction = 'Respect the boundary while leaving the door open for overflow manufacturing needs.';
  } else if (
    latestText.includes('price') || 
    latestText.includes('cost') || 
    latestText.includes('rate') || 
    latestText.includes('quote')
  ) {
    buyingSignals.push('Inquiring about commercial terms / pricing');
    detectedIntent = 'Commercial evaluation / cost comparison';
    suggestedResponse = 'Our rates are competitive with regional precision shops, typically based on run volume and material hardness.';
    followUpQuestion = 'What kind of batch sizes do you typically release for machining?';
    recommendedAction = 'Avoid giving blind figures; offer to review a sample drawing to provide an accurate estimate.';
  } else if (
    latestText.includes('scrap') || 
    latestText.includes('downtime') || 
    latestText.includes('delay') || 
    latestText.includes('lead time')
  ) {
    buyingSignals.push('Stated operational pain point on shop floor');
    detectedIntent = 'Sharing operational bottleneck';
    suggestedResponse = 'That lead-time bottleneck is exactly where we help peers keep spindle utilization above 85% with scrap under 0.8%.';
    followUpQuestion = 'How often does that supplier delay push back your final customer shipments?';
    recommendedAction = 'Quantify the financial impact of the stated scrap or delay.';
  } else {
    // Stage-specific natural progression
    switch (stage) {
      case 1:
        suggestedResponse = `Hi ${contact || 'there'}, thanks for taking my call. I'm calling regarding operational tooling and spindle runtimes at ${company}.`;
        followUpQuestion = 'Did I catch you in the middle of a shop floor run?';
        break;
      case 2:
        suggestedResponse = `The reason for my call is we help precision machine shops in ${industry} reduce changeover downtime and scrap rates below 0.8%.`;
        followUpQuestion = 'Is keeping spindle utilization high a priority for your plant this quarter?';
        break;
      case 3:
        suggestedResponse = 'I know your time is valuable. Could I take 60 seconds to explain our approach, and you can tell me if it makes sense to continue?';
        followUpQuestion = 'Fair enough?';
        break;
      case 4:
        suggestedResponse = 'We guarantee ±0.0002" tolerances on our 5-axis Haas CNC equipment, with typical turnaround in under 14 days.';
        followUpQuestion = 'What is the biggest operational headache with your current machine shop turnaround?';
        break;
      case 5:
        suggestedResponse = 'I understand. What works best with your current provider, and is there anything you would like to improve?';
        followUpQuestion = 'What would need to improve for you to consider evaluating a backup vendor?';
        break;
      case 6:
        suggestedResponse = 'Based on the batch quantities you mentioned, we could run a trial lot to benchmark precision and cycle time.';
        followUpQuestion = 'Who else on your operations team would typically evaluate the inspection report?';
        break;
      case 7:
        suggestedResponse = 'Would you be open to a 15-minute technical review next Tuesday at 10 AM to inspect our line card and sample reports?';
        followUpQuestion = 'Does Tuesday morning or Thursday afternoon fit your schedule better?';
        break;
      case 8:
        suggestedResponse = `I'll send over a calendar invite for our agreed time along with our ISO 9001 certs and capability sheet.`;
        followUpQuestion = `Is ${input.prospectNotes ? 'this email on file' : 'your direct email'} the best place to send the confirmation?`;
        break;
      default:
        suggestedResponse = 'Thank you for your time today. Let us follow up with the agreed information.';
        followUpQuestion = 'Is there any other question before we wrap up?';
    }
  }

  return {
    callId: input.callId || 'call-local',
    suggested_response: suggestedResponse,
    detected_intent: detectedIntent,
    objection,
    buying_signals: buyingSignals,
    follow_up_question: followUpQuestion,
    recommended_action: recommendedAction,
    confidence: 0.88,
    stageNumber: stage,
    sourceSegmentId: input.sourceSegmentId,
    modelUsed: 'heuristic-grounded-fallback',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Real-Time LLM Coaching Generator
 * Invokes configurable text LLM (GEMINI_COACHING_MODEL, e.g. gemini-2.5-flash)
 * Dedicated to text conversation coaching during active calls.
 */
export async function generateRealTimeCoaching(input: CoachingInput): Promise<CoachingSuggestion> {
  const coachingModel = process.env.GEMINI_COACHING_MODEL || 'gemini-3.5-flash-lite';

  if (!config.geminiApiKey) {
    return generateFallbackCoaching(input);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const recent = (input.recentSegments || []).slice(-8);
    const transcriptHistory = recent.length > 0
      ? recent.map(s => {
          const speaker = s.speaker === 'prospect' ? 'Prospect' : 'Agent';
          return `${speaker}: "${s.text}"`;
        }).join('\n')
      : 'No live speech captured yet.';

    const latestSegment = recent.length > 0 ? recent[recent.length - 1] : null;
    const latestProspectStatement = latestSegment?.speaker === 'prospect'
      ? `"${latestSegment.text}"`
      : (input.prospectWords ? `"${input.prospectWords}"` : 'None');

    const stage = input.activeStage || 1;
    const prompt = `You are a real-time AI Cold Call Coach providing instant guidance for an active B2B manufacturing sales call.

=== TARGET ACCOUNT CONTEXT ===
- Target Company: ${input.companyName || 'Target Company'}
- Decision Maker: ${input.contactName || 'Plant Operations Contact'}
- Industry: ${input.industry || 'Manufacturing'}
- Plant Facility Context: ${input.manufacturingType || 'Precision machining & CNC operations'}
- Stored Notes: ${input.prospectNotes || 'None'}
- Current Call Stage: Stage ${stage} (${input.stageName || 'Active Stage'})
- Stage Goal: ${STAGE_OBJECTIVES[stage]?.goal || 'Engage prospect effectively'}
- Call Objective: ${input.callObjective || 'Manufacturing discovery'}
- Latest Prospect Statement: ${latestProspectStatement}

=== RECENT CONVERSATION TRANSCRIPT (LAST FEW TURNS) ===
${transcriptHistory}

=== STRICT COACHING GUIDELINES ===
1. Generate ONE concise sentence the sales rep can speak next ("suggested_response"). It must sound natural, conversational, polite, and directly address what was just said.
2. Detect the prospect's likely intent ("detected_intent").
3. Detect any objection raised ("objection"). If none, use null.
4. Detect any buying signals ("buying_signals", array of strings). If none, empty array.
5. Provide ONE relevant follow-up question ("follow_up_question") that keeps the conversation moving forward without being pushy.
6. Provide ONE practical action recommendation ("recommended_action").
7. Output confidence as a decimal between 0.50 and 0.99.
8. NEVER invent fictional product specs, false pricing, or unapproved claims. Ground your response strictly in the manufacturing context provided.

Respond ONLY with a valid JSON object matching this schema:
{
  "suggested_response": "One concise sentence the caller can say next.",
  "detected_intent": "Likely prospect intent",
  "objection": "Detected objection or null",
  "buying_signals": ["Signal 1"],
  "follow_up_question": "A relevant next question",
  "recommended_action": "A practical action",
  "confidence": 0.90
}`;

    const response = await ai.models.generateContent({
      model: coachingModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const responseText = response.text || '';
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      callId: input.callId || 'call-local',
      suggested_response: String(parsed.suggested_response || '').trim() || generateFallbackCoaching(input).suggested_response,
      detected_intent: String(parsed.detected_intent || 'General discovery inquiry').trim(),
      objection: parsed.objection && parsed.objection !== 'null' ? String(parsed.objection).trim() : null,
      buying_signals: Array.isArray(parsed.buying_signals) ? parsed.buying_signals.map((s: any) => String(s).trim()).filter(Boolean) : [],
      follow_up_question: String(parsed.follow_up_question || '').trim() || generateFallbackCoaching(input).follow_up_question,
      recommended_action: String(parsed.recommended_action || '').trim() || generateFallbackCoaching(input).recommended_action,
      confidence: typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1 ? parsed.confidence : 0.85,
      stageNumber: stage,
      sourceSegmentId: input.sourceSegmentId,
      modelUsed: coachingModel,
      createdAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn(`[Coaching Service] LLM call failed (${err?.message || err}). Falling back to grounded heuristic coaching.`);
    return generateFallbackCoaching(input);
  }
}

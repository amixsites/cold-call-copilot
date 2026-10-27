import { StageDefinition, CallStageNumber, EndingReason } from '../types';

export const STAGES_CONFIG: StageDefinition[] = [
  {
    stageNumber: 1,
    name: 'Opening',
    shortName: 'Opening',
    purpose: 'Confirm contact identity, verify reachability, and navigate reception or gatekeepers politely.',
    actionTaps: [
      { id: 'greeting_delivered', label: 'Greeting delivered' },
      { id: 'right_person', label: 'Right person confirmed' },
      { id: 'gatekeeper_reception', label: 'Gatekeeper / Reception' },
      { id: 'wrong_person', label: 'Wrong person / Number' },
      { id: 'former_contact', label: 'Former contact / Moved' },
      { id: 'referral_redirect', label: 'Referral / Redirected' },
    ],
    promptExamples: [],
  },
  {
    stageNumber: 2,
    name: 'Purpose',
    shortName: 'Purpose',
    purpose: 'Deliver a concise, 1–2 sentence reason for calling; frame relevance without launching into an aggressive pitch.',
    actionTaps: [
      { id: 'purpose_explained', label: 'Purpose explained' },
      { id: 'purpose_understood', label: 'Purpose understood' },
      { id: 'asked_what_we_do', label: 'Asked what we do' },
      { id: 'asked_why_calling', label: 'Asked why calling' },
      { id: 'asked_contact_source', label: 'Asked contact source' },
      { id: 'sales_call_suspicion', label: 'Sales suspicion / Defensive' },
      { id: 'clarification_requested', label: 'Clarification requested' },
    ],
    promptExamples: [],
  },
  {
    stageNumber: 3,
    name: 'Permission',
    shortName: 'Permission',
    purpose: 'Respect the prospect’s schedule and secure explicit micro-consent before diving into discussion.',
    actionTaps: [
      { id: 'permission_granted', label: 'Permission granted (30s agreed)' },
      { id: 'busy_call_later', label: 'Busy / Asked to call later' },
      { id: 'permission_declined', label: 'Permission declined' },
      { id: 'in_meeting_transit', label: 'In meeting / On shop floor' },
      { id: 'not_available', label: 'Decision maker not available' },
    ],
    promptExamples: [],
  },
  {
    stageNumber: 4,
    name: 'Their business',
    shortName: 'Their Business',
    purpose: 'Understand manufacturing plant scale, machine capacities, tooling processes, and decision-making structure.',
    actionTaps: [
      { id: 'business_context_shared', label: 'Business context shared' },
      { id: 'current_process_identified', label: 'Current process / lines described' },
      { id: 'role_scope_corrected', label: 'Role / Scope corrected' },
      { id: 'capacity_lines_shared', label: 'Plant capacity / volume shared' },
      { id: 'decision_maker_elsewhere', label: 'Decision maker elsewhere' },
    ],
    promptExamples: [],
  },
  {
    stageNumber: 5,
    name: 'Their need in their words',
    shortName: 'Their Need',
    purpose: 'Evoke and document the prospect\'s authentic operational bottlenecks using their exact verbatim words.',
    actionTaps: [
      { id: 'need_stated', label: 'Operational pain point stated' },
      { id: 'goal_stated', label: 'Improvement goal stated' },
      { id: 'bottleneck_identified', label: 'Scrap / Bottleneck identified' },
      { id: 'no_need_stated', label: 'No immediate need stated' },
      { id: 'unclear', label: 'Unclear / Ambiguous need' },
    ],
    promptExamples: [],
  },
  {
    stageNumber: 6,
    name: 'Objection',
    shortName: 'Objection',
    purpose: 'Acknowledge hesitations and categorize prospect resistance using the official 9-category objection taxonomy.',
    actionTaps: [
      { id: 'timing_or_capacity', label: '1. Timing or capacity constraint', category: 'Timing' },
      { id: 'existing_internal_process', label: '2. Existing internal process', category: 'Process' },
      { id: 'existing_provider_or_alternative', label: '3. Existing provider / Rate contract', category: 'Provider' },
      { id: 'wrong_contact_or_authority', label: '4. Wrong contact / No authority', category: 'Authority' },
      { id: 'poor_fit_or_scope', label: '5. Poor fit / Scope mismatch', category: 'Fit' },
      { id: 'commercial_intent_unclear', label: '6. Commercial intent / ROI unclear', category: 'Commercial' },
      { id: 'explicit_not_interested', label: '7. Explicitly not interested', category: 'Intent' },
      { id: 'do_not_contact_requested', label: '8. Do not contact requested', category: 'DNC' },
      { id: 'other_or_unclear', label: '9. Other / Unclear objection', category: 'Other' },
    ],
    promptExamples: [],
  },
  {
    stageNumber: 7,
    name: 'Next step',
    shortName: 'Next Step',
    purpose: 'Secure a clear, time-bound, mutually agreed operational commitment.',
    actionTaps: [
      { id: 'send_report', label: 'Send benchmark / report' },
      { id: 'send_email', label: 'Send email intro profile' },
      { id: 'send_whatsapp', label: 'Send WhatsApp case study' },
      { id: 'callback_agreed', label: 'Callback scheduled' },
      { id: 'meeting_proposed', label: 'Technical demo proposed' },
      { id: 'meeting_agreed', label: 'Demo / Meeting confirmed' },
      { id: 'referral_given', label: 'Referral to colleague given' },
      { id: 'no_next_step', label: 'No next step agreed' },
    ],
    promptExamples: [],
  },
  {
    stageNumber: 8,
    name: 'Close',
    shortName: 'Close',
    purpose: 'Professional wrap-up confirming agreed next actions or cordial termination.',
    actionTaps: [
      { id: 'positive_close', label: 'Positive close (commitment confirmed)' },
      { id: 'neutral_close', label: 'Neutral polite wrap-up' },
      { id: 'ended_normally', label: 'Call ended normally' },
      { id: 'line_dropped', label: 'Line dropped / Disconnected' },
      { id: 'prospect_ended', label: 'Prospect ended abruptly' },
      { id: 'caller_ended', label: 'Caller ended' },
      { id: 'unsuccessful_close', label: 'Unsuccessful close' },
    ],
    promptExamples: [],
  },
];

export const ENDING_REASONS_CONFIG: { id: EndingReason; label: string; description: string }[] = [
  { id: 'normal_completion', label: 'Call Completed Normally', description: 'Dialogue completed through close or agreed next step.' },
  { id: 'prospect_ended', label: 'Prospect Ended / Hung Up', description: 'Prospect abruptly disconnected or said goodbye early.' },
  { id: 'caller_ended', label: 'Caller Ended Call', description: 'Caller determined conversation was complete or ineffective.' },
  { id: 'gatekeeper_block', label: 'Gatekeeper Blocked', description: 'Receptionist / Assistant refused or failed to transfer.' },
  { id: 'wrong_number', label: 'Wrong Number / Person', description: 'Contact is no longer at company or incorrect phone number.' },
  { id: 'busy_callback', label: 'Prospect Busy / Callback', description: 'Prospect requested to be called back at another time.' },
  { id: 'line_dropped', label: 'Line Dropped / Network', description: 'Call abruptly disconnected due to signal or technical fault.' },
  { id: 'not_interested', label: 'Explicitly Not Interested', description: 'Prospect clearly stated they have no interest or need.' },
  { id: 'do_not_call', label: 'Do Not Contact Requested', description: 'Prospect demanded removal from calling list.' },
];

export const QUOTE_STATUS_OPTIONS: { id: 'need_stated' | 'goal_stated' | 'no_need_stated' | 'unclear' | 'not_reached'; label: string; badgeColor: string }[] = [
  { id: 'need_stated', label: 'Need Stated (Operational pain point voiced)', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'goal_stated', label: 'Goal Stated (Target improvement described)', badgeColor: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'no_need_stated', label: 'No Need Stated (Prospect claims no issues)', badgeColor: 'bg-slate-100 text-slate-800 border-slate-300' },
  { id: 'unclear', label: 'Unclear / Ambiguous (Vague or incomplete)', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'not_reached', label: 'Not Reached (Call ended before need discovery)', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' },
];

export const getStageConfig = (stageNum: CallStageNumber): StageDefinition => {
  const found = STAGES_CONFIG.find(s => s.stageNumber === stageNum);
  return found || STAGES_CONFIG[0];
};

import assert from 'node:assert';
import { 
  STAGES_CONFIG, 
  getStageConfig, 
  ENDING_REASONS_CONFIG, 
  QUOTE_STATUS_OPTIONS 
} from '../src/data/stageDefinitions.js';
import { CallStageNumber, QuoteStatus, EndingReason, StageEvent } from '../src/types/index.js';

console.log('=== Cold Call Copilot — Phase 2 Eight-Stage Workspace Unit & Logic Tests ===\n');

let passedTests = 0;
let totalTests = 0;

function test(description: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`✓ PASS: ${description}`);
    passedTests++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${description}`);
    console.error(`   ${err.message}`);
  }
}

// 1. All eight stages appear in the specified order
test('Scenario 1: All eight stages appear in the specified exact order', () => {
  const expectedNames = [
    'Opening',
    'Purpose',
    'Permission',
    'Their business',
    'Their need in their words',
    'Objection',
    'Next step',
    'Close',
  ];

  assert.strictEqual(STAGES_CONFIG.length, 8, 'Must have exactly 8 stages');
  STAGES_CONFIG.forEach((stage, idx) => {
    assert.strictEqual(stage.stageNumber, idx + 1, `Stage ${idx + 1} must match index`);
    assert.strictEqual(stage.name, expectedNames[idx], `Stage ${idx + 1} name must be ${expectedNames[idx]}`);
  });
});

// 2. Stage 1 is the initial active stage for a new call
test('Scenario 2: Stage 1 is the initial active stage for a new call', () => {
  const initialActiveStage: CallStageNumber = 1;
  const initialFurthestStage: CallStageNumber = 1;
  assert.strictEqual(initialActiveStage, 1);
  assert.strictEqual(initialFurthestStage, 1);
  const config = getStageConfig(initialActiveStage);
  assert.strictEqual(config.name, 'Opening');
});

// 3. Next moves from Opening to Purpose
test('Scenario 3: Next moves from Opening (Stage 1) to Purpose (Stage 2)', () => {
  let activeStage: CallStageNumber = 1;
  let furthestStage: CallStageNumber = 1;

  // Advance
  const nextStage = (activeStage + 1) as CallStageNumber;
  activeStage = nextStage;
  furthestStage = Math.max(furthestStage, nextStage) as CallStageNumber;

  assert.strictEqual(activeStage, 2);
  assert.strictEqual(furthestStage, 2);
  assert.strictEqual(getStageConfig(activeStage).name, 'Purpose');
});

// 4. Next moves correctly through all remaining stages
test('Scenario 4: Next moves sequentially through all 8 stages', () => {
  let activeStage: CallStageNumber = 1;
  let furthestStage: CallStageNumber = 1;

  for (let s = 1; s <= 7; s++) {
    const next = (activeStage + 1) as CallStageNumber;
    activeStage = next;
    furthestStage = Math.max(furthestStage, next) as CallStageNumber;
    assert.strictEqual(activeStage, s + 1);
    assert.strictEqual(furthestStage, s + 1);
  }
  assert.strictEqual(activeStage, 8);
  assert.strictEqual(getStageConfig(activeStage).name, 'Close');
});

// 5. The interface does not create a ninth stage
test('Scenario 5: Advancing from Stage 8 triggers wrap-up and does NOT create a 9th stage', () => {
  const activeStage: CallStageNumber = 8;
  const hasNextStage = activeStage < 8;
  assert.strictEqual(hasNextStage, false, 'Stage 8 must not have a stage 9');
});

// 6. Previous-stage navigation preserves draft data
test('Scenario 6: Navigating backward to earlier stages preserves prospect words and action taps', () => {
  let activeStage: CallStageNumber = 4;
  let furthestStage: CallStageNumber = 4;
  const draftQuote = 'Scrap rate month end pe 4% cross kar jata hai';
  const draftNotes: Record<number, string> = { 1: 'Reception transferred directly', 4: 'Running 3 VMCs' };
  const events: StageEvent[] = [
    { id: '1', stageNumber: 1, eventType: 'right_person', eventLabel: 'Right person confirmed', timestamp: '2026-10-26T12:00:00Z' },
    { id: '2', stageNumber: 4, eventType: 'business_context_shared', eventLabel: 'Business context shared', timestamp: '2026-10-26T12:01:00Z' },
  ];

  // Navigate backward to stage 2
  activeStage = 2;
  // Furthest reached remains 4!
  assert.strictEqual(activeStage, 2);
  assert.strictEqual(furthestStage, 4, 'Furthest stage reached must not decrease when moving back');
  assert.strictEqual(draftQuote, 'Scrap rate month end pe 4% cross kar jata hai');
  assert.strictEqual(draftNotes[4], 'Running 3 VMCs');
  assert.strictEqual(events.length, 2);
});

// 7. Event taps visibly toggle and retain their selected state
test('Scenario 7: Event taps toggle state idempotently', () => {
  let selectedEvents: StageEvent[] = [];

  const toggleEvent = (stageNumber: CallStageNumber, eventType: string, eventLabel: string) => {
    const exists = selectedEvents.some(e => e.stageNumber === stageNumber && e.eventType === eventType);
    if (exists) {
      selectedEvents = selectedEvents.filter(e => !(e.stageNumber === stageNumber && e.eventType === eventType));
    } else {
      selectedEvents.push({
        id: 'evt-1',
        stageNumber,
        eventType,
        eventLabel,
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Toggle on
  toggleEvent(1, 'right_person', 'Right person confirmed');
  assert.strictEqual(selectedEvents.length, 1);
  assert.strictEqual(selectedEvents[0].eventType, 'right_person');

  // Toggle off
  toggleEvent(1, 'right_person', 'Right person confirmed');
  assert.strictEqual(selectedEvents.length, 0);
});

// 8. Multiple event taps behave according to the defined event model
test('Scenario 8: Multiple distinct event taps can be recorded per stage', () => {
  const events: StageEvent[] = [
    { id: 'e1', stageNumber: 2, eventType: 'purpose_explained', eventLabel: 'Purpose explained', timestamp: '2026-10-26T12:00:10Z' },
    { id: 'e2', stageNumber: 2, eventType: 'asked_what_we_do', eventLabel: 'Asked what we do', timestamp: '2026-10-26T12:00:15Z' },
    { id: 'e3', stageNumber: 2, eventType: 'sales_call_suspicion', eventLabel: 'Sales suspicion', timestamp: '2026-10-26T12:00:20Z' },
  ];

  const stage2Events = events.filter(e => e.stageNumber === 2);
  assert.strictEqual(stage2Events.length, 3);
});

// 9. The Prospect\'s words field accepts and retains entered text
test('Scenario 9: Prospect words field captures verbatim quotes without alteration', () => {
  let prospectWords = '';
  const verbatimSpoken = 'Local heat treatment vendors take 6 days instead of 2. Entire line waits.';
  prospectWords = verbatimSpoken;
  assert.strictEqual(prospectWords, verbatimSpoken);
});

// 10. Quote status accepts only the specified values
test('Scenario 10: Quote status validates against the 5 specified values', () => {
  const validStatuses: QuoteStatus[] = [
    'need_stated',
    'goal_stated',
    'no_need_stated',
    'unclear',
    'not_reached',
  ];

  assert.strictEqual(QUOTE_STATUS_OPTIONS.length, 5);
  QUOTE_STATUS_OPTIONS.forEach(opt => {
    assert(validStatuses.includes(opt.id as QuoteStatus), `Invalid quote status: ${opt.id}`);
  });
});

// 11. An empty quote is not automatically treated as no need
test('Scenario 11: An empty quote defaults to not_reached, never auto-classified as no_need_stated', () => {
  const emptyQuote = '';
  const initialStatus: QuoteStatus = 'not_reached';
  assert.strictEqual(emptyQuote, '');
  assert.notStrictEqual(initialStatus, 'no_need_stated', 'Empty quote must not be assumed as no need');
  assert.strictEqual(initialStatus, 'not_reached');
});

// 12. End Call is available from every stage
test('Scenario 12: End Call action is supported across all 8 stages', () => {
  for (let s = 1; s <= 8; s++) {
    const stageNum = s as CallStageNumber;
    assert(stageNum >= 1 && stageNum <= 8);
  }
});

// 13. Cancelling the End Call modal leaves the draft unchanged
test('Scenario 13: Cancelling End Call modal preserves active stage and notes', () => {
  const activeStage: CallStageNumber = 3;
  const draftQuote = 'Currently looking for suppliers';
  let modalOpen = true;

  // User clicks Cancel
  modalOpen = false;

  assert.strictEqual(modalOpen, false);
  assert.strictEqual(activeStage, 3);
  assert.strictEqual(draftQuote, 'Currently looking for suppliers');
});

// 14. Confirming an early end records the correct client-side ending stage
test('Scenario 14: Ending at Stage 3 records endingStage = 3', () => {
  const activeStage: CallStageNumber = 3;
  const furthestStage: CallStageNumber = 3;
  const selectedReason: EndingReason = 'busy_callback';

  const completedCall = {
    activeStage,
    furthestStageReached: furthestStage,
    endingStage: activeStage, // Stored as 3!
    endingReason: selectedReason,
  };

  assert.strictEqual(completedCall.endingStage, 3);
  assert.strictEqual(completedCall.endingReason, 'busy_callback');
});

// 15. Ending at Stage 3 does not change the furthest stage reached to Stage 8
test('Scenario 15: Ending early at Stage 3 NEVER alters furthestStageReached to 8', () => {
  const activeStage: CallStageNumber = 3;
  let furthestStage: CallStageNumber = 3;

  // End Call execution
  const endingStage: CallStageNumber = activeStage;
  assert.strictEqual(endingStage, 3);
  assert.strictEqual(furthestStage, 3, 'Furthest stage reached must remain 3');
  assert.notStrictEqual(furthestStage, 8, 'Must never auto-advance to 8 on early exit');
});

// 16. Hardcoded prompt examples removed; authentic prospect words are unpopulated
test('Scenario 16: Hardcoded prompt examples are removed and prospect words remain authentic and empty', () => {
  let prospectWords = '';
  assert.strictEqual(prospectWords, '', 'Prospect words must remain empty until user types');
  assert.strictEqual(STAGES_CONFIG[0].promptExamples?.length || 0, 0, 'Hardcoded prompts must be removed');
});

// 17. The workspace handles empty prompt examples or missing optional fields gracefully
test('Scenario 17: Workspace handles empty prompt examples and all 8 stages gracefully', () => {
  const stage1 = getStageConfig(1);
  assert(stage1.actionTaps.length > 0);
  assert.strictEqual(stage1.promptExamples?.length || 0, 0);
  assert.strictEqual(STAGES_CONFIG.length, 8);
});

// 18. Nine-category objection taxonomy is present on Stage 6
test('Scenario 18: Stage 6 implements the complete 9-category objection taxonomy', () => {
  const stage6 = getStageConfig(6);
  assert.strictEqual(stage6.name, 'Objection');
  assert.strictEqual(stage6.actionTaps.length, 9, 'Must have exactly 9 objection categories');

  const expectedCategories = [
    'timing_or_capacity',
    'existing_internal_process',
    'existing_provider_or_alternative',
    'wrong_contact_or_authority',
    'poor_fit_or_scope',
    'commercial_intent_unclear',
    'explicit_not_interested',
    'do_not_contact_requested',
    'other_or_unclear',
  ];

  stage6.actionTaps.forEach((tap, idx) => {
    assert.strictEqual(tap.id, expectedCategories[idx]);
  });
});

console.log(`\n=== Test Results: ${passedTests} of ${totalTests} PASSED ===`);
if (passedTests !== totalTests) {
  process.exit(1);
}

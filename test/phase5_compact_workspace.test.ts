import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('=== Cold Call Copilot — Phase 5 Compact Enterprise Workspace & Scroll Tests ===\n');

let passedTests = 0;
let totalTests = 0;

function reportPass(name: string) {
  passedTests++;
  console.log(`✓ PASS: ${name}`);
}

function reportFail(name: string, err: any) {
  console.error(`✗ FAIL: ${name}`);
  console.error(`   ${err.message || err}`);
}

async function runTests() {
  const callWorkspacePath = path.join(rootDir, 'src/pages/CallWorkspacePage.tsx');
  const transcriptPanelPath = path.join(rootDir, 'src/components/workspace/LiveTranscriptPanel.tsx');
  const stageActionTapsPath = path.join(rootDir, 'src/components/workspace/StageActionTaps.tsx');
  const stageStepperPath = path.join(rootDir, 'src/components/workspace/StageStepper.tsx');

  const workspaceContent = fs.readFileSync(callWorkspacePath, 'utf-8');
  const transcriptContent = fs.readFileSync(transcriptPanelPath, 'utf-8');
  const actionTapsContent = fs.readFileSync(stageActionTapsPath, 'utf-8');
  const stepperContent = fs.readFileSync(stageStepperPath, 'utf-8');

  // Test 1: Header is extremely compact (48-52px, single horizontal row, all metadata present)
  totalTests++;
  try {
    assert(workspaceContent.includes('h-12 sm:h-13'), 'Header must have compact height h-12 sm:h-13 (48-52px)');
    assert(workspaceContent.includes('{selectedProspect.companyName}'), 'Header must display company name');
    assert(workspaceContent.includes('Live Call Active'), 'Header must display Live Call Active badge');
    assert(workspaceContent.includes('formatDuration(elapsedSeconds)'), 'Header must display elapsed timer');
    assert(workspaceContent.includes('{selectedProspect.contactName}'), 'Header must display contact name');
    assert(workspaceContent.includes('{selectedProspect.jobTitle'), 'Header must display contact role');
    assert(workspaceContent.includes('{selectedProspect.phone}'), 'Header must display phone');
    assert(workspaceContent.includes('{selectedProspect.location}'), 'Header must display location');
    assert(workspaceContent.includes('Save Draft'), 'Header must contain Save Draft button');
    assert(workspaceContent.includes('End Call'), 'Header must contain End Call button');
    reportPass('1. Compact active call header is horizontally aligned (48-52px) with all required metadata & controls');
  } catch (err) {
    reportFail('1. Compact active call header', err);
  }

  // Test 2: Compact Eight-Stage Navigation Footprint
  totalTests++;
  try {
    assert(stepperContent.includes('Stage {activeStage} of 8 · {activeConfig.name}'), 'Must display consolidated Stage X of 8 · StageName');
    assert(stepperContent.includes('Furthest:'), 'Must display Furthest Reached as compact metadata');
    assert(stepperContent.includes('progressPercent'), 'Must display thin progress bar');
    assert(stepperContent.includes('→'), 'Must display horizontal rail with arrow separators');
    assert(stepperContent.includes('overflow-x-auto'), 'Must support horizontal scroll on constrained screens');
    reportPass('2. Stage navigation footprint is consolidated with single label, thin progress bar, and rail');
  } catch (err) {
    reportFail('2. Stage navigation footprint is consolidated', err);
  }

  // Test 3: Mandatory Scroll Reset on Stage Navigation
  totalTests++;
  try {
    // Check mainContentScrollRef definition
    assert(workspaceContent.includes('mainContentScrollRef = useRef<HTMLDivElement>(null)'), 'Must declare mainContentScrollRef');
    // Check ref attached to the stage content scroll container
    assert(workspaceContent.includes('ref={mainContentScrollRef}'), 'Must attach mainContentScrollRef to stage content container');
    assert(workspaceContent.includes('mainContentScrollRef.current.scrollTop = 0'), 'Must reset scrollTop to 0');
    // Check useEffect hook on activeStage
    assert(workspaceContent.includes('useEffect(() => {\n    if (mainContentScrollRef.current) {\n      mainContentScrollRef.current.scrollTop = 0;\n    }\n  }, [activeStage]);') ||
           workspaceContent.includes('mainContentScrollRef.current.scrollTop = 0;\n    }\n  }, [activeStage])'),
           'Must contain useEffect resetting scrollTop on [activeStage]');
    // Check handler resets
    assert(workspaceContent.includes('handleNextStage') && workspaceContent.includes('handleSelectStage') && workspaceContent.includes('handlePrevStage'), 'Must have all stage handlers');
    reportPass('3. Scroll reset is implemented via mainContentScrollRef and useEffect on activeStage');
  } catch (err) {
    reportFail('3. Scroll reset is implemented', err);
  }

  // Test 4: Workspace Proportions (Left Stage Workspace ~68-72% / Right Live Transcript ~28-32%)
  totalTests++;
  try {
    assert(workspaceContent.includes('lg:w-[70%]'), 'Main stage workspace column must occupy ~70% (68-72%) of workspace width on the left');
    assert(workspaceContent.includes('lg:w-[30%]'), 'Live Transcript panel column must occupy ~30% (28-32%) of workspace width on the right');
    assert(workspaceContent.includes('Finish Call & Review'), 'Must feature Finish Call & Review pre-call-ending workflow button');
    reportPass('4. Workspace layout dedicates 70% to Stage Workspace & Quick Actions and 30% to compact Live Transcript on the right');
  } catch (err) {
    reportFail('4. Workspace layout adheres to 70% / 30% proportions', err);
  }

  // Test 5: Quick Actions is the main focus with required heading and subtitle
  totalTests++;
  try {
    assert(actionTapsContent.includes('Quick Actions'), 'Action taps header must be Quick Actions');
    assert(actionTapsContent.includes('Record observed responses with one click.'), 'Must contain concise subtitle');
    assert(actionTapsContent.includes('isSelected'), 'Must maintain selected event state');
    reportPass('5. Quick Actions is the primary interaction area with exact heading and subtitle');
  } catch (err) {
    reportFail('5. Quick Actions is the primary interaction area', err);
  }

  // Test 6: Compact Prospect\'s Words and 5 Quote Classifications
  totalTests++;
  try {
    assert(workspaceContent.includes("Prospect's Words"), 'Must contain Prospect\'s Words heading');
    assert(workspaceContent.includes('placeholder="Capture the prospect\'s exact words..."'), 'Must have exact required placeholder');
    assert(workspaceContent.includes('QUOTE_STATUS_OPTIONS.map'), 'Must render quote classification options');
    reportPass("6. Prospect's Words is directly visible with required placeholder and 5 classifications");
  } catch (err) {
    reportFail("6. Prospect's Words is directly visible", err);
  }

  // Test 7: Compact Call Notes directly visible with autosave
  totalTests++;
  try {
    assert(workspaceContent.includes('Call Notes'), 'Must contain Call Notes heading');
    assert(workspaceContent.includes('placeholder="Record key observations, technical details, objections, and agreed next steps..."'), 'Must have exact required placeholder');
    assert(workspaceContent.includes('Autosaved'), 'Must show autosaved status');
    reportPass('7. Call Notes is directly visible with autosave indicator');
  } catch (err) {
    reportFail('7. Call Notes is directly visible', err);
  }

  // Test 8: Live Transcript Smart Auto-Scroll and Independent Scrolling
  totalTests++;
  try {
    assert(transcriptContent.includes('isAtBottomRef'), 'Must track whether user is at bottom using isAtBottomRef');
    assert(transcriptContent.includes('handleScroll'), 'Must implement onScroll handler to track scroll position');
    assert(transcriptContent.includes('distanceFromBottom'), 'Must measure distance from bottom to determine follow state');
    assert(transcriptContent.includes('showScrollBottomButton'), 'Must support indicator/button when user has scrolled away from bottom');
    assert(transcriptContent.includes('scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight'), 'Must scroll to bottom on update when following');
    assert(transcriptContent.includes('overflow-y-auto'), 'Must have independent overflow-y-auto scrolling');
    reportPass('8. Live Transcript implements smart auto-scroll with manual scroll inspection preservation');
  } catch (err) {
    reportFail('8. Live Transcript implements smart auto-scroll', err);
  }

  // Test 9: Next Stage is accessible and pinned at bottom of main column
  totalTests++;
  try {
    assert(workspaceContent.includes('Previous Stage'), 'Must contain Previous Stage button');
    assert(workspaceContent.includes('{getNextStageLabel()}'), 'Must contain Next Stage button with dynamic label');
    assert(workspaceContent.includes('handleNextStage'), 'Must preserve handleNextStage handler');
    reportPass('9. Next Stage and Previous Stage buttons are pinned and accessible');
  } catch (err) {
    reportFail('9. Next Stage and Previous Stage buttons are pinned', err);
  }

  // Test 10: Live Transcript does NOT reset on stage changes
  totalTests++;
  try {
    // Ensure that activeStage effect does NOT reset transcript scrollContainerRef
    const activeStageEffectMatch = workspaceContent.match(/useEffect\(\(\) => \{\s+if \(mainContentScrollRef\.current\)[\s\S]+?\}, \[activeStage\]\);/);
    assert(activeStageEffectMatch, 'activeStage effect must exist');
    assert(!activeStageEffectMatch[0].includes('scrollContainerRef'), 'activeStage effect must NOT reset transcript scrollContainerRef');
    reportPass('10. Live Transcript scroll position is completely isolated from stage changes');
  } catch (err) {
    reportFail('10. Live Transcript scroll position is isolated from stage changes', err);
  }

  // Test 11: UI Clutter Removal (Unnecessary labels, badges, and explanatory text removed)
  totalTests++;
  try {
    assert(!transcriptContent.includes('Ready. Click "Start Listening" to stream microphone.'), 'Must remove Ready. Click "Start Listening" message');
    assert(!transcriptContent.includes('12 Split View'), 'Must remove redundant 12 Split View label');
    assert(!transcriptContent.includes('Pause heuristic'), 'Must remove Pause heuristic label');
    assert(!transcriptContent.includes('Speaker Alternation: Agent ↔'), 'Must remove visible Speaker Alternation row');
    assert(!workspaceContent.includes('12 Split View'), 'Workspace must not contain 12 Split View');
    reportPass('11. Removed instructional clutter, model-name badges, 12 Split View, and standalone alternation rows');
  } catch (err) {
    reportFail('11. UI clutter removal', err);
  }

  // Test 12: Compact Empty State in Live Transcript
  totalTests++;
  try {
    assert(transcriptContent.includes('No transcript yet'), 'Must contain clean "No transcript yet" heading');
    assert(transcriptContent.includes('Start listening to capture the conversation.'), 'Must contain concise subtitle');
    reportPass('12. Live Transcript renders clean, compact empty state without bulky instructional cards');
  } catch (err) {
    reportFail('12. Compact empty state in Live Transcript', err);
  }

  console.log(`\n=== Phase 5 Compact Workspace Test Results: ${passedTests} of ${totalTests} PASSED ===\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();

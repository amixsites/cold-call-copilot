import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGES_CONFIG, getStageConfig, QUOTE_STATUS_OPTIONS } from '../src/data/stageDefinitions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('=== Cold Call Copilot — Redesign Call Workspace & Prompt Removal Tests ===\n');

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
  // Test 1: Hardcoded manufacturing prompts completely removed from stage definitions
  totalTests++;
  try {
    for (const stage of STAGES_CONFIG) {
      assert.strictEqual(stage.promptExamples?.length || 0, 0, `Stage ${stage.stageNumber} must not contain hardcoded promptExamples`);
    }
    reportPass('1. All eight stages have empty prompt examples (no hardcoded manufacturing prompts)');
  } catch (err) {
    reportFail('1. All eight stages have empty prompt examples', err);
  }

  // Test 2: Source code check - no reference to "cold-call-transcripts-100" in src/
  totalTests++;
  try {
    const callWorkspacePath = path.join(rootDir, 'src/pages/CallWorkspacePage.tsx');
    const stageDefsPath = path.join(rootDir, 'src/data/stageDefinitions.ts');
    const aiPanelPath = path.join(rootDir, 'src/components/workspace/AiSuggestionsPanel.tsx');

    const workspaceContent = fs.readFileSync(callWorkspacePath, 'utf-8');
    const stageDefsContent = fs.readFileSync(stageDefsPath, 'utf-8');
    const aiPanelContent = fs.readFileSync(aiPanelPath, 'utf-8');

    assert(!workspaceContent.includes('cold-call-transcripts-100'), 'CallWorkspacePage must not contain cold-call-transcripts-100');
    assert(!workspaceContent.includes('Real Manufacturing Call Prompts & Responses'), 'Must not contain Real Manufacturing Call Prompts');
    assert(!workspaceContent.includes('TranscriptPromptCard'), 'TranscriptPromptCard must not be referenced in CallWorkspacePage');

    assert(!stageDefsContent.includes('cold-call-transcripts-100'), 'stageDefinitions must not contain cold-call-transcripts-100');
    assert(!stageDefsContent.includes('Direct Reach (Operations)'), 'Must not contain Direct Reach sample dialogue');
    assert(!stageDefsContent.includes('Former Contact Check'), 'Must not contain Former Contact Check sample dialogue');

    reportPass('2. Zero references to cold-call-transcripts-100 or hardcoded dialogue categories in active workspace');
  } catch (err) {
    reportFail('2. Zero references to cold-call-transcripts-100 or hardcoded dialogue categories', err);
  }

  // Test 3: Prospect Words label and placeholder matches specification
  totalTests++;
  try {
    const callWorkspacePath = path.join(rootDir, 'src/pages/CallWorkspacePage.tsx');
    const workspaceContent = fs.readFileSync(callWorkspacePath, 'utf-8');

    assert(workspaceContent.includes("Prospect's Words"), "Must display label Prospect's Words");
    assert(workspaceContent.includes('placeholder="Capture the prospect\'s exact words..."'), 'Must have correct placeholder for Prospect Words');
    assert(!workspaceContent.includes('CNC spindle runout on the night shift'), 'Must NOT prepopulate sample quote about CNC spindle');

    reportPass("3. Prospect's Words uses exact required placeholder and label without dummy data");
  } catch (err) {
    reportFail("3. Prospect's Words uses exact required placeholder and label", err);
  }

  // Test 4: Call Notes directly visible in main column with exact required placeholder
  totalTests++;
  try {
    const callWorkspacePath = path.join(rootDir, 'src/pages/CallWorkspacePage.tsx');
    const workspaceContent = fs.readFileSync(callWorkspacePath, 'utf-8');

    assert(workspaceContent.includes('Call Notes'), 'Must display label Call Notes');
    assert(workspaceContent.includes('placeholder="Record key observations, technical details, objections, and agreed next steps..."'), 'Must have exact required notes placeholder');

    reportPass('4. Call Notes is directly visible in main column with required placeholder');
  } catch (err) {
    reportFail('4. Call Notes is directly visible in main column', err);
  }

  // Test 5: Live Transcript component integrated in right column
  totalTests++;
  try {
    const callWorkspacePath = path.join(rootDir, 'src/pages/CallWorkspacePage.tsx');
    const workspaceContent = fs.readFileSync(callWorkspacePath, 'utf-8');
    const transcriptPanelPath = path.join(rootDir, 'src/components/workspace/LiveTranscriptPanel.tsx');

    assert(fs.existsSync(transcriptPanelPath), 'LiveTranscriptPanel.tsx must exist');
    assert(workspaceContent.includes('<LiveTranscriptPanel'), 'LiveTranscriptPanel must be rendered in CallWorkspacePage');

    const transcriptContent = fs.readFileSync(transcriptPanelPath, 'utf-8');
    assert(transcriptContent.includes('Live Transcript'), 'Must have Live Transcript heading');
    assert(transcriptContent.includes('Start Listening'), 'Must have Start Listening control');
    assert(transcriptContent.includes('Stop Listening') || transcriptContent.includes('handleStopListening'), 'Must have Stop Listening control');
    assert(transcriptContent.includes('geminiLiveAudio') || transcriptContent.includes('GeminiLiveAudioClient') || transcriptContent.includes('SpeechRecognition'), 'Must utilize Gemini Live streaming or speech pipeline');
    assert(transcriptContent.includes('Microphone inactive'), 'Must have honest inactive state');
    assert(transcriptContent.includes('Captures local microphone audio'), 'Must have honest disclaimer regarding remote phone lines');

    reportPass('5. Live Transcript panel is integrated with Gemini Live streaming pipeline, controls, and honest audio notice');
  } catch (err) {
    reportFail('5. Live Transcript panel is integrated', err);
  }

  // Test 6: AI Suggestions Panel uses light enterprise theme and removed Account Context
  totalTests++;
  try {
    const aiPanelPath = path.join(rootDir, 'src/components/workspace/AiSuggestionsPanel.tsx');
    const aiPanelContent = fs.readFileSync(aiPanelPath, 'utf-8');

    assert(aiPanelContent.includes('Suggested Next Question') || aiPanelContent.includes('gemini-3.5-transcribe-live') || aiPanelContent.includes('AI Suggestions Deactivated'), 'Must reflect AI Suggestions status');

    // Section 7 check: Account Context removed from visible interface
    assert(!aiPanelContent.includes('accountContext.companyName'), 'Account Context must be removed from visible AI panel');
    assert(!aiPanelContent.includes('Verified Facts'), 'Verified Facts must be removed from visible AI panel');

    // Light theme check
    assert(aiPanelContent.includes('bg-white'), 'Must use white background for light enterprise SaaS theme');
    assert(!aiPanelContent.includes('bg-slate-900 border-slate-800'), 'Must not use dark container styling');

    reportPass('6. AI Suggestions panel retains clean state, removes visible account context, and applies light theme');
  } catch (err) {
    reportFail('6. AI Suggestions panel retains genuine AI sections', err);
  }

  // Test 7: Compact Eight-Stage Progress Tracker
  totalTests++;
  try {
    const stepperPath = path.join(rootDir, 'src/components/workspace/StageStepper.tsx');
    const stepperContent = fs.readFileSync(stepperPath, 'utf-8');

    assert(stepperContent.includes('Stage {activeStage} of 8 · {activeConfig.name}'), 'Must display active stage label once in compact format');
    assert(stepperContent.includes('progressPercent'), 'Must compute thin progress bar percentage');
    assert(stepperContent.includes('→'), 'Must have horizontal arrow separators');

    reportPass('7. Compact eight-stage tracker displays single label, thin progress bar, and horizontal rail');
  } catch (err) {
    reportFail('7. Compact eight-stage tracker displays single label', err);
  }

  // Test 8: Compact Header layout check
  totalTests++;
  try {
    const callWorkspacePath = path.join(rootDir, 'src/pages/CallWorkspacePage.tsx');
    const workspaceContent = fs.readFileSync(callWorkspacePath, 'utf-8');

    assert(workspaceContent.includes('{selectedProspect.companyName}'), 'Must display company name');
    assert(workspaceContent.includes('{selectedProspect.contactName}'), 'Must display contact name');
    assert(workspaceContent.includes('{selectedProspect.phone}'), 'Must display phone');
    assert(workspaceContent.includes('{selectedProspect.location}'), 'Must display location');
    assert(workspaceContent.includes('Live Call Active'), 'Must display Live Call Active badge');
    assert(workspaceContent.includes('Save Draft'), 'Must display Save Draft button');
    assert(workspaceContent.includes('End Call'), 'Must display End Call button');

    reportPass('8. Compact active call header preserves all required prospect and lifecycle controls');
  } catch (err) {
    reportFail('8. Compact active call header preserves all required prospect and lifecycle controls', err);
  }

  // Test 9: Quote classification taxonomy matches all 5 required options
  totalTests++;
  try {
    const requiredStatuses = ['need_stated', 'goal_stated', 'no_need_stated', 'unclear', 'not_reached'];
    const actualStatuses = QUOTE_STATUS_OPTIONS.map(o => o.id);

    for (const req of requiredStatuses) {
      assert(actualStatuses.includes(req as any), `Quote status option ${req} must be present`);
    }

    reportPass('9. Quote classification options match all 5 specified categories');
  } catch (err) {
    reportFail('9. Quote classification options match all 5 specified categories', err);
  }

  // Test 10: AppLayout light theme in Call Mode
  totalTests++;
  try {
    const appLayoutPath = path.join(rootDir, 'src/components/layout/AppLayout.tsx');
    const layoutContent = fs.readFileSync(appLayoutPath, 'utf-8');

    assert(!layoutContent.includes('isCallMode ? \'bg-slate-900\''), 'AppLayout must not switch to bg-slate-900 in Call Mode');
    assert(layoutContent.includes('bg-slate-50'), 'AppLayout must use light bg-slate-50 surface');

    reportPass('10. AppLayout maintains light enterprise SaaS theme across Call Mode');
  } catch (err) {
    reportFail('10. AppLayout maintains light enterprise SaaS theme', err);
  }

  console.log(`\n=== Workspace Redesign Test Results: ${passedTests} of ${totalTests} PASSED ===\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();

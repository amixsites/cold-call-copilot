import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../server/.env');
let apiKey = '';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('GEMINI_API_KEY=')) {
      apiKey = trimmed.split('=')[1].trim();
    }
  }
}

async function testModel(model: string) {
  console.log(`Testing model: ${model}...`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Explain AI in 5 words' }] }]
    })
  });
  const data = await res.json() as any;
  if (res.ok) {
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log(`✓ ${model} SUCCESS:`, text?.trim());
    return true;
  } else {
    console.log(`✗ ${model} FAILED (${res.status}):`, data.error?.message || data);
    return false;
  }
}

async function main() {
  await testModel('gemini-flash-latest');
  await testModel('gemini-3.8-flash');
  await testModel('gemini-flash-lite-latest');
}

main().catch(console.error);

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

async function check() {
  console.log('Fetching available models from Google Generative Language API...');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json() as any;
  if (data.models) {
    console.log('Found', data.models.length, 'models.');
    const flashModels = data.models
      .map((m: any) => m.name.replace('models/', ''))
      .filter((n: string) => n.includes('flash'));
    console.log('Flash models available:', flashModels);
  } else {
    console.log('Response:', JSON.stringify(data, null, 2));
  }
}

check().catch(console.error);

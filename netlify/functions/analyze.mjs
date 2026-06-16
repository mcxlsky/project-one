import { analyzeNames } from './shared/checks.mjs';

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { description, baseName } = body;
  if (!description) {
    return Response.json({ error: 'Description is required' }, { status: 400 });
  }

  const apiKey = Netlify.env.get('GEMINI_API_KEY');
  const result = await analyzeNames(description, baseName || '', apiKey);
  return Response.json(result);
};

export const config = { path: '/api/analyze', method: 'POST' };

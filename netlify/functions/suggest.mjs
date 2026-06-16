import { generateSuggestions } from './shared/checks.mjs';

export default async (req) => {
  const params = new URL(req.url).searchParams;
  const name = params.get('name');
  const category = params.get('category');
  if (!name) {
    return Response.json({ error: 'Name parameter is required' }, { status: 400 });
  }
  const result = generateSuggestions(name, category);
  if (!result) {
    return Response.json({ error: 'Invalid name parameter' }, { status: 400 });
  }
  return Response.json(result);
};

export const config = { path: '/api/suggest' };

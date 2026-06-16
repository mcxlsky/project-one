import { checkSocialAvailability } from './shared/checks.mjs';

export default async (req) => {
  const params = new URL(req.url).searchParams;
  const platform = params.get('platform');
  const handle = params.get('handle');
  if (!platform || !handle) {
    return Response.json({ error: 'Platform and handle parameters are required' }, { status: 400 });
  }
  const status = await checkSocialAvailability(platform.toLowerCase(), handle.toLowerCase());
  return Response.json({ platform, handle, status });
};

export const config = { path: '/api/check-social' };

import { checkDomainAvailability } from './shared/checks.mjs';

export default async (req) => {
  const domain = new URL(req.url).searchParams.get('domain');
  if (!domain) {
    return Response.json({ error: 'Domain parameter is required' }, { status: 400 });
  }
  const status = await checkDomainAvailability(domain.toLowerCase());
  return Response.json({ domain, status });
};

export const config = { path: '/api/check-domain' };

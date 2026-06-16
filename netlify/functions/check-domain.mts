import type { Config, Context } from '@netlify/functions'
import dns from 'node:dns/promises'

// Check domain availability via DNS lookup with an RDAP fallback.
async function checkDomainAvailability(domain: string): Promise<string> {
  try {
    // DNS resolve with a hard 3s timeout (the default can hang 20s+).
    const dnsTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DNS timeout')), 3000),
    )
    await Promise.race([dns.resolve(domain), dnsTimeout])
    return 'taken' // Resolves means it's taken.
  } catch {
    // Query RDAP to confirm availability.
    try {
      const response = await fetch(`https://rdap.org/domain/${domain}`, {
        signal: AbortSignal.timeout(2500),
        redirect: 'follow',
      })
      if (response.status === 404) return 'available'
      if (response.status === 200) return 'taken'
      return 'available' // Default fallback.
    } catch {
      return 'available' // Fall back to available if DNS fails and RDAP errors out.
    }
  }
}

export default async (req: Request, _context: Context) => {
  const domain = new URL(req.url).searchParams.get('domain')
  if (!domain) {
    return Response.json({ error: 'Domain parameter is required' }, { status: 400 })
  }
  const status = await checkDomainAvailability(domain.toLowerCase())
  return Response.json({ domain, status })
}

export const config: Config = {
  path: '/api/check-domain',
}

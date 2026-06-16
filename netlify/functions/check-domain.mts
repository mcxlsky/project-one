import type { Config, Context } from '@netlify/functions'
import { resolve } from 'node:dns/promises'

// Check domain availability via DNS lookup with an RDAP fallback.
async function checkDomainAvailability(domain: string): Promise<string> {
  try {
    const dnsTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DNS timeout')), 3000),
    )
    await Promise.race([resolve(domain), dnsTimeout])
    return 'taken' // Resolves => the domain is registered
  } catch {
    // DNS failed or timed out — confirm via RDAP
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 2500)
      const response = await fetch(`https://rdap.org/domain/${domain}`, {
        signal: controller.signal,
      })
      clearTimeout(t)
      if (response.status === 404) return 'available'
      if (response.status === 200) return 'taken'
      return 'available'
    } catch {
      return 'available'
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

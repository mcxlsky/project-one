import type { Config, Context } from '@netlify/functions'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
]

function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' })
  } finally {
    clearTimeout(t)
  }
}

// Instagram (and Threads, which shares its namespace) via the Web Profile API.
async function checkInstagram(handle: string, userAgent: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${handle}`,
      {
        headers: {
          'User-Agent': userAgent,
          'X-IG-App-ID': '936619743392459',
          Accept: '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      5000,
    )

    if (res.status === 404) return 'available'
    if (res.status === 200) {
      const data: any = await res.json().catch(() => null)
      if (!data) return 'unknown'
      if (data.require_login === true) return 'unknown'
      if (data.status === 'fail') return 'unknown'
      if (data.data && data.data.user) return 'taken'
      if (data.data && data.data.user === null) return 'available'
      return 'unknown'
    }
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

async function scrapeProfilePage(platform: string, handle: string, userAgent: string): Promise<string> {
  let url = ''
  switch (platform) {
    case 'x':
      url = `https://twitter.com/${handle}`
      break
    case 'tiktok':
      url = `https://www.tiktok.com/@${handle}`
      break
    case 'youtube':
      url = `https://www.youtube.com/@${handle}`
      break
    case 'github':
      url = `https://github.com/${handle}`
      break
    default:
      return 'unknown'
  }

  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': userAgent,
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      },
      8000,
    )

    if (res.status === 404) return 'available'
    if (res.status === 429) return 'rate_limited'
    if (res.status === 403 || res.status === 401) return 'unknown'

    // Inspect the final URL for login/consent walls
    const finalUrl = (res.url || url).toLowerCase()
    if (
      finalUrl.includes('login') ||
      finalUrl.includes('signin') ||
      finalUrl.includes('accounts/login') ||
      finalUrl.includes('/flow/login') ||
      finalUrl.includes('consent.youtube.com') ||
      finalUrl.includes('consent.google') ||
      finalUrl.includes('interactiveconsent')
    ) {
      return 'unknown'
    }

    if (res.status === 200) {
      const body = await res.text().catch(() => '')
      if (platform === 'tiktok') {
        if (body.includes("Couldn't find this account") || body.includes('user-not-found')) {
          return 'available'
        }
      }
      return 'taken'
    }

    return 'taken'
  } catch {
    return 'unknown'
  }
}

async function checkSocialAvailability(platform: string, handle: string): Promise<string> {
  const userAgent = pickUserAgent()
  // Threads shares Instagram's username namespace
  if (platform === 'threads' || platform === 'instagram') {
    return checkInstagram(handle, userAgent)
  }
  return scrapeProfilePage(platform, handle, userAgent)
}

export default async (req: Request, _context: Context) => {
  const params = new URL(req.url).searchParams
  const platform = params.get('platform')
  const handle = params.get('handle')
  if (!platform || !handle) {
    return Response.json(
      { error: 'Platform and handle parameters are required' },
      { status: 400 },
    )
  }
  const status = await checkSocialAvailability(platform.toLowerCase(), handle.toLowerCase())
  return Response.json({ platform, handle, status })
}

export const config: Config = {
  path: '/api/check-social',
}

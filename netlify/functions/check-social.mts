import type { Config, Context } from '@netlify/functions'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
]

// Cache Instagram results so Threads (same Meta namespace) can reuse them within a warm container.
const igResultCache = new Map<string, string>()

async function checkSocialAvailability(platform: string, handle: string): Promise<string> {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]

  // Threads shares Instagram's username namespace — derive from the IG result.
  if (platform === 'threads') {
    if (igResultCache.has(handle)) return igResultCache.get(handle)!
    return checkSocialAvailability('instagram', handle)
  }

  // Instagram: use the Web Profile API for a reliable check.
  if (platform === 'instagram') {
    try {
      const igResponse = await fetch(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${handle}`,
        {
          headers: {
            'User-Agent': userAgent,
            'X-IG-App-ID': '936619743392459',
            Accept: '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(5000),
        },
      )

      let result = 'unknown'
      if (igResponse.status === 404) {
        result = 'available'
      } else if (igResponse.status === 200) {
        const igData: any = await igResponse.json().catch(() => null)
        if (igData && igData.require_login === true) result = 'unknown'
        else if (igData && igData.status === 'fail') result = 'unknown'
        else if (igData && igData.data && igData.data.user) result = 'taken'
        else if (igData && igData.data && igData.data.user === null) result = 'available'
        else result = 'unknown'
      }

      igResultCache.set(handle, result)
      return result
    } catch {
      // API failed — don't fall through to the scraper (unreliable for Meta platforms).
      igResultCache.set(handle, 'unknown')
      return 'unknown'
    }
  }

  // All other platforms: scrape the profile page.
  return scrapeProfilePage(platform, handle, userAgent)
}

async function scrapeProfilePage(
  platform: string,
  handle: string,
  userAgent: string,
): Promise<string> {
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
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })

    if (response.status === 404) return 'available'
    if (response.status === 429) return 'rate_limited'
    if (response.status === 403 || response.status === 401) return 'unknown'

    // Inspect the final URL to detect login/consent walls.
    const lowerFinal = (response.url || url).toLowerCase()
    if (
      lowerFinal.includes('login') ||
      lowerFinal.includes('signin') ||
      lowerFinal.includes('accounts/login') ||
      lowerFinal.includes('/flow/login') ||
      lowerFinal.includes('consent.youtube.com') ||
      lowerFinal.includes('consent.google') ||
      lowerFinal.includes('interactiveconsent')
    ) {
      return 'unknown'
    }

    if (response.status === 200) {
      const body = await response.text().catch(() => '')

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

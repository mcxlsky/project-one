import type { Config, Context } from '@netlify/functions'
import { GoogleGenAI } from '@google/genai'

// Netlify AI Gateway injects GEMINI_API_KEY / GOOGLE_GEMINI_BASE_URL at runtime,
// so the zero-config constructor works without managing keys.
const ai = new GoogleGenAI({})

// Auxiliary/functional words filtered out before keyword extraction.
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their',
  'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an',
  'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about',
  'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up',
  'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should',
  'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', 'couldn', 'didn', 'doesn', 'hadn', 'hasn', 'haven',
  'isn', 'ma', 'mightn', 'mustn', 'needn', 'shan', 'shouldn', 'wasn', 'weren', 'won', 'wouldn',
  'want', 'wants', 'build', 'building', 'create', 'creating', 'make', 'making', 'tool', 'tools', 'app', 'apps',
  'startup', 'startups', 'called', 'named', 'name', 'names', 'something', 'like', 'idea', 'ideas', 'niche', 'market',
  'helps', 'help', 'quickly', 'easily', 'fast', 'simple', 'developer', 'developers', 'platform', 'platforms',
  'software', 'service', 'services', 'company', 'companies', 'business', 'businesses', 'project', 'projects',
  'product', 'products', 'allows', 'allow', 'allowing', 'find', 'finding', 'possible', 'search', 'searching',
  'check', 'checking', 'every', 'people', 'user', 'users', 'person', 'someone', 'use', 'using', 'used',
  'helpful', 'great', 'awesome', 'need', 'needs', 'needed', 'describe', 'describing', 'try', 'trying', 'learn',
  'learning', 'work', 'working', 'show', 'showing', 'see', 'seeing', 'provide', 'providing', 'tooling', 'toolset',
  'finds', 'would', 'could', 'many', 'much', 'brand', 'brands', 'domain', 'domains', 'social',
  'socials', 'handle', 'handles', 'username', 'usernames',
])

function cleanWord(w: string): string {
  let word = w.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (word.endsWith('ing') && word.length > 5) word = word.slice(0, -3)
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) word = word.slice(0, -1)
  return word
}

function extractKeywords(text: string): string[] {
  if (!text) return []
  const quotesReg = /["']([^"']+)["']/g
  const quotedWords: string[] = []
  let match: RegExpExecArray | null
  while ((match = quotesReg.exec(text)) !== null) {
    quotedWords.push(cleanWord(match[1]))
  }
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  const words = cleanText.split(/\s+/).map((w) => w.trim()).filter((w) => w.length >= 3)
  const filtered = words.filter((w) => !STOP_WORDS.has(w)).map(cleanWord).filter((w) => w.length >= 3)
  return Array.from(new Set([...quotedWords, ...filtered])).slice(0, 5)
}

interface Candidate {
  text: string
  score: number
  source: string
}

export default async (req: Request, _context: Context) => {
  const { description, baseName } = (await req.json().catch(() => ({}))) as {
    description?: string
    baseName?: string
  }
  if (!description) {
    return Response.json({ error: 'Description is required' }, { status: 400 })
  }

  const keywords = extractKeywords(description)

  let activeKeywords = keywords
  if (activeKeywords.length === 0) {
    const cleanText = description.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
    const words = cleanText.split(/\s+/).map(cleanWord).filter((w) => w.length >= 3)
    activeKeywords = Array.from(new Set(words)).slice(0, 3)
  }
  if (activeKeywords.length === 0) activeKeywords = ['brand']

  const candidatesList: Candidate[] = []
  const seenTexts = new Set<string>()
  const addCandidate = (text: string, score: number, source: string) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (clean && clean.length >= 3 && !seenTexts.has(clean)) {
      seenTexts.add(clean)
      candidatesList.push({ text: clean, score, source })
    }
  }

  const descLower = description.toLowerCase()
  let category = 'generic'

  const techKeywords = ['dev', 'code', 'coding', 'program', 'soft', 'cloud', 'system', 'data', 'api', 'infra', 'server', 'db', 'database', 'git', 'github', 'host', 'hosting', 'deploy', 'deployment']
  const financeKeywords = ['pay', 'payment', 'finance', 'fintech', 'wealth', 'money', 'coin', 'crypto', 'bank', 'banking', 'ledger', 'save', 'vault', 'capital', 'fund', 'wallet']
  const fitnessKeywords = ['fit', 'fitness', 'gym', 'run', 'lift', 'sweat', 'health', 'active', 'sport', 'sports', 'yoga', 'body', 'mind', 'wellness', 'athlete', 'workout']
  const creativeKeywords = ['design', 'art', 'studio', 'creative', 'media', 'pixel', 'video', 'photo', 'draw', 'branding', 'logo', 'graphics', 'canvas', 'craft', 'agency']
  const foodKeywords = ['eat', 'food', 'drink', 'cafe', 'coffee', 'kitchen', 'brew', 'restaurant', 'recipe', 'cooking', 'bake', 'bakery', 'sip', 'taste', 'dish']
  const travelKeywords = ['travel', 'trip', 'wander', 'fly', 'explore', 'hike', 'camp', 'path', 'road', 'map', 'tour', 'tours', 'booking', 'flight', 'stay']
  const brandKeywords = ['domain', 'domains', 'social', 'socials', 'handle', 'handles', 'brand', 'brands', 'naming', 'name', 'names', 'checking', 'check', 'finder', 'find']

  if (brandKeywords.some((kw) => descLower.includes(kw))) category = 'branding'
  else if (techKeywords.some((kw) => descLower.includes(kw))) category = 'tech'
  else if (financeKeywords.some((kw) => descLower.includes(kw))) category = 'finance'
  else if (fitnessKeywords.some((kw) => descLower.includes(kw))) category = 'fitness'
  else if (creativeKeywords.some((kw) => descLower.includes(kw))) category = 'creative'
  else if (foodKeywords.some((kw) => descLower.includes(kw))) category = 'food'
  else if (travelKeywords.some((kw) => descLower.includes(kw))) category = 'travel'

  const dropVowels = (word: string) => word.replace(/[aeiouAEIOU]/gi, '')
  const pluralize = (word: string) => (word.endsWith('s') ? word : word + 's')

  // Primary generation: Gemini via Netlify AI Gateway
  try {
    let baseInstruction = ''
    if (baseName) {
      baseInstruction = `CRITICAL: The user has chosen a specific core name: "${baseName}". You MUST base your names around this core name. Make the names sound completely natural, fluid, and human. Create clever natural-language blends or compound words. Do NOT just stick robotic suffixes on the end (e.g. no -ify, -ly, -ear). Think like a premium lifestyle or modern consumer brand.`
    }

    const prompt = `You are an expert brand naming agency specializing in natural, elegant, and modern brand names.
The user provided the following input for their new project/company: "${description}".
${baseInstruction}

Generate exactly 15 highly creative, natural-sounding brand name ideas based on this input.
Prioritize clean portmanteaus, natural compound words, and names that roll off the tongue.
Do not use harsh or robotic suffixes. The names must sound like real, premium, approachable brands.

Return ONLY a valid JSON array of objects, where each object has:
- "text": the brand name (lowercase, letters and numbers only, no spaces, e.g. "airbnb")
- "score": an integer from 80 to 99 representing your confidence in how good it is
- "source": a short string describing the naming style (e.g. "Natural Blend", "Compound Word", "Lifestyle Name")

Do not include any markdown formatting (like \`\`\`json) or extra text. Return just the raw JSON array.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    })

    let rawText = (response.text ?? '').trim()
    if (rawText.startsWith('```json')) rawText = rawText.replace(/^```json/, '')
    if (rawText.startsWith('```')) rawText = rawText.replace(/^```/, '')
    if (rawText.endsWith('```')) rawText = rawText.replace(/```$/, '')

    const parsed = JSON.parse(rawText.trim())
    if (Array.isArray(parsed)) {
      parsed.forEach((item: any) => {
        if (item && item.text) addCandidate(item.text, item.score || 90, item.source || 'AI Synthesized')
      })
    }
  } catch (err) {
    console.error('Gemini AI failed, falling back to algorithmic generation:', (err as Error).message)
  }

  // Always mix in algorithmic logic so favorites like Vowel Drop appear.
  const mainKw = baseName ? cleanWord(baseName) : activeKeywords[0]

  if (mainKw) {
    if (mainKw.length >= 4) {
      const vowelless = dropVowels(mainKw)
      if (vowelless.length >= 3) {
        addCandidate(vowelless, 96, 'Vowel Drop')
        addCandidate(`${vowelless}app`, 85, 'Vowel Drop + App')
      }
    }

    addCandidate(pluralize(mainKw), 95, 'Plural')

    const actionPrefixes = ['get', 'use', 'make', 'try', 'build']
    actionPrefixes.forEach((pref) => addCandidate(`${pref}${mainKw}`, 90, 'Action Prefix'))

    const categoryNouns: Record<string, string[]> = {
      branding: ['name', 'brand', 'mark'],
      tech: ['stack', 'flow', 'base', 'node', 'sync', 'ops', 'dev'],
      finance: ['pay', 'vault', 'ledger', 'mint', 'wealth'],
      fitness: ['fit', 'pulse', 'peak', 'sweat'],
      creative: ['studio', 'pixel', 'craft', 'lens'],
      food: ['eats', 'kitchen', 'brew', 'taste'],
      travel: ['map', 'path', 'trip', 'go'],
      generic: ['hub', 'labs', 'studio', 'base', 'sync', 'deck'],
    }

    const nouns = categoryNouns[category] || categoryNouns.generic
    nouns.forEach((noun) => {
      if (mainKw !== noun) {
        addCandidate(`${mainKw}${noun}`, 80, 'Concept Blend')
        addCandidate(`${noun}${mainKw}`, 79, 'Concept Blend')
      }
    })
  }

  candidatesList.sort((a, b) => b.score - a.score)

  return Response.json({
    keywords: activeKeywords,
    category,
    candidates: candidatesList.slice(0, 15),
  })
}

export const config: Config = {
  path: '/api/analyze',
  method: 'POST',
}

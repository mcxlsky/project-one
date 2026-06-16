const express = require('express');
const cors = require('cors');
const dns = require('dns').promises;
const axios = require('axios');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini SDK
// It will pick up the GEMINI_API_KEY environment variable automatically.
const ai = new GoogleGenAI({});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
];

// Helper to check domain availability via DNS lookup + RDAP fallback
async function checkDomainAvailability(domain) {
  try {
    // 1. Try DNS resolve with a hard 3s timeout (default can hang 20s+)
    const dnsTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('DNS timeout'), { code: 'ETIMEOUT' })), 3000)
    );
    await Promise.race([dns.resolve(domain), dnsTimeout]);
    return 'taken'; // Resolves means it's taken
  } catch (dnsErr) {
    // If it's not a standard "not found" error, log it
    if (dnsErr.code !== 'ENOTFOUND' && dnsErr.code !== 'ENODATA') {
      console.warn(`DNS check warning for ${domain}:`, dnsErr.message);
    }

    // 2. Query RDAP to confirm availability
    try {
      const response = await axios.get(`https://rdap.org/domain/${domain}`, {
        timeout: 2000,
        validateStatus: (status) => true // Capture 404, 200, etc.
      });
      if (response.status === 404) {
        return 'available';
      } else if (response.status === 200) {
        return 'taken';
      }
      return 'available'; // Default fallback
    } catch (rdapErr) {
      console.warn(`RDAP check failed for ${domain}:`, rdapErr.message);
      return 'available'; // Fallback to available if DNS fails and RDAP errors out
    }
  }
}

// Helper to check social handle availability
// Cache for Instagram results to reuse for Threads (same Meta namespace)
const igResultCache = new Map();

async function checkSocialAvailability(platform, handle) {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  let url = '';

  // Threads shares Instagram's username namespace — derive from IG result
  if (platform === 'threads') {
    // Check if we already have an IG result cached
    if (igResultCache.has(handle)) {
      return igResultCache.get(handle);
    }
    // If not cached yet, run the IG check ourselves
    const igStatus = await checkSocialAvailability('instagram', handle);
    return igStatus;
  }

  // Instagram: Use the Web Profile API for a reliable check
  if (platform === 'instagram') {
    try {
      const igResponse = await axios.get(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${handle}`, {
        headers: {
          'User-Agent': userAgent,
          'X-IG-App-ID': '936619743392459',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 5000,
        validateStatus: (status) => true
      });

      let result;
      if (igResponse.status === 404) {
        result = 'available';
      } else if (igResponse.status === 200) {
        // Check response body for rate-limit/login-required indicators
        const igData = igResponse.data;
        if (igData && igData.require_login === true) {
          result = 'unknown';
        } else if (igData && igData.status === 'fail') {
          result = 'unknown';
        } else if (igData && igData.data && igData.data.user) {
          result = 'taken';
        } else if (igData && igData.data && igData.data.user === null) {
          result = 'available';
        } else {
          result = 'unknown';
        }
      } else if (igResponse.status === 429 || igResponse.status === 401 || igResponse.status === 403) {
        result = 'unknown';
      } else {
        result = 'unknown';
      }

      igResultCache.set(handle, result);
      return result;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        igResultCache.set(handle, 'available');
        return 'available';
      }
      // API failed — don't fall through to scraper (unreliable for Meta platforms)
      igResultCache.set(handle, 'unknown');
      return 'unknown';
    }
  }

  // All other platforms: scrape the profile page
  return scrapeProfilePage(platform, handle, userAgent);
}

async function scrapeProfilePage(platform, handle, userAgent) {
  let url = '';
  switch (platform) {
    case 'instagram':
      url = `https://www.instagram.com/${handle}/`;
      break;
    case 'x':
      url = `https://twitter.com/${handle}`;
      break;
    case 'tiktok':
      url = `https://www.tiktok.com/@${handle}`;
      break;
    case 'youtube':
      url = `https://www.youtube.com/@${handle}`;
      break;
    case 'github':
      url = `https://github.com/${handle}`;
      break;
    default:
      return 'unknown';
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 8000,
      maxRedirects: 4,
      validateStatus: (status) => true
    });

    if (response.status === 404) {
      return 'available';
    }

    if (response.status === 429) {
      return 'rate_limited';
    }

    if (response.status === 403 || response.status === 401) {
      return 'unknown';
    }

    // Check redirection URL to verify if we hit login/consent walls
    const finalUrl = (response.request && response.request.res && response.request.res.responseUrl) || url;
    const lowerFinal = finalUrl.toLowerCase();
    if (lowerFinal.includes('login') || 
        lowerFinal.includes('signin') || 
        lowerFinal.includes('accounts/login') ||
        lowerFinal.includes('/flow/login') ||
        lowerFinal.includes('consent.youtube.com') ||
        lowerFinal.includes('consent.google') ||
        lowerFinal.includes('interactiveconsent')) {
      return 'unknown'; // Indeterminate due to auth redirect wall
    }

    if (response.status === 200) {
      const body = typeof response.data === 'string' ? response.data : '';

      // Instagram: detect login wall SPA pages that return 200
      if (platform === 'instagram') {
        if (body.includes('"loginPage"') || 
            body.includes('Login • Instagram') ||
            body.includes('"viewerId":null') ||
            (body.includes('<meta property="og:url"') && body.includes('/accounts/login'))) {
          return 'unknown';
        }
      }

      // TikTok: detect not-found in body
      if (platform === 'tiktok') {
        if (body.includes("Couldn't find this account") || body.includes("user-not-found")) {
          return 'available';
        }
      }

      return 'taken';
    }

    return 'taken';
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) return 'available';
      if (error.response.status === 429) return 'rate_limited';
      if (error.response.status === 403 || error.response.status === 401) return 'unknown';
    }
    return 'unknown';
  }
}

// API endpoint for domain checks
app.get('/api/check-domain', async (req, res) => {
  const { domain } = req.query;
  if (!domain) {
    return res.status(400).json({ error: 'Domain parameter is required' });
  }
  const status = await checkDomainAvailability(domain.toLowerCase());
  res.json({ domain, status });
});

// API endpoint for social handle checks
app.get('/api/check-social', async (req, res) => {
  const { platform, handle } = req.query;
  if (!platform || !handle) {
    return res.status(400).json({ error: 'Platform and handle parameters are required' });
  }
  const status = await checkSocialAvailability(platform.toLowerCase(), handle.toLowerCase());
  res.json({ platform, handle, status });
});

// API endpoint to generate suggestions (legacy fallback/unused on chatbot page)
app.get('/api/suggest', (req, res) => {
  const { name, category } = req.query;
  if (!name) {
    return res.status(400).json({ error: 'Name parameter is required' });
  }

  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanName) {
    return res.status(400).json({ error: 'Invalid name parameter' });
  }

  let detectedCategory = category || 'auto';
  if (detectedCategory === 'auto') {
    const techKeywords = ['app', 'tech', 'dev', 'code', 'soft', 'cloud', 'system', 'data', 'io', 'ai', 'bot', 'hub', 'net'];
    const financeKeywords = ['pay', 'coin', 'bank', 'finance', 'wealth', 'invest', 'save', 'cash', 'credit'];
    const fitnessKeywords = ['fit', 'gym', 'run', 'lift', 'sweat', 'health', 'active', 'sport', 'yoga', 'body', 'mind'];
    const socialKeywords = ['club', 'social', 'meet', 'group', 'peer', 'guild', 'tribe', 'chat', 'hub'];
    const creativeKeywords = ['design', 'art', 'studio', 'creative', 'brand', 'make', 'pixel', 'draw', 'write', 'media', 'agency'];
    const foodKeywords = ['eat', 'drink', 'sip', 'bite', 'food', 'cafe', 'brew', 'coffee', 'kitchen', 'bar', 'table'];
    const travelKeywords = ['travel', 'trip', 'go', 'wander', 'fly', 'road', 'path', 'camp', 'hike', 'surf', 'explore'];

    if (techKeywords.some(kw => cleanName.includes(kw))) detectedCategory = 'tech';
    else if (financeKeywords.some(kw => cleanName.includes(kw))) detectedCategory = 'finance';
    else if (fitnessKeywords.some(kw => cleanName.includes(kw))) detectedCategory = 'fitness';
    else if (socialKeywords.some(kw => cleanName.includes(kw))) detectedCategory = 'social';
    else if (creativeKeywords.some(kw => cleanName.includes(kw))) detectedCategory = 'creative';
    else if (foodKeywords.some(kw => cleanName.includes(kw))) detectedCategory = 'food';
    else if (travelKeywords.some(kw => cleanName.includes(kw))) detectedCategory = 'travel';
  }

  let prefixes = [];
  let suffixes = [];
  let prefixType = 'Prefix';
  let suffixType = 'Suffix';

  switch (detectedCategory) {
    case 'tech':
      prefixes = ['get', 'try', 'use', 'build', 'run', 'launch'];
      suffixes = ['app', 'tech', 'ai', 'io', 'soft', 'labs', 'hq'];
      prefixType = 'Tech Verb';
      suffixType = 'Tech Suffix';
      break;
    case 'finance':
      prefixes = ['pay', 'save', 'invest', 'send', 'get', 'use'];
      suffixes = ['pay', 'coin', 'capital', 'finance', 'wallet'];
      prefixType = 'Finance Verb';
      suffixType = 'Finance Suffix';
      break;
    case 'fitness':
      prefixes = ['fit', 'train', 'sweat', 'move', 'get', 'active'];
      suffixes = ['fit', 'gym', 'club', 'active', 'studio'];
      prefixType = 'Fitness Verb';
      suffixType = 'Fitness Suffix';
      break;
    case 'social':
      prefixes = ['join', 'meet', 'connect', 'share', 'gather', 'enter'];
      suffixes = ['club', 'hub', 'net', 'network', 'circle', 'peer'];
      prefixType = 'Social Verb';
      suffixType = 'Social Suffix';
      break;
    case 'creative':
      prefixes = ['make', 'create', 'draw', 'design', 'build', 'get'];
      suffixes = ['studio', 'creative', 'design', 'media', 'agency', 'art'];
      prefixType = 'Creative Verb';
      suffixType = 'Creative Suffix';
      break;
    case 'food':
      prefixes = ['eat', 'drink', 'sip', 'bite', 'brew', 'taste', 'get'];
      suffixes = ['cafe', 'brew', 'coffee', 'kitchen', 'eats', 'bar'];
      prefixType = 'Food Verb';
      suffixType = 'Food Suffix';
      break;
    case 'travel':
      prefixes = ['go', 'fly', 'roam', 'explore', 'wander', 'travel'];
      suffixes = ['travel', 'trips', 'explore', 'tours', 'camp'];
      prefixType = 'Travel Verb';
      suffixType = 'Travel Suffix';
      break;
    default:
      prefixes = ['get', 'try', 'use', 'weare', 'join', 'my', 'the'];
      suffixes = ['hq', 'app', 'co', 'studio', 'labs', 'tech', 'ai', 'inc'];
      prefixType = 'Prefix';
      suffixType = 'Suffix';
      break;
  }

  const suggestions = [];
  const genericPremiumSuffixes = ['hq', 'labs', 'studio', 'flow', 'base', 'scale', 'alpha', 'hub'];
  genericPremiumSuffixes.forEach(suff => {
    if (!suffixes.includes(suff)) {
      suggestions.push({ text: `${cleanName}${suff}`, type: 'Premium Suffix' });
    }
  });

  prefixes.forEach(pref => {
    suggestions.push({ text: `${pref}${cleanName}`, type: prefixType });
  });

  suffixes.forEach(suff => {
    if (!suggestions.some(s => s.text === `${cleanName}${suff}`)) {
      suggestions.push({ text: `${cleanName}${suff}`, type: suffixType });
    }
  });

  if (detectedCategory === 'tech') {
    suggestions.push({ text: `get${cleanName}app`, type: 'Combo' });
  } else if (detectedCategory === 'social') {
    suggestions.push({ text: `join${cleanName}club`, type: 'Combo' });
  } else {
    suggestions.push({ text: `get${cleanName}co`, type: 'Combo' });
    suggestions.push({ text: `go${cleanName}`, type: 'Combo' });
  }

  res.json({
    original: cleanName,
    detectedCategory,
    suggestions: suggestions.slice(0, 15)
  });
});

// Comprehensive Stop Words List to filter out auxiliary/functional words
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
  // Auxiliary filler verbs & generic nouns
  'want', 'wants', 'build', 'building', 'create', 'creating', 'make', 'making', 'tool', 'tools', 'app', 'apps', 
  'startup', 'startups', 'called', 'named', 'name', 'names', 'something', 'like', 'idea', 'ideas', 'niche', 'market', 
  'helps', 'help', 'quickly', 'easily', 'fast', 'simple', 'developer', 'developers', 'platform', 'platforms',
  'software', 'service', 'services', 'company', 'companies', 'business', 'businesses', 'project', 'projects', 
  'product', 'products', 'allows', 'allow', 'allowing', 'find', 'finding', 'possible', 'search', 'searching', 
  'check', 'checking', 'all', 'every', 'people', 'user', 'users', 'person', 'someone', 'use', 'using', 'used',
  'helpful', 'great', 'awesome', 'need', 'needs', 'needed', 'describe', 'describing', 'try', 'trying', 'learn', 
  'learning', 'work', 'working', 'show', 'showing', 'see', 'seeing', 'provide', 'providing', 'tooling', 'toolset',
  'finds', 'allows', 'would', 'could', 'should', 'many', 'much', 'brand', 'brands', 'domain', 'domains', 'social', 
  'socials', 'handle', 'handles', 'username', 'usernames'
]);

function cleanWord(w) {
  let word = w.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (word.endsWith('ing') && word.length > 5) {
    word = word.slice(0, -3);
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
    word = word.slice(0, -1);
  }
  return word;
}

function extractKeywords(text) {
  if (!text) return [];
  const quotesReg = /["']([^"']+)["']/g;
  const quotedWords = [];
  let match;
  while ((match = quotesReg.exec(text)) !== null) {
    quotedWords.push(cleanWord(match[1]));
  }
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = cleanText.split(/\s+/).map(w => w.trim()).filter(w => w.length >= 3);
  const filtered = words.filter(w => !STOP_WORDS.has(w)).map(cleanWord).filter(w => w.length >= 3);
  return Array.from(new Set([...quotedWords, ...filtered])).slice(0, 5);
}

app.post('/api/analyze', async (req, res) => {
  const { description, baseName } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const keywords = extractKeywords(description);
  
  // Relax stop-word filter if we got 0 keywords, to ensure some output
  let activeKeywords = keywords;
  if (activeKeywords.length === 0) {
    const cleanText = description.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const words = cleanText.split(/\s+/).map(cleanWord).filter(w => w.length >= 3);
    activeKeywords = Array.from(new Set(words)).slice(0, 3);
  }

  if (activeKeywords.length === 0) {
    // If absolutely nothing, just default to "brand"
    activeKeywords = ['brand'];
  }

  let candidatesList = [];
  const seenTexts = new Set();

  const addCandidate = (text, score, source) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean && clean.length >= 3 && !seenTexts.has(clean)) {
      seenTexts.add(clean);
      candidatesList.push({ text: clean, score, source });
    }
  };

  const descLower = description.toLowerCase();
  let category = 'generic';
  
  const techKeywords = ['dev', 'code', 'coding', 'program', 'soft', 'cloud', 'system', 'data', 'api', 'infra', 'server', 'db', 'database', 'git', 'github', 'host', 'hosting', 'deploy', 'deployment'];
  const financeKeywords = ['pay', 'payment', 'finance', 'fintech', 'wealth', 'money', 'coin', 'crypto', 'bank', 'banking', 'ledger', 'save', 'vault', 'capital', 'fund', 'wallet'];
  const fitnessKeywords = ['fit', 'fitness', 'gym', 'run', 'lift', 'sweat', 'health', 'active', 'sport', 'sports', 'yoga', 'body', 'mind', 'wellness', 'athlete', 'workout'];
  const creativeKeywords = ['design', 'art', 'studio', 'creative', 'media', 'pixel', 'video', 'photo', 'draw', 'branding', 'logo', 'graphics', 'canvas', 'craft', 'agency'];
  const foodKeywords = ['eat', 'food', 'drink', 'cafe', 'coffee', 'kitchen', 'brew', 'restaurant', 'recipe', 'cooking', 'bake', 'bakery', 'sip', 'taste', 'dish'];
  const travelKeywords = ['travel', 'trip', 'wander', 'fly', 'explore', 'hike', 'camp', 'path', 'road', 'map', 'tour', 'tours', 'booking', 'flight', 'stay'];
  const brandKeywords = ['domain', 'domains', 'social', 'socials', 'handle', 'handles', 'brand', 'brands', 'naming', 'name', 'names', 'checking', 'check', 'finder', 'find'];

  if (brandKeywords.some(kw => descLower.includes(kw))) category = 'branding';
  else if (techKeywords.some(kw => descLower.includes(kw))) category = 'tech';
  else if (financeKeywords.some(kw => descLower.includes(kw))) category = 'finance';
  else if (fitnessKeywords.some(kw => descLower.includes(kw))) category = 'fitness';
  else if (creativeKeywords.some(kw => descLower.includes(kw))) category = 'creative';
  else if (foodKeywords.some(kw => descLower.includes(kw))) category = 'food';
  else if (travelKeywords.some(kw => descLower.includes(kw))) category = 'travel';

  // Attempt to use Gemini AI for name generation
  let aiSuccess = false;
  
  const dropVowels = (word) => word.replace(/[aeiouAEIOU]/gi, '');
  const pluralize = (word) => word.endsWith('s') ? word : word + 's';

  try {
    if (process.env.GEMINI_API_KEY) {
      let baseInstruction = '';
      if (baseName) {
        baseInstruction = `CRITICAL: The user has chosen a specific core name: "${baseName}". You MUST base your names around this core name. Make the names sound completely natural, fluid, and human. Create clever natural-language blends or compound words. Do NOT just stick robotic suffixes on the end (e.g. no -ify, -ly, -ear). Think like a premium lifestyle or modern consumer brand.`;
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

Do not include any markdown formatting (like \`\`\`json) or extra text. Return just the raw JSON array.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      let rawText = response.text;
      // Strip markdown if the AI includes it despite instructions
      if (rawText.startsWith('\`\`\`json')) rawText = rawText.replace(/^\`\`\`json/, '');
      if (rawText.startsWith('\`\`\`')) rawText = rawText.replace(/^\`\`\`/, '');
      if (rawText.endsWith('\`\`\`')) rawText = rawText.replace(/\`\`\`$/, '');
      
      const parsed = JSON.parse(rawText.trim());
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach(item => {
          if (item.text) {
            addCandidate(item.text, item.score || 90, item.source || 'AI Synthsized');
          }
        });
        aiSuccess = true;
      }
    }
  } catch (err) {
    console.error("Gemini AI failed, falling back to algorithmic generation:", err.message);
  }

  // Always mix in naive algorithmic logic to ensure favorites like Vowel Drop appear
  if (true) {
    const mainKw = baseName ? cleanWord(baseName) : activeKeywords[0];
    const secondaryKw = baseName 
      ? activeKeywords.filter(k => k !== cleanWord(baseName))[0] || activeKeywords[1] 
      : activeKeywords[1];

    if (mainKw) {
      if (mainKw.length >= 4) {
        const vowelless = dropVowels(mainKw);
        if (vowelless.length >= 3) {
          addCandidate(vowelless, 96, 'Vowel Drop');
          addCandidate(`${vowelless}app`, 85, 'Vowel Drop + App');
        }
      }

      addCandidate(pluralize(mainKw), 95, 'Plural');

      const actionPrefixes = ['get', 'use', 'make', 'try', 'build'];
      actionPrefixes.forEach(pref => {
        addCandidate(`${pref}${mainKw}`, 90, 'Action Prefix');
      });

      const categoryNouns = {
        branding: ['name', 'brand', 'mark'],
        tech: ['stack', 'flow', 'base', 'node', 'sync', 'ops', 'dev'],
        finance: ['pay', 'vault', 'ledger', 'mint', 'wealth'],
        fitness: ['fit', 'pulse', 'peak', 'sweat'],
        creative: ['studio', 'pixel', 'craft', 'lens'],
        food: ['eats', 'kitchen', 'brew', 'taste'],
        travel: ['map', 'path', 'trip', 'go'],
        generic: ['hub', 'labs', 'studio', 'base', 'sync', 'deck']
      };

      const nouns = categoryNouns[category] || categoryNouns.generic;
      nouns.forEach(noun => {
        if (mainKw !== noun) {
          addCandidate(`${mainKw}${noun}`, 80, 'Concept Blend');
          addCandidate(`${noun}${mainKw}`, 79, 'Concept Blend');
        }
      });
    }
  }

  // Sort by initial candidate score
  candidatesList.sort((a, b) => b.score - a.score);

  // Return top 15 candidates
  res.json({
    keywords: activeKeywords,
    category,
    candidates: candidatesList.slice(0, 15)
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

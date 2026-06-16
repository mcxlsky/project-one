const DOMAINS = ['com', 'co', 'io', 'net', 'org', 'app', 'ai'];
const SOCIALS = [
  { id: 'instagram', name: 'Instagram', icon: 'fa-brands fa-instagram', urlPrefix: 'https://instagram.com/' },
  { id: 'x', name: 'X (Twitter)', icon: 'fa-brands fa-x-twitter', urlPrefix: 'https://x.com/' },
  { id: 'threads', name: 'Threads', icon: 'fa-brands fa-threads', urlPrefix: 'https://threads.net/@' },
  { id: 'tiktok', name: 'TikTok', icon: 'fa-brands fa-tiktok', urlPrefix: 'https://tiktok.com/@' },
  { id: 'youtube', name: 'YouTube', icon: 'fa-brands fa-youtube', urlPrefix: 'https://youtube.com/@' },
  { id: 'github', name: 'GitHub', icon: 'fa-brands fa-github', urlPrefix: 'https://github.com/' }
];

// Fallback logic to direct requests to localhost:3000 if page is opened as a local file
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

// State variables to track original thought and transformations
let originalWord = '';
let activeTransformedWord = '';
let searchCounter = 0;
let currentContextChip = '';

let results = {
  domains: {},
  socials: {}
};

// Selection cart tracking selected available domains and socials
let cart = {
  domains: [],
  socials: []
};

// DOM Elements
const searchForm = document.getElementById('search-form');
const brandInput = document.getElementById('brand-input');
const searchButton = document.getElementById('search-button');
const resultsDashboard = document.getElementById('results-dashboard');
const assetsList = document.getElementById('assets-list');

const statusSummary = document.getElementById('status-summary');
const exportCsvBtn = document.getElementById('export-csv-btn');
const copyReportBtn = document.getElementById('copy-report-btn');

// Best Options Elements
const bestOptionsList = document.getElementById('best-options-list');

// Brand Pack Modal Elements
const grabPackBtn = document.getElementById('grab-pack-btn');
const brandPackModal = document.getElementById('brand-pack-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalBrandName = document.getElementById('modal-brand-name');
const modalDomainsList = document.getElementById('modal-domains-list');
const modalSocialsList = document.getElementById('modal-socials-list');
const modalBulkDomainsBtn = document.getElementById('modal-bulk-domains-btn');
const modalBulkSocialsBtn = document.getElementById('modal-bulk-socials-btn');

// Cart Selection Button Updater
function updateCartButtonLabel() {
  const totalItems = cart.domains.length + cart.socials.length;
  grabPackBtn.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> Claim Brand Selection (${totalItems})`;
  if (totalItems === 0) {
    grabPackBtn.disabled = true;
    grabPackBtn.classList.add('disabled');
  } else {
    grabPackBtn.disabled = false;
    grabPackBtn.classList.remove('disabled');
  }
}

// Database of real-world domain rates for top registrars
function getDomainRates(tld) {
  const rates = {
    com: [
      { name: 'Porkbun', price: 10.37, url: (d) => `https://porkbun.com/checkout/search?q=${d}` },
      { name: 'Namecheap', price: 10.98, promo: true, url: (d) => `https://www.namecheap.com/domains/registration/results/?domain=${d}` },
      { name: 'GoDaddy', price: 11.99, promo: true, url: (d) => `https://www.godaddy.com/domainfind/search?domainToCheck=${d}` },
      { name: 'Squarespace', price: 20.00, url: (d) => `https://domains.squarespace.com/` }
    ],
    co: [
      { name: 'Namecheap', price: 9.98, promo: true, url: (d) => `https://www.namecheap.com/domains/registration/results/?domain=${d}` },
      { name: 'Porkbun', price: 22.50, url: (d) => `https://porkbun.com/checkout/search?q=${d}` },
      { name: 'Squarespace', price: 30.00, url: (d) => `https://domains.squarespace.com/` },
      { name: 'GoDaddy', price: 34.99, url: (d) => `https://www.godaddy.com/domainfind/search?domainToCheck=${d}` }
    ],
    io: [
      { name: 'Namecheap', price: 29.98, promo: true, url: (d) => `https://www.namecheap.com/domains/registration/results/?domain=${d}` },
      { name: 'Porkbun', price: 32.50, url: (d) => `https://porkbun.com/checkout/search?q=${d}` },
      { name: 'GoDaddy', price: 59.99, url: (d) => `https://www.godaddy.com/domainfind/search?domainToCheck=${d}` },
      { name: 'Squarespace', price: 60.00, url: (d) => `https://domains.squarespace.com/` }
    ],
    net: [
      { name: 'Namecheap', price: 10.98, promo: true, url: (d) => `https://www.namecheap.com/domains/registration/results/?domain=${d}` },
      { name: 'Porkbun', price: 11.50, url: (d) => `https://porkbun.com/checkout/search?q=${d}` },
      { name: 'Squarespace', price: 20.00, url: (d) => `https://domains.squarespace.com/` },
      { name: 'GoDaddy', price: 22.99, url: (d) => `https://www.godaddy.com/domainfind/search?domainToCheck=${d}` }
    ],
    org: [
      { name: 'Namecheap', price: 9.98, promo: true, url: (d) => `https://www.namecheap.com/domains/registration/results/?domain=${d}` },
      { name: 'Porkbun', price: 10.50, url: (d) => `https://porkbun.com/checkout/search?q=${d}` },
      { name: 'Squarespace', price: 20.00, url: (d) => `https://domains.squarespace.com/` },
      { name: 'GoDaddy', price: 21.99, url: (d) => `https://www.godaddy.com/domainfind/search?domainToCheck=${d}` }
    ],
    app: [
      { name: 'Namecheap', price: 12.98, promo: true, url: (d) => `https://www.namecheap.com/domains/registration/results/?domain=${d}` },
      { name: 'Porkbun', price: 14.00, url: (d) => `https://porkbun.com/checkout/search?q=${d}` },
      { name: 'Squarespace', price: 20.00, url: (d) => `https://domains.squarespace.com/` },
      { name: 'GoDaddy', price: 24.99, url: (d) => `https://www.godaddy.com/domainfind/search?domainToCheck=${d}` }
    ],
    ai: [
      { name: 'Namecheap', price: 69.98, promo: true, url: (d) => `https://www.namecheap.com/domains/registration/results/?domain=${d}` },
      { name: 'Porkbun', price: 71.50, url: (d) => `https://porkbun.com/checkout/search?q=${d}` },
      { name: 'Squarespace', price: 125.00, url: (d) => `https://domains.squarespace.com/` },
      { name: 'GoDaddy', price: 139.99, url: (d) => `https://www.godaddy.com/domainfind/search?domainToCheck=${d}` }
    ]
  };
  
  const tldRates = rates[tld] || rates['com'];
  return [...tldRates].sort((a, b) => a.price - b.price);
}

// Form Submit Handler
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const rawInput = brandInput.value.trim();
  if (rawInput || currentContextChip) {
    let finalQuery = rawInput;
    if (currentContextChip) {
      finalQuery = rawInput ? `${currentContextChip} ${rawInput}` : currentContextChip;
    }
    performBrandCheck(finalQuery);
  } else {
    searchForm.reportValidity();
  }
});

// Auto-grow textarea and dynamic hinting
brandInput.addEventListener('input', () => {
  brandInput.style.height = 'auto';
  brandInput.style.height = (brandInput.scrollHeight) + 'px';
  resultsDashboard.classList.add('hidden');
});



// Enter to submit keydown handler
brandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const rawInput = brandInput.value.trim();
    if (rawInput || currentContextChip) {
      // If there's a chip and they entered text, combine them
      let finalQuery = rawInput;
      if (currentContextChip) {
        finalQuery = rawInput ? `${currentContextChip} ${rawInput}` : currentContextChip;
      }
      performBrandCheck(finalQuery);
    } else {
      searchForm.reportValidity();
    }
  }
});

// Top candidates state tracker
let currentCandidates = [];

// Dynamic option cards renderer
function renderCandidateCards(candidates) {
  bestOptionsList.innerHTML = '';
  candidates.forEach(c => {
    const card = document.createElement('div');
    card.className = `option-card ${c.text === activeTransformedWord ? 'active' : ''}`;
    card.id = `candidate-card-${c.text}`;
    
    updateCardContent(card, c);
    
    card.addEventListener('click', () => {
      document.querySelectorAll('.option-card').forEach(el => el.classList.remove('active'));
      card.classList.add('active');
      
      activeTransformedWord = c.text;
      performDetailedBrandCheck(c.text);
    });
    
    bestOptionsList.appendChild(card);
  });
}

function updateCardContent(cardElement, c) {
  const domainStatus = c.status?.domain || 'checking';
  const igStatus = c.status?.instagram || 'checking';
  const xStatus = c.status?.x || 'checking';
  const bestTld = c.bestTld || 'com';
  
  const getIndicatorHtml = (status, label) => {
    if (status === 'available') {
      return `<span class="option-indicator available"><i class="fa-solid fa-check"></i> ${label}</span>`;
    } else if (status === 'taken') {
      return `<span class="option-indicator taken"><i class="fa-solid fa-ban"></i> ${label}</span>`;
    } else if (status === 'checking') {
      return `<span class="option-indicator checking"><i class="fa-solid fa-circle-notch fa-spin"></i> ${label}</span>`;
    } else {
      return `<span class="option-indicator taken"><i class="fa-solid fa-circle-question"></i> ${label}</span>`;
    }
  };

  const domainHtml = getIndicatorHtml(domainStatus, `.${bestTld}`);
  const igHtml = getIndicatorHtml(igStatus, 'IG');
  const xHtml = getIndicatorHtml(xStatus, 'X');
  
  let scoreHtml = '';
  if (c.isResolved) {
    scoreHtml = `${c.finalScore}% Available`;
  } else {
    scoreHtml = `<i class="fa-solid fa-circle-notch fa-spin"></i> Checking`;
  }

  cardElement.innerHTML = `
    <div class="option-card-header">
      <span class="option-card-name">${c.text}</span>
      <span class="option-card-score">${scoreHtml}</span>
    </div>
    <div class="option-card-indicators">
      ${domainHtml}
      ${igHtml}
      ${xHtml}
    </div>
  `;
}

function updateCandidateCardUI(c) {
  const card = document.getElementById(`candidate-card-${c.text}`);
  if (card) {
    updateCardContent(card, c);
  }
}

function recalculateCandidateScore(c) {
  let domainScore = 0;
  if (c.status.domain === 'available') {
    const weights = { com: 50, co: 45, io: 40, ai: 35, app: 30, net: 25, org: 20 };
    domainScore = weights[c.bestTld] || 0;
  }
  let igScore = (c.status.instagram === 'available') ? 25 : 0;
  let xScore = (c.status.x === 'available') ? 25 : 0;
  c.finalScore = domainScore + igScore + xScore;
  updateCandidateCardUI(c);
}

// Render generic skeleton cards during candidate generation checks
function renderSkeletons() {
  bestOptionsList.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const card = document.createElement('div');
    card.className = 'option-card skeleton';
    card.innerHTML = `
      <div class="option-card-header">
        <span class="option-card-name skeleton-text" style="width: 80px; height: 16px; background: #e8e8e8; border-radius: 4px; display: inline-block;"></span>
        <span class="option-card-score skeleton-text" style="width: 60px; height: 16px; background: #eef2ff; border-radius: 4px; display: inline-block;"></span>
      </div>
      <div class="option-card-indicators" style="display: flex; gap: 0.4rem; margin-top: 0.25rem;">
        <span class="option-indicator skeleton-indicator" style="width: 45px; height: 16px; background: #f3f4f6; border-radius: 4px; display: inline-block;"></span>
        <span class="option-indicator skeleton-indicator" style="width: 35px; height: 16px; background: #f3f4f6; border-radius: 4px; display: inline-block;"></span>
        <span class="option-indicator skeleton-indicator" style="width: 35px; height: 16px; background: #f3f4f6; border-radius: 4px; display: inline-block;"></span>
      </div>
      <div class="option-card-footer" style="display: flex; justify-content: space-between; margin-top: auto;">
        <span class="skeleton-text" style="width: 50px; height: 12px; background: #f3f4f6; border-radius: 4px; display: inline-block;"></span>
      </div>
    `;
    bestOptionsList.appendChild(card);
  }
}

async function runBackgroundScoring(candidates, searchId) {
  const promises = candidates.map(async (c) => {
    c.status = { domain: 'checking', instagram: 'checking', x: 'checking' };
    c.bestTld = 'com';
    c.isResolved = false;
    let igAvailable = false;
    let xAvailable = false;

    const pIg = fetch(`${API_BASE}/api/check-social?platform=instagram&handle=${c.text}`)
      .then(res => res.json())
      .then(data => {
        if (searchId !== searchCounter) return;
        c.status.instagram = data.status;
        if (data.status === 'available') igAvailable = true;
      })
      .catch(() => {
        if (searchId !== searchCounter) return;
        c.status.instagram = 'unknown';
      });

    const pX = fetch(`${API_BASE}/api/check-social?platform=x&handle=${c.text}`)
      .then(res => res.json())
      .then(data => {
        if (searchId !== searchCounter) return;
        c.status.x = data.status;
        if (data.status === 'available') xAvailable = true;
      })
      .catch(() => {
        if (searchId !== searchCounter) return;
        c.status.x = 'unknown';
      });

    // Check domains in parallel in priority order
    const checkDomainPriority = async () => {
      const priorityTlds = ['com', 'co', 'io', 'ai', 'app', 'net', 'org'];
      const tldPromises = priorityTlds.map(async (tld) => {
        try {
          const res = await fetch(`${API_BASE}/api/check-domain?domain=${c.text}.${tld}`);
          const data = await res.json();
          return { tld, status: data.status };
        } catch (e) {
          return { tld, status: 'taken' };
        }
      });
      
      const tldResults = await Promise.all(tldPromises);
      if (searchId !== searchCounter) return;
      
      for (const tld of priorityTlds) {
        const r = tldResults.find(x => x.tld === tld);
        if (r && r.status === 'available') {
          c.bestTld = tld;
          c.status.domain = 'available';
          return;
        }
      }
      c.bestTld = 'com';
      c.status.domain = 'taken';
    };

    await Promise.all([pIg, pX, checkDomainPriority()]);

    if (searchId !== searchCounter) return;

    // Compute availability score weights (Gold standard com=50%, co=45%, io=40%, ai=35%, app=30%, net=25%, org=20%)
    let domainScore = 0;
    if (c.status.domain === 'available') {
      const weights = { com: 50, co: 45, io: 40, ai: 35, app: 30, net: 25, org: 20 };
      domainScore = weights[c.bestTld] || 0;
    }

    let igScore = igAvailable ? 25 : 0;
    let xScore = xAvailable ? 25 : 0;

    c.finalScore = domainScore + igScore + xScore;
    c.isResolved = true;
    updateCandidateCardUI(c);
  });

  await Promise.all(promises);

  if (searchId !== searchCounter) return;

  // Re-sort the currentCandidates array based on a blended score
  // combining actual availability (finalScore) and name quality (score)
  currentCandidates.sort((a, b) => {
    const availA = a.isResolved ? a.finalScore : 0;
    const availB = b.isResolved ? b.finalScore : 0;
    const qualA = a.score || 0;
    const qualB = b.score || 0;
    
    // Give availability a slight multiplier so a great available name beats an amazing unavailable name,
    // but a truly exceptional name with a .co will beat a mediocre name with a .com
    const blendedA = (availA * 1.2) + qualA;
    const blendedB = (availB * 1.2) + qualB;
    
    if (blendedB !== blendedA) {
      return blendedB - blendedA;
    }
    return qualB - qualA;
  });

  let topCandidates = [];
  const isBrandSearch = originalWord.trim().split(/\s+/).length <= 3;
  if (isBrandSearch) {
    const exactMatchText = originalWord.toLowerCase().replace(/[^a-z0-9]/g, '');
    let exactMatchCandidate = currentCandidates.find(c => c.text === exactMatchText);
    
    if (exactMatchCandidate) {
      const otherCandidates = currentCandidates.filter(c => c.text !== exactMatchText).slice(0, 14);
      topCandidates = [exactMatchCandidate, ...otherCandidates];
    } else {
      exactMatchCandidate = {
        text: exactMatchText,
        score: 100,
        source: 'Exact Match',
        status: { domain: 'taken', instagram: 'taken', x: 'taken' },
        bestTld: 'com',
        isResolved: true,
        finalScore: 0
      };
      currentCandidates.push(exactMatchCandidate);
      const otherCandidates = currentCandidates.filter(c => c.text !== exactMatchText).slice(0, 14);
      topCandidates = [exactMatchCandidate, ...otherCandidates];
    }
  } else {
    topCandidates = currentCandidates.slice(0, 15);
  }

  // Re-render candidates in sorted order
  renderCandidateCards(topCandidates);

  // Set top sorted candidate as active
  if (topCandidates.length > 0) {
    const bestCandidate = topCandidates[0];
    activeTransformedWord = bestCandidate.text;

    // Highlight card
    document.querySelectorAll('.option-card').forEach(el => el.classList.remove('active'));
    const activeCard = document.getElementById(`candidate-card-${bestCandidate.text}`);
    if (activeCard) {
      activeCard.classList.add('active');
    }

    // Perform detailed checks
    performDetailedBrandCheck(bestCandidate.text);
  }
}

// Perform full status checks for active focused candidate
async function performDetailedBrandCheck(name) {
  results = {
    domains: {},
    socials: {}
  };

  // Clear and initialize display items
  initDashboardDisplay(name);

  // Trigger parallel checks
  const domainPromises = checkAllDomains(name);
  const socialPromises = checkAllSocials(name);
  
  await Promise.all([...domainPromises, ...socialPromises]);
  if (name !== activeTransformedWord) return;
  updateSummaryBar();
}

// Main check function
async function performBrandCheck(description) {
  if (!description) return;
  
  const thisSearchId = ++searchCounter;
  originalWord = description;
  activeTransformedWord = ''; // Clear active to prevent race conditions from previous checks

  // AI Follow-up for short context (Chip Mode)
  // Check if we don't already have a context chip and the input is 1-2 words
  const wordCount = description.trim().split(/\s+/).length;
  if (wordCount <= 2 && !currentContextChip) {
    // Create chip
    currentContextChip = description;
    const chipsContainer = document.getElementById('input-chips');
    
    chipsContainer.innerHTML = `
      <div class="context-chip">
        ${description}
        <button type="button" class="remove-chip" title="Remove"><i class="fa-solid fa-xmark"></i></button>
      </div>
    `;
    chipsContainer.style.display = 'flex';
    document.getElementById('chatbot-footer').style.display = 'flex';

    // Add remove listener
    chipsContainer.querySelector('.remove-chip').addEventListener('click', () => {
      currentContextChip = '';
      chipsContainer.innerHTML = '';
      chipsContainer.style.display = 'none';
      document.getElementById('chatbot-footer').style.display = 'none';
      resultsDashboard.classList.add('hidden');
      brandInput.value = description; // Put it back so they don't lose it
      brandInput.focus();
    });

    // Clear input and prompt for context
    brandInput.value = '';
    brandInput.setAttribute('placeholder', 'What does it do? (e.g. rental app)');
    brandInput.focus();
    
    // Hide dashboard if it was open
    resultsDashboard.classList.add('hidden');
    
    return;
  }

  // We are performing a real search now.
  // Note: We DO NOT clear currentContextChip here anymore, so it acts as a breadcrumb!
  const apiDescription = description;

  // Show loading state inside the lists while candidate checking occurs
  bestOptionsList.innerHTML = `
    <div style="padding: 1.5rem 0.25rem; color: var(--text-secondary); display:flex; align-items:center; gap:0.6rem;">
      <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--primary-blue);"></i>
      <span style="font-size: 0.95rem;">Finding the best options...</span>
    </div>
  `;
  // Clear previous results
  assetsList.innerHTML = '';

  // Generate candidates pool
  renderSkeletons();

  // Reset cart selection state
  cart = {
    domains: [],
    socials: []
  };
  updateCartButtonLabel();

  // Show dashboard (tiles are already visible above, no scroll needed)
  resultsDashboard.classList.remove('hidden');

  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        description: apiDescription,
        baseName: currentContextChip || ''
      })
    });
    
    if (thisSearchId !== searchCounter) return;

    if (!response.ok) {
      throw new Error('Failed to generate brand names.');
    }
    
    const data = await response.json();
    currentCandidates = data.candidates || [];

    // Prepend the exact match candidate for brand searches (<= 3 words) so it gets checked in parallel
    const isBrandSearch = apiDescription.trim().split(/\s+/).length <= 3;
    if (isBrandSearch) {
      const exactMatchText = apiDescription.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (exactMatchText) {
        const exists = currentCandidates.some(c => c.text === exactMatchText);
        if (!exists) {
          currentCandidates.unshift({
            text: exactMatchText,
            score: 100,
            source: 'Exact Match'
          });
        }
      }
    }

    // Immediately start detailed checks on the first candidate so
    // domains/socials populate right away without waiting for all scoring
    if (currentCandidates.length > 0) {
      const firstCandidate = currentCandidates[0];
      activeTransformedWord = firstCandidate.text;
      initDashboardDisplay(firstCandidate.text);

      // Render the first card immediately so user sees something
      renderCandidateCards(currentCandidates.slice(0, 15));
      const firstCard = document.getElementById(`candidate-card-${firstCandidate.text}`);
      if (firstCard) firstCard.classList.add('active');

      // Kick off domain/social checks for the first candidate immediately
      checkAllDomains(firstCandidate.text);
      checkAllSocials(firstCandidate.text);
    }

    runBackgroundScoring(currentCandidates, thisSearchId);
  } catch (err) {
    if (thisSearchId !== searchCounter) return;
    bestOptionsList.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-secondary); width: 100%;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.5rem; margin-bottom: 0.75rem; color: #ef4444;"></i>
        <p style="font-size: 0.95rem;">Error: ${err.message || 'Failed to connect to Hatch AI server.'}</p>
      </div>
    `;
  }
}

// Populate dashboard with initial "Checking..." status rows
function initDashboardDisplay(name) {
  assetsList.innerHTML = '';

  statusSummary.innerHTML = `
    <div class="summary-metric"><i class="fa-solid fa-spinner fa-spin"></i> Checking availability...</div>
  `;

  // Initialize Domains list
  DOMAINS.forEach(tld => {
    const domain = `${name}.${tld}`;
    results.domains[tld] = { domain, status: 'checking' };
    
    const row = document.createElement('div');
    row.className = 'result-item';
    row.id = `domain-${tld}`;
    row.dataset.type = 'domain';
    row.dataset.id = tld;
    row.innerHTML = `
      <div class="item-left">
        <div class="item-platform-icon"><i class="fa-solid fa-globe"></i></div>
        <span class="item-name">${domain}</span>
      </div>
      <div class="item-right">
        <span class="status-badge checking">
          <i class="fa-solid fa-circle-notch fa-spin"></i> Checking
        </span>
        <button class="row-action-btn disabled" disabled>
          <i class="fa-solid fa-minus"></i>
        </button>
      </div>
    `;
    assetsList.appendChild(row);
  });

  // Initialize Socials list
  SOCIALS.forEach(platform => {
    results.socials[platform.id] = { handle: name, status: 'checking' };
    
    const row = document.createElement('div');
    row.className = 'result-item';
    row.id = `social-${platform.id}`;
    row.dataset.type = 'social';
    row.dataset.id = platform.id;
    row.innerHTML = `
      <div class="item-left">
        <div class="item-platform-icon"><i class="${platform.icon}"></i></div>
        <span class="item-name">${platform.name}</span>
      </div>
      <div class="item-right">
        <span class="status-badge checking">
          <i class="fa-solid fa-circle-notch fa-spin"></i> Checking
        </span>
        <button class="row-action-btn disabled" disabled>
          <i class="fa-solid fa-minus"></i>
        </button>
      </div>
    `;
    assetsList.appendChild(row);
  });
}

// Trigger checks for domains and update GUI on response
function checkAllDomains(name) {
  let checkedCount = 0;
  return DOMAINS.map(async (tld) => {
    const domain = `${name}.${tld}`;
    try {
      const response = await fetch(`${API_BASE}/api/check-domain?domain=${domain}`);
      const data = await response.json();
      if (name !== activeTransformedWord) return;
      
      results.domains[tld].status = data.status;
      
      // Auto-select behavior removed per user request
      if (data.status === 'available') {
        // Update active candidate if this TLD is better than the current best TLD
        const activeC = currentCandidates.find(c => c.text === name);
        if (activeC) {
          const priorityTlds = ['com', 'co', 'io', 'ai', 'app', 'net', 'org'];
          const currentIdx = priorityTlds.indexOf(activeC.bestTld || 'com');
          const newIdx = priorityTlds.indexOf(tld);
          if (activeC.status.domain !== 'available' || newIdx < currentIdx || activeC.bestTld === undefined) {
            activeC.bestTld = tld;
            activeC.status.domain = 'available';
          }
          recalculateCandidateScore(activeC);
        }
      } else {
        const activeC = currentCandidates.find(c => c.text === name);
        if (activeC) {
          if (activeC.bestTld === tld) {
            activeC.status.domain = 'taken';
            const priorityTlds = ['com', 'co', 'io', 'ai', 'app', 'net', 'org'];
            let found = false;
            for (const t of priorityTlds) {
              if (results.domains[t] && results.domains[t].status === 'available') {
                activeC.bestTld = t;
                activeC.status.domain = 'available';
                found = true;
                break;
              }
            }
            if (!found) {
              activeC.bestTld = 'com';
              activeC.status.domain = 'taken';
            }
          }
          recalculateCandidateScore(activeC);
        }
      }
      
      updateItemStatus('domain', tld, data.status);
    } catch (err) {
      if (name !== activeTransformedWord) return;
      results.domains[tld].status = 'unknown';
      updateItemStatus('domain', tld, 'unknown');
    }
    checkedCount++;

    updateSummaryBar();
  });
}

// Trigger checks for socials and update GUI on response
function checkAllSocials(name) {
  let checkedCount = 0;
  return SOCIALS.map(async (platform) => {
    try {
      const response = await fetch(`${API_BASE}/api/check-social?platform=${platform.id}&handle=${name}`);
      const data = await response.json();
      if (name !== activeTransformedWord) return;

      results.socials[platform.id].status = data.status;
      
      // Auto-select behavior removed per user request
      if (data.status === 'available') {
        // Fall through
      }

      // Update active candidate status
      const activeC = currentCandidates.find(c => c.text === name);
      if (activeC) {
        if (platform.id === 'instagram') {
          activeC.status.instagram = data.status;
          recalculateCandidateScore(activeC);
        } else if (platform.id === 'x') {
          activeC.status.x = data.status;
          recalculateCandidateScore(activeC);
        }
      }
      
      updateItemStatus('social', platform.id, data.status);
    } catch (err) {
      if (name !== activeTransformedWord) return;
      results.socials[platform.id].status = 'unknown';
      updateItemStatus('social', platform.id, 'unknown');
    }
    checkedCount++;

    updateSummaryBar();
  });
}

// Helper to sort assets list
function sortAssetsList() {
  const items = Array.from(assetsList.children);
  
  const getScore = (el) => {
    const badge = el.querySelector('.status-badge');
    if (!badge) return 0;
    if (badge.classList.contains('available')) return 3;
    if (badge.classList.contains('checking')) return 2;
    if (badge.classList.contains('unknown')) return 1;
    return 0; // taken
  };

  items.sort((a, b) => {
    return getScore(b) - getScore(a);
  });

  items.forEach(item => assetsList.appendChild(item));
}

// Update single item status node in GUI
function updateItemStatus(type, id, status) {
  const element = document.getElementById(`${type}-${id}`);
  if (!element) return;

  const rightArea = element.querySelector('.item-right');
  if (!rightArea) return;

  let rightHtml = '';
  
  if (type === 'domain') {
    const domainName = `${activeTransformedWord}.${id}`;
    if (status === 'available') {
      const isSelected = cart.domains.includes(domainName);
      rightHtml = `
        <span class="status-badge available">Available</span>
        <button class="row-action-btn toggle-cart-btn ${isSelected ? 'in-cart' : ''}" 
                data-type="domain" 
                data-name="${domainName}" 
                title="${isSelected ? 'Remove from bundle' : 'Add to bundle'}">
          <i class="fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}"></i>
        </button>
      `;
    } else if (status === 'taken') {
      rightHtml = `
        <span class="status-badge taken">Taken</span>
        <a href="http://${domainName}" target="_blank" rel="noopener noreferrer" class="row-action-btn" aria-label="Visit domain">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      `;
      element.style.opacity = '0.4';
    } else {
      rightHtml = `
        <span class="status-badge unknown">Unknown</span>
        <a href="https://domains.squarespace.com/" target="_blank" rel="noopener noreferrer" class="row-action-btn" title="Verify manually">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      `;
    }
  } else {
    // Social profiles
    const platform = SOCIALS.find(p => p.id === id);
    const handleName = results.socials[id].handle;
    const url = platform ? `${platform.urlPrefix}${handleName}` : '#';

    if (status === 'available') {
      const isSelected = cart.socials.includes(id);
      rightHtml = `
        <span class="status-badge available">Available</span>
        <button class="row-action-btn toggle-cart-btn ${isSelected ? 'in-cart' : ''}" 
                data-type="social" 
                data-id="${id}" 
                title="${isSelected ? 'Remove from bundle' : 'Add to bundle'}">
          <i class="fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}"></i>
        </button>
      `;
    } else if (status === 'taken') {
      rightHtml = `
        <span class="status-badge taken">Taken</span>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="row-action-btn" aria-label="View profile">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      `;
      element.style.opacity = '0.4';
    } else {
      rightHtml = `
        <span class="status-badge unknown">Unknown</span>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="row-action-btn" aria-label="View profile">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      `;
    }
  }

  rightArea.innerHTML = rightHtml;
  
  // Sort the list so available items bubble up and taken items drop down
  sortAssetsList();
}

// Update the real-time summary statistics bar
function updateSummaryBar() {
  let available = 0;
  let taken = 0;
  let unknown = 0;
  let domainAvailable = 0;
  let domainChecking = 0;

  // Count domains
  Object.values(results.domains).forEach(d => {
    if (d.status === 'available') { available++; domainAvailable++; }
    else if (d.status === 'taken') taken++;
    else if (d.status === 'checking') domainChecking++;
    else unknown++;
  });

  // Count socials
  Object.values(results.socials).forEach(s => {
    if (s.status === 'available') available++;
    else if (s.status === 'taken') taken++;
    else if (s.status !== 'checking') unknown++;
  });

  statusSummary.innerHTML = `
    <div class="summary-metric">
      <span class="summary-metric-dot dot-available"></span>
      <span>${available} Available</span>
    </div>
    <div class="summary-metric">
      <span class="summary-metric-dot dot-taken"></span>
      <span>${taken} Taken</span>
    </div>
    ${unknown > 0 ? `
      <div class="summary-metric">
        <span class="summary-metric-dot dot-unknown"></span>
        <span>${unknown} Indeterminate</span>
      </div>
    ` : ''}
  `;

}

// Export Results to CSV format
exportCsvBtn.addEventListener('click', () => {
  const headers = ['Type', 'Service/TLD', 'Name/Address', 'Status'];
  const rows = [];

  // Add domains
  Object.keys(results.domains).forEach(tld => {
    const d = results.domains[tld];
    rows.push(['Domain', tld.toUpperCase(), d.domain, d.status]);
  });

  // Add socials
  Object.keys(results.socials).forEach(platformId => {
    const s = results.socials[platformId];
    const platform = SOCIALS.find(p => p.id === platformId);
    rows.push(['Social Profile', platform ? platform.name : platformId, s.handle, s.status]);
  });

  // Convert array to CSV string
  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  const currentBrand = activeTransformedWord || 'brand';
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `hatch_${currentBrand}_report.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// Copy summary text to clipboard
copyReportBtn.addEventListener('click', async () => {
  let text = `Hatch Availability Report: ${activeTransformedWord.toUpperCase()}\n`;
  text += `Generated on: ${new Date().toLocaleDateString()}\n`;
  text += `=========================================\n\n`;

  text += `DOMAINS:\n`;
  Object.keys(results.domains).forEach(tld => {
    const d = results.domains[tld];
    text += `- ${d.domain}: ${d.status.toUpperCase()}\n`;
  });

  text += `\nSOCIAL HANDLES:\n`;
  Object.keys(results.socials).forEach(platformId => {
    const s = results.socials[platformId];
    const platform = SOCIALS.find(p => p.id === platformId);
    text += `- ${platform ? platform.name : platformId}: ${s.status.toUpperCase()}\n`;
  });

  try {
    await navigator.clipboard.writeText(text);
    const originalText = copyReportBtn.innerHTML;
    copyReportBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    setTimeout(() => {
      copyReportBtn.innerHTML = originalText;
    }, 2000);
  } catch (err) {
    alert('Failed to copy report to clipboard.');
  }
});

// Brand Pack Modal Event Listeners
grabPackBtn.addEventListener('click', () => {
  openBrandPackModal();
});

modalCloseBtn.addEventListener('click', () => {
  brandPackModal.classList.add('hidden');
});

// Close modal when clicking outside content
brandPackModal.addEventListener('click', (e) => {
  if (e.target === brandPackModal) {
    brandPackModal.classList.add('hidden');
  }
});

function openBrandPackModal() {
  modalBrandName.textContent = activeTransformedWord;
  modalDomainsList.innerHTML = '';
  modalSocialsList.innerHTML = '';

  // 1. Populate Selected Domains List
  let availableDomainsCount = cart.domains.length;
  cart.domains.forEach(domainName => {
    const tld = domainName.split('.').pop();
    const rates = getDomainRates(tld);
    const cheapest = rates[0];
    const targetUrl = cheapest.url(domainName);
    
    const row = document.createElement('div');
    row.className = 'modal-row';
    row.innerHTML = `
      <div class="modal-row-left">
        <i class="fa-solid fa-globe" style="color: var(--success-green)"></i>
        <span>${domainName}</span>
        <span style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 0.25rem;">($${cheapest.price.toFixed(2)} via ${cheapest.name})</span>
      </div>
      <div class="modal-row-right">
        <span class="claim-badge available">Selected</span>
        <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="modal-row-btn">
          Register <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    `;
    modalDomainsList.appendChild(row);
  });

  if (availableDomainsCount === 0) {
    modalDomainsList.innerHTML = `
      <div style="padding: 1.25rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
        No domains selected. Click "+" next to available domains to select them.
      </div>
    `;
    modalBulkDomainsBtn.disabled = true;
    modalBulkDomainsBtn.classList.add('disabled');
  } else {
    modalBulkDomainsBtn.disabled = false;
    modalBulkDomainsBtn.classList.remove('disabled');
    modalBulkDomainsBtn.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> Register All ${availableDomainsCount} Selected Domains`;
  }

  // 2. Populate Selected Social Handles List
  let availableSocialsCount = 0;
  const availableSocialUrls = [];
  cart.socials.forEach(platformId => {
    const platform = SOCIALS.find(p => p.id === platformId);
    if (platform) {
      const handleName = results.socials[platformId] ? results.socials[platformId].handle : activeTransformedWord;
      const profileUrl = `${platform.urlPrefix}${handleName}`;
      availableSocialsCount++;
      availableSocialUrls.push(profileUrl);

      const row = document.createElement('div');
      row.className = 'modal-row';
      row.innerHTML = `
        <div class="modal-row-left">
          <i class="${platform.icon}" style="color: var(--primary-blue)"></i>
          <span>${platform.name} (@${handleName})</span>
        </div>
        <div class="modal-row-right">
          <span class="claim-badge available">Selected</span>
          <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="modal-row-btn">
            Claim <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
      `;
      modalSocialsList.appendChild(row);
    }
  });

  if (availableSocialsCount === 0) {
    modalSocialsList.innerHTML = `
      <div style="padding: 1.25rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
        No social handles selected. Click "+" next to available handles to select them.
      </div>
    `;
    modalBulkSocialsBtn.disabled = true;
    modalBulkSocialsBtn.classList.add('disabled');
  } else {
    modalBulkSocialsBtn.disabled = false;
    modalBulkSocialsBtn.classList.remove('disabled');
    modalBulkSocialsBtn.innerHTML = `<i class="fa-solid fa-up-right-from-square"></i> Open All ${availableSocialsCount} Selected Claim Pages`;
  }

  // Bind Bulk Action Handlers
  modalBulkDomainsBtn.onclick = () => {
    window.open(`https://domains.squarespace.com/`, '_blank');
    alert(`Forwarding to Squarespace Domains to register: \n\n${cart.domains.join('\n')}`);
  };

  modalBulkSocialsBtn.onclick = () => {
    availableSocialUrls.forEach(url => {
      window.open(url, '_blank');
    });
  };

  // Show Modal
  brandPackModal.classList.remove('hidden');
}

// Delegate cart selection toggling
resultsDashboard.addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('.toggle-cart-btn');
  if (!toggleBtn) return;
  
  const type = toggleBtn.getAttribute('data-type');
  const name = toggleBtn.getAttribute('data-name');
  const id = toggleBtn.getAttribute('data-id'); // platform id
  
  if (type === 'domain') {
    const idx = cart.domains.indexOf(name);
    if (idx > -1) {
      // Remove
      cart.domains.splice(idx, 1);
      toggleBtn.classList.remove('in-cart');
      toggleBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
      toggleBtn.title = 'Add to bundle';
    } else {
      // Add
      cart.domains.push(name);
      toggleBtn.classList.add('in-cart');
      toggleBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
      toggleBtn.title = 'Remove from bundle';
    }
  } else if (type === 'social') {
    const idx = cart.socials.indexOf(id);
    if (idx > -1) {
      // Remove
      cart.socials.splice(idx, 1);
      toggleBtn.classList.remove('in-cart');
      toggleBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
      toggleBtn.title = 'Add to bundle';
    } else {
      // Add
      cart.socials.push(id);
      toggleBtn.classList.add('in-cart');
      toggleBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
      toggleBtn.title = 'Remove from bundle';
    }
  }
  
  updateCartButtonLabel();
});

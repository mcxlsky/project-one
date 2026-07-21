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
let currentDescriptionChip = '';
// Which TLD is showing in the single domain row's extension picker
let selectedTld = 'com';

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

// Score badge shown next to the input once a name is being tested
const inputScoreBadge = document.getElementById('input-score-badge');

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
    performBrandCheck(rawInput);
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
      performBrandCheck(rawInput);
    } else {
      searchForm.reportValidity();
    }
  }
});

// How closely a candidate resembles the name the user actually typed, 0-100.
// Based on longest common subsequence so prefix/suffix blends and vowel-drops
// (e.g. "ftrschl" from "afterschool") still score highly, not just exact substrings.
function computeRelevanceScore(candidateText, baseName) {
  const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = clean(candidateText);
  const b = clean(baseName);
  if (!b) return 100;
  if (!a) return 0;

  const m = a.length;
  const n = b.length;
  const dp = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    let prev = 0;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return Math.round((dp[n] / n) * 100);
}

// Blend of availability (best open TLD + IG + X) and relevance-to-typed-name for
// whichever name is currently active, shown as a badge next to the input.
function updateInputScoreBadge() {
  if (!inputScoreBadge) return;
  if (!(currentContextChip && currentDescriptionChip) || !activeTransformedWord) {
    inputScoreBadge.style.display = 'none';
    return;
  }

  const domainEntries = Object.entries(results.domains);
  if (domainEntries.length === 0) {
    inputScoreBadge.style.display = 'none';
    return;
  }

  const socialEntries = Object.values(results.socials);
  const stillChecking = domainEntries.some(([, d]) => d.status === 'checking')
    || socialEntries.some(s => s.status === 'checking');

  if (stillChecking) {
    inputScoreBadge.textContent = 'Checking…';
    inputScoreBadge.className = 'input-score-badge checking';
    inputScoreBadge.style.display = 'inline-flex';
    return;
  }

  const weights = { com: 50, co: 45, io: 40, ai: 35, app: 30, net: 25, org: 20 };
  const priorityTlds = ['com', 'co', 'io', 'ai', 'app', 'net', 'org'];
  let domainScore = 0;
  for (const tld of priorityTlds) {
    if (results.domains[tld] && results.domains[tld].status === 'available') {
      domainScore = weights[tld];
      break;
    }
  }
  const igScore = results.socials.instagram && results.socials.instagram.status === 'available' ? 25 : 0;
  const xScore = results.socials.x && results.socials.x.status === 'available' ? 25 : 0;
  const availabilityScore = domainScore + igScore + xScore;
  const relevanceScore = computeRelevanceScore(activeTransformedWord, currentContextChip || originalWord);
  const finalScore = Math.round(availabilityScore * 0.5 + relevanceScore * 0.5);

  inputScoreBadge.textContent = `${finalScore}% Match`;
  inputScoreBadge.className = 'input-score-badge';
  inputScoreBadge.style.display = 'inline-flex';
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

// Rebuild the name/description chips row from current state
function renderInputChips() {
  const chipsContainer = document.getElementById('input-chips');
  const footer = document.getElementById('chatbot-footer');

  if (!currentContextChip) {
    chipsContainer.innerHTML = '';
    chipsContainer.style.display = 'none';
    footer.style.display = 'none';
    return;
  }

  const chips = [{ key: 'name', text: currentContextChip }];
  if (currentDescriptionChip) chips.push({ key: 'description', text: currentDescriptionChip });

  chipsContainer.innerHTML = chips.map(chip => `
    <div class="context-chip">
      ${chip.text}
      <button type="button" class="remove-chip" data-chip="${chip.key}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `).join('');
  chipsContainer.style.display = 'flex';
  footer.style.display = 'flex';

  chipsContainer.querySelectorAll('.remove-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('data-chip') === 'name') {
        // Removing the name chip resets back to the very start
        const restoreText = currentContextChip;
        currentContextChip = '';
        currentDescriptionChip = '';
        renderInputChips();
        resultsDashboard.classList.add('hidden');
        brandInput.setAttribute('placeholder', "What's your brand's name?");
        brandInput.value = restoreText;
      } else {
        // Removing the description chip drops back to the "what does it do?" step
        const restoreText = currentDescriptionChip;
        currentDescriptionChip = '';
        renderInputChips();
        resultsDashboard.classList.add('hidden');
        brandInput.setAttribute('placeholder', 'What does it do? (e.g. rental app)');
        brandInput.value = restoreText;
      }
      searchForm.classList.remove('name-line-mode');
      brandInput.focus();
    });
  });
}

// Main check function. rawInput is whatever the user just typed (may be empty
// when re-submitting with chips already in place).
function performBrandCheck(rawInput) {
  const trimmedInput = (rawInput || '').trim();
  if (!trimmedInput && !currentContextChip) return;

  const wordCount = trimmedInput ? trimmedInput.split(/\s+/).length : 0;

  // Stage 1: no name chip yet and this looks like a short name — chip it and ask what it does
  if (!currentContextChip && wordCount > 0 && wordCount <= 2) {
    currentContextChip = trimmedInput;
    renderInputChips();
    brandInput.value = '';
    brandInput.setAttribute('placeholder', 'What does it do? (e.g. rental app)');
    brandInput.focus();
    resultsDashboard.classList.add('hidden');
    return;
  }

  // Stage 2: name chip exists, no description chip yet — this input becomes the description chip
  if (currentContextChip && !currentDescriptionChip && trimmedInput) {
    currentDescriptionChip = trimmedInput;
    renderInputChips();
  } else if (currentContextChip && currentDescriptionChip && trimmedInput && trimmedInput !== currentContextChip) {
    // Stage 3: both chips already existed — the new text is a fresh brand name to check,
    // replacing the old name chip while the description stays fixed
    currentContextChip = trimmedInput;
    renderInputChips();
  }

  // We are performing a real search now — directly against the name typed/chosen,
  // no AI-generated alternates to browse anymore.
  const apiDescription = [currentContextChip, currentDescriptionChip].filter(Boolean).join(' ') || trimmedInput;
  originalWord = currentContextChip || apiDescription;
  activeTransformedWord = originalWord;

  // Once both chips exist, the input drops to a plain line showing the active name
  if (currentContextChip && currentDescriptionChip) {
    searchForm.classList.add('name-line-mode');
    brandInput.removeAttribute('placeholder');
  }
  brandInput.value = activeTransformedWord;
  brandInput.style.height = 'auto';
  brandInput.focus();

  // Reset cart selection state
  cart = {
    domains: [],
    socials: []
  };
  updateCartButtonLabel();

  // Show dashboard (tiles are already visible above, no scroll needed)
  resultsDashboard.classList.remove('hidden');

  performDetailedBrandCheck(activeTransformedWord);
}

// Populate dashboard with initial "Checking..." status rows
function initDashboardDisplay(name) {
  assetsList.innerHTML = '';

  statusSummary.innerHTML = `
    <div class="summary-metric"><i class="fa-solid fa-spinner fa-spin"></i> Checking availability...</div>
  `;

  // Initialize the single Domain row with a TLD picker (one row, all extensions checked in the background)
  selectedTld = 'com';
  DOMAINS.forEach(tld => {
    results.domains[tld] = { domain: `${name}.${tld}`, status: 'checking' };
  });

  const domainRow = document.createElement('div');
  domainRow.className = 'result-item';
  domainRow.id = 'domain-row';
  domainRow.dataset.type = 'domain';
  domainRow.innerHTML = `
    <div class="item-left">
      <div class="item-platform-icon"><i class="fa-solid fa-globe"></i></div>
      <div class="item-name-block">
        <span class="item-name">${name}</span>
        <select class="tld-select" id="tld-select">
          ${DOMAINS.map(tld => `<option value="${tld}" ${tld === selectedTld ? 'selected' : ''}>${tldOptionLabel(tld)}</option>`).join('')}
        </select>
      </div>
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
  domainRow.querySelector('#tld-select').addEventListener('change', (e) => {
    selectedTld = e.target.value;
    renderSelectedDomainStatus();
  });
  assetsList.appendChild(domainRow);

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
        <div class="item-name-block">
          <span class="item-name">${platform.name}</span>
          <span class="item-handle-row">
            <span class="item-handle" data-id="${platform.id}">@${name}</span>
            <button type="button" class="edit-handle-btn" data-id="${platform.id}" title="Use a different handle on ${platform.name}" aria-label="Edit handle for ${platform.name}">
              <i class="fa-solid fa-pen"></i>
            </button>
          </span>
        </div>
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

// Track in-flight per-row handle checks so stale responses can't clobber a newer edit
const handleEditCounter = {};

// Swap a social row's handle label for an inline input
function startEditingHandle(platformId) {
  const row = document.getElementById(`social-${platformId}`);
  if (!row) return;
  const handleRow = row.querySelector('.item-handle-row');
  if (!handleRow) return;
  const currentHandle = results.socials[platformId].handle;

  handleRow.innerHTML = `<input type="text" class="item-handle-input" value="${currentHandle}" />`;
  const input = handleRow.querySelector('.item-handle-input');
  input.focus();
  input.select();

  // Replacing the row's HTML below removes this input, which fires a synchronous
  // native blur on it — re-entering this handler while the first commit is still
  // running. Guard so only the first commit (Enter or blur) actually applies.
  let committed = false;

  const commit = () => {
    if (committed) return;
    committed = true;
    const newHandle = input.value.trim().replace(/^@/, '');
    finishEditingHandle(platformId, newHandle || currentHandle);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      committed = true;
      finishEditingHandle(platformId, currentHandle);
    }
  });
  input.addEventListener('blur', commit);
}

// Restore the static handle label + edit button for a social row
function renderHandleRow(platformId) {
  const row = document.getElementById(`social-${platformId}`);
  if (!row) return;
  const handleRow = row.querySelector('.item-handle-row');
  if (!handleRow) return;
  const platform = SOCIALS.find(p => p.id === platformId);

  handleRow.innerHTML = `
    <span class="item-handle" data-id="${platformId}">@${results.socials[platformId].handle}</span>
    <button type="button" class="edit-handle-btn" data-id="${platformId}" title="Use a different handle on ${platform ? platform.name : platformId}" aria-label="Edit handle">
      <i class="fa-solid fa-pen"></i>
    </button>
  `;
}

// Apply an edited handle for a single platform and re-check just that row
function finishEditingHandle(platformId, newHandle) {
  const platform = SOCIALS.find(p => p.id === platformId);
  if (!platform) return;

  const changed = results.socials[platformId].handle !== newHandle;
  results.socials[platformId].handle = newHandle;
  renderHandleRow(platformId);

  if (!changed) return;

  results.socials[platformId].status = 'checking';
  const row = document.getElementById(`social-${platformId}`);
  const rightArea = row ? row.querySelector('.item-right') : null;
  if (rightArea) {
    rightArea.innerHTML = `
      <span class="status-badge checking"><i class="fa-solid fa-circle-notch fa-spin"></i> Checking</span>
      <button class="row-action-btn disabled" disabled><i class="fa-solid fa-minus"></i></button>
    `;
  }

  checkSingleSocial(platform, newHandle);
}

// Check availability for one platform + handle, independent of the active candidate
async function checkSingleSocial(platform, handle) {
  const requestToken = (handleEditCounter[platform.id] = (handleEditCounter[platform.id] || 0) + 1);
  try {
    const response = await fetch(`${API_BASE}/api/check-social?platform=${platform.id}&handle=${handle}`);
    const data = await response.json();
    if (handleEditCounter[platform.id] !== requestToken) return;
    if (results.socials[platform.id].handle !== handle) return;

    results.socials[platform.id].status = data.status;
    updateItemStatus('social', platform.id, data.status);
  } catch (err) {
    if (handleEditCounter[platform.id] !== requestToken) return;
    if (results.socials[platform.id].handle !== handle) return;
    results.socials[platform.id].status = 'unknown';
    updateItemStatus('social', platform.id, 'unknown');
  }
  updateSummaryBar();
}

// Trigger checks for domains and update GUI on response
function checkAllDomains(name) {
  return DOMAINS.map(async (tld) => {
    const domain = `${name}.${tld}`;
    try {
      const response = await fetch(`${API_BASE}/api/check-domain?domain=${domain}`);
      const data = await response.json();
      if (name !== activeTransformedWord) return;

      results.domains[tld].status = data.status;
      renderTldSelectOptions();
      if (tld === selectedTld) renderSelectedDomainStatus();
    } catch (err) {
      if (name !== activeTransformedWord) return;
      results.domains[tld].status = 'unknown';
      renderTldSelectOptions();
      if (tld === selectedTld) renderSelectedDomainStatus();
    }

    updateSummaryBar();
  });
}

// Label shown for one TLD option in the extension picker, e.g. ".com — Available"
function tldOptionLabel(tld) {
  const info = results.domains[tld];
  const status = info ? info.status : 'checking';
  const statusText = status === 'available' ? 'Available'
    : status === 'taken' ? 'Taken'
    : status === 'checking' ? 'Checking…'
    : 'Unknown';
  return `.${tld} — ${statusText}`;
}

// Rebuild the extension picker's option labels as background checks resolve
function renderTldSelectOptions() {
  const select = document.getElementById('tld-select');
  if (!select) return;
  select.innerHTML = DOMAINS.map(tld =>
    `<option value="${tld}" ${tld === selectedTld ? 'selected' : ''}>${tldOptionLabel(tld)}</option>`
  ).join('');
}

// Render the status badge + action button for whichever TLD is currently selected
function renderSelectedDomainStatus() {
  const row = document.getElementById('domain-row');
  if (!row) return;
  const rightArea = row.querySelector('.item-right');
  if (!rightArea) return;

  const info = results.domains[selectedTld];
  const status = info ? info.status : 'checking';
  const domainName = info ? info.domain : `${activeTransformedWord}.${selectedTld}`;

  let rightHtml = '';
  row.style.opacity = '1';

  if (status === 'checking') {
    rightHtml = `
      <span class="status-badge checking">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Checking
      </span>
      <button class="row-action-btn disabled" disabled>
        <i class="fa-solid fa-minus"></i>
      </button>
    `;
  } else if (status === 'available') {
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
    row.style.opacity = '0.4';
  } else {
    rightHtml = `
      <span class="status-badge unknown">Unknown</span>
      <a href="https://domains.squarespace.com/" target="_blank" rel="noopener noreferrer" class="row-action-btn" title="Verify manually">
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
      </a>
    `;
  }

  rightArea.innerHTML = rightHtml;
  sortAssetsList();
}

// Trigger checks for socials and update GUI on response
function checkAllSocials(name) {
  return SOCIALS.map(async (platform) => {
    try {
      const response = await fetch(`${API_BASE}/api/check-social?platform=${platform.id}&handle=${name}`);
      const data = await response.json();
      if (name !== activeTransformedWord) return;
      // Bail if this row's handle was independently edited while the request was in flight
      if (results.socials[platform.id].handle !== name) return;

      results.socials[platform.id].status = data.status;
      updateItemStatus('social', platform.id, data.status);
    } catch (err) {
      if (name !== activeTransformedWord) return;
      if (results.socials[platform.id].handle !== name) return;
      results.socials[platform.id].status = 'unknown';
      updateItemStatus('social', platform.id, 'unknown');
    }

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

// Update a single social row's status node in the GUI (domain status is rendered
// separately by renderSelectedDomainStatus, since domains share one row with a TLD picker)
function updateItemStatus(type, id, status) {
  const element = document.getElementById(`${type}-${id}`);
  if (!element) return;

  const rightArea = element.querySelector('.item-right');
  if (!rightArea) return;

  let rightHtml = '';

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

  rightArea.innerHTML = rightHtml;

  // Sort the list so available items bubble up and taken items drop down
  sortAssetsList();
}

// Update the real-time summary statistics bar
function updateSummaryBar() {
  updateInputScoreBadge();

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

// Delegate handle editing (click the pencil or the handle text itself)
resultsDashboard.addEventListener('click', (e) => {
  const editTrigger = e.target.closest('.edit-handle-btn, .item-handle');
  if (!editTrigger) return;
  startEditingHandle(editTrigger.getAttribute('data-id'));
});

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

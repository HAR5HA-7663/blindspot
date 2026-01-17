// Blindspot - Content Script
// Injects analysis UI into web pages

const BLINDSPOT_LOGO_URL = chrome.runtime.getURL('blindspot-logo.png');

let blindspotOverlay = null;
let currentOverlayState = null; // Store current overlay state for persistence

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "promptForContext":
      showOverlay(
        createContextPromptUI(message.text, message.withScreenshot, message.screenshotOnly),
        { type: 'context', data: message }
      );
      sendResponse({ received: true });
      break;
    case "showLoading":
      showOverlay(
        createLoadingUI(message.text, message.screenshotOnly),
        { type: 'loading', data: message }
      );
      sendResponse({ received: true });
      break;
    case "showAnalysis":
      // Force remove any existing overlay first (but keep state temporarily)
      const tempOverlay = blindspotOverlay;
      blindspotOverlay = null;
      if (tempOverlay) tempOverlay.remove();

      // Small delay to ensure clean slate
      setTimeout(() => {
        showOverlay(
          createAnalysisUI(message.analysis, message.originalText, message.screenshot),
          { type: 'analysis', data: message }
        );
      }, 50);
      sendResponse({ received: true });
      break;
    case "showError":
      const tempOverlay2 = blindspotOverlay;
      blindspotOverlay = null;
      if (tempOverlay2) tempOverlay2.remove();

      setTimeout(() => {
        showOverlay(
          createErrorUI(message.error),
          { type: 'error', data: message }
        );
      }, 50);
      sendResponse({ received: true });
      break;
  }
  return true;
});

function showOverlay(content, state = null) {
  // Always remove existing overlay first
  removeOverlay();

  blindspotOverlay = document.createElement('div');
  blindspotOverlay.id = 'blindspot-overlay';
  blindspotOverlay.innerHTML = `
    <div class="blindspot-backdrop"></div>
    <div class="blindspot-modal">
      <button class="blindspot-close" aria-label="Close">&times;</button>
      <div class="blindspot-content">
        ${content}
      </div>
    </div>
  `;

  document.body.appendChild(blindspotOverlay);

  // Close handlers
  blindspotOverlay.querySelector('.blindspot-close').addEventListener('click', removeOverlay);
  blindspotOverlay.querySelector('.blindspot-backdrop').addEventListener('click', removeOverlay);

  // Escape key to close
  document.addEventListener('keydown', handleEscape);

  // Focus on input if present
  const contextInput = blindspotOverlay.querySelector('#blindspot-context-input');
  if (contextInput) {
    setTimeout(() => contextInput.focus(), 100);
  }

  // Setup tooltip handlers
  setupTooltips();

  // Save state for persistence
  if (state) {
    currentOverlayState = state;
    saveOverlayState(state);
  }
}

function setupTooltips() {
  document.querySelectorAll('.blindspot-info-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tooltip = btn.querySelector('.blindspot-tooltip');
      if (tooltip) {
        tooltip.classList.toggle('visible');
      }
    });
  });

  // Close tooltips when clicking elsewhere
  document.addEventListener('click', () => {
    document.querySelectorAll('.blindspot-tooltip.visible').forEach(t => {
      t.classList.remove('visible');
    });
  });
}

function handleEscape(e) {
  if (e.key === 'Escape') {
    removeOverlay();
  }
}

function removeOverlay() {
  if (blindspotOverlay) {
    blindspotOverlay.remove();
    blindspotOverlay = null;
    document.removeEventListener('keydown', handleEscape);
  }
  // Also remove any orphaned overlays
  const orphans = document.querySelectorAll('#blindspot-overlay');
  orphans.forEach(el => el.remove());

  // Clear saved state when explicitly closed
  currentOverlayState = null;
  clearOverlayState();
}

// NEW: Context prompt UI - asks user what decision they're facing
function createContextPromptUI(selectedText, withScreenshot, screenshotOnly = false) {
  const hasText = selectedText && selectedText.length > 0;
  const truncatedText = hasText ? (selectedText.length > 150 ? selectedText.substring(0, 150) + '...' : selectedText) : '';

  const selectedTextSection = hasText ? `
    <p class="blindspot-prompt-label">You selected:</p>
    <p class="blindspot-selected-text">"${escapeHtml(truncatedText)}"</p>
  ` : `
    <div class="blindspot-screenshot-notice">
      <span class="blindspot-screenshot-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6.76 22h10.48c2.76 0 3.86-1.69 3.99-3.75l.52-8.26A3.753 3.753 0 0 0 18 6.04c-.61 0-1.17-.35-1.45-.89l-.72-1.45C15.37 2.75 14.17 2 13.15 2h-2.29c-1.03 0-2.23.75-2.69 1.7l-.72 1.45c-.28.54-.84.89-1.45.89-1.98 0-3.58 1.55-3.75 3.5l-.52 7.75C1.57 19.66 2.97 22 6.76 22Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 8h3M12 18c1.79 0 3.25-1.46 3.25-3.25S13.79 11.5 12 11.5s-3.25 1.46-3.25 3.25S10.21 18 12 18Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span>Screenshot will be captured for context</span>
    </div>
  `;

  const questionLabel = screenshotOnly
    ? "What are you thinking about on this page?"
    : "What decision are you trying to make?";

  const placeholder = screenshotOnly
    ? "e.g., Is this product worth the price? Should I trust this website? What am I missing here?"
    : "e.g., Should I buy this? Is this a good career move? Am I overreacting to this email?";

  return `
    <div class="blindspot-context-prompt">
      <div class="blindspot-logo">
        <img src="${BLINDSPOT_LOGO_URL}" alt="Blindspot" class="blindspot-icon-img" />
        <span class="blindspot-title">Blindspot</span>
      </div>

      ${selectedTextSection}

      <div class="blindspot-context-form">
        <label class="blindspot-input-label" for="blindspot-context-input">
          ${questionLabel}
        </label>
        <textarea
          id="blindspot-context-input"
          class="blindspot-textarea"
          placeholder="${placeholder}"
          rows="3"
        ></textarea>
        <p class="blindspot-hint">This helps Blindspot understand your situation and give better advice.</p>
      </div>

      <div class="blindspot-footer">
        <button class="blindspot-btn blindspot-btn-secondary" id="blindspot-cancel-btn">
          Cancel
        </button>
        <button class="blindspot-btn blindspot-btn-primary" id="blindspot-analyze-btn"
          data-text="${escapeAttr(selectedText || '')}"
          data-screenshot="${withScreenshot}"
          data-screenshot-only="${screenshotOnly}">
          Analyze
        </button>
      </div>
    </div>
  `;
}

function createLoadingUI(text, screenshotOnly = false) {
  const hasText = text && text.length > 0;
  const truncatedText = hasText ? (text.length > 100 ? text.substring(0, 100) + '...' : text) : '';

  const textSection = hasText ? `
    <p class="blindspot-selected-text">"${escapeHtml(truncatedText)}"</p>
  ` : `
    <p class="blindspot-loading-subtext"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 4px;"><path d="M6.76 22h10.48c2.76 0 3.86-1.69 3.99-3.75l.52-8.26A3.753 3.753 0 0 0 18 6.04c-.61 0-1.17-.35-1.45-.89l-.72-1.45C15.37 2.75 14.17 2 13.15 2h-2.29c-1.03 0-2.23.75-2.69 1.7l-.72 1.45c-.28.54-.84.89-1.45.89-1.98 0-3.58 1.55-3.75 3.5l-.52 7.75C1.57 19.66 2.97 22 6.76 22Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 8h3M12 18c1.79 0 3.25-1.46 3.25-3.25S13.79 11.5 12 11.5s-3.25 1.46-3.25 3.25S10.21 18 12 18Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Using screenshot for context</p>
  `;

  return `
    <div class="blindspot-loading">
      <div class="blindspot-logo">
        <img src="${BLINDSPOT_LOGO_URL}" alt="Blindspot" class="blindspot-icon-img" />
        <span class="blindspot-title">Blindspot</span>
      </div>
      <div class="blindspot-spinner"></div>
      <p class="blindspot-loading-text">Analyzing your reasoning...</p>
      ${textSection}
    </div>
  `;
}

function createAnalysisUI(analysis, originalText, screenshot = null) {
  const biases = analysis.biases_detected || [];
  const hasBiases = biases.length > 0;

  const qualityInfo = {
    'poor': { color: '#ef4444', desc: 'Significant bias detected - reconsider your reasoning' },
    'fair': { color: '#f59e0b', desc: 'Some bias present - room for improvement' },
    'good': { color: '#22c55e', desc: 'Mostly balanced thinking with minor issues' },
    'excellent': { color: '#10b981', desc: 'Well-reasoned and balanced thinking' }
  };

  const quality = analysis.thinking_quality || 'fair';
  const qualityData = qualityInfo[quality] || qualityInfo['fair'];

  let biasesHTML = '';

  if (hasBiases) {
    biasesHTML = biases.map(bias => `
      <div class="blindspot-bias-card">
        <div class="blindspot-bias-header">
          <span class="blindspot-bias-name">${formatBiasName(bias.bias)}</span>
          <div class="blindspot-confidence-wrap">
            <span class="blindspot-confidence blindspot-confidence-${bias.confidence}">${bias.confidence}</span>
            <button class="blindspot-info-btn" type="button" aria-label="Info">
              <span class="blindspot-info-icon">i</span>
              <div class="blindspot-tooltip">
                <strong>Confidence Levels:</strong><br>
                <span class="conf-high">High</span> - Strong evidence of this bias<br>
                <span class="conf-medium">Medium</span> - Likely present<br>
                <span class="conf-low">Low</span> - Possible but uncertain
              </div>
            </button>
          </div>
        </div>
        <div class="blindspot-trigger">
          <span class="blindspot-label">Trigger:</span>
          <span class="blindspot-quote">"${escapeHtml(bias.trigger_quote)}"</span>
        </div>
        <div class="blindspot-explanation">
          ${escapeHtml(bias.explanation)}
        </div>
        <div class="blindspot-reframe">
          <span class="blindspot-reframe-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 7.89v5.66M12 21.41a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.89 2.2a5.67 5.67 0 0 1 6.22 0M9.89 4.18a3.12 3.12 0 0 1 4.22 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span class="blindspot-reframe-text">${escapeHtml(bias.reframe)}</span>
        </div>
      </div>
    `).join('');
  } else {
    biasesHTML = `
      <div class="blindspot-no-bias">
        <span class="blindspot-checkmark"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="m7.75 12 2.83 2.83 5.67-5.66" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <p>No significant biases detected in your reasoning.</p>
      </div>
    `;
  }

  // Screenshot thumbnail section
  const screenshotSection = screenshot ? `
    <div class="blindspot-screenshot-section">
      <div class="blindspot-screenshot-header">
        <span class="blindspot-screenshot-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 4px;"><path d="M6.76 22h10.48c2.76 0 3.86-1.69 3.99-3.75l.52-8.26A3.753 3.753 0 0 0 18 6.04c-.61 0-1.17-.35-1.45-.89l-.72-1.45C15.37 2.75 14.17 2 13.15 2h-2.29c-1.03 0-2.23.75-2.69 1.7l-.72 1.45c-.28.54-.84.89-1.45.89-1.98 0-3.58 1.55-3.75 3.5l-.52 7.75C1.57 19.66 2.97 22 6.76 22Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 8h3M12 18c1.79 0 3.25-1.46 3.25-3.25S13.79 11.5 12 11.5s-3.25 1.46-3.25 3.25S10.21 18 12 18Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Context Used</span>
        <button class="blindspot-screenshot-expand" id="blindspot-expand-screenshot" type="button">
          View Full
        </button>
      </div>
      <div class="blindspot-screenshot-thumb" id="blindspot-screenshot-container">
        <img src="${screenshot}" alt="Page screenshot" class="blindspot-screenshot-img" />
      </div>
    </div>
  ` : '';

  return `
    <div class="blindspot-analysis">
      <div class="blindspot-header">
        <div class="blindspot-logo">
          <img src="${BLINDSPOT_LOGO_URL}" alt="Blindspot" class="blindspot-icon-img" />
          <span class="blindspot-title">Analysis</span>
        </div>
      </div>

      <div class="blindspot-quality-section">
        <div class="blindspot-quality-badge" style="background-color: ${qualityData.color}">
          ${quality}
        </div>
        <button class="blindspot-info-btn" type="button" aria-label="Info">
          <span class="blindspot-info-icon">i</span>
          <div class="blindspot-tooltip tooltip-left">
            <strong>Thinking Quality:</strong><br>
            <span class="qual-excellent">Excellent</span> - Well-reasoned<br>
            <span class="qual-good">Good</span> - Mostly balanced<br>
            <span class="qual-fair">Fair</span> - Some bias present<br>
            <span class="qual-poor">Poor</span> - Significant bias
          </div>
        </button>
        <span class="blindspot-quality-desc">${qualityData.desc}</span>
      </div>

      <div class="blindspot-summary">
        ${escapeHtml(analysis.overall_assessment)}
      </div>

      <div class="blindspot-biases">
        ${hasBiases ? `<h3 class="blindspot-section-title">Biases Detected (${biases.length})</h3>` : ''}
        ${biasesHTML}
      </div>

      ${screenshotSection}

      <div class="blindspot-footer">
        <button class="blindspot-btn blindspot-btn-secondary" id="blindspot-copy">
          Copy Insights
        </button>
        <button class="blindspot-btn blindspot-btn-primary" id="blindspot-close-btn">
          Got It
        </button>
      </div>
    </div>
  `;
}

function createErrorUI(error) {
  return `
    <div class="blindspot-error">
      <div class="blindspot-logo">
        <img src="${BLINDSPOT_LOGO_URL}" alt="Blindspot" class="blindspot-icon-img" />
        <span class="blindspot-title">Blindspot</span>
      </div>
      <div class="blindspot-error-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 9v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.0001 21.41H5.94005C2.47005 21.41 1.02005 18.93 2.70005 15.9L5.82006 10.28L8.76005 5.00003C10.54 1.79003 13.46 1.79003 15.24 5.00003L18.18 10.29L21.3 15.91C22.98 18.94 21.52 21.42 18.06 21.42H12.0001V21.41Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.995 17h.009" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <p class="blindspot-error-message">${escapeHtml(error)}</p>
      <button class="blindspot-btn blindspot-btn-primary" id="blindspot-close-btn">
        Close
      </button>
    </div>
  `;
}

// Event delegation for dynamic buttons
document.addEventListener('click', (e) => {
  if (e.target.id === 'blindspot-close-btn' || e.target.id === 'blindspot-cancel-btn') {
    removeOverlay();
  }
  if (e.target.id === 'blindspot-copy') {
    copyInsights();
  }
  if (e.target.id === 'blindspot-analyze-btn') {
    handleAnalyzeClick(e.target);
  }
  if (e.target.id === 'blindspot-expand-screenshot' || e.target.closest('#blindspot-screenshot-container')) {
    toggleScreenshotExpand();
  }
});

// Handle Enter key in textarea
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey && e.target.id === 'blindspot-context-input') {
    const analyzeBtn = document.getElementById('blindspot-analyze-btn');
    if (analyzeBtn) {
      handleAnalyzeClick(analyzeBtn);
    }
  }
});

function handleAnalyzeClick(btn) {
  const selectedText = btn.dataset.text || '';
  const withScreenshot = btn.dataset.screenshot === 'true';
  const screenshotOnly = btn.dataset.screenshotOnly === 'true';
  const contextInput = document.getElementById('blindspot-context-input');
  const userContext = contextInput ? contextInput.value.trim() : '';

  // Show loading
  showOverlay(createLoadingUI(selectedText, screenshotOnly));

  // Send to background for analysis
  chrome.runtime.sendMessage({
    action: 'analyzeFromContent',
    text: selectedText,
    userContext: userContext,
    withScreenshot: withScreenshot,
    screenshotOnly: screenshotOnly
  }).catch(err => {
    console.error('Blindspot: Failed to send message', err);
    showOverlay(createErrorUI('Failed to connect. Please refresh the page and try again.'));
  });
}

function toggleScreenshotExpand() {
  const container = document.getElementById('blindspot-screenshot-container');
  const btn = document.getElementById('blindspot-expand-screenshot');
  if (container) {
    container.classList.toggle('expanded');
    if (btn) {
      btn.textContent = container.classList.contains('expanded') ? 'Collapse' : 'View Full';
    }
  }
}

function copyInsights() {
  const content = document.querySelector('.blindspot-analysis');
  if (content) {
    const text = content.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('blindspot-copy');
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy Insights', 2000);
      }
    });
  }
}

function formatBiasName(bias) {
  return bias
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// State persistence functions
// Note: Using URL-based key since chrome.tabs is not available in content scripts

// Check if extension context is still valid
function isExtensionContextValid() {
  try {
    // If chrome.runtime.id is undefined, context is invalidated
    return !!chrome.runtime?.id;
  } catch (e) {
    return false;
  }
}

function getStateKey() {
  // Use a hash of the current URL as the key
  const url = window.location.href;
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `blindspot_overlay_${Math.abs(hash)}`;
}

async function saveOverlayState(state) {
  if (!isExtensionContextValid()) return;
  try {
    const key = getStateKey();
    await chrome.storage.local.set({ [key]: state });
  } catch (e) {
    // Silently fail if context invalidated
    if (!e.message?.includes('Extension context invalidated')) {
      console.error('Blindspot: Failed to save overlay state', e);
    }
  }
}

async function clearOverlayState() {
  if (!isExtensionContextValid()) return;
  try {
    const key = getStateKey();
    await chrome.storage.local.remove(key);
  } catch (e) {
    // Silently fail if context invalidated
    if (!e.message?.includes('Extension context invalidated')) {
      console.error('Blindspot: Failed to clear overlay state', e);
    }
  }
}

async function restoreOverlayState() {
  // Don't attempt if extension context is invalid
  if (!isExtensionContextValid()) return;

  try {
    // Don't restore if overlay already exists
    if (blindspotOverlay) return;

    const key = getStateKey();
    const result = await chrome.storage.local.get(key);
    const state = result[key];

    if (!state) return;

    currentOverlayState = state;

    // Restore the overlay based on saved state (without saving again to avoid recursion)
    const tempState = currentOverlayState;
    currentOverlayState = null; // Temporarily clear to prevent re-saving

    switch (state.type) {
      case 'context':
        showOverlay(
          createContextPromptUI(state.data.text, state.data.withScreenshot, state.data.screenshotOnly),
          tempState
        );
        break;
      case 'loading':
        showOverlay(
          createLoadingUI(state.data.text, state.data.screenshotOnly),
          tempState
        );
        break;
      case 'analysis':
        showOverlay(
          createAnalysisUI(state.data.analysis, state.data.originalText, state.data.screenshot),
          tempState
        );
        break;
      case 'error':
        showOverlay(
          createErrorUI(state.data.error),
          tempState
        );
        break;
    }

    currentOverlayState = tempState;
  } catch (e) {
    // Silently fail if context invalidated
    if (!e.message?.includes('Extension context invalidated')) {
      console.error('Blindspot: Failed to restore overlay state', e);
    }
  }
}

// Restore overlay when page becomes visible again
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !blindspotOverlay && isExtensionContextValid()) {
    restoreOverlayState();
  }
});

// Also check when window regains focus
window.addEventListener('focus', () => {
  if (!blindspotOverlay && isExtensionContextValid()) {
    restoreOverlayState();
  }
});

// Restore overlay on page load if state exists
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (isExtensionContextValid()) {
      setTimeout(restoreOverlayState, 100);
    }
  });
} else if (isExtensionContextValid()) {
  setTimeout(restoreOverlayState, 100);
}

// ============ INTERVENTION SYSTEM ============
// Proactively detects when user might need a bias check

const INTERVENTION_CONFIG = {
  // Shopping sites (only match domain names, not URL paths)
  shoppingSites: [
    'amazon.', 'ebay.', 'walmart.', 'target.', 'bestbuy.', 'etsy.',
    'aliexpress.', 'newegg.', 'wayfair.', 'homedepot.', 'lowes.',
    'costco.', 'macys.', 'nordstrom.', 'zappos.', 'asos.', 'shein.'
  ],
  // Job/Career sites
  careerSites: [
    'linkedin.com/jobs', 'indeed.', 'glassdoor.', 'monster.', 'ziprecruiter.',
    'careers.', 'jobs.'
  ],
  // Finance sites
  financeSites: [
    'robinhood.', 'etrade.', 'fidelity.', 'schwab.', 'coinbase.',
    'binance.', 'crypto.', 'invest', 'trading'
  ],
  // Social media sites
  socialMediaSites: [
    'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com',
    'reddit.com', 'linkedin.com/feed', 'linkedin.com/posts', 'threads.net',
    'youtube.com', 'snapchat.com', 'discord.com'
  ],
  // Food delivery sites
  foodDeliverySites: [
    'doordash.', 'ubereats.', 'grubhub.', 'postmates.', 'seamless.',
    'instacart.', 'gopuff.', 'deliveroo.', 'foodpanda.'
  ],
  // Checkout indicators (URL or page content)
  checkoutIndicators: [
    'checkout', 'cart', 'basket', 'payment', 'order-review',
    'place-order', 'buy-now', 'purchase'
  ],
  // Subscription indicators
  subscriptionIndicators: [
    'subscribe', 'premium', 'pricing', 'plans', 'upgrade',
    'pro-plan', 'membership', 'trial', 'billing'
  ],
  // Sale urgency indicators (more specific phrases to avoid false positives)
  urgencyIndicators: [
    'limited time offer', 'ends soon', 'last chance', 'only 1 left', 'only 2 left',
    'only 3 left', 'left in stock', 'selling fast', 'hurry up', 'flash sale',
    'deal ends in', 'hours left', 'minutes left', 'today only', 'while supplies last',
    'act now', 'don\'t miss out', 'expires today', 'ending soon', 'almost gone'
  ],
  // Time threshold (ms) before triggering time-based intervention
  timeThreshold: 2 * 60 * 1000, // 2 minutes (for hackathon demo)
  // Cooldown between interventions (ms)
  interventionCooldown: 10 * 60 * 1000 // 10 minutes
};

let pageLoadTime = Date.now();
let lastInterventionTime = 0;
let interventionCheckInterval = null;
let hasShownTimeIntervention = false;

// Check what type of site we're on
function detectSiteType() {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  // Shopping sites - match hostname only
  for (const site of INTERVENTION_CONFIG.shoppingSites) {
    if (hostname.includes(site.replace('.', ''))) return 'shopping';
  }

  // Career sites - some need path check (like linkedin.com/jobs)
  for (const site of INTERVENTION_CONFIG.careerSites) {
    if (site.includes('/')) {
      // Site includes path, check full URL
      if ((hostname + pathname).includes(site)) return 'career';
    } else if (hostname.includes(site.replace('.', ''))) {
      return 'career';
    }
  }

  // Finance sites - match hostname
  for (const site of INTERVENTION_CONFIG.financeSites) {
    if (hostname.includes(site.replace('.', ''))) return 'finance';
  }

  // Social media - match hostname
  for (const site of INTERVENTION_CONFIG.socialMediaSites) {
    if (site.includes('/')) {
      if ((hostname + pathname).includes(site)) return 'social';
    } else if (hostname.includes(site.replace('.com', '').replace('.', ''))) {
      return 'social';
    }
  }

  // Food delivery - match hostname
  for (const site of INTERVENTION_CONFIG.foodDeliverySites) {
    if (hostname.includes(site.replace('.', ''))) return 'food';
  }

  return null;
}

// Check if we're on a subscription page
function isSubscriptionPage() {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  // Known subscription services
  const subscriptionSites = [
    'netflix.', 'hulu.', 'disneyplus.', 'hbomax.', 'spotify.', 'apple.com/tv',
    'primevideo.', 'peacock.', 'paramount', 'crunchyroll.'
  ];

  const isSubscriptionSite = subscriptionSites.some(site => hostname.includes(site.replace('.', '')));

  // URL indicators for subscription/signup flows
  const urlIndicators = [
    'pricing', 'plans', 'subscribe', 'upgrade', 'premium', 'membership',
    'signup', 'planform', 'choose', 'select-plan', 'billing', 'checkout'
  ];

  const hasUrlIndicator = urlIndicators.some(indicator => pathname.includes(indicator));

  // If on a known subscription site with signup-like URL, trigger
  if (isSubscriptionSite && hasUrlIndicator) return true;

  // For other sites, check for pricing URL + pricing elements
  if (hasUrlIndicator) {
    const pricingElements = document.querySelectorAll(
      '[class*="price"], [class*="pricing"], [class*="plan"], ' +
      '[class*="subscription"], [data-plan], [data-price]'
    );
    return pricingElements.length >= 2;
  }

  // Also detect by page content: multiple price cards visible
  const priceText = document.body?.innerText || '';
  const priceMatches = priceText.match(/\$\d+\.?\d*\/mo|\$\d+\.?\d*\s*per\s*month/gi);
  if (priceMatches && priceMatches.length >= 2) {
    // Multiple monthly prices visible = likely a plan selection page
    const planCards = document.querySelectorAll(
      '[class*="plan"], [class*="tier"], [class*="package"], [class*="option"]'
    );
    if (planCards.length >= 2) return true;
  }

  return false;
}

// Check for urgency tactics on page
function hasUrgencyTactics() {
  const pageText = document.body?.innerText?.toLowerCase() || '';

  for (const indicator of INTERVENTION_CONFIG.urgencyIndicators) {
    if (pageText.includes(indicator)) return true;
  }

  // Check for countdown timers
  const timerElements = document.querySelectorAll(
    '[class*="countdown"], [class*="timer"], [class*="clock"], ' +
    '[class*="hurry"], [class*="urgent"], [data-countdown]'
  );

  return timerElements.length > 0;
}

// Check if we're on a checkout page
function isCheckoutPage() {
  const url = window.location.href.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const siteType = detectSiteType();

  // Only check for checkout on shopping sites
  if (siteType !== 'shopping') return false;

  // Check URL for checkout indicators
  const checkoutUrlIndicators = ['checkout', 'cart', 'basket', 'payment', 'order'];
  for (const indicator of checkoutUrlIndicators) {
    if (pathname.includes(indicator)) return true;
  }

  // Don't rely on button detection alone - too many false positives
  return false;
}

// Check if this site has been reported as false positive
async function isReportedFalsePositive(reason) {
  try {
    const { falsePositives = [] } = await chrome.storage.local.get(['falsePositives']);
    const hostname = window.location.hostname;

    // Count ALL reports for this hostname (any reason)
    const allReportsForSite = falsePositives.filter(fp => fp.hostname === hostname);

    // If reported 2+ times for ANY reason, skip ALL interventions on this site
    if (allReportsForSite.length >= 2) return true;

    // Also check specific reason
    const reportsForReason = falsePositives.filter(fp =>
      fp.hostname === hostname && fp.reason === reason
    );

    // If reported once for this specific reason, skip it
    return reportsForReason.length >= 1;
  } catch (e) {
    return false;
  }
}

// Show intervention nudge
async function showInterventionNudge(reason, siteType) {
  // Check cooldown
  if (Date.now() - lastInterventionTime < INTERVENTION_CONFIG.interventionCooldown) {
    return;
  }

  // Don't show if overlay already exists
  if (blindspotOverlay) return;

  // Check if this site has been reported as false positive
  if (await isReportedFalsePositive(reason)) {
    console.log('Blindspot: Skipping intervention - site reported as false positive');
    return;
  }

  lastInterventionTime = Date.now();

  const messages = {
    checkout: {
      title: "About to checkout?",
      subtitle: "Let's make sure this is the right decision",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M8.81 2L5.19 5.63M15.19 2l3.62 3.63" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 7.85c0-1.85.99-2 2.22-2h15.56c1.23 0 2.22.15 2.22 2 0 2.15-.99 2-2.22 2H4.22C2.99 9.85 2 10 2 7.85Z" stroke="currentColor" stroke-width="1.5"/><path d="M9.76 14v3.55M14.36 14v3.55" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M3.5 10l1.41 8.64C5.23 20.58 6 22 8.86 22h6.03c3.11 0 3.57-1.36 3.93-3.24L20.5 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      prompt: "What's driving this purchase? Is it a need or a want?"
    },
    time_shopping: {
      title: "Been browsing for a while",
      subtitle: "Taking a moment to reflect can help",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.71 15.18l-3.1-1.85c-.54-.32-.98-1.09-.98-1.72V7.51" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      prompt: "What are you looking for? Have you compared options?"
    },
    time_career: {
      title: "Job hunting check-in",
      subtitle: "Career decisions deserve careful thought",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7.99 22h8c5 0 6-2 6.48-4.46l.98-6c.62-3.12-.42-5.54-4.46-5.54H5c-4.03 0-5.07 2.42-4.46 5.54l.98 6C1.99 20 2.99 22 7.99 22Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 6V5.2C8 3.43 8 2 11.2 2h1.6C16 2 16 3.43 16 5.2V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 13v.76c0 1.02-.01 1.84-2 1.84s-2-.83-2-1.85V13c0-1 0-1 1-1h2c1 0 1 0 1 1Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21.65 11A19.478 19.478 0 0 1 14 13.77M2.62 11.27A18.853 18.853 0 0 0 10 13.76" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      prompt: "What's most important to you in your next role?"
    },
    time_finance: {
      title: "Investment check-in",
      subtitle: "Financial decisions benefit from a clear head",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 22h20" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.75 4v18h4.5V4c0-1.1-.45-2-1.8-2h-.9c-1.35 0-1.8.9-1.8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 10v12h4V10c0-1.1-.4-2-1.6-2h-.8C3.4 8 3 8.9 3 10ZM17 15v7h4v-7c0-1.1-.4-2-1.6-2h-.8c-1.2 0-1.6.9-1.6 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      prompt: "What's your strategy here? Are emotions involved?"
    },
    time_social: {
      title: "Social media check-in",
      subtitle: "How's this making you feel?",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 22H9c-4 0-5-1-5-5V7c0-4 1-5 5-5h6c4 0 5 1 5 5v10c0 4-1 5-5 5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 5.5h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 18.1a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      prompt: "Are you scrolling with purpose or just passing time? How do you feel right now?"
    },
    time_food: {
      title: "Craving check",
      subtitle: "Is this hunger or something else?",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17.98 10.79v-.9c0-3.07-2.64-5.56-5.89-5.56-3.21 0-5.82 2.44-5.89 5.46h-.28C4.29 9.79 2.9 11.18 2.9 12.91c0 1.73 1.39 3.12 3.1 3.12h11.98c1.71 0 3.1-1.4 3.1-3.12a3.08 3.08 0 0 0-3.1-3.12Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 16.03v1.92c0 1.11.9 2.01 2.01 2.01h8.98c1.11 0 2.01-.9 2.01-2.01v-1.92" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      prompt: "Are you actually hungry, or is this stress/boredom eating?"
    },
    subscription: {
      title: "Subscription alert",
      subtitle: "Recurring payments add up fast",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 8.5h20M6 16.5h2M10.5 16.5h4" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.44 3.5h11.11c3.56 0 4.45.88 4.45 4.39v8.22c0 3.51-.89 4.39-4.44 4.39H6.44c-3.55.01-4.44-.87-4.44-4.38V7.89c0-3.51.89-4.39 4.44-4.39Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      prompt: "Do you really need this? Will you use it in 3 months?"
    },
    urgency: {
      title: "Urgency tactics detected",
      subtitle: "This page is trying to rush you",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 9v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.0001 21.41H5.94005C2.47005 21.41 1.02005 18.93 2.70005 15.9L5.82006 10.28L8.76005 5.00003C10.54 1.79003 13.46 1.79003 15.24 5.00003L18.18 10.29L21.3 15.91C22.98 18.94 21.52 21.42 18.06 21.42H12.0001V21.41Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.995 17h.009" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      prompt: "Would you still want this if there was no time pressure?"
    },
    manual: {
      title: "Bias Check",
      subtitle: "Good call checking your thinking!",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3c-1.5 0-2.8.8-3.5 2-.5-.3-1-.4-1.5-.4-1.9 0-3.5 1.6-3.5 3.5 0 .5.1 1 .3 1.4-.8.6-1.3 1.6-1.3 2.6 0 1.3.7 2.4 1.8 3-.1.3-.2.6-.2 1 0 1.6 1.3 2.9 2.9 2.9.4 0 .8-.1 1.2-.2.6 1.4 2 2.3 3.6 2.3 1.6 0 3-1 3.6-2.3.4.1.8.2 1.2.2 1.6 0 2.9-1.3 2.9-2.9 0-.4-.1-.7-.2-1 1.1-.6 1.8-1.7 1.8-3 0-1-.5-2-1.3-2.6.2-.4.3-.9.3-1.4 0-1.9-1.6-3.5-3.5-3.5-.5 0-1 .1-1.5.4-.7-1.2-2-2-3.5-2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3v18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 8.5h5M7 12h5M7 15.5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 8.5h-5M17 12h-5M17 15.5h-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      prompt: "What decision are you facing right now?"
    }
  };

  const key = reason === 'checkout' ? 'checkout' :
              reason === 'subscription' ? 'subscription' :
              reason === 'urgency' ? 'urgency' :
              reason === 'manual' ? 'manual' :
              `time_${siteType || 'shopping'}`;
  const msg = messages[key] || messages.manual;

  const nudgeHTML = `
    <div class="blindspot-intervention">
      <div class="blindspot-intervention-header">
        <span class="blindspot-intervention-icon">${msg.icon}</span>
        <div class="blindspot-intervention-titles">
          <span class="blindspot-intervention-title">${msg.title}</span>
          <span class="blindspot-intervention-subtitle">${msg.subtitle}</span>
        </div>
        <button class="blindspot-intervention-dismiss" id="blindspot-dismiss-nudge">×</button>
      </div>

      <div class="blindspot-intervention-body">
        <textarea
          id="blindspot-intervention-input"
          class="blindspot-textarea"
          placeholder="${msg.prompt}"
          rows="2"
        ></textarea>
      </div>

      <div class="blindspot-intervention-actions">
        <button class="blindspot-btn blindspot-btn-ghost" id="blindspot-skip-nudge">
          Skip
        </button>
        <button class="blindspot-btn blindspot-btn-ghost blindspot-btn-report" id="blindspot-report-false"
          data-reason="${reason}" data-site="${siteType || 'unknown'}" data-url="${window.location.hostname}">
          Not helpful
        </button>
        <button class="blindspot-btn blindspot-btn-primary" id="blindspot-check-nudge">
          Check
        </button>
      </div>
    </div>
  `;

  const nudgeContainer = document.createElement('div');
  nudgeContainer.id = 'blindspot-nudge-container';
  nudgeContainer.innerHTML = nudgeHTML;
  document.body.appendChild(nudgeContainer);

  // Animate in
  requestAnimationFrame(() => {
    nudgeContainer.classList.add('visible');
  });

  // Focus input
  setTimeout(() => {
    document.getElementById('blindspot-intervention-input')?.focus();
  }, 300);
}

// Remove intervention nudge
function removeInterventionNudge() {
  const nudge = document.getElementById('blindspot-nudge-container');
  if (nudge) {
    nudge.classList.remove('visible');
    setTimeout(() => nudge.remove(), 300);
  }
}

// Handle intervention action
function handleInterventionCheck() {
  const input = document.getElementById('blindspot-intervention-input');
  const userContext = input?.value?.trim() || '';

  removeInterventionNudge();

  // Show loading and trigger analysis with screenshot
  showOverlay(createLoadingUI('', true));

  chrome.runtime.sendMessage({
    action: 'analyzeFromContent',
    text: '',
    userContext: userContext || 'User triggered a bias check while browsing',
    withScreenshot: true,
    screenshotOnly: true
  }).catch(err => {
    console.error('Blindspot: Intervention analysis failed', err);
    showOverlay(createErrorUI('Failed to analyze. Please try again.'));
  });
}

// Event listeners for intervention nudge
document.addEventListener('click', (e) => {
  if (e.target.id === 'blindspot-dismiss-nudge' || e.target.id === 'blindspot-skip-nudge') {
    removeInterventionNudge();
  }
  if (e.target.id === 'blindspot-check-nudge') {
    handleInterventionCheck();
  }
  if (e.target.id === 'blindspot-report-false') {
    reportFalsePositive(e.target);
  }
});

// Report false positive intervention
async function reportFalsePositive(btn) {
  const reason = btn.dataset.reason;
  const site = btn.dataset.site;
  const url = btn.dataset.url;

  try {
    // Get existing false positives
    const { falsePositives = [] } = await chrome.storage.local.get(['falsePositives']);

    // Add this report
    falsePositives.push({
      timestamp: Date.now(),
      reason: reason,
      siteType: site,
      hostname: url,
      fullUrl: window.location.href
    });

    // Keep last 100 reports
    const trimmed = falsePositives.slice(-100);
    await chrome.storage.local.set({ falsePositives: trimmed });

    // Show feedback
    btn.textContent = 'Reported';
    btn.disabled = true;
    btn.style.color = '#10b981';

    // Close nudge after brief delay
    setTimeout(() => {
      removeInterventionNudge();
    }, 1000);

    console.log('Blindspot: False positive reported', { reason, site, url });
  } catch (e) {
    console.error('Blindspot: Failed to report false positive', e);
  }
}

// Enter key in intervention input
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'blindspot-intervention-input') {
    e.preventDefault();
    handleInterventionCheck();
  }
});

// Keyboard shortcut: Ctrl+Shift+B for manual intervention
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'B') {
    e.preventDefault();
    showInterventionNudge('manual', null);
  }
});

// Start monitoring for interventions
async function startInterventionMonitoring() {
  if (!isExtensionContextValid()) return;

  // Check if interventions are enabled
  try {
    const { interventionSettings } = await chrome.storage.local.get(['interventionSettings']);
    const settings = interventionSettings || {
      enabled: true,
      shopping: true,
      social: true,
      food: true,
      subscription: true,
      urgency: true,
      careerFinance: true
    };

    if (!settings.enabled) return;

    const siteType = detectSiteType();

    // Check if this site type is enabled
    const siteEnabled = {
      'shopping': settings.shopping,
      'social': settings.social,
      'food': settings.food,
      'career': settings.careerFinance,
      'finance': settings.careerFinance
    };

    // Checkout detection (highest priority) - part of shopping
    if (settings.shopping && isCheckoutPage()) {
      setTimeout(async () => {
        await showInterventionNudge('checkout', siteType);
      }, 2000);
      return;
    }

    // Subscription page detection
    if (settings.subscription && isSubscriptionPage()) {
      setTimeout(async () => {
        await showInterventionNudge('subscription', siteType);
      }, 2500);
      return;
    }

    // Urgency tactics detection (only on shopping sites)
    if (settings.urgency && siteType === 'shopping') {
      setTimeout(async () => {
        if (hasUrgencyTactics() && !hasShownTimeIntervention) {
          hasShownTimeIntervention = true;
          await showInterventionNudge('urgency', siteType);
        }
      }, 3000);
    }

    // Time-based check for decision-heavy sites (only if that site type is enabled)
    if (siteType && siteEnabled[siteType]) {
      interventionCheckInterval = setInterval(async () => {
        if (hasShownTimeIntervention) return;

        const timeOnPage = Date.now() - pageLoadTime;
        if (timeOnPage >= INTERVENTION_CONFIG.timeThreshold) {
          hasShownTimeIntervention = true;
          await showInterventionNudge('time', siteType);
        }
      }, 30000); // Check every 30 seconds
    }
  } catch (e) {
    console.error('Blindspot: Failed to start intervention monitoring', e);
  }
}

// Initialize intervention system
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startInterventionMonitoring);
} else {
  startInterventionMonitoring();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (interventionCheckInterval) {
    clearInterval(interventionCheckInterval);
  }
});

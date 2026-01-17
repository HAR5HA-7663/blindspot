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
      <span class="blindspot-screenshot-icon">📸</span>
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
          📸 Analyze
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
    <p class="blindspot-loading-subtext">📸 Using screenshot for context</p>
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
          <span class="blindspot-reframe-icon">💡</span>
          <span class="blindspot-reframe-text">${escapeHtml(bias.reframe)}</span>
        </div>
      </div>
    `).join('');
  } else {
    biasesHTML = `
      <div class="blindspot-no-bias">
        <span class="blindspot-checkmark">✓</span>
        <p>No significant biases detected in your reasoning.</p>
      </div>
    `;
  }

  // Screenshot thumbnail section
  const screenshotSection = screenshot ? `
    <div class="blindspot-screenshot-section">
      <div class="blindspot-screenshot-header">
        <span class="blindspot-screenshot-label">📸 Context Used</span>
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
      <div class="blindspot-error-icon">⚠️</div>
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

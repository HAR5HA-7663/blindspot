// Blindspot - Content Script
// Injects analysis UI into web pages

let blindspotOverlay = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "showLoading":
      showOverlay(createLoadingUI(message.text));
      break;
    case "showAnalysis":
      showOverlay(createAnalysisUI(message.analysis, message.originalText));
      break;
    case "showError":
      showOverlay(createErrorUI(message.error));
      break;
  }
});

function showOverlay(content) {
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
}

function createLoadingUI(text) {
  const truncatedText = text.length > 100 ? text.substring(0, 100) + '...' : text;
  return `
    <div class="blindspot-loading">
      <div class="blindspot-logo">
        <span class="blindspot-icon">🧠</span>
        <span class="blindspot-title">Blindspot</span>
      </div>
      <div class="blindspot-spinner"></div>
      <p class="blindspot-loading-text">Analyzing your reasoning...</p>
      <p class="blindspot-selected-text">"${escapeHtml(truncatedText)}"</p>
    </div>
  `;
}

function createAnalysisUI(analysis, originalText) {
  const biases = analysis.biases_detected || [];
  const hasBiases = biases.length > 0;

  const qualityColors = {
    'poor': '#ef4444',
    'fair': '#f59e0b',
    'good': '#22c55e',
    'excellent': '#10b981'
  };

  const qualityColor = qualityColors[analysis.thinking_quality] || '#6b7280';

  let biasesHTML = '';

  if (hasBiases) {
    biasesHTML = biases.map(bias => `
      <div class="blindspot-bias-card">
        <div class="blindspot-bias-header">
          <span class="blindspot-bias-name">${formatBiasName(bias.bias)}</span>
          <span class="blindspot-confidence blindspot-confidence-${bias.confidence}">${bias.confidence}</span>
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

  return `
    <div class="blindspot-analysis">
      <div class="blindspot-header">
        <div class="blindspot-logo">
          <span class="blindspot-icon">🧠</span>
          <span class="blindspot-title">Blindspot Analysis</span>
        </div>
        <div class="blindspot-quality" style="background-color: ${qualityColor}">
          ${analysis.thinking_quality || 'analyzed'}
        </div>
      </div>

      <div class="blindspot-summary">
        ${escapeHtml(analysis.overall_assessment)}
      </div>

      <div class="blindspot-biases">
        ${hasBiases ? `<h3 class="blindspot-section-title">Biases Detected (${biases.length})</h3>` : ''}
        ${biasesHTML}
      </div>

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
        <span class="blindspot-icon">🧠</span>
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
  if (e.target.id === 'blindspot-close-btn') {
    removeOverlay();
  }
  if (e.target.id === 'blindspot-copy') {
    copyInsights();
  }
});

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

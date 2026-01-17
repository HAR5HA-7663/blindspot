// Blindspot Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const toggleKeyBtn = document.getElementById('toggle-key');
  const saveKeyBtn = document.getElementById('save-key');
  const keyStatus = document.getElementById('key-status');
  const quickText = document.getElementById('quick-text');
  const analyzeBtn = document.getElementById('analyze-btn');
  const analyzeText = document.getElementById('analyze-text');
  const analyzeLoading = document.getElementById('analyze-loading');
  const resultsSection = document.getElementById('results-section');
  const resultsContent = document.getElementById('results-content');
  const qualityBadge = document.getElementById('quality-badge');

  // Load saved API key
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (apiKey) {
    apiKeyInput.value = apiKey;
    showStatus(keyStatus, 'API key saved', 'success');
  }

  // Toggle password visibility
  toggleKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
    toggleKeyBtn.textContent = type === 'password' ? '👁️' : '🙈';
  });

  // Save API key
  saveKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showStatus(keyStatus, 'Please enter an API key', 'error');
      return;
    }
    if (!key.startsWith('sk-ant-')) {
      showStatus(keyStatus, 'Invalid key format (should start with sk-ant-)', 'error');
      return;
    }
    await chrome.storage.local.set({ apiKey: key });
    showStatus(keyStatus, 'API key saved successfully!', 'success');
  });

  // Analyze text
  analyzeBtn.addEventListener('click', async () => {
    const text = quickText.value.trim();
    if (!text) {
      alert('Please enter some text to analyze');
      return;
    }
    if (text.length < 10) {
      alert('Please enter more text (at least a sentence)');
      return;
    }

    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
      alert('Please save your API key first');
      return;
    }

    // Show loading
    analyzeBtn.disabled = true;
    analyzeText.classList.add('hidden');
    analyzeLoading.classList.remove('hidden');
    resultsSection.classList.add('hidden');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeText',
        text: text
      });

      if (response.error) {
        throw new Error(response.error);
      }

      displayResults(response.analysis);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      analyzeBtn.disabled = false;
      analyzeText.classList.remove('hidden');
      analyzeLoading.classList.add('hidden');
    }
  });

  function displayResults(analysis) {
    resultsSection.classList.remove('hidden');

    // Quality badge
    const quality = analysis.thinking_quality || 'analyzed';
    qualityBadge.textContent = quality;
    qualityBadge.className = 'quality-badge quality-' + quality;

    // Results content
    const biases = analysis.biases_detected || [];

    if (biases.length === 0) {
      resultsContent.innerHTML = `
        <div style="text-align: center; color: #059669;">
          ✓ No significant biases detected!
        </div>
        <p style="margin-top: 8px; color: #6b7280; font-size: 12px;">
          ${analysis.overall_assessment}
        </p>
      `;
    } else {
      resultsContent.innerHTML = biases.map(bias => `
        <div class="bias-item">
          <div class="bias-name">⚠️ ${formatBiasName(bias.bias)}</div>
          <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">
            ${bias.explanation}
          </div>
          <div class="bias-reframe">
            💡 ${bias.reframe}
          </div>
        </div>
      `).join('');
    }
  }

  function formatBiasName(bias) {
    return bias
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function showStatus(element, message, type) {
    element.textContent = message;
    element.className = 'status ' + type;
  }
});

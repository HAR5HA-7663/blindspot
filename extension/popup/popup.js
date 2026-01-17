// Blindspot Popup Script - Onboarding & Main UI

let currentStep = 1;
let collectedData = {};

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  // Set up all event listeners first
  setupEventListeners();

  // Check if onboarding is complete
  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkOnboarding' });
    if (response && response.onboardingComplete) {
      showMainView();
    } else {
      showOnboardingView();
    }
  } catch (error) {
    console.log('First run, showing onboarding');
    showOnboardingView();
  }
});

// ============ EVENT LISTENERS ============

function setupEventListeners() {
  // Step 1: Get Started button
  document.getElementById('btn-get-started')?.addEventListener('click', () => nextStep(2));

  // Step 2: API Key
  document.getElementById('btn-back-to-1')?.addEventListener('click', () => nextStep(1));
  document.getElementById('btn-validate-api')?.addEventListener('click', validateAndNext);
  document.getElementById('toggle-api-key')?.addEventListener('click', toggleApiKey);

  // Step 3: Personal Info
  document.getElementById('btn-back-to-2')?.addEventListener('click', () => nextStep(2));
  document.getElementById('btn-to-step-4')?.addEventListener('click', () => nextStep(4));

  // Step 4: Thinking Patterns
  document.getElementById('btn-back-to-3')?.addEventListener('click', () => nextStep(3));
  document.getElementById('btn-to-step-5')?.addEventListener('click', () => nextStep(5));

  // Step 5: Goals
  document.getElementById('btn-back-to-4')?.addEventListener('click', () => nextStep(4));
  document.getElementById('btn-complete')?.addEventListener('click', completeOnboarding);

  // Step 6: Complete
  document.getElementById('btn-start-using')?.addEventListener('click', showMainView);

  // Main View
  document.getElementById('analyze-btn')?.addEventListener('click', handleAnalyze);
  document.getElementById('btn-edit-profile')?.addEventListener('click', showEditProfile);
  document.getElementById('btn-reset')?.addEventListener('click', resetOnboarding);

  // Tab Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // History
  document.getElementById('btn-clear-history')?.addEventListener('click', clearHistory);

  // Intervention Settings
  document.getElementById('setting-interventions-enabled')?.addEventListener('change', saveInterventionSettings);
  document.getElementById('setting-shopping')?.addEventListener('change', saveInterventionSettings);
  document.getElementById('setting-social')?.addEventListener('change', saveInterventionSettings);
  document.getElementById('setting-food')?.addEventListener('change', saveInterventionSettings);
  document.getElementById('setting-subscription')?.addEventListener('change', saveInterventionSettings);
  document.getElementById('setting-urgency')?.addEventListener('change', saveInterventionSettings);
  document.getElementById('setting-career-finance')?.addEventListener('change', saveInterventionSettings);

  // Edit Profile View
  document.getElementById('btn-cancel-edit')?.addEventListener('click', showMainView);
  document.getElementById('btn-save-profile')?.addEventListener('click', saveProfile);
}

// ============ VIEW MANAGEMENT ============

function showOnboardingView() {
  document.getElementById('onboarding-view').classList.remove('hidden');
  document.getElementById('main-view').classList.add('hidden');
  document.getElementById('edit-profile-view').classList.add('hidden');
}

function showMainView() {
  document.getElementById('onboarding-view').classList.add('hidden');
  document.getElementById('main-view').classList.remove('hidden');
  document.getElementById('edit-profile-view').classList.add('hidden');

  // Load stats, patterns, history, and intervention settings
  loadStats();
  loadInsights();
  loadHistory();
  loadInterventionSettings();
}

// ============ TAB NAVIGATION ============

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

// ============ STATS ============

async function loadStats() {
  try {
    const { learnedPatterns, insightsJournal = [], streakData } = await chrome.storage.local.get([
      'learnedPatterns',
      'insightsJournal',
      'streakData'
    ]);

    // Total analyses
    const totalAnalyses = learnedPatterns?.totalAnalyses || 0;
    document.getElementById('stat-analyses').textContent = totalAnalyses;

    // Total biases caught
    const totalBiases = insightsJournal.reduce((sum, entry) =>
      sum + (entry.biasesDetected?.length || 0), 0);
    document.getElementById('stat-biases').textContent = totalBiases;

    // Calculate streak
    const streak = calculateStreak(insightsJournal, streakData);
    document.getElementById('stat-streak').textContent = streak;

  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

function calculateStreak(journal, streakData) {
  if (!journal || journal.length === 0) return 0;

  // Get dates of analyses
  const dates = journal
    .map(entry => {
      const d = new Date(entry.timestamp);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
    .filter((v, i, a) => a.indexOf(v) === i) // unique dates
    .sort()
    .reverse();

  if (dates.length === 0) return 0;

  // Check if today or yesterday had analysis
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    return 0; // Streak broken
  }

  // Count consecutive days
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1].replace(/-/g, '/'));
    const currDate = new Date(dates[i].replace(/-/g, '/'));
    const diffDays = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ============ HISTORY ============

async function loadHistory() {
  const historyList = document.getElementById('history-list');

  try {
    const { insightsJournal = [] } = await chrome.storage.local.get(['insightsJournal']);

    if (insightsJournal.length === 0) {
      historyList.innerHTML = `
        <div class="history-empty">
          <span class="empty-icon">📝</span>
          <p>No analyses yet</p>
          <p class="hint">Start analyzing to build your history</p>
        </div>
      `;
      return;
    }

    // Sort by most recent first
    const sorted = [...insightsJournal].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    historyList.innerHTML = sorted.map((entry, index) => {
      const date = new Date(entry.timestamp);
      const timeAgo = getTimeAgo(date);
      const biasCount = entry.biasesDetected?.length || 0;
      const quality = entry.thinkingQuality || entry.quality || 'analyzed';
      const preview = entry.overallAssessment || entry.textPreview || 'Analysis';
      const context = entry.userContext || entry.context || '';
      const biases = entry.biasesDetected || [];

      // Build expanded content with full bias details
      const biasesHTML = biases.length > 0 ? biases.map(b => `
        <div class="history-bias-item">
          <div class="history-bias-header">
            <span class="history-bias-name">${formatBiasName(b.bias)}</span>
            <span class="history-bias-confidence conf-${b.confidence}">${b.confidence}</span>
          </div>
          ${b.triggerQuote ? `<div class="history-bias-quote">"${escapeHtml(b.triggerQuote)}"</div>` : ''}
          ${b.explanation ? `<div class="history-bias-explanation">${escapeHtml(b.explanation)}</div>` : ''}
          ${b.reframe ? `<div class="history-bias-reframe">💡 ${escapeHtml(b.reframe)}</div>` : ''}
        </div>
      `).join('') : '<div class="history-no-bias">✓ No biases detected</div>';

      return `
        <div class="history-item" data-index="${index}">
          <div class="history-item-summary">
            <div class="history-item-header">
              <span class="history-time">${timeAgo}</span>
              <span class="history-badge badge-${quality}">${quality}</span>
            </div>
            <div class="history-preview">${escapeHtml(preview)}</div>
            <div class="history-meta">
              ${biasCount > 0
                ? `<span class="history-biases">⚠️ ${biasCount} bias${biasCount > 1 ? 'es' : ''}</span>`
                : '<span class="history-clean">✓ Clean</span>'
              }
              <span class="history-expand-hint">Click to expand</span>
            </div>
          </div>
          <div class="history-item-expanded">
            ${context ? `<div class="history-context-full"><strong>Context:</strong> ${escapeHtml(context)}</div>` : ''}
            <div class="history-assessment"><strong>Assessment:</strong> ${escapeHtml(preview)}</div>
            <div class="history-biases-full">
              <strong>Biases Detected (${biasCount}):</strong>
              ${biasesHTML}
            </div>
            ${entry.pageUrl ? `<div class="history-url"><strong>Source:</strong> ${escapeHtml(entry.pageUrl)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers for expanding
    historyList.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        item.classList.toggle('expanded');
      });
    });

  } catch (e) {
    console.error('Failed to load history:', e);
    historyList.innerHTML = `<div class="history-empty"><p>Failed to load history</p></div>`;
  }
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function clearHistory() {
  if (confirm('Clear all analysis history? This cannot be undone.')) {
    await chrome.storage.local.remove(['insightsJournal']);
    await chrome.storage.local.set({
      learnedPatterns: {
        totalAnalyses: 0,
        biasFrequency: {},
        contextCategories: {}
      }
    });
    loadStats();
    loadHistory();
    loadInsights();
  }
}

// ============ INTERVENTION SETTINGS ============

async function loadInterventionSettings() {
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

    document.getElementById('setting-interventions-enabled').checked = settings.enabled;
    document.getElementById('setting-shopping').checked = settings.shopping !== false;
    document.getElementById('setting-social').checked = settings.social !== false;
    document.getElementById('setting-food').checked = settings.food !== false;
    document.getElementById('setting-subscription').checked = settings.subscription !== false;
    document.getElementById('setting-urgency').checked = settings.urgency !== false;
    document.getElementById('setting-career-finance').checked = settings.careerFinance !== false;

    // Update UI state
    updateInterventionSettingsUI(settings.enabled);
  } catch (e) {
    console.error('Failed to load intervention settings:', e);
  }
}

async function saveInterventionSettings() {
  const settings = {
    enabled: document.getElementById('setting-interventions-enabled').checked,
    shopping: document.getElementById('setting-shopping').checked,
    social: document.getElementById('setting-social').checked,
    food: document.getElementById('setting-food').checked,
    subscription: document.getElementById('setting-subscription').checked,
    urgency: document.getElementById('setting-urgency').checked,
    careerFinance: document.getElementById('setting-career-finance').checked
  };

  try {
    await chrome.storage.local.set({ interventionSettings: settings });
    updateInterventionSettingsUI(settings.enabled);
  } catch (e) {
    console.error('Failed to save intervention settings:', e);
  }
}

function updateInterventionSettingsUI(enabled) {
  const settingsGroup = document.getElementById('intervention-settings-group');
  if (settingsGroup) {
    settingsGroup.style.opacity = enabled ? '1' : '0.5';
    settingsGroup.style.pointerEvents = enabled ? 'auto' : 'none';
  }
}

// ============ INSIGHTS / LEARNED PATTERNS ============

async function loadInsights() {
  const insightsSection = document.getElementById('insights-section');
  const insightsContent = document.getElementById('insights-content');
  const insightsCount = document.getElementById('insights-count');

  try {
    const { learnedPatterns, insightsJournal = [] } = await chrome.storage.local.get(['learnedPatterns', 'insightsJournal']);

    if (!learnedPatterns || learnedPatterns.totalAnalyses < 1) {
      insightsSection.classList.add('hidden');
      return;
    }

    insightsSection.classList.remove('hidden');
    insightsCount.textContent = `${learnedPatterns.totalAnalyses} analyses`;

    let html = '';

    // Show frequent biases
    if (learnedPatterns.frequentBiases && learnedPatterns.frequentBiases.length > 0) {
      html += '<div class="insight-group">';
      html += '<div class="insight-label">Your recurring biases:</div>';
      html += '<div class="insight-biases">';
      learnedPatterns.frequentBiases.forEach(({ bias, frequency }) => {
        const formattedBias = formatBiasName(bias);
        html += `<span class="insight-bias-tag">${formattedBias} <small>${frequency}%</small></span>`;
      });
      html += '</div></div>';
    }

    // Show common decision contexts
    if (learnedPatterns.commonContexts && learnedPatterns.commonContexts.length > 0) {
      html += '<div class="insight-group">';
      html += '<div class="insight-label">Common decision types:</div>';
      html += '<div class="insight-contexts">';
      learnedPatterns.commonContexts.forEach(context => {
        html += `<span class="insight-context-tag">${context}</span>`;
      });
      html += '</div></div>';
    }

    // Show recent analyses summary
    const recentCount = Math.min(insightsJournal.length, 3);
    if (recentCount > 0) {
      const recentBiasCount = insightsJournal.slice(0, recentCount)
        .reduce((sum, i) => sum + i.biasesDetected.length, 0);
      html += `<div class="insight-summary">Last ${recentCount} analyses found ${recentBiasCount} biases</div>`;
    }

    insightsContent.innerHTML = html || '<div class="insight-summary">Keep using Blindspot to discover your patterns!</div>';

  } catch (e) {
    console.error('Failed to load insights:', e);
    insightsSection.classList.add('hidden');
  }
}

function showEditProfile() {
  chrome.runtime.sendMessage({ action: 'getProfile' }).then(({ userProfile }) => {
    document.getElementById('edit-profile-text').value = userProfile || '';
    document.getElementById('onboarding-view').classList.add('hidden');
    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('edit-profile-view').classList.remove('hidden');
  });
}

// ============ ONBOARDING STEPS ============

function nextStep(step) {
  // Hide current step
  const currentStepEl = document.getElementById(`step-${currentStep}`);
  if (currentStepEl) {
    currentStepEl.classList.add('hidden');
  }

  // Show new step
  const newStepEl = document.getElementById(`step-${step}`);
  if (newStepEl) {
    newStepEl.classList.remove('hidden');
  }

  // Update progress dots
  updateProgressDots(step);

  currentStep = step;
}

function updateProgressDots(step) {
  const dots = document.querySelectorAll('.dot');
  dots.forEach(dot => {
    const dotStep = parseInt(dot.dataset.step);
    dot.classList.toggle('active', dotStep <= step);
    dot.classList.toggle('completed', dotStep < step);
  });

  // Hide dots on completion step
  const progressDots = document.getElementById('progress-dots');
  if (progressDots) {
    if (step === 6) {
      progressDots.classList.add('hidden');
    } else {
      progressDots.classList.remove('hidden');
    }
  }
}

function toggleApiKey() {
  const input = document.getElementById('api-key');
  const btn = document.getElementById('toggle-api-key');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

function validateAndNext() {
  const apiKey = document.getElementById('api-key').value.trim();
  const errorEl = document.getElementById('api-error');

  if (!apiKey) {
    errorEl.textContent = 'Please enter your API key';
    errorEl.classList.remove('hidden');
    return;
  }

  if (!apiKey.startsWith('sk-ant-')) {
    errorEl.textContent = 'Invalid key format (should start with sk-ant-)';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');
  collectedData.apiKey = apiKey;
  nextStep(3);
}

function completeOnboarding() {
  // Collect all data
  collectedData.name = document.getElementById('user-name').value.trim() || 'User';
  collectedData.role = document.getElementById('user-role').value.trim();
  collectedData.decisions = document.getElementById('user-decisions').value.trim();
  collectedData.weaknesses = document.getElementById('user-weaknesses').value.trim();
  collectedData.goals = document.getElementById('user-goals').value.trim();
  collectedData.feedbackStyle = document.getElementById('user-style').value;

  // Collect selected biases
  const selectedBiases = [];
  document.querySelectorAll('.checkbox-group input:checked').forEach(cb => {
    selectedBiases.push(cb.value);
  });
  collectedData.proneBiases = selectedBiases;

  // Generate markdown profile
  const userProfile = generateMarkdownProfile(collectedData);

  // Save to storage
  chrome.runtime.sendMessage({
    action: 'saveOnboarding',
    apiKey: collectedData.apiKey,
    userProfile: userProfile
  }).then(() => {
    nextStep(6);
  });
}

function generateMarkdownProfile(data) {
  const biasLabels = {
    'sunk_cost': 'Sunk Cost Fallacy',
    'confirmation': 'Confirmation Bias',
    'planning': 'Planning Fallacy',
    'emotional': 'Emotional Reasoning',
    'bandwagon': 'Bandwagon Effect',
    'loss_aversion': 'Loss Aversion'
  };

  const styleLabels = {
    'direct': 'Direct and blunt',
    'supportive': 'Supportive but honest',
    'analytical': 'Analytical and logical',
    'curious': 'Socratic questioning'
  };

  let markdown = `# User Profile: ${data.name}\n\n`;

  if (data.role) {
    markdown += `## Role/Profession\n${data.role}\n\n`;
  }

  if (data.decisions) {
    markdown += `## Common Decisions\n${data.decisions}\n\n`;
  }

  if (data.proneBiases && data.proneBiases.length > 0) {
    markdown += `## Known Bias Vulnerabilities\n`;
    markdown += `**Pay extra attention to these biases:**\n`;
    data.proneBiases.forEach(bias => {
      markdown += `- ${biasLabels[bias] || bias}\n`;
    });
    markdown += `\n`;
  }

  if (data.weaknesses) {
    markdown += `## Other Decision-Making Patterns\n${data.weaknesses}\n\n`;
  }

  if (data.goals) {
    markdown += `## Current Goals\n${data.goals}\n\n`;
  }

  markdown += `## Preferred Feedback Style\n${styleLabels[data.feedbackStyle] || data.feedbackStyle}\n`;

  return markdown;
}

// ============ PROFILE MANAGEMENT ============

function saveProfile() {
  const newProfile = document.getElementById('edit-profile-text').value;
  chrome.runtime.sendMessage({
    action: 'updateProfile',
    userProfile: newProfile
  }).then(() => {
    showMainView();
  });
}

function resetOnboarding() {
  if (confirm('This will reset all your settings and profile. Are you sure?')) {
    chrome.storage.local.clear().then(() => {
      currentStep = 1;
      collectedData = {};
      // Reset all form fields
      document.querySelectorAll('input, textarea, select').forEach(el => {
        if (el.type === 'checkbox') {
          el.checked = false;
        } else {
          el.value = '';
        }
      });
      // Show step 1
      document.querySelectorAll('.step').forEach(step => step.classList.add('hidden'));
      document.getElementById('step-1').classList.remove('hidden');
      updateProgressDots(1);
      showOnboardingView();
    });
  }
}

// ============ ANALYSIS ============

async function handleAnalyze() {
  const text = document.getElementById('quick-text').value.trim();
  const analyzeBtn = document.getElementById('analyze-btn');
  const analyzeText = document.getElementById('analyze-text');
  const analyzeLoading = document.getElementById('analyze-loading');
  const resultsSection = document.getElementById('results-section');

  if (!text) {
    alert('Please enter some text to analyze');
    return;
  }

  if (text.length < 10) {
    alert('Please enter more text (at least a sentence)');
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
}

function displayResults(analysis) {
  const resultsSection = document.getElementById('results-section');
  const resultsContent = document.getElementById('results-content');
  const qualityBadge = document.getElementById('quality-badge');

  resultsSection.classList.remove('hidden');

  // Quality badge
  const quality = analysis.thinking_quality || 'analyzed';
  qualityBadge.textContent = quality;
  qualityBadge.className = 'quality-badge quality-' + quality;

  // Results content
  const biases = analysis.biases_detected || [];

  if (biases.length === 0) {
    resultsContent.innerHTML = `
      <div style="text-align: center; color: var(--success);">
        ✓ No significant biases detected!
      </div>
      <p style="margin-top: 8px; color: var(--text-secondary); font-size: 12px;">
        ${analysis.overall_assessment}
      </p>
    `;
  } else {
    resultsContent.innerHTML = biases.map(bias => `
      <div class="bias-item">
        <div class="bias-name">⚠️ ${formatBiasName(bias.bias)}</div>
        <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 4px;">
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

// Blindspot - Background Service Worker
// Handles context menu, screenshot capture, and API calls

// ============ INSIGHTS LEARNING SYSTEM ============
// Stores and learns from past analyses to provide personalized feedback

async function saveInsight(analysis, userContext, pageUrl) {
  try {
    const { insightsJournal = [] } = await chrome.storage.local.get(['insightsJournal']);

    // Extract full information from this analysis for history display
    const insight = {
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      userContext: userContext || 'Not specified',
      pageUrl: pageUrl || 'Unknown',
      thinkingQuality: analysis.thinking_quality,
      biasesDetected: (analysis.biases_detected || []).map(b => ({
        bias: b.bias,
        confidence: b.confidence,
        triggerQuote: b.trigger_quote || '',
        explanation: b.explanation || '',
        reframe: b.reframe || ''
      })),
      overallAssessment: analysis.overall_assessment
    };

    // Keep last 10 insights for history
    const updatedJournal = [insight, ...insightsJournal].slice(0, 10);

    await chrome.storage.local.set({ insightsJournal: updatedJournal });

    // Update learned patterns (use all data for patterns)
    await updateLearnedPatterns(updatedJournal);

    console.log('Blindspot: Insight saved', insight);
  } catch (e) {
    console.error('Blindspot: Failed to save insight', e);
  }
}

async function updateLearnedPatterns(journal) {
  // Filter to only last 7 days for percentage calculation
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentJournal = journal.filter(insight => insight.timestamp >= oneWeekAgo);

  // Analyze patterns across recent insights only
  const biasFrequency = {};  // Count of analyses containing each bias (not total detections)
  const contextPatterns = {};
  let totalAnalyses = recentJournal.length;

  recentJournal.forEach(insight => {
    // Count unique biases per analysis (use Set to avoid counting same bias twice in one analysis)
    const uniqueBiases = new Set(insight.biasesDetected.map(b => b.bias));
    uniqueBiases.forEach(bias => {
      biasFrequency[bias] = (biasFrequency[bias] || 0) + 1;
    });

    // Track context patterns (what types of decisions)
    const context = (insight.userContext || '').toLowerCase();
    if (context.includes('buy') || context.includes('purchase') || context.includes('spend')) {
      contextPatterns['purchase_decisions'] = (contextPatterns['purchase_decisions'] || 0) + 1;
    }
    if (context.includes('career') || context.includes('job') || context.includes('work')) {
      contextPatterns['career_decisions'] = (contextPatterns['career_decisions'] || 0) + 1;
    }
    if (context.includes('relationship') || context.includes('friend') || context.includes('family')) {
      contextPatterns['relationship_decisions'] = (contextPatterns['relationship_decisions'] || 0) + 1;
    }
  });

  // Find most common biases from last week (show all that occurred, sorted by frequency)
  const frequentBiases = Object.entries(biasFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([bias, count]) => ({
      bias,
      frequency: totalAnalyses > 0 ? Math.round((count / totalAnalyses) * 100) : 0
    }));

  // Find most common decision contexts
  const commonContexts = Object.entries(contextPatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([context, count]) => context.replace('_', ' '));

  const learnedPatterns = {
    totalAnalyses,
    frequentBiases,
    commonContexts,
    lastUpdated: Date.now()
  };

  await chrome.storage.local.set({ learnedPatterns });
}

async function getLearnedPatternsPrompt() {
  try {
    const { learnedPatterns, insightsJournal = [] } = await chrome.storage.local.get(['learnedPatterns', 'insightsJournal']);

    if (!learnedPatterns || learnedPatterns.totalAnalyses < 3) {
      return ''; // Not enough data yet
    }

    let prompt = '\n\n## LEARNED PATTERNS FROM PAST ANALYSES\n';
    prompt += `Based on ${learnedPatterns.totalAnalyses} previous analyses:\n\n`;

    if (learnedPatterns.frequentBiases.length > 0) {
      prompt += '**Recurring Biases (be extra vigilant for these):**\n';
      learnedPatterns.frequentBiases.forEach(({ bias, frequency }) => {
        prompt += `- ${bias}: Detected in ${frequency}% of past analyses\n`;
      });
      prompt += '\n';
    }

    if (learnedPatterns.commonContexts.length > 0) {
      prompt += `**Common Decision Types:** ${learnedPatterns.commonContexts.join(', ')}\n\n`;
    }

    // Add recent context for continuity
    const recentInsights = insightsJournal.slice(0, 3);
    if (recentInsights.length > 0) {
      prompt += '**Recent Analysis History:**\n';
      recentInsights.forEach((insight, i) => {
        const biases = insight.biasesDetected.map(b => b.bias).join(', ') || 'None';
        prompt += `${i + 1}. "${insight.userContext.substring(0, 50)}..." → Detected: ${biases}\n`;
      });
      prompt += '\n';
    }

    prompt += 'IMPORTANT: Reference these patterns when relevant. For example:\n';
    prompt += '- "I notice you often struggle with SUNK_COST - and I see it here again..."\n';
    prompt += '- "Based on your history, you tend to use emotional reasoning for career decisions..."\n';

    return prompt;
  } catch (e) {
    console.error('Blindspot: Failed to get learned patterns', e);
    return '';
  }
}

// ============ END LEARNING SYSTEM ============

const BIAS_SYSTEM_PROMPT = `You are Blindspot, a cognitive bias detector. Your job is to analyze text and identify cognitive biases in the user's reasoning.

When analyzing text, look for these common biases:

1. SUNK_COST - Continuing because of past investment ("I've already put so much into this", "we've come this far")
2. CONFIRMATION_BIAS - Only considering evidence that supports existing beliefs
3. PLANNING_FALLACY - Underestimating time, costs, or risks ("this will only take...", "should be easy")
4. ANCHORING - Over-relying on first piece of information
5. LOSS_AVERSION - Fearing losses more than valuing equivalent gains ("can't lose", "don't want to give up")
6. EMOTIONAL_REASONING - Using feelings as evidence ("I feel like", "my gut says")
7. BANDWAGON - Doing something because others do ("everyone is", "people say")
8. FALSE_DICHOTOMY - Presenting only two options when more exist ("either X or Y", "only choice is")
9. RECENCY_BIAS - Overweighting recent events
10. AVAILABILITY_HEURISTIC - Judging likelihood by how easily examples come to mind

Respond in this exact JSON format:
{
  "biases_detected": [
    {
      "bias": "BIAS_NAME",
      "confidence": "high|medium|low",
      "trigger_quote": "exact quote from text that shows this bias",
      "explanation": "brief explanation of why this is this bias",
      "reframe": "a question or alternative framing to help them think better"
    }
  ],
  "overall_assessment": "brief 1-2 sentence summary",
  "thinking_quality": "poor|fair|good|excellent"
}

If no biases are detected, return:
{
  "biases_detected": [],
  "overall_assessment": "Your reasoning appears balanced and well-considered.",
  "thinking_quality": "good"
}

Be direct but not harsh. You're helping them think better, not criticizing them.
Only flag biases you're confident about. Quality over quantity.`;

// Store current tab info for analysis
let pendingAnalysis = {};

// Create context menus on install
chrome.runtime.onInstalled.addListener(() => {
  // Text-only analysis (requires selection)
  chrome.contextMenus.create({
    id: "analyzeWithBlindspot",
    title: "🧠 Analyze with Blindspot",
    contexts: ["selection"]
  });

  // Screenshot + text analysis (requires selection)
  chrome.contextMenus.create({
    id: "analyzeWithScreenshot",
    title: "📸 Analyze with Screenshot",
    contexts: ["selection"]
  });

  // Screenshot-only analysis (no selection needed)
  chrome.contextMenus.create({
    id: "analyzePageWithScreenshot",
    title: "📸 Analyze Page with Blindspot",
    contexts: ["page", "image", "link"]
  });

  console.log("Blindspot installed - context menus created");
});

// Handle context menu click - show prompt for context first
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText?.trim() || '';
  const isPageScreenshot = info.menuItemId === "analyzePageWithScreenshot";

  // For text-based analysis, require text selection
  if (!isPageScreenshot && selectedText.length < 10) {
    await sendToTab(tab.id, {
      action: "showError",
      error: "Please select more text to analyze (at least a sentence)."
    });
    return;
  }

  // Check if setup is complete
  const { apiKey } = await chrome.storage.local.get(['apiKey']);
  if (!apiKey) {
    await sendToTab(tab.id, {
      action: "showError",
      error: "Please complete the setup in the extension popup first."
    });
    return;
  }

  // Store tab for later use with screenshot
  pendingAnalysis[tab.id] = {
    tabId: tab.id,
    windowId: tab.windowId
  };

  // Determine analysis type
  const withScreenshot = info.menuItemId === "analyzeWithScreenshot" || isPageScreenshot;

  // Show context prompt UI
  await sendToTab(tab.id, {
    action: "promptForContext",
    text: selectedText,
    withScreenshot: withScreenshot,
    screenshotOnly: isPageScreenshot
  });
});

// Helper to safely send message to tab
async function sendToTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.error("Failed to send message to tab:", error);
    // Try injecting content script and retry
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['styles.css']
      });
      // Retry sending message
      await chrome.tabs.sendMessage(tabId, message);
    } catch (retryError) {
      console.error("Failed to inject and retry:", retryError);
    }
  }
}

// Capture screenshot of visible tab
async function captureScreenshot(tabId) {
  try {
    // Get fresh tab info
    const tab = await chrome.tabs.get(tabId);

    // Check if it's a page we can capture
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('edge://')) {
      throw new Error("Cannot capture screenshots on browser internal pages.");
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 80
    });
    return dataUrl;
  } catch (error) {
    console.error("Screenshot capture failed:", error);
    if (error.message.includes('Cannot capture')) {
      throw error;
    }
    throw new Error("Could not capture screenshot. Make sure the tab is visible and try again.");
  }
}

// Build personalized system prompt
async function buildSystemPrompt(userProfile) {
  let prompt = BIAS_SYSTEM_PROMPT;

  if (userProfile) {
    prompt += `\n\n---\n\n## USER PROFILE (Use this to personalize your analysis)\n\n${userProfile}`;
    prompt += `\n\nIMPORTANT: Use the user's profile to:
1. Reference their specific role/profession when relevant
2. Acknowledge their known decision-making patterns
3. Frame reframes in ways that resonate with their goals
4. Be extra watchful for biases they've identified as personal weaknesses
5. Speak to them as an individual, not generically`;
  }

  // Add learned patterns from past analyses
  const learnedPatternsPrompt = await getLearnedPatternsPrompt();
  if (learnedPatternsPrompt) {
    prompt += learnedPatternsPrompt;
  }

  return prompt;
}

// Claude API call (text only)
async function analyzeWithClaude(text, userContext, apiKey, userProfile) {
  const systemPrompt = await buildSystemPrompt(userProfile);

  let userMessage = `Analyze this text for cognitive biases:\n\n"${text}"`;

  if (userContext) {
    userMessage = `The user is trying to decide: "${userContext}"\n\nThey selected this text from a webpage:\n"${text}"\n\nAnalyze their thinking for cognitive biases, keeping in mind the decision they're trying to make.`;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userMessage
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  return parseAnalysisResponse(content);
}

// Claude API call with vision (screenshot + text)
async function analyzeWithVision(text, userContext, screenshotDataUrl, apiKey, userProfile) {
  const systemPrompt = await buildSystemPrompt(userProfile);

  // Extract base64 data from data URL
  const base64Data = screenshotDataUrl.split(',')[1];

  let userMessage = `I'm looking at this webpage/screen. The text I've selected for analysis is:\n\n"${text}"\n\nPlease analyze this text for cognitive biases. Use the screenshot for additional context about what I'm looking at (e.g., is this a shopping page, an email, a document, etc.). This context should inform your analysis.`;

  if (userContext) {
    userMessage = `I'm trying to decide: "${userContext}"\n\nI've selected this text from the webpage:\n"${text}"\n\nPlease analyze my thinking for cognitive biases. Use the screenshot to understand the full context of what I'm looking at (shopping page, email, article, etc.). Consider both my stated decision and the context visible in the screenshot.`;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Data
            }
          },
          {
            type: 'text',
            text: userMessage
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  return parseAnalysisResponse(content);
}

// Parse JSON response from Claude
function parseAnalysisResponse(content) {
  try {
    // Find JSON in response (in case there's extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("No valid JSON in response");
  } catch (e) {
    console.error("Failed to parse response:", content);
    throw new Error("Failed to parse analysis results");
  }
}

// Listen for messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle analysis request from content script (after user enters context)
  if (message.action === "analyzeFromContent") {
    const tabId = sender.tab?.id;

    chrome.storage.local.get(['apiKey', 'userProfile']).then(async ({ apiKey, userProfile }) => {
      if (!apiKey) {
        await sendToTab(tabId, {
          action: "showError",
          error: "No API key set. Please complete setup."
        });
        return;
      }

      try {
        let analysis;
        let screenshotThumbnail = null;

        if (message.withScreenshot) {
          const screenshot = await captureScreenshot(tabId);
          screenshotThumbnail = screenshot; // Pass to content script for display
          analysis = await analyzeWithVision(message.text, message.userContext, screenshot, apiKey, userProfile);
        } else {
          analysis = await analyzeWithClaude(message.text, message.userContext, apiKey, userProfile);
        }

        // Save insight for learning (get tab URL for context)
        const tab = await chrome.tabs.get(tabId);
        await saveInsight(analysis, message.userContext, tab.url);

        await sendToTab(tabId, {
          action: "showAnalysis",
          analysis: analysis,
          originalText: message.text,
          screenshot: screenshotThumbnail
        });

      } catch (error) {
        console.error("Blindspot error:", error);
        await sendToTab(tabId, {
          action: "showError",
          error: error.message || "Failed to analyze text. Please try again."
        });
      }
    });

    sendResponse({ received: true });
    return true;
  }

  if (message.action === "analyzeText") {
    chrome.storage.local.get(['apiKey', 'userProfile']).then(({ apiKey, userProfile }) => {
      if (!apiKey) {
        sendResponse({ error: "No API key set" });
        return;
      }
      analyzeWithClaude(message.text, '', apiKey, userProfile)
        .then(analysis => sendResponse({ analysis }))
        .catch(error => sendResponse({ error: error.message }));
    });
    return true; // Keep channel open for async response
  }

  if (message.action === "checkOnboarding") {
    chrome.storage.local.get(['apiKey', 'userProfile', 'onboardingComplete']).then((data) => {
      sendResponse({
        hasApiKey: !!data.apiKey,
        hasProfile: !!data.userProfile,
        onboardingComplete: !!data.onboardingComplete
      });
    });
    return true;
  }

  if (message.action === "saveOnboarding") {
    chrome.storage.local.set({
      apiKey: message.apiKey,
      userProfile: message.userProfile,
      onboardingComplete: true
    }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === "getProfile") {
    chrome.storage.local.get(['userProfile']).then(({ userProfile }) => {
      sendResponse({ userProfile });
    });
    return true;
  }

  if (message.action === "updateProfile") {
    chrome.storage.local.set({ userProfile: message.userProfile }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Blindspot - Background Service Worker
// Handles context menu, screenshot capture, and API calls

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

// Create context menus on install
chrome.runtime.onInstalled.addListener(() => {
  // Text-only analysis
  chrome.contextMenus.create({
    id: "analyzeWithBlindspot",
    title: "🧠 Analyze with Blindspot",
    contexts: ["selection"]
  });

  // Screenshot + text analysis
  chrome.contextMenus.create({
    id: "analyzeWithScreenshot",
    title: "📸 Analyze with Screenshot",
    contexts: ["selection"]
  });

  console.log("Blindspot installed - context menus created");
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText?.trim();

  if (!selectedText || selectedText.length < 10) {
    chrome.tabs.sendMessage(tab.id, {
      action: "showError",
      error: "Please select more text to analyze (at least a sentence)."
    });
    return;
  }

  // Show loading state
  chrome.tabs.sendMessage(tab.id, {
    action: "showLoading",
    text: selectedText
  });

  try {
    // Get API key and user profile from storage
    const { apiKey, userProfile } = await chrome.storage.local.get(['apiKey', 'userProfile']);

    if (!apiKey) {
      chrome.tabs.sendMessage(tab.id, {
        action: "showError",
        error: "Please complete the setup in the extension popup first."
      });
      return;
    }

    let analysis;

    if (info.menuItemId === "analyzeWithScreenshot") {
      // Capture screenshot and analyze with vision
      const screenshot = await captureScreenshot(tab);
      analysis = await analyzeWithVision(selectedText, screenshot, apiKey, userProfile);
    } else {
      // Text-only analysis
      analysis = await analyzeWithClaude(selectedText, apiKey, userProfile);
    }

    // Send results to content script
    chrome.tabs.sendMessage(tab.id, {
      action: "showAnalysis",
      analysis: analysis,
      originalText: selectedText
    });

  } catch (error) {
    console.error("Blindspot error:", error);
    chrome.tabs.sendMessage(tab.id, {
      action: "showError",
      error: error.message || "Failed to analyze text. Please try again."
    });
  }
});

// Capture screenshot of visible tab
async function captureScreenshot(tab) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 80
    });
    return dataUrl;
  } catch (error) {
    console.error("Screenshot capture failed:", error);
    throw new Error("Could not capture screenshot. Please try text-only analysis.");
  }
}

// Build personalized system prompt
function buildSystemPrompt(userProfile) {
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

  return prompt;
}

// Claude API call (text only)
async function analyzeWithClaude(text, apiKey, userProfile) {
  const systemPrompt = buildSystemPrompt(userProfile);

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
        content: `Analyze this text for cognitive biases:\n\n"${text}"`
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
async function analyzeWithVision(text, screenshotDataUrl, apiKey, userProfile) {
  const systemPrompt = buildSystemPrompt(userProfile);

  // Extract base64 data from data URL
  const base64Data = screenshotDataUrl.split(',')[1];

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
            text: `I'm looking at this webpage/screen. The text I've selected for analysis is:\n\n"${text}"\n\nPlease analyze this text for cognitive biases. Use the screenshot for additional context about what I'm looking at (e.g., is this a shopping page, an email, a document, etc.). This context should inform your analysis.`
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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeText") {
    chrome.storage.local.get(['apiKey', 'userProfile']).then(({ apiKey, userProfile }) => {
      if (!apiKey) {
        sendResponse({ error: "No API key set" });
        return;
      }
      analyzeWithClaude(message.text, apiKey, userProfile)
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

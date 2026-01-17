// Blindspot - Background Service Worker
// Handles context menu and API calls

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

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "analyzeWithBlindspot",
    title: "Analyze with Blindspot",
    contexts: ["selection"]
  });
  console.log("Blindspot installed - context menu created");
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "analyzeWithBlindspot" && info.selectionText) {
    const selectedText = info.selectionText.trim();

    if (selectedText.length < 10) {
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
      // Get API key from storage
      const { apiKey } = await chrome.storage.local.get('apiKey');

      if (!apiKey) {
        chrome.tabs.sendMessage(tab.id, {
          action: "showError",
          error: "Please set your Claude API key in the extension popup."
        });
        return;
      }

      // Call Claude API
      const analysis = await analyzeWithClaude(selectedText, apiKey);

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
  }
});

// Claude API call
async function analyzeWithClaude(text, apiKey) {
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
      system: BIAS_SYSTEM_PROMPT,
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

  // Parse JSON from response
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
    chrome.storage.local.get('apiKey').then(({ apiKey }) => {
      if (!apiKey) {
        sendResponse({ error: "No API key set" });
        return;
      }
      analyzeWithClaude(message.text, apiKey)
        .then(analysis => sendResponse({ analysis }))
        .catch(error => sendResponse({ error: error.message }));
    });
    return true; // Keep channel open for async response
  }
});

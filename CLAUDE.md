# Blindspot - Proactive Cognitive Bias Detector

## Hackathon Context
- **Event**: Aurora Hackathon
- **Theme**: AI-Led Proactive Systems that anticipate user needs
- **Team**: User + Vaishnav
- **Deadline**: 6PM PST today
- **Demo**: 1 minute presentation

## Product Overview

**Blindspot** catches your brain's bugs (cognitive biases) in real-time, BEFORE you make bad decisions.

### Core Insight
You don't make bad decisions because you're dumb. You make them because your brain has predictable bugs called cognitive biases. By the time you realize you fell for sunk cost fallacy or confirmation bias, the damage is done.

### What Makes It Proactive
- Intervenes BEFORE the decision is made
- User summons it when making important decisions (low friction)
- Analyzes reasoning and flags biases instantly
- Suggests reframes to improve thinking

## Target Biases

| Bias | Detection Pattern | Reframe |
|------|-------------------|---------|
| Sunk Cost Fallacy | "I've already invested...", "put so much into..." | "If starting fresh today, would you choose this?" |
| Confirmation Bias | Only citing supporting evidence | "What evidence would change your mind?" |
| Planning Fallacy | Optimistic time/effort estimates | "How long did similar tasks actually take?" |
| Anchoring | Fixating on first number/offer | "What would you think if you heard X first?" |
| Recency Bias | Overweighting recent events | "How does this compare to the broader pattern?" |
| Loss Aversion | "Can't lose...", "don't want to give up..." | "Frame as gain: what do you get, not lose?" |
| Emotional Reasoning | "I feel like...", feelings as evidence | "What's the evidence beyond how you feel?" |
| Bandwagon Effect | "Everyone is doing...", "people say..." | "Is popularity evidence it's right for YOU?" |
| Availability Heuristic | Citing easily recalled examples | "Is this representative or just memorable?" |
| False Dichotomy | "Either X or Y", binary framing | "What options exist between or beyond these?" |

## Architecture

```
blindspot/
├── extension/               # Chrome Extension (Priority 1)
│   ├── manifest.json        # Extension config (Manifest V3)
│   ├── background.js        # Service worker, context menu, API calls
│   ├── content.js           # Injects UI into pages
│   ├── popup/
│   │   ├── popup.html       # Extension popup UI
│   │   ├── popup.js         # Popup logic
│   │   └── popup.css        # Popup styles
│   ├── analysis/
│   │   ├── analysis.html    # Bias analysis results view
│   │   ├── analysis.js      # Analysis logic
│   │   └── analysis.css     # Analysis styles
│   └── lib/
│       ├── api.js           # Claude API integration
│       └── biases.js        # Bias definitions and patterns
│
├── web-app/                 # Web App (Priority 2, if time)
│   ├── index.html
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Analyze.jsx  # Quick paste + analyze
│   │   │   ├── Journal.jsx  # Decision history
│   │   │   └── Patterns.jsx # Your common biases
│   │   └── components/
│   └── package.json
│
└── prompts/
    └── bias-detection.md    # System prompts for Claude API
```

## User Flow

### Primary Flow (Chrome Extension)
1. User is writing email/document/message with important decision
2. Highlights the text containing their reasoning
3. Right-click → "Analyze with Blindspot"
4. Popup appears with:
   - Detected biases (with confidence)
   - Specific quotes that triggered detection
   - Reframe suggestions
5. User revises their thinking

### Secondary Flow (Web App)
1. User opens Blindspot web app
2. Types or pastes their decision reasoning
3. Gets instant bias analysis
4. Can save to decision journal
5. Over time, sees patterns in their biases

## Tech Stack

- **Extension**: Chrome Manifest V3, vanilla JS
- **Web App**: React + Tailwind (if time)
- **AI**: Claude API (claude-sonnet or claude-haiku for speed)
- **Storage**: Chrome storage API (extension), localStorage (web)

## API Integration

### Claude API Call Structure
```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: BIAS_DETECTION_PROMPT,
    messages: [{ role: 'user', content: userText }]
  })
});
```

## Demo Script (1 minute)

1. **Hook (10s)**: "Your brain has bugs called cognitive biases. Blindspot catches them before you decide."

2. **Show context (10s)**: Open Gmail, composing important email about a decision

3. **Trigger analysis (15s)**: Highlight reasoning text, right-click "Blindspot"

4. **Show results (20s)**:
   - Biases detected with quotes
   - Reframe suggestions
   - User sees their flawed thinking

5. **Close (5s)**: "Better thinking. Better decisions. Blindspot."

## Development Priorities

### Must Have (MVP)
- [ ] Chrome extension with right-click context menu
- [ ] Send selected text to Claude API
- [ ] Display bias analysis in popup
- [ ] Clean, readable UI

### Should Have
- [ ] Copy reframe suggestions
- [ ] Basic styling that looks professional

### Nice to Have (if time)
- [ ] Web app for quick analysis
- [ ] Decision journal/history
- [ ] Pattern tracking over time

## Environment Variables Needed
```
ANTHROPIC_API_KEY=your_key_here
```

## Commands

```bash
# Load extension in Chrome
1. Go to chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension/ folder

# Run web app (if built)
cd web-app
npm install
npm run dev
```

## Key Files to Build

1. `extension/manifest.json` - Extension configuration
2. `extension/background.js` - Context menu + API calls
3. `extension/content.js` - Inject analysis popup into page
4. `extension/popup/` - Extension popup UI
5. `prompts/bias-detection.md` - The prompt engineering (critical)

## Notes
- Keep API key secure (don't commit to git)
- Use Claude Haiku for faster responses during demo
- Focus on 3-4 biases detecting well rather than all 10 poorly
- Make the UI clean and readable - judges will see this briefly

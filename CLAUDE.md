# Blindspot - Proactive Cognitive Bias Detector

## Hackathon Context
- **Event**: Aurora Hackathon
- **Theme**: AI-Led Proactive Systems that anticipate user needs
- **Team**: Harsha + Vaishnav
- **Deadline**: 6PM PST today
- **Demo**: 1 minute presentation
- **Repo**: https://github.com/HAR5HA-7663/blindspot

## Product Overview

**Blindspot** catches your brain's bugs (cognitive biases) in real-time, BEFORE you make bad decisions.

### Core Insight
You don't make bad decisions because you're dumb. You make them because your brain has predictable bugs called cognitive biases. By the time you realize you fell for sunk cost fallacy or confirmation bias, the damage is done.

### What Makes It Proactive
- Intervenes BEFORE the decision is made
- User summons it when making important decisions (low friction)
- Analyzes reasoning and flags biases instantly
- Suggests reframes to improve thinking
- **Personalized** - knows your common biases and decision patterns

---

## Current Status: WORKING MVP

### What's Built

#### Chrome Extension (Fully Functional)
- **3 Context Menu Options**:
  1. `🧠 Analyze with Blindspot` - Select text, right-click, analyze
  2. `📸 Analyze with Screenshot` - Select text + capture page screenshot
  3. `📸 Analyze Page with Blindspot` - No text needed, just screenshot

- **User Context Input**: Before analysis, asks "What decision are you trying to make?" so Claude understands the situation

- **Screenshot Vision**: Uses Claude's vision API to see the page context (shopping page, email, document, etc.)

- **Personalized Onboarding** (5 steps):
  1. Welcome screen
  2. API key input (validates `sk-ant-` format)
  3. Personal info (name, role, common decisions)
  4. Thinking patterns (select known biases, weaknesses)
  5. Goals and feedback style preference

- **User Profile**: Stored as markdown, injected into system prompt for personalized analysis

- **Analysis Results UI**:
  - Quality badge (excellent/good/fair/poor) with info tooltip
  - Bias cards with confidence levels (high/medium/low)
  - Trigger quotes showing what triggered the detection
  - Reframe suggestions for each bias
  - Screenshot thumbnail at bottom (expandable)
  - Copy insights button

- **Design**: "Neural Noir" dark theme with amber accents, custom fonts (Instrument Serif, DM Sans, JetBrains Mono)

---

## File Structure (Actual)

```
blindspot/
├── CLAUDE.md                 # This file - project context
├── extension/
│   ├── manifest.json         # Chrome Manifest V3 config
│   ├── background.js         # Service worker: context menus, Claude API, screenshot capture
│   ├── content.js            # Overlay injection, UI rendering, user interactions
│   ├── styles.css            # Page overlay styles (Neural Noir theme)
│   └── popup/
│       ├── popup.html        # Extension popup with onboarding + main view
│       ├── popup.js          # Popup logic, onboarding flow, profile management
│       └── popup.css         # Popup styles (matching theme)
```

---

## Key Technical Decisions

### API Integration
- **Model**: `claude-sonnet-4-20250514`
- **Vision**: Base64 JPEG screenshots sent to Claude
- **Header**: `anthropic-dangerous-direct-browser-access: true` (required for browser)
- **Response**: JSON format with biases_detected array

### Chrome Extension
- **Manifest V3** (latest, required)
- **Permissions**: `contextMenus`, `activeTab`, `storage`, `tabs`, `scripting`
- **Host Permissions**: `https://api.anthropic.com/*`, `<all_urls>`
- **Content Script**: Injected on all URLs, adds overlay when triggered

### User Profile Storage
- Stored in `chrome.storage.local`
- Format: Markdown document with sections for role, decisions, known biases, goals
- Injected into system prompt for personalization

---

## User Flow

### Flow 1: Text Analysis
1. User selects text on any webpage
2. Right-click → "🧠 Analyze with Blindspot"
3. Overlay appears asking "What decision are you trying to make?"
4. User types context → clicks Analyze
5. Loading spinner while Claude processes
6. Results show with biases, explanations, reframes

### Flow 2: Screenshot Analysis
1. User selects text on webpage
2. Right-click → "📸 Analyze with Screenshot"
3. Same flow, but Claude also sees the page screenshot
4. Results include screenshot thumbnail at bottom

### Flow 3: Page-Only Analysis
1. User right-clicks anywhere (no text selected)
2. Choose "📸 Analyze Page with Blindspot"
3. Overlay asks "What are you thinking about on this page?"
4. Screenshot captured and sent to Claude
5. Results based on visual context + user's question

---

## Target Biases (10 Types)

| Bias | Detection Pattern | Reframe |
|------|-------------------|---------|
| Sunk Cost | "I've already invested...", "put so much into..." | "If starting fresh today, would you choose this?" |
| Confirmation | Only citing supporting evidence | "What evidence would change your mind?" |
| Planning Fallacy | Optimistic time/effort estimates | "How long did similar tasks actually take?" |
| Anchoring | Fixating on first number/offer | "What would you think if you heard X first?" |
| Recency Bias | Overweighting recent events | "How does this compare to the broader pattern?" |
| Loss Aversion | "Can't lose...", "don't want to give up..." | "Frame as gain: what do you get, not lose?" |
| Emotional Reasoning | "I feel like...", feelings as evidence | "What's the evidence beyond how you feel?" |
| Bandwagon | "Everyone is doing...", "people say..." | "Is popularity evidence it's right for YOU?" |
| Availability Heuristic | Citing easily recalled examples | "Is this representative or just memorable?" |
| False Dichotomy | "Either X or Y", binary framing | "What options exist between or beyond these?" |

---

## Demo Script (1 minute)

1. **Hook (10s)**: "Your brain has bugs called cognitive biases. Blindspot catches them before you decide."

2. **Show Setup (5s)**: Briefly show the onboarding completed

3. **Demo Scenario (15s)**: Open Amazon product page, right-click → "Analyze Page with Blindspot"

4. **Enter Context (10s)**: Type "Should I buy this laptop? It's 40% off but I don't really need it"

5. **Show Results (15s)**:
   - Point out detected biases (anchoring on discount, emotional reasoning)
   - Show reframe suggestions
   - Show screenshot thumbnail proving context was used

6. **Close (5s)**: "Better thinking. Better decisions. Blindspot."

---

## Installation Instructions

```bash
# 1. Clone the repo
git clone https://github.com/HAR5HA-7663/blindspot.git

# 2. Load in Chrome
- Go to chrome://extensions/
- Enable "Developer mode" (top right)
- Click "Load unpacked"
- Select the extension/ folder

# 3. Setup
- Click the Blindspot extension icon
- Complete the 5-step onboarding
- Enter your Anthropic API key (get from console.anthropic.com)

# 4. Use
- Select text on any page → right-click → Analyze with Blindspot
- Or right-click anywhere → Analyze Page with Blindspot
```

---

## What to Think About Next

### Before Demo
- [ ] Test on various websites (Amazon, Gmail, Twitter, LinkedIn)
- [ ] Prepare 2-3 demo scenarios with clear bias examples
- [ ] Make sure API key is ready and working
- [ ] Practice the 1-minute demo flow

### If Time Permits
- [ ] Add keyboard shortcut (Ctrl+Shift+B) for quick access
- [ ] Add "decision journal" to track past analyses
- [ ] Web app version for non-Chrome users
- [ ] Rate limiting handling (show friendly error)
- [ ] Offline mode with cached suggestions

### Future Ideas
- [ ] Pattern detection: "You often fall for sunk cost - here it is again"
- [ ] Team mode: Share anonymized bias patterns with team
- [ ] Integration with note apps (Notion, Obsidian)
- [ ] Mobile PWA version
- [ ] Browser notification reminders for big decisions

---

## Known Issues

1. **Context menus need extension reload**: After first install, reload extension for all 3 menu items to appear
2. **Chrome pages blocked**: Can't capture screenshots on chrome:// pages
3. **API key visible**: Currently stored in chrome.storage.local (not encrypted)

---

## Environment

- **API**: Anthropic Claude API
- **Key Format**: `sk-ant-api03-...`
- **Get Key**: https://console.anthropic.com/

---

## Team Notes

- Harsha: Extension development, UI/UX
- Vaishnav: Testing, demo preparation
- Focus on making the demo smooth and impressive
- The personalization is our differentiator - emphasize it!

# 🧠 Blindspot

**Proactive Cognitive Bias Detector**

Blindspot catches your brain's cognitive biases in real-time, BEFORE you make bad decisions.

> Built for Aurora Hackathon 2026

## The Problem

You don't make bad decisions because you're dumb. You make them because your brain has predictable bugs called **cognitive biases**. By the time you realize you fell for sunk cost fallacy or confirmation bias, the damage is done.

## The Solution

Blindspot analyzes your reasoning and flags biases before you decide:

- **Sunk Cost Fallacy** - "I've already invested so much..."
- **Confirmation Bias** - Only seeing evidence that supports you
- **Planning Fallacy** - "This will only take a week..."
- **Loss Aversion** - Fearing losses more than valuing gains
- **Emotional Reasoning** - Using feelings as evidence
- And more...

## How It Works

### On-Demand Analysis
1. **Select text** containing your reasoning on any webpage
2. **Right-click** → "Analyze with Blindspot"
3. **Review** detected biases and reframe suggestions
4. **Decide better**

### Proactive Interventions
Blindspot automatically detects risky decision contexts and nudges you:
- **Shopping sites** - Amazon, eBay, checkout pages
- **Food delivery** - DoorDash, UberEats, Grubhub
- **Social media** - Twitter, Instagram, TikTok, Reddit
- **Urgency tactics** - "Limited time!", countdown timers
- **Subscription pages** - Pricing, premium signups

Press `Ctrl+Shift+B` to manually trigger an intervention check.

## Installation

### Load Extension in Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project

### Set Up API Key

1. Click the Blindspot extension icon
2. Enter your [Claude API key](https://console.anthropic.com/)
3. Click "Save Key"

## Demo

```
User writes: "I think we should keep this project going. We've already spent
6 months on it and I've put so much effort into making it work..."

Blindspot detects:

⚠️ SUNK COST FALLACY (High confidence)
Trigger: "We've already spent 6 months" / "put so much effort"
→ You're justifying with past investment, not future value

💡 Reframe: "If you started fresh today with what you know now,
would you choose this project?"
```

## Tech Stack

- Chrome Extension (Manifest V3)
- Claude API (Anthropic)
- Vanilla JavaScript
- CSS3

## Team

Built by **Harsha Yellela** and **Vaishnav** for Aurora Hackathon 2026.

## License

MIT

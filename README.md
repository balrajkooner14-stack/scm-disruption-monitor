# SCM Disruption Monitor

> Real-time supply chain risk intelligence powered by GDELT and Claude AI

**[Live Demo](https://your-app.vercel.app)** | Built with Next.js 14 + Vercel

## What it does

Aggregates global supply chain disruption signals from 4,500+ news sources via the 
free GDELT Project API, scores each event by severity using keyword analysis, visualizes 
risk by region on an interactive world heatmap, and generates AI-powered executive 
risk summaries.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Map | react-simple-maps |
| News data | GDELT DOC 2.0 API (free, no API key needed) |
| AI summary | Anthropic claude-sonnet-4-6 |
| Hosting | Vercel (free Hobby tier) |

## How it works

**Data ingestion:** Three GDELT API queries run server-side on every page load, pulling 
the last 24 hours of supply chain, port, and trade disruption news. Results are 
deduplicated and normalized into a typed schema.

**Severity scoring:** Events scored 1–3 by keyword matching. Critical (3): strikes, 
closures, sanctions. Warning (2): delays, shortages, tariffs. Monitor (1): all others.

**AI analysis:** Top 5 headlines sent to Claude claude-sonnet-4-6 for a 3-bullet executive 
risk brief. Cached 10 minutes to control API costs.

## Local setup

```bash
git clone https://github.com/yourusername/scm-disruption-monitor
cd scm-disruption-monitor
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm run dev
```

## Data sources

- **GDELT Project** — https://www.gdeltproject.org (free, no key required)
- **Anthropic API** — https://console.anthropic.com

## About

Built as a portfolio project demonstrating supply chain domain expertise combined 
with full-stack development and AI integration. Targets Business Analyst, Data Analyst, 
and Supply Chain Analyst roles.

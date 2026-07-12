# 📰 Current Affairs for Kids 🇸🇬

A web app that helps a 10-year-old in Singapore keep up with current affairs.

- **Home page** — today's trending news as colourful story cards
- **Story page** — a kid-friendly summary capturing ~80% of what the child needs to know, broken down through five lenses: **For Me · For My Family · For My Friends · For Singapore · For the World**
- **PSLE prep built in** — every story ends with Power Words and idioms for Composition (Paper 1) and stimulus-based conversation questions for Oral, aligned to Singapore MOE standards
- **Refreshes itself daily** — a GitHub Action asks Claude to search the web each morning (6:15am SGT) and rewrite the day's top stories for kids

## Project structure

```
index.html                      App shell
css/style.css                   Kid-friendly styling
js/app.js                       Tiny hash-router SPA (no build step)
data/news.json                  Today's stories (updated daily by the Action)
scripts/generate-news.mjs       Claude-powered news generator
.github/workflows/update-news.yml   Daily 6:15am SGT refresh
```

## Run locally

No build step — just serve the folder:

```bash
python3 -m http.server 4173
# open http://localhost:4173
```

## Host on GitHub Pages

1. **Create a repository** on https://github.com/new (e.g. `current-affairs-for-kids`, Public).
2. **Push this folder:**
   ```bash
   git remote add origin https://github.com/<your-username>/current-affairs-for-kids.git
   git push -u origin main
   ```
3. **Enable Pages:** repo → Settings → Pages → Source: *Deploy from a branch* → Branch: `main` / `/ (root)` → Save.
   Your site will be live at `https://<your-username>.github.io/current-affairs-for-kids/` in a minute or two.

## Enable the daily news refresh

The site works immediately with the seeded stories. To have it refresh itself every morning:

1. Get an Anthropic API key from https://platform.claude.com
2. In the repo: Settings → Secrets and variables → Actions → **New repository secret**
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key
3. That's it. The workflow runs daily at 6:15am Singapore time. You can also trigger it manually: Actions → *Update daily news* → *Run workflow*.

Each run makes one Claude API call (Claude Opus 4.8 with web search) — typically a few cents per day.

## Updating news by hand

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run generate
```

Or simply edit `data/news.json` — the schema is self-explanatory.

## A note for grown-ups

Summaries are AI-simplified for young readers. Each story links to its original sources — encourage your child to read them together with you.

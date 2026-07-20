/**
 * Generates data/news.json — today's Singapore news rewritten for a 10-year-old,
 * with the five-lens breakdown (me/family/friends/nation/world) and PSLE
 * Composition & Oral vocabulary.
 *
 * Runs daily via .github/workflows/update-news.yml. Requires ANTHROPIC_API_KEY.
 * News is sourced from public RSS feeds (CNA, Mothership). After collecting
 * headlines, the script fetches full article text client-side (cheap input tokens)
 * so Claude can curate based on actual content, not just 250-char snippets.
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(here, "..", "data");
const OUTPUT_PATH = path.join(DATA_DIR, "news.json");
const DATED_PATH = path.join(DATA_DIR, `news-${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" })}.json`);
const INDEX_PATH = path.join(DATA_DIR, "index.json");
const MODEL = "claude-sonnet-5";

const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }); // YYYY-MM-DD

const RSS_FEEDS = [
  "https://www.channelnewsasia.com/rssfeeds/8395744",  // CNA Singapore
  "https://www.channelnewsasia.com/rssfeeds/8395986",  // CNA Asia
  "https://mothership.sg/feed/",                        // Mothership
];

const SYSTEM_PROMPT = `You are the editor of "Current Affairs for Kids", a news site for 10-year-old children in Singapore (Primary 4-5, preparing for PSLE English).

Your job: select the most important and interesting news from the headlines provided, then rewrite each story so a 10-year-old fully understands it. Each summary must capture roughly 80% of what the child needs to know.

Editorial rules:
- Always output exactly 5 stories — never fewer. Priority order: (1) news directly affecting daily life in Singapore (prices, school, transport, weather, health, safety), (2) major Singapore national news, (3) world or regional news that has a concrete, specific impact on Singapore or Singaporeans, (4) one lighter story — must be set in Singapore or directly involve Singaporeans (sports, science, culture, people). Only reach outside Singapore if you genuinely cannot fill a slot with Singapore-connected news; in that case, pick the story most relevant to Singapore and explain the Singapore angle clearly.
- Write warmly and clearly for a 10-year-old. Short sentences. Explain every difficult concept with a comparison a child knows. Never talk down to the reader.
- Handle upsetting topics (war, death, crime) truthfully but gently, without graphic detail.
- Vocabulary must match Singapore MOE PSLE English standards: "power words" and idioms a Primary 5 pupil could realistically use in Continuous Writing (Paper 1) and Oral (stimulus-based conversation).
- Oral questions must sound like real PSLE stimulus-based conversation prompts: personal, opinion-based, connected to the child's own life.
- The five "lenses" must be concrete and specific to the story, not generic filler.

Output rules:
- Output ONLY a single JSON object. No markdown fences, no commentary before or after.
- Every id must be a short kebab-case slug unique within the file.
- For sources, use the publication name and URL from the RSS headlines provided.

JSON schema:
{
  "date": "${today}",
  "generated_by": "claude",
  "stories": [
    {
      "id": "kebab-case-slug",
      "emoji": "one emoji",
      "title": "catchy kid-friendly title",
      "tag": "one of: Money & Daily Life | Nature & Environment | Weather & Travel | Singapore & The World | People & Culture | Science & Tech | School & Health | Sports",
      "headline_kid": "one-sentence hook a child understands",
      "summary": ["3-4 paragraphs, each 2-4 sentences, together covering 80% of what the child needs to know"],
      "lenses": {
        "me": "what it means for a 10-year-old personally",
        "family": "what it means for their family",
        "friends": "what it means for their friends/classmates",
        "nation": "what it means for Singapore",
        "world": "what it means for the world"
      },
      "compo_words": [ { "word": "", "type": "noun/verb/adjective", "meaning": "", "example": "example sentence a P5 pupil could write" } ],
      "compo_phrases": [ { "phrase": "", "meaning": "", "example": "" } ],
      "oral": {
        "questions": ["3 PSLE-style stimulus-based conversation questions"],
        "phrases": ["5 useful sentence starters for answering aloud"]
      },
      "sources": [ { "name": "publication + short title", "url": "" } ]
    }
  ]
}`;

async function fetchRSS(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [];
    const itemPattern = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemPattern.exec(xml)) !== null) {
      const block = m[1];
      const title = (/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s.exec(block) || [])[1] || "";
      const desc  = (/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/s.exec(block) || [])[1] || "";
      const link  = (/<link>(.*?)<\/link>/.exec(block) || [])[1] || "";
      if (title.trim()) items.push({
        title: title.trim(),
        description: desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 250),
        url: link.trim(),
      });
    }
    return items.slice(0, 15);
  } catch {
    return [];
  }
}

async function fetchArticleText(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CurrentAffairsBot/1.0)" },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Strip noisy structural elements and their content
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");

    // Pull paragraph text
    const paragraphs = [];
    const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = pPattern.exec(cleaned)) !== null) {
      const p = m[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z#0-9]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (p.length > 50) paragraphs.push(p);
    }

    const text = paragraphs.join(" ").slice(0, 1000);
    return text.length > 100 ? text : null;
  } catch {
    return null;
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set — aborting without changes.");
    process.exit(1);
  }

  // Fetch RSS feeds in parallel
  console.log("Fetching RSS feeds…");
  const results = await Promise.all(RSS_FEEDS.map(fetchRSS));
  const seen = new Set();
  const items = results.flat().filter(i => {
    if (seen.has(i.title)) return false;
    seen.add(i.title);
    return true;
  }).slice(0, 25);

  if (items.length === 0) {
    console.error("No RSS items fetched — aborting without changes.");
    process.exit(1);
  }
  console.log(`Fetched ${items.length} headlines from RSS.`);

  // Fetch full article text in parallel so Claude can curate on content, not just snippets
  console.log("Fetching full article text…");
  const articleTexts = await Promise.all(items.map(i => i.url ? fetchArticleText(i.url) : Promise.resolve(null)));
  const fetched = articleTexts.filter(Boolean).length;
  console.log(`Article text fetched for ${fetched}/${items.length} items.`);

  const newsContext = items.map((i, idx) => {
    const article = articleTexts[idx];
    return `• ${i.title}${i.description ? ` — ${i.description}` : ""}${i.url ? ` [${i.url}]` : ""}${article ? `\n  Article excerpt: ${article}` : ""}`;
  }).join("\n\n");

  // Load recent story titles so the model avoids repeating them (~150 tokens)
  let recentContext = "";
  try {
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
    const lines = [];
    for (const date of index.slice(0, 3)) {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `news-${date}.json`), "utf8"));
        for (const s of d.stories || []) lines.push(`- ${date}: ${s.title}`);
      } catch {}
    }
    if (lines.length) recentContext = `\n\nStories already published in the past 3 days — only cover a similar topic if there is a significant NEW development today:\n${lines.join("\n")}`;
  } catch {}

  const USER_PROMPT = `Today's date in Singapore is ${today}.

Here are today's latest Singapore news headlines with article excerpts:
${newsContext}
${recentContext}

Pick exactly 5 stories from the headlines above and produce the JSON described in your instructions.`;

  const client = new Anthropic();

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: USER_PROMPT }],
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === "max_tokens") {
    console.error("Output truncated (stop_reason: max_tokens) — keeping existing news.json.");
    process.exit(1);
  }

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const data = extractJson(text);
  validate(data);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2) + "\n");
  fs.writeFileSync(DATED_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${data.stories.length} stories for ${data.date} → ${OUTPUT_PATH} + ${path.basename(DATED_PATH)}`);

  // Keep a rolling index of available dates (newest first, max 30)
  let index = [];
  try { index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")); } catch {}
  if (!index.includes(today)) index.unshift(today);
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index.slice(0, 30), null, 2) + "\n");
  console.log(`index.json updated — ${index.length} date(s) available.`);

  // Sonnet 5 intro pricing: $2/M input, $10/M output (through 2026-08-31, then $3/$15)
  // Article fetch adds ~5-8K input tokens ($0.01-0.02) for much better curation quality
  const { input_tokens: totalIn, output_tokens: totalOut } = response.usage;
  const costUSD = (totalIn / 1e6 * 2) + (totalOut / 1e6 * 10);
  console.log(`Usage: in=${totalIn} out=${totalOut} — est. cost $${costUSD.toFixed(4)}`);
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model output.");
  return JSON.parse(text.slice(start, end + 1));
}

function validate(data) {
  if (!Array.isArray(data.stories) || data.stories.length === 0) {
    throw new Error("news.json must contain a non-empty stories array.");
  }
  for (const s of data.stories) {
    for (const field of ["id", "emoji", "title", "tag", "headline_kid", "summary", "lenses", "compo_words", "oral"]) {
      if (!s[field]) throw new Error(`Story "${s.id || s.title}" is missing "${field}".`);
    }
    for (const lens of ["me", "family", "friends", "nation", "world"]) {
      if (!s.lenses[lens]) throw new Error(`Story "${s.id}" is missing lens "${lens}".`);
    }
  }
}

main().catch((err) => {
  console.error("News generation failed:", err);
  process.exit(1);
});

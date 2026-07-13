/**
 * Generates data/news.json — today's Singapore news rewritten for a 10-year-old,
 * with the five-lens breakdown (me/family/friends/nation/world) and PSLE
 * Composition & Oral vocabulary.
 *
 * Runs daily via .github/workflows/update-news.yml. Requires ANTHROPIC_API_KEY.
 * Claude searches the web itself (server-side web_search tool), so no RSS
 * parsing is needed here.
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

const SYSTEM_PROMPT = `You are the editor of "Current Affairs for Kids", a news site for 10-year-old children in Singapore (Primary 4-5, preparing for PSLE English).

Your job: find today's most important and interesting news for Singapore, then rewrite each story so a 10-year-old fully understands it. Each summary must capture roughly 80% of what the child needs to know.

Editorial rules:
- Pick 5 stories. Prioritise: (1) news directly affecting daily life in Singapore (prices, school, transport, weather, health, safety), (2) major Singapore national news, (3) big world news explained through its impact on Singapore, (4) one lighter story about people, culture, sports or science.
- Write warmly and clearly for a 10-year-old. Short sentences. Explain every difficult concept with a comparison a child knows. Never talk down to the reader.
- Handle upsetting topics (war, death, crime) truthfully but gently, without graphic detail.
- Vocabulary must match Singapore MOE PSLE English standards: "power words" and idioms a Primary 5 pupil could realistically use in Continuous Writing (Paper 1) and Oral (stimulus-based conversation).
- Oral questions must sound like real PSLE stimulus-based conversation prompts: personal, opinion-based, connected to the child's own life.
- The five "lenses" must be concrete and specific to the story, not generic filler.

Output rules:
- Output ONLY a single JSON object. No markdown fences, no commentary before or after.
- Every id must be a short kebab-case slug unique within the file.
- Include 2-3 real source articles per story with working URLs from your web searches.

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
      "compo_words": [ { "word": "", "type": "noun/verb/adjective", "meaning": "", "example": "example sentence a P5 pupil could write" } ],  // exactly 6
      "compo_phrases": [ { "phrase": "", "meaning": "", "example": "" } ],  // exactly 3 idioms/phrases
      "oral": {
        "questions": ["3 PSLE-style stimulus-based conversation questions"],
        "phrases": ["5 useful sentence starters for answering aloud"]
      },
      "sources": [ { "name": "publication + short title", "url": "" } ]
    }
  ]
}`;

const USER_PROMPT = `Today's date in Singapore is ${today}. Search the web for today's (and the past 1-2 days') top news relevant to Singapore — check sources like CNA, The Straits Times, Mothership, Today Online and major wire services. Then produce the JSON described in your instructions, with exactly 5 stories.`;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set — aborting without changes.");
    process.exit(1);
  }

  const client = new Anthropic();

  let messages = [{ role: "user", content: USER_PROMPT }];
  let response;

  // Web search runs in a server-side loop; on pause_turn, append the assistant
  // turn and re-send so the server resumes where it left off.
  for (let attempt = 0; attempt < 6; attempt++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
      messages,
    });
    response = await stream.finalMessage();

    if (response.stop_reason !== "pause_turn") break;
    messages = [...messages, { role: "assistant", content: response.content }];
  }

  if (response.stop_reason === "refusal") {
    console.error("Model declined the request (stop_reason: refusal) — keeping existing news.json.");
    process.exit(1);
  }
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
  console.log(`Usage: in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
}

function extractJson(text) {
  // Tolerate accidental markdown fences or preamble around the JSON object.
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

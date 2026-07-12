/* Current Affairs for Kids — tiny hash-router single-page app.
   Data lives in data/news.json and is refreshed daily by the GitHub Action. */

const app = document.getElementById("app");
let newsData = null;

const LENSES = [
  { key: "me", label: "For Me", emoji: "🧒", cls: "lens-me" },
  { key: "family", label: "For My Family", emoji: "👨‍👩‍👧‍👦", cls: "lens-family" },
  { key: "friends", label: "For My Friends", emoji: "🧑‍🤝‍🧑", cls: "lens-friends" },
  { key: "nation", label: "For Singapore", emoji: "🇸🇬", cls: "lens-nation" },
  { key: "world", label: "For the World", emoji: "🌍", cls: "lens-world" },
];

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s == null ? "" : String(s);
  return div.innerHTML;
}

function formatDate(iso) {
  const d = iso ? new Date(iso + "T00:00:00") : new Date();
  return d.toLocaleDateString("en-SG", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function renderHome() {
  const stories = newsData.stories || [];
  app.innerHTML = `
    <div class="intro">
      <h1>What's happening today? 🔎</h1>
      <p>Tap a story to see what it means <strong>for you, your family, your friends, Singapore and the world</strong> —
      plus power words for your Composition and Oral practice!</p>
    </div>
    <div class="story-list">
      ${stories.map((s) => `
        <a class="story-card" href="#/story/${esc(s.id)}">
          <div class="card-emoji">${esc(s.emoji)}</div>
          <div>
            <h2>${esc(s.title)}</h2>
            <p class="card-headline">${esc(s.headline_kid)}</p>
            <div class="card-meta"><span class="tag">${esc(s.tag)}</span></div>
          </div>
          <span class="read-more">Read&nbsp;→</span>
        </a>`).join("")}
    </div>`;
  window.scrollTo(0, 0);
}

function renderStory(id) {
  const s = (newsData.stories || []).find((x) => x.id === id);
  if (!s) {
    app.innerHTML = `<div class="error-box">Oops, that story flew away! 🕊️ <a href="#/">Back to today's news</a></div>`;
    return;
  }

  const summary = (s.summary || []).map((p) => `<p>${esc(p)}</p>`).join("");

  const lenses = LENSES.filter((l) => s.lenses && s.lenses[l.key]).map((l) => `
    <div class="lens ${l.cls}">
      <h3>${l.emoji} ${l.label}</h3>
      <p>${esc(s.lenses[l.key])}</p>
    </div>`).join("");

  const words = (s.compo_words || []).map((w) => `
    <div class="vocab-item">
      <span class="word">${esc(w.word)}</span><span class="word-type">(${esc(w.type)})</span>
      <div class="meaning">${esc(w.meaning)}</div>
      <div class="example">${esc(w.example)}</div>
    </div>`).join("");

  const phrases = (s.compo_phrases || []).map((p) => `
    <div class="vocab-item phrase-item">
      <span class="word">${esc(p.phrase)}</span>
      <div class="meaning">${esc(p.meaning)}</div>
      <div class="example">${esc(p.example)}</div>
    </div>`).join("");

  const oralQs = ((s.oral && s.oral.questions) || []).map((q) => `<div class="oral-question">${esc(q)}</div>`).join("");
  const starters = ((s.oral && s.oral.phrases) || []).map((p) => `<span class="starter-chip">${esc(p)}</span>`).join("");

  const sources = (s.sources || []).map((src) => `<li><a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.name)}</a></li>`).join("");

  app.innerHTML = `
    <a class="back-link" href="#/">← Back to today's news</a>
    <div class="detail-header">
      <div class="detail-emoji">${esc(s.emoji)}</div>
      <h1>${esc(s.title)}</h1>
      <p class="detail-headline">${esc(s.headline_kid)}</p>
      <div class="card-meta"><span class="tag">${esc(s.tag)}</span></div>
    </div>

    <div class="section">
      <h2>📖 The Story in a Nutshell</h2>
      ${summary}
    </div>

    <div class="section">
      <h2>🔍 What Does It Mean…</h2>
      <div class="lens-grid">${lenses}</div>
    </div>

    <div class="section">
      <h2>✏️ Power Words for Composition</h2>
      <div class="vocab-list">${words}</div>
    </div>

    ${phrases ? `
    <div class="section">
      <h2>💬 Golden Phrases &amp; Idioms</h2>
      <div class="vocab-list">${phrases}</div>
    </div>` : ""}

    <div class="section">
      <h2>🎙️ Oral Practice — Stimulus-Based Conversation</h2>
      <p style="color:var(--ink-soft);font-size:0.9rem;margin-bottom:12px;">
        Practise answering aloud, just like in the PSLE Oral exam. Give your <strong>Point</strong>,
        <strong>Reason</strong>, an <strong>Example</strong> from your own life, and a <strong>Conclusion</strong>.
      </p>
      ${oralQs}
      <div class="oral-starters">
        <h3>Useful sentence starters:</h3>
        ${starters}
      </div>
    </div>

    ${sources ? `
    <div class="section sources">
      <h2>🔗 Read More (with a grown-up)</h2>
      <ul>${sources}</ul>
    </div>` : ""}
  `;
  window.scrollTo(0, 0);
}

function route() {
  if (!newsData) return;
  const hash = window.location.hash || "#/";
  const match = hash.match(/^#\/story\/(.+)$/);
  if (match) renderStory(decodeURIComponent(match[1]));
  else renderHome();
}

async function init() {
  document.getElementById("header-date").textContent = formatDate();
  try {
    const res = await fetch("data/news.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    newsData = await res.json();
    if (newsData.date) {
      document.getElementById("header-date").textContent = "News for " + formatDate(newsData.date);
    }
    route();
  } catch (err) {
    app.innerHTML = `<div class="error-box">We couldn't load today's news. 😢<br>Please try again later.</div>`;
    console.error("Failed to load news.json:", err);
  }
}

window.addEventListener("hashchange", route);
init();

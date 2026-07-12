/* Current Affairs for Kids — hash-router SPA with date history and favourites.
   Data: data/news.json (today), data/news-YYYY-MM-DD.json (past), data/index.json (date list). */

const app = document.getElementById("app");
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }); // YYYY-MM-DD

const LENSES = [
  { key: "me",      label: "For Me",          emoji: "🧒",          cls: "lens-me" },
  { key: "family",  label: "For My Family",   emoji: "👨‍👩‍👧‍👦", cls: "lens-family" },
  { key: "friends", label: "For My Friends",  emoji: "🧑‍🤝‍🧑",  cls: "lens-friends" },
  { key: "nation",  label: "For Singapore",   emoji: "🇸🇬",         cls: "lens-nation" },
  { key: "world",   label: "For the World",   emoji: "🌍",          cls: "lens-world" },
];

// --- Utilities ---

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s == null ? "" : String(s);
  return div.innerHTML;
}

function formatDate(iso) {
  const d = iso ? new Date(iso + "T00:00:00") : new Date();
  return d.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}

function setHeaderDate(text) {
  document.getElementById("header-date").textContent = text;
}

// --- Data loading (in-memory cache) ---

const dataCache = {};

async function loadStories(date) {
  if (dataCache[date]) return dataCache[date];
  const url = date === TODAY ? "data/news.json" : `data/news-${date}.json`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  dataCache[date] = await r.json();
  return dataCache[date];
}

async function loadIndex() {
  try {
    const r = await fetch("data/index.json", { cache: "no-store" });
    if (!r.ok) return [TODAY];
    const idx = await r.json();
    return Array.isArray(idx) && idx.length ? idx : [TODAY];
  } catch {
    return [TODAY];
  }
}

// --- Favourites (localStorage) ---

const FAV_KEY = "cak-favorites";

function getFavourites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
}

function isFavourite(date, id) {
  return getFavourites().some(f => f.date === date && f.id === id);
}

function toggleFavourite(fav) {
  const favs = getFavourites();
  const idx = favs.findIndex(f => f.date === fav.date && f.id === fav.id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.unshift(fav);
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
}

// --- Nav component ---

function renderDateNav(dates, activeDate) {
  const favCount = getFavourites().length;
  const favActive = window.location.hash === "#/favorites";

  const chips = dates.map(d => {
    const label = d === TODAY ? "Today" : formatDateShort(d);
    const href  = d === TODAY ? "#/" : `#/date/${d}`;
    const cls   = d === activeDate ? "date-chip date-chip-active" : "date-chip";
    return `<a class="${cls}" href="${href}">${esc(label)}</a>`;
  }).join("");

  const badge = favCount > 0 ? ` <span class="fav-count">${favCount}</span>` : "";
  const favCls = `date-chip fav-tab${favActive ? " date-chip-active" : ""}`;

  return `
    <nav class="date-nav">
      <div class="date-chips">${chips}</div>
      <a class="${favCls}" href="#/favorites">⭐ Saved${badge}</a>
    </nav>`;
}

// --- Fav button helpers ---

function favBtnHtml(date, id) {
  const active = isFavourite(date, id);
  return `<button class="fav-btn${active ? " fav-active" : ""}" data-date="${esc(date)}" data-id="${esc(id)}" title="Save story" aria-label="Save story">⭐</button>`;
}

function bindCardFavBtns(storiesByDate) {
  document.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const { date, id } = btn.dataset;
      const story = storiesByDate[date] && storiesByDate[date].find(s => s.id === id);
      if (story) {
        toggleFavourite({ date, id, emoji: story.emoji, title: story.title, tag: story.tag, headline_kid: story.headline_kid });
      } else {
        // Already have minimal data for saved-stories page
        toggleFavourite({ date, id });
      }
      btn.classList.toggle("fav-active", isFavourite(date, id));
      // Update badge in date nav
      const badge = document.querySelector(".fav-tab .fav-count");
      const count = getFavourites().length;
      const favTab = document.querySelector(".fav-tab");
      if (favTab) {
        const savedSpan = badge ? badge.outerHTML : "";
        const newBadge = count > 0 ? `<span class="fav-count">${count}</span>` : "";
        favTab.innerHTML = `⭐ Saved${newBadge}`;
      }
    });
  });
}

// --- Home page ---

async function renderHome(date) {
  app.innerHTML = `<div class="loading"><div class="loading-emoji">📰</div><p>Loading stories…</p></div>`;

  const [data, allDates] = await Promise.all([
    loadStories(date).catch(() => null),
    loadIndex(),
  ]);

  const nav = renderDateNav(allDates, date);

  if (!data) {
    app.innerHTML = nav + `<div class="error-box">No stories found for this date. 😢 <a href="#/">Back to today's news</a></div>`;
    return;
  }

  const stories = data.stories || [];
  const title = date === TODAY ? "What's happening today? 🔎" : `News for ${formatDateShort(date)} 📅`;

  app.innerHTML = nav + `
    <div class="intro">
      <h1>${title}</h1>
      <p>Tap a story to see what it means <strong>for you, your family, your friends, Singapore and the world</strong> —
      plus power words for your Composition and Oral practice!</p>
    </div>
    <div class="story-list">
      ${stories.map(s => `
        <a class="story-card" href="#/story/${esc(date)}/${esc(s.id)}">
          <div class="card-emoji">${esc(s.emoji)}</div>
          <div class="card-body">
            <h2>${esc(s.title)}</h2>
            <p class="card-headline">${esc(s.headline_kid)}</p>
            <div class="card-meta"><span class="tag">${esc(s.tag)}</span></div>
          </div>
          ${favBtnHtml(date, s.id)}
          <span class="read-more">Read&nbsp;→</span>
        </a>`).join("")}
    </div>`;

  setHeaderDate("News for " + formatDate(data.date || date));
  window.scrollTo(0, 0);
  bindCardFavBtns({ [date]: stories });
}

// --- Favourites page ---

async function renderFavourites() {
  app.innerHTML = `<div class="loading"><div class="loading-emoji">⭐</div><p>Loading saved stories…</p></div>`;

  const allDates = await loadIndex();
  const nav = renderDateNav(allDates, null);
  const favs = getFavourites();

  if (favs.length === 0) {
    app.innerHTML = nav + `
      <div class="empty-favs">
        <div class="empty-emoji">⭐</div>
        <h2>No saved stories yet</h2>
        <p>Tap the ⭐ on any story card to save it here.</p>
        <a class="back-link" href="#/">Browse today's news</a>
      </div>`;
    setHeaderDate("Saved Stories");
    return;
  }

  const cards = favs.map(f => `
    <a class="story-card" href="#/story/${esc(f.date)}/${esc(f.id)}">
      <div class="card-emoji">${esc(f.emoji || "📰")}</div>
      <div class="card-body">
        <h2>${esc(f.title || f.id)}</h2>
        <p class="card-headline">${esc(f.headline_kid || "")}</p>
        <div class="card-meta">
          <span class="tag">${esc(f.tag || "")}</span>
          <span class="date-badge">${formatDateShort(f.date)}</span>
        </div>
      </div>
      ${favBtnHtml(f.date, f.id)}
      <span class="read-more">Read&nbsp;→</span>
    </a>`).join("");

  app.innerHTML = nav + `
    <div class="intro intro-favs">
      <h1>Your Saved Stories ⭐</h1>
      <p>Tap ⭐ again on any card to unsave it.</p>
    </div>
    <div class="story-list">${cards}</div>`;

  setHeaderDate("Saved Stories");
  window.scrollTo(0, 0);

  // On unsave, re-render the whole page
  document.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const { date, id } = btn.dataset;
      toggleFavourite({ date, id });
      renderFavourites();
    });
  });
}

// --- Story detail ---

async function renderStory(date, id) {
  app.innerHTML = `<div class="loading"><div class="loading-emoji">📖</div><p>Loading story…</p></div>`;

  let data;
  try { data = await loadStories(date); }
  catch {
    app.innerHTML = `<div class="error-box">Couldn't load this story. 😢 <a href="#/">Back to today's news</a></div>`;
    return;
  }

  const s = (data.stories || []).find(x => x.id === id);
  if (!s) {
    app.innerHTML = `<div class="error-box">Oops, that story flew away! 🕊️ <a href="#/">Back to today's news</a></div>`;
    return;
  }

  const backHref  = date === TODAY ? "#/" : `#/date/${date}`;
  const backLabel = date === TODAY ? "Today's news" : `News for ${formatDateShort(date)}`;
  const faved     = isFavourite(date, s.id);

  const summary  = (s.summary || []).map(p => `<p>${esc(p)}</p>`).join("");
  const lenses   = LENSES.filter(l => s.lenses?.[l.key]).map(l => `
    <div class="lens ${l.cls}">
      <h3>${l.emoji} ${l.label}</h3>
      <p>${esc(s.lenses[l.key])}</p>
    </div>`).join("");
  const words    = (s.compo_words || []).map(w => `
    <div class="vocab-item">
      <span class="word">${esc(w.word)}</span><span class="word-type">(${esc(w.type)})</span>
      <div class="meaning">${esc(w.meaning)}</div>
      <div class="example">${esc(w.example)}</div>
    </div>`).join("");
  const phrases  = (s.compo_phrases || []).map(p => `
    <div class="vocab-item phrase-item">
      <span class="word">${esc(p.phrase)}</span>
      <div class="meaning">${esc(p.meaning)}</div>
      <div class="example">${esc(p.example)}</div>
    </div>`).join("");
  const oralQs   = (s.oral?.questions || []).map(q => `<div class="oral-question">${esc(q)}</div>`).join("");
  const starters = (s.oral?.phrases   || []).map(p => `<span class="starter-chip">${esc(p)}</span>`).join("");
  const sources  = (s.sources || []).map(src => `<li><a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.name)}</a></li>`).join("");

  app.innerHTML = `
    <div class="detail-nav">
      <a class="back-link" href="${backHref}">← ${esc(backLabel)}</a>
      <button class="fav-btn-detail${faved ? " fav-active" : ""}">${faved ? "⭐ Saved" : "☆ Save"}</button>
    </div>
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

  setHeaderDate("News for " + formatDate(date));
  window.scrollTo(0, 0);

  document.querySelector(".fav-btn-detail").addEventListener("click", () => {
    toggleFavourite({ date, id: s.id, emoji: s.emoji, title: s.title, tag: s.tag, headline_kid: s.headline_kid });
    const now = isFavourite(date, s.id);
    const btn = document.querySelector(".fav-btn-detail");
    btn.classList.toggle("fav-active", now);
    btn.textContent = now ? "⭐ Saved" : "☆ Save";
  });
}

// --- Router ---

async function route() {
  const hash = window.location.hash || "#/";

  // #/story/YYYY-MM-DD/id
  const storyMatch = hash.match(/^#\/story\/(\d{4}-\d{2}-\d{2})\/(.+)$/);
  if (storyMatch) { await renderStory(storyMatch[1], decodeURIComponent(storyMatch[2])); return; }

  // #/story/id (legacy — treat as today)
  const legacyStory = hash.match(/^#\/story\/([^/]+)$/);
  if (legacyStory) { await renderStory(TODAY, decodeURIComponent(legacyStory[1])); return; }

  // #/date/YYYY-MM-DD
  const dateMatch = hash.match(/^#\/date\/(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) { await renderHome(dateMatch[1]); return; }

  // #/favorites
  if (hash === "#/favorites") { await renderFavourites(); return; }

  // #/ (default — today)
  await renderHome(TODAY);
}

window.addEventListener("hashchange", route);
route();

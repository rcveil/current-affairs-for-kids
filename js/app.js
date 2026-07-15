/* Current Affairs for Kids — hash-router SPA with date history and favourites.
   Data: data/news.json (today), data/news-YYYY-MM-DD.json (past), data/index.json (date list). */

const app = document.getElementById("app");
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }); // YYYY-MM-DD
let calMonth = TODAY.slice(0, 7); // "YYYY-MM" — which month the calendar shows

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
const VOCAB_KEY = "cak-fav-vocab";

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

// --- Vocab Favourites (localStorage) ---

function getVocabFavs() {
  try { return JSON.parse(localStorage.getItem(VOCAB_KEY) || "[]"); } catch { return []; }
}

function isVocabFav(key) {
  return getVocabFavs().some(v => v.key === key);
}

function toggleVocabFav(item) {
  const favs = getVocabFavs();
  const idx = favs.findIndex(v => v.key === item.key);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.unshift(item);
  localStorage.setItem(VOCAB_KEY, JSON.stringify(favs));
}

// --- Calendar nav ---

function renderCalendarNav(availableDates, activeDate) {
  const [year, month] = calMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const totalDays = new Date(year, month, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0 = Sun

  const availableSet = new Set(availableDates);
  const monthLabel = firstDay.toLocaleDateString("en-SG", { month: "long", year: "numeric" });

  const prevM = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const nextM = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(`<div class="cal-day"></div>`);
  for (let d = 1; d <= totalDays; d++) {
    const iso = `${calMonth}-${String(d).padStart(2, "0")}`;
    const hasNews = availableSet.has(iso);
    const isActive = iso === activeDate;
    const isToday = iso === TODAY;
    let cls = "cal-day";
    if (hasNews) cls += " cal-day-has-news";
    if (isActive) cls += " cal-day-active";
    if (isToday && !isActive) cls += " cal-day-today";
    const href = iso === TODAY ? "#/" : `#/date/${iso}`;
    cells.push(hasNews
      ? `<a class="${cls}" href="${href}">${d}</a>`
      : `<div class="${cls}">${d}</div>`);
  }

  const favCount = getFavourites().length;
  const favActive = window.location.hash === "#/favorites";
  const badge = favCount > 0 ? `<span class="fav-count">${favCount}</span>` : "";
  const favCls = `cal-fav-btn${favActive ? " cal-fav-active" : ""}`;

  return `
    <div class="cal-nav">
      <div class="cal-header">
        <button class="cal-month-btn" data-month="${prevM}">&#8249;</button>
        <span class="cal-month-label">${monthLabel}</span>
        <button class="cal-month-btn" data-month="${nextM}">&#8250;</button>
        <a class="${favCls}" href="#/favorites">⭐ Saved${badge}</a>
      </div>
      <div class="cal-weekdays">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div class="cal-grid">${cells.join("")}</div>
    </div>`;
}

function bindCalendarNav(rerenderFn) {
  document.querySelectorAll(".cal-month-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      calMonth = btn.dataset.month;
      rerenderFn();
    });
  });
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
  calMonth = date.slice(0, 7);

  const [data, allDates] = await Promise.all([
    loadStories(date).catch(() => null),
    loadIndex(),
  ]);

  const nav = renderCalendarNav(allDates, date);

  if (!data) {
    app.innerHTML = nav + `<div class="error-box">No stories found for this date. 😢 <a href="#/">Back to today's news</a></div>`;
    bindCalendarNav(() => renderHome(date));
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
  bindCalendarNav(() => renderHome(date));
}

// --- Favourites page ---

async function renderFavourites() {
  app.innerHTML = `<div class="loading"><div class="loading-emoji">⭐</div><p>Loading saved stories…</p></div>`;

  const allDates = await loadIndex();
  const nav = renderCalendarNav(allDates, null);
  const favs = getFavourites();
  const vocabFavs = getVocabFavs();

  if (favs.length === 0 && vocabFavs.length === 0) {
    app.innerHTML = nav + `
      <div class="empty-favs">
        <div class="empty-emoji">⭐</div>
        <h2>No saved items yet</h2>
        <p>Tap ⭐ on any story card to save it, or ⭐ on any power word or phrase to save it here.</p>
        <a class="back-link" href="#/">Browse today's news</a>
      </div>`;
    setHeaderDate("Saved Stories");
    bindCalendarNav(() => renderFavourites());
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

  const vocabItems = vocabFavs.map(v => v.type === "word" ? `
    <div class="vocab-item">
      <div class="vocab-row">
        <div><span class="word">${esc(v.word)}</span><span class="word-type">(${esc(v.wordType)})</span></div>
        <button class="vocab-star-btn vocab-star-active" data-vkey="${esc(v.key)}" title="Unsave word" aria-label="Unsave word">⭐</button>
      </div>
      <div class="meaning">${esc(v.meaning)}</div>
      <div class="example">${esc(v.example)}</div>
      <div class="vocab-source">from <a href="#/story/${esc(v.storyDate)}/${esc(v.storyId)}">${esc(v.storyTitle)}</a></div>
    </div>` : `
    <div class="vocab-item phrase-item">
      <div class="vocab-row">
        <span class="word">${esc(v.phrase)}</span>
        <button class="vocab-star-btn vocab-star-active" data-vkey="${esc(v.key)}" title="Unsave phrase" aria-label="Unsave phrase">⭐</button>
      </div>
      <div class="meaning">${esc(v.meaning)}</div>
      <div class="example">${esc(v.example)}</div>
      <div class="vocab-source">from <a href="#/story/${esc(v.storyDate)}/${esc(v.storyId)}">${esc(v.storyTitle)}</a></div>
    </div>`).join("");

  const storiesSection = favs.length > 0 ? `
    <div class="intro intro-favs">
      <h1>Your Saved Stories ⭐</h1>
      <p>Tap ⭐ again on any card to unsave it.</p>
    </div>
    <div class="story-list">${cards}</div>` : "";

  const vocabSection = vocabFavs.length > 0 ? `
    <div class="section vocab-favs-section">
      <h2>📚 Your Saved Words &amp; Phrases</h2>
      <div class="vocab-list">${vocabItems}</div>
    </div>` : "";

  app.innerHTML = nav + storiesSection + vocabSection;

  setHeaderDate("Saved Stories");
  window.scrollTo(0, 0);
  bindCalendarNav(() => renderFavourites());

  document.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const { date, id } = btn.dataset;
      toggleFavourite({ date, id });
      renderFavourites();
    });
  });

  document.querySelectorAll(".vocab-star-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      toggleVocabFav({ key: btn.dataset.vkey });
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
  const words    = (s.compo_words || []).map(w => {
    const vkey = `word:${w.word}`;
    return `
    <div class="vocab-item">
      <div class="vocab-row">
        <div><span class="word">${esc(w.word)}</span><span class="word-type">(${esc(w.type)})</span></div>
        <button class="vocab-star-btn${isVocabFav(vkey) ? " vocab-star-active" : ""}" data-vkey="${esc(vkey)}" data-vtype="word" title="Save word" aria-label="Save word">⭐</button>
      </div>
      <div class="meaning">${esc(w.meaning)}</div>
      <div class="example">${esc(w.example)}</div>
    </div>`;
  }).join("");
  const phrases  = (s.compo_phrases || []).map(p => {
    const vkey = `phrase:${p.phrase}`;
    return `
    <div class="vocab-item phrase-item">
      <div class="vocab-row">
        <span class="word">${esc(p.phrase)}</span>
        <button class="vocab-star-btn${isVocabFav(vkey) ? " vocab-star-active" : ""}" data-vkey="${esc(vkey)}" data-vtype="phrase" title="Save phrase" aria-label="Save phrase">⭐</button>
      </div>
      <div class="meaning">${esc(p.meaning)}</div>
      <div class="example">${esc(p.example)}</div>
    </div>`;
  }).join("");
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

  document.querySelectorAll(".vocab-star-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const { vkey, vtype } = btn.dataset;
      let item;
      if (vtype === "word") {
        const w = (s.compo_words || []).find(x => `word:${x.word}` === vkey);
        if (w) item = { key: vkey, type: "word", word: w.word, wordType: w.type, meaning: w.meaning, example: w.example, storyTitle: s.title, storyDate: date, storyId: s.id };
      } else {
        const p = (s.compo_phrases || []).find(x => `phrase:${x.phrase}` === vkey);
        if (p) item = { key: vkey, type: "phrase", phrase: p.phrase, meaning: p.meaning, example: p.example, storyTitle: s.title, storyDate: date, storyId: s.id };
      }
      if (item) {
        toggleVocabFav(item);
        btn.classList.toggle("vocab-star-active", isVocabFav(vkey));
      }
    });
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

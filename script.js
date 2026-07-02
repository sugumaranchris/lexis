'use strict';

/* ══════════════════════════════════════════
   LEXIS — script.js (FIXED & FULLY FUNCTIONAL)
   ══════════════════════════════════════════ */

/* ── Constants ── */
const DB_KEY     = 'lexis_v4';
const TRANS_DB   = 'lexis_trans_v2';
const THEME_KEY  = 'lexis_theme';
const TODAY_KEY  = 'lexis_today_' + new Date().toDateString();
const DICT_API   = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

/* ── Safe Client-Side Cross-Origin Translation Interface ── */
/* ── PASTE YOUR CLOUDFLARE WORKER URL BELOW ── */
const PROXY_URL = 'https://lexis-translate.YOUR-SUBDOMAIN.workers.dev';

async function translateText(text, from, to) {
  const langPair = `${from}|${to}`;

  // Try Cloudflare Worker first (Claude AI — most reliable)
  if (!PROXY_URL.includes('YOUR-SUBDOMAIN')) {
    try {
      const fromName = LANGUAGES.find(l => l.code === from)?.name || from;
      const toName   = LANGUAGES.find(l => l.code === to)?.name || to;
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, from: fromName, to: toName })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translated) return data.translated;
      }
    } catch (e) { /* fall through to MyMemory */ }
  }

  // Fallback: MyMemory API (free, no key)
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Translation failed');
  const data = await response.json();
  const translated = data.responseData?.translatedText?.trim();
  if (!translated) throw new Error('Empty result returned');
  return translated;
}

const TRENDING = ['Resilience','Eloquent','Empathy','Diligent','Serendipity','Ephemeral','Meticulous','Perseverance'];
const WOTD_LIST = [
  {word:'Serendipity', def:'The occurrence of events by chance in a happy way.'},
  {word:'Ephemeral',   def:'Lasting for a very short time.'},
  {word:'Resilience',  def:'The capacity to recover quickly from difficulties.'},
  {word:'Eloquent',    def:'Fluent or persuasive in speaking or writing.'},
  {word:'Melancholy',  def:'A feeling of pensive sadness, typically with no obvious cause.'},
];

const LANGUAGES = [
  {code:'en',  name:'English'}, {code:'ta',  name:'Tamil'}, {code:'hi',  name:'Hindi'},
  {code:'fr',  name:'French'}, {code:'de',  name:'German'}, {code:'es',  name:'Spanish'},
  {code:'it',  name:'Italian'}, {code:'pt',  name:'Portuguese'}, {code:'ru',  name:'Russian'},
  {code:'zh',  name:'Chinese (Simplified)'}, {code:'ja',  name:'Japanese'}, {code:'ko',  name:'Korean'},
  {code:'ar',  name:'Arabic'}, {code:'bn',  name:'Bengali'}, {code:'te',  name:'Telugu'},
  {code:'mr',  name:'Marathi'}, {code:'ur',  name:'Urdu'}, {code:'ml',  name:'Malayalam'},
  {code:'kn',  name:'Kannada'}, {code:'gu',  name:'Gujarati'}, {code:'pa',  name:'Punjabi'},
  {code:'nl',  name:'Dutch'}, {code:'pl',  name:'Polish'}, {code:'sv',  name:'Swedish'},
  {code:'tr',  name:'Turkish'}, {code:'id',  name:'Indonesian'}, {code:'th',  name:'Thai'},
  {code:'vi',  name:'Vietnamese'}, {code:'uk',  name:'Ukrainian'}, {code:'el',  name:'Greek'},
  {code:'he',  name:'Hebrew'}, {code:'fa',  name:'Persian'}, {code:'sw',  name:'Swahili'},
  {code:'tl',  name:'Filipino'}, {code:'ms',  name:'Malay'}, {code:'ro',  name:'Romanian'},
  {code:'hu',  name:'Hungarian'}, {code:'cs',  name:'Czech'}, {code:'sk',  name:'Slovak'},
  {code:'bg',  name:'Bulgarian'}, {code:'hr',  name:'Croatian'}, {code:'sr',  name:'Serbian'},
  {code:'lt',  name:'Lithuanian'}, {code:'lv',  name:'Latvian'}, {code:'et',  name:'Estonian'},
  {code:'fi',  name:'Finnish'}, {code:'da',  name:'Danish'}, {code:'no',  name:'Norwegian'},
  {code:'is',  name:'Icelandic'}, {code:'mk',  name:'Macedonian'}, {code:'sq',  name:'Albanian'},
  {code:'ka',  name:'Georgian'}, {code:'hy',  name:'Armenian'}, {code:'mn',  name:'Mongolian'},
  {code:'ne',  name:'Nepali'}, {code:'si',  name:'Sinhala'}, {code:'cy',  name:'Welsh'},
  {code:'af',  name:'Afrikaans'},
];

/* ── State ── */
let vocab        = dbLoad(DB_KEY, []);
let transHistory = dbLoad(TRANS_DB, []);
let currentWord  = null;
let currentPosIdx = 0;
let todayCount   = parseInt(sessionStorage.getItem(TODAY_KEY)||'0', 10);
let currentPage  = 'home';
let quizQ=0, quizScore=0, quizTotal=0;
let exCurrentLang = 'en';
let aiExpanded = false;

/* ── DOM Mapping Initialization ── */
const $ = id => document.getElementById(id);
const el = {
  sidebar:   $('sidebar'),   hamburger: $('hamburger'), mobOverlay:$('mob-overlay'),
  searchForm:$('search-form'), wordInput: $('word-input'), micBtn:    $('mic-btn'),
  themeBtn:  $('theme-btn'),  themeLabel: $('theme-label'), toast:     $('toast'),
  wotdWord:  $('wotd-word'), wotdDef: $('wotd-def'), wotdBtn: $('wotd-btn'),
  pageHome:     $('page-home'), pageWord:     $('page-word'), pageQuiz:     $('page-quiz'),
  pageLibrary:  $('page-library'), pageFavs:     $('page-favs'), pageHistory:  $('page-history'),
  statSaved:      $('stat-saved'), statFav:        $('stat-fav'), statToday:      $('stat-today'),
  trendingChips:  $('trending-chips'), recentSearches: $('recent-searches-block'),
  wtWord:     $('wt-word'),    wtPhonetic: $('wt-phonetic'), wtPosBadges:$('wt-pos-badges'),
  defTabs:    $('def-tabs'),   defBody: $('def-body'),
  waSpeak:    $('wa-speak'),   waFav: $('wa-fav'), waSave:     $('wa-save'),    waShare: $('wa-share'),
  exLangSelect: $('ex-lang-select'), examplesList:$('examples-list'),
  transTo:    $('trans-to'), itIdle:     $('it-idle'), itLoading:  $('it-loading'),
  itResult:   $('it-result'), itError:    $('it-error'), itListen:   $('it-listen'),
  itCopy:     $('it-copy'), tcActions:  $('tc-actions'),
  aiBody:         $('ai-body'), explainMoreBtn: $('explain-more-btn'), usageBody: $('usage-body'),
  libSearch: $('lib-search'), wordGrid: $('word-grid'), favGrid: $('fav-grid'),
  histListPage: $('history-list-page'), clearHistoryBtn: $('clear-history-btn'),
  quizWrap: $('quiz-wrap'),
  installBanner: $('install-banner'), installYes: $('install-yes'), installNo: $('install-no'),
};

/* ── Local Storage Data Parsers ── */
function dbLoad(k,fb){try{return JSON.parse(localStorage.getItem(k))||fb;}catch{return fb;}}
function dbSave(k,d){localStorage.setItem(k,JSON.stringify(d));}

/* ══ INITIALIZATION RUN ══ */
initTheme();
buildLangSelects();
renderWOTD();
renderTrending();
updateStats();
renderRecentSearches();

/* ══ CORE NAVIGATION CONTROLS ══ */
const PAGE_MAP = {
  home:     el.pageHome, dict:     el.pageWord, quiz:     el.pageQuiz,
  library:  el.pageLibrary, favs:     el.pageFavs, history:  el.pageHistory,
};

document.querySelectorAll('.nav-link[data-view]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    goPage(link.dataset.view);
  });
});

function goPage(view) {
  closeSidebar();

  if (view === 'dict' && !currentWord) {
    toast('Search a word first to view it in the dictionary.');
    view = 'home';
  }

  currentPage = view;
  Object.values(PAGE_MAP).forEach(p => { if(p) p.classList.add('hidden'); });
  
  const target = PAGE_MAP[view];
  if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.view === view));

  if (view === 'library')  renderGrid(el.wordGrid, vocab, el.libSearch.value);
  if (view === 'favs')     renderGrid(el.favGrid, vocab.filter(w=>w.isFav));
  if (view === 'history')  renderHistoryPage();
  if (view === 'quiz')     startQuiz();
}

/* ══ INTERACTIVE SIDEBAR WRAPPERS ══ */
el.hamburger.addEventListener('click', () => {
  el.sidebar.classList.add('open');
  el.mobOverlay.classList.remove('hidden');
});
el.mobOverlay.addEventListener('click', closeSidebar);
function closeSidebar() {
  el.sidebar.classList.remove('open');
  el.mobOverlay.classList.add('hidden');
}

/* ══ STYLESHEET STATE MANIPULATION ══ */
function initTheme() {
  const t = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.dataset.theme = t;
  el.themeLabel.textContent = t === 'dark' ? 'Light Mode' : 'Dark Mode';
}
el.themeBtn.addEventListener('click', e => {
  e.preventDefault();
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  el.themeLabel.textContent = dark ? 'Dark Mode' : 'Light Mode';
  localStorage.setItem(THEME_KEY, dark ? 'light' : 'dark');
});

/* ══ INTERACTIVE ELEMENTS RENDERING ══ */
function renderWOTD() {
  const w = WOTD_LIST[new Date().getDate() % WOTD_LIST.length];
  el.wotdWord.textContent = `"${w.word}"`;
  el.wotdDef.textContent  = w.def;
  
  const newBtn = el.wotdBtn.cloneNode(true);
  el.wotdBtn.parentNode.replaceChild(newBtn, el.wotdBtn);
  el.wotdBtn = newBtn;
  el.wotdBtn.addEventListener('click', () => lookupWord(w.word));
}

function renderTrending() {
  el.trendingChips.innerHTML = TRENDING.map(w =>
    `<button class="trend-chip" data-w="${escAttr(w)}">${escHtml(w)}</button>`
  ).join('');
  el.trendingChips.querySelectorAll('.trend-chip').forEach(c =>
    c.addEventListener('click', () => lookupWord(c.dataset.w))
  );
}

function renderRecentSearches() {
  if (!vocab.length) { el.recentSearches.innerHTML = ''; return; }
  el.recentSearches.innerHTML = `
    <div class="rs-header">
      <span class="rs-title">Recent Searches</span>
      <button class="see-all-btn" id="see-all-hist">See all</button>
    </div>
    <div class="rs-list">${
      vocab.slice(0,5).map(w=>`
        <div class="rs-item" data-id="${w.id}">
          <span class="rs-icon">◷</span>
          <span class="rs-word">${escHtml(w.word)}</span>
          ${w.meanings[0]?`<span class="rs-pos">${w.meanings[0].pos}</span>`:''}
          <span class="rs-icon">↗</span>
        </div>`).join('')
    }</div>`;
  el.recentSearches.querySelectorAll('.rs-item').forEach(item => {
    item.addEventListener('click', () => {
      const w = vocab.find(v=>v.id==item.dataset.id);
      if (w) showWordPage(w);
    });
  });
  $('see-all-hist')?.addEventListener('click', ()=>goPage('history'));
}

/* ══ DICTIONARY SEARCH ENGINE PROCESSING ══ */
el.searchForm.addEventListener('submit', async e => {
  e.preventDefault();
  const q = el.wordInput.value.trim();
  if (!q) return;
  await lookupWord(q);
  el.wordInput.value = '';
  el.wordInput.blur();
});

el.micBtn.addEventListener('click', () => {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    toast('Voice search not supported in this browser.'); return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = 'en-US'; rec.interimResults = false;
  el.micBtn.textContent = '⏺';
  rec.onresult = e => {
    const word = e.results[0][0].transcript.trim();
    el.micBtn.textContent = '🎙';
    lookupWord(word);
  };
  rec.onerror = () => { el.micBtn.textContent = '🎙'; toast('Voice search failed.'); };
  rec.onend   = () => { el.micBtn.textContent = '🎙'; };
  rec.start();
});

async function lookupWord(word) {
  closeSidebar();
  goPage('dict');
  showWordLoading(word);
  try {
    const res  = await fetch(DICT_API + encodeURIComponent(word.toLowerCase()));
    if (!res.ok) throw new Error();
    const data = await res.json();
    const entry = buildEntry(data[0]);
    upsertVocab(entry);
    bumpToday();
    currentWord = entry;
    currentPosIdx = 0;
    showWordPage(entry);
  } catch {
    showWordError(word);
  }
}

function showWordLoading(word) {
  el.defBody.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:2rem 0;color:var(--text-2);">
    <div class="spinner"></div> Looking up "${escHtml(word)}"…</div>`;
  el.wtWord.textContent     = word;
  el.wtPhonetic.textContent = '/.../';
  el.wtPosBadges.innerHTML  = '';
  el.defTabs.innerHTML      = '';
  el.aiBody.innerHTML       = '<p class="ai-placeholder">Generating explanation…</p>';
  el.explainMoreBtn.classList.add('hidden');
  el.usageBody.innerHTML    = '<p class="usage-placeholder">Loading…</p>';
  resetTransCard();
  el.examplesList.innerHTML = `<div class="ex-loading"><div class="spinner"></div> Loading examples…</div>`;
}

function showWordError(word) {
  el.defBody.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-2);">
    <div style="font-size:2rem;margin-bottom:0.75rem;">?</div>
    <strong>"${escHtml(word)}"</strong> was not found.<br>
    <small>Check spelling or try a simpler form.</small></div>`;
}

function buildEntry(raw) {
  const ex = vocab.find(v=>v.word.toLowerCase()===raw.word.toLowerCase());
  let audio = raw.phonetics?.find(p=>p.audio)?.audio || '';
  if (audio && audio.startsWith('//')) {
    audio = 'https:' + audio;
  }

  return {
    id:       ex?.id || Date.now(),
    word:     raw.word,
    phonetic: raw.phonetic || raw.phonetics?.find(p=>p.text)?.text || '',
    audioUrl: audio,
    meanings: raw.meanings.map(m=>({
      pos:  m.partOfSpeech,
      defs: m.definitions.slice(0,4).map(d=>({d:d.definition, ex:d.example||''})),
      synonyms:[...new Set([...(m.synonyms||[]),...m.definitions.flatMap(d=>d.synonyms||[])])].slice(0,10),
      antonyms:[...new Set([...(m.antonyms||[]),...m.definitions.flatMap(d=>d.antonyms||[])])].slice(0,6),
    })),
    isFav:   ex?.isFav || false,
    savedAt: ex?.savedAt || Date.now(),
    source:  raw.sourceUrls?.[0] || '',
  };
}

function upsertVocab(entry) {
  const idx = vocab.findIndex(v=>v.id===entry.id || v.word.toLowerCase() === entry.word.toLowerCase());
  if (idx>=0) vocab[idx]=entry; else vocab.unshift(entry);
  dbSave(DB_KEY, vocab);
  updateStats();
  renderRecentSearches();
}

function bumpToday() {
  todayCount++;
  sessionStorage.setItem(TODAY_KEY, todayCount);
  el.statToday.textContent = todayCount;
}

/* ══ DICTIONARY INTERACTION SUB-ROUTINES ══ */
function showWordPage(entry) {
  currentWord  = entry;
  currentPosIdx = 0;
  aiExpanded   = false;

  el.wtWord.textContent     = entry.word;
  el.wtPhonetic.textContent = entry.phonetic || '/.../';
  el.wtPosBadges.innerHTML  = [...new Set(entry.meanings.map(m=>m.pos))]
    .map(p=>`<span class="pos-badge">${p}</span>`).join('');

  syncFavBtn(entry);

  el.defTabs.innerHTML = entry.meanings.map((m,i)=>`
    <button class="def-tab ${i===0?'active':''}" data-idx="${i}">${m.pos}</button>
  `).join('');
  
  const hasSyn = entry.meanings.some(m=>m.synonyms.length);
  const hasAnt = entry.meanings.some(m=>m.antonyms.length);
  if (hasSyn) el.defTabs.innerHTML += `<button class="def-tab" data-idx="syn">Synonyms</button>`;
  if (hasAnt) el.defTabs.innerHTML += `<button class="def-tab" data-idx="ant">Antonyms</button>`;

  el.defTabs.querySelectorAll('.def-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      el.defTabs.querySelectorAll('.def-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const idx = tab.dataset.idx;
      if (idx==='syn') renderSynAnt(entry, 'syn');
      else if (idx==='ant') renderSynAnt(entry, 'ant');
      else { currentPosIdx=+idx; renderDefinitions(entry.meanings[+idx]); }
    });
  });

  renderDefinitions(entry.meanings[0]);
  doWordTranslation();
  exCurrentLang = 'en';
  el.exLangSelect.value = 'en';
  renderExamples(entry, 'en');
  generateAIExplain(entry);
  renderUsage(entry);
  goPage('dict');
}

function renderDefinitions(m) {
  let html = '';
  m.defs.forEach((d,i)=>{
    html += `<div class="def-item">
      <span class="def-num">0${i+1}</span>
      <p class="def-text">${escHtml(d.d)}</p>
      ${d.ex?`<p class="def-ex">${escHtml(d.ex)}</p>`:''}
    </div>`;
    if (i<m.defs.length-1) html += '<div class="def-divider"></div>';
  });
  el.defBody.innerHTML = html;
}

function renderSynAnt(entry, type) {
  const words = [...new Set(entry.meanings.flatMap(m=>type==='syn'?m.synonyms:m.antonyms))].slice(0,20);
  if (!words.length) { el.defBody.innerHTML=`<p style="color:var(--text-3);padding:1rem 0;">No ${type==='syn'?'synonyms':'antonyms'} found.</p>`; return; }
  el.defBody.innerHTML = `
    <p class="chips-label">${type==='syn'?'Synonyms':'Antonyms'}</p>
    <div class="chips-row">${words.map(w=>`<button class="word-chip" data-word="${escAttr(w)}">${escHtml(w)}</button>`).join('')}</div>`;
  
  el.defBody.querySelectorAll('.word-chip').forEach(btn => {
    btn.addEventListener('click', () => lookupWord(btn.dataset.word));
  });
}

function syncFavBtn(entry) {
  el.waFav.classList.toggle('fav-on', entry.isFav);
  el.waFav.textContent = entry.isFav ? '❤️' : '🤍';
}

/* ── Interactive Layout Bar Controls ── */
el.waSpeak.addEventListener('click', () => {
  if (!currentWord) return;
  if (currentWord.audioUrl) {
    const audio = new Audio(currentWord.audioUrl);
    audio.play().catch(() => tts(currentWord.word, 'en'));
  } else {
    tts(currentWord.word, 'en');
  }
  el.waSpeak.style.transform='scale(1.2)';
  setTimeout(()=>el.waSpeak.style.transform='', 400);
});

el.waFav.addEventListener('click', () => {
  if (!currentWord) return;
  currentWord.isFav = !currentWord.isFav;
  syncFavBtn(currentWord);
  upsertVocab(currentWord);
  toast(currentWord.isFav ? '❤️ Added to favorites' : 'Removed from favorites');
});

el.waSave.addEventListener('click', () => {
  if (!currentWord) return;
  upsertVocab(currentWord);
  toast('✅ Word explicitly saved to Library');
});

el.waShare.addEventListener('click', () => {
  if (!currentWord) return;
  const m = currentWord.meanings[currentPosIdx];
  const text = `${currentWord.word} — ${m?.defs[0]?.d||''}`;
  if (navigator.share) {
    navigator.share({title:'Lexis', text}).catch(()=>{});
  } else {
    navigator.clipboard.writeText(text).then(()=>toast('⎘ Copied to clipboard!'));
  }
});

/* ── Contextual Local AI Engine Simulation ── */
async function generateAIExplain(entry) {
  aiExpanded = false;
  el.explainMoreBtn.classList.add('hidden');
  el.aiBody.innerHTML = '<p class="ai-placeholder">Generating simple explanation…</p>';

  const def = entry.meanings[0]?.defs[0]?.d || '';
  const word = entry.word;
  await new Promise(r=>setTimeout(r, 450));

  const simple = buildSimpleExplain(word, def);
  const detailed = buildDetailedExplain(word, entry);

  el.aiBody.innerHTML = `
    <span class="ai-tag">Simple Explanation</span>
    <p class="ai-text" id="ai-text-content">${escHtml(simple)}</p>`;
  el.explainMoreBtn.classList.remove('hidden');
  el.explainMoreBtn.textContent = 'Explain More';
  
  el.explainMoreBtn.onclick = () => {
    aiExpanded = !aiExpanded;
    $('ai-text-content').textContent = aiExpanded ? detailed : simple;
    el.explainMoreBtn.textContent = aiExpanded ? 'Show Less' : 'Explain More';
  };
}

function buildSimpleExplain(word, def) {
  const cleaned = def.replace(/\.$/, '').toLowerCase();
  return `"${word}" simply describes the state or action of being ${cleaned}. It is a highly practical addition to everyday expression.`;
}

function buildDetailedExplain(word, entry) {
  const defs = entry.meanings[0]?.defs || [];
  const syns = entry.meanings[0]?.synonyms.slice(0, 3) || [];
  let text = `"${word}" functions dynamically as a ${entry.meanings[0]?.pos || 'term'}. `;
  if (defs[0]) text += `Primary usage path: ${defs[0].d} `;
  if (defs[1]) text += `Secondary contextual variant: ${defs[1].ex} `;
  if (syns.length) text += `Interchangeable variants include: ${syns.join(', ')}. `;
  return text;
}

function renderUsage(entry) {
  const defCount = entry.meanings.reduce((a,m)=>a+m.defs.length, 0);
  const pct = Math.min(95, Math.max(20, defCount * 18 + 10));
  const usageDesc = pct > 70
    ? 'This word is used frequently across complex contexts.'
    : pct > 45
    ? 'This word appears commonly in standard modern media structures.'
    : 'This word is highly specialized, surfacing in rare literary contexts.';

  el.usageBody.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;width:100%;">
      <p class="usage-text" style="font-size:0.88rem;color:var(--text-2);line-height:1.6;flex:1;">${usageDesc}</p>
      <div class="usage-circle" style="flex-shrink:0;position:relative;width:64px;height:64px;">
        <svg width="64" height="64" class="usage-ring" style="transform:rotate(-90deg);">
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" stroke-width="5"/>
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--accent)" stroke-width="5"
            stroke-dasharray="${Math.round(2*Math.PI*26)}"
            stroke-dashoffset="${Math.round(2*Math.PI*26*(1-pct/100))}"
            stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:0.78rem;font-weight:700;color:var(--accent);">${pct}%</div>
      </div>
    </div>`;
}

/* ── Inline Translation Subsections ── */
function buildLangSelects() {
  const opts = `<option value="">— Select language —</option>` +
    LANGUAGES.filter(l=>l.code!=='en').map(l=>`<option value="${l.code}">${l.name}</option>`).join('');
  el.transTo.innerHTML = opts;
}

function showTransState(state) {
  el.itIdle.style.display    = state === 'idle'    ? '' : 'none';
  el.itLoading.style.display = state === 'loading' ? 'flex' : 'none';
  el.itResult.style.display  = state === 'result'  ? 'block' : 'none';
  el.itError.style.display   = state === 'error'   ? 'block' : 'none';
  el.tcActions.style.display = state === 'result'  ? 'flex' : 'none';
}

function resetTransCard() {
  showTransState('idle');
  el.itResult.textContent = '';
}

el.transTo.addEventListener('change', () => {
  doWordTranslation();
});

el.itListen.addEventListener('click', () => {
  const t = el.itResult.textContent;
  if (t) tts(t, el.transTo.value);
});
el.itCopy.addEventListener('click', () => {
  const t = el.itResult.textContent;
  if (t) navigator.clipboard.writeText(t).then(()=>toast('⎘ Translation copied!'));
});

async function doWordTranslation() {
  const word = currentWord?.word;
  const to = el.transTo.value;
  if (!word || !to) { resetTransCard(); return; }

  showTransState('loading');
  try {
    const translated = await translateText(word, 'en', to);
    el.itResult.textContent = translated;
    showTransState('result');
  } catch (err) {
    showTransState('error');
  }
}

/* ── Example Engine Processing Arrays ── */
el.exLangSelect.addEventListener('change', () => {
  if (!currentWord) return;
  exCurrentLang = el.exLangSelect.value;
  renderExamples(currentWord, exCurrentLang);
});

function collectExamples(entry) {
  const ex = [];
  entry.meanings.forEach(m=>m.defs.forEach(d=>{ if(d.ex) ex.push(d.ex); }));
  if (ex.length<3) {
    const w = entry.word;
    const def = entry.meanings[0]?.defs[0]?.d||'';
    ex.push(`${w[0].toUpperCase()+w.slice(1)} is essential in modern expressive communication patterns.`);
    ex.push(`She demonstrated deep and natural ${w} during the structural assessment workflow.`);
    ex.push(`The core application of ${w} represents: ${def.toLowerCase().replace(/\.$/,'')}.`);
  }
  return [...new Set(ex)].slice(0, 5);
}

async function renderExamples(entry, langCode) {
  const sentences = collectExamples(entry);
  if (langCode === 'en') { renderExamplesHTML(sentences, 'en'); return; }
  
  el.examplesList.innerHTML = `<div class="ex-loading"><div class="spinner"></div> Translating examples…</div>`;
  try {
    const translated = await Promise.all(
      sentences.map(s => translateText(s, 'en', langCode).catch(() => s))
    );
    renderExamplesHTML(translated, langCode);
  } catch {
    renderExamplesHTML(sentences, 'en');
    toast('Could not translate examples. Showing English.');
  }
}

function renderExamplesHTML(sentences, langCode) {
  const word = currentWord?.word||'';
  el.examplesList.innerHTML = sentences.map((s) => {
    const highlighted = s.replace(new RegExp(`(${word})`, 'gi'), '<em>$1</em>');
    return `<div class="ex-row">
      <p class="ex-sentence">${highlighted}</p>
      <button class="ex-mini-btn" data-speak="${escAttr(s)}" title="Speak">🔊</button>
      <button class="ex-mini-btn" data-copy="${escAttr(s)}" title="Copy">📋</button>
    </div>`;
  }).join('');

  el.examplesList.querySelectorAll('[data-speak]').forEach(b => {
    b.addEventListener('click', () => tts(b.dataset.speak, langCode));
  });
  el.examplesList.querySelectorAll('[data-copy]').forEach(b => {
    b.addEventListener('click', () => navigator.clipboard.writeText(b.dataset.copy).then(()=>toast('⎘ Copied!')));
  });
}

/* ══ CARD VIEW AND DISPLAY GRIDS ══ */
el.libSearch.addEventListener('input', () => renderGrid(el.wordGrid, vocab, el.libSearch.value));

function renderGrid(container, words, filter='') {
  const q = filter.toLowerCase();
  const list = q ? words.filter(w=>w.word.toLowerCase().includes(q) || w.meanings[0]?.defs[0]?.d?.toLowerCase().includes(q)) : words;
  
  if (!list.length) {
    container.innerHTML=`<div class="empty-state"><div class="empty-icon">◈</div><p>${filter?'No words match your filter.':'Nothing saved yet. Search a word to get started!'}</p></div>`;
    return;
  }
  
  container.innerHTML = list.map(w=>`
    <div class="word-tile" data-id="${w.id}">
      <div class="tile-word">${escHtml(w.word)}</div>
      ${w.meanings[0]?`<div class="tile-pos">${w.meanings[0].pos}</div>`:''}
      <div class="tile-def">${escHtml(w.meanings[0]?.defs[0]?.d||'')}</div>
      <div class="tile-footer">
        <button class="tile-fav ${w.isFav?'on':''}" data-fav="${w.id}">${w.isFav?'❤️':'🤍'}</button>
        <button class="tile-del" data-del="${w.id}">Remove</button>
      </div>
    </div>`).join('');
    
  container.querySelectorAll('.word-tile').forEach(tile=>{
    tile.addEventListener('click', e => {
      if(e.target.closest('[data-fav]') || e.target.closest('[data-del]')) return;
      const w = vocab.find(v=>v.id == tile.dataset.id);
      if (w) showWordPage(w);
    });
  });
  
  container.querySelectorAll('[data-fav]').forEach(btn=>{
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const w = vocab.find(v=>v.id == btn.dataset.fav); if(!w) return;
      w.isFav = !w.isFav; 
      dbSave(DB_KEY, vocab); 
      updateStats();
      renderGrid(container, container === el.favGrid ? vocab.filter(v=>v.isFav) : vocab, el.libSearch?.value||'');
      if(currentWord?.id === w.id) syncFavBtn(w);
      toast(w.isFav ? '❤️ Favorited' : 'Unfavorited');
    });
  });
  
  container.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = Number(btn.dataset.del); 
      vocab = vocab.filter(v=>v.id !== id);
      dbSave(DB_KEY, vocab); 
      updateStats(); 
      renderRecentSearches();
      renderGrid(container, container === el.favGrid ? vocab.filter(v=>v.isFav) : vocab, el.libSearch?.value||'');
      if(currentWord?.id === id) { currentWord = null; }
      toast('Word removed.');
    });
  });
}

/* ══ RENDERING PERSISTENT HISTORICAL SEARCH LOGS ══ */
function renderHistoryPage() {
  if (!vocab.length) { el.histListPage.innerHTML='<p style="color:var(--text-3);padding:1rem 0;">No search history yet.</p>'; return; }
  el.histListPage.innerHTML = vocab.map(w=>`
    <div class="history-item-row" data-id="${w.id}">
      <span style="color:var(--text-3);font-size:0.9rem;">◷</span>
      <span class="hi-word">${escHtml(w.word)}</span>
      ${w.isFav?'<span class="hi-fav">❤️</span>':''}
      ${w.meanings[0]?`<span class="hi-pos">${w.meanings[0].pos}</span>`:''}
    </div>`).join('');
    
  el.histListPage.querySelectorAll('.history-item-row').forEach(row=>{
    row.addEventListener('click',()=>{
      const w = vocab.find(v=>v.id == row.dataset.id); if(w) showWordPage(w);
    });
  });
}

el.clearHistoryBtn?.addEventListener('click', () => {
  if(!confirm('Clear all search logs and current local history?')) return;
  vocab = []; 
  currentWord = null;
  dbSave(DB_KEY, vocab); 
  updateStats(); 
  renderRecentSearches();
  renderHistoryPage(); 
  toast('History cleared.');
});

function updateStats() {
  const favs = vocab.filter(v=>v.isFav);
  el.statSaved.textContent = vocab.length;
  el.statFav.textContent   = favs.length;
  el.statToday.textContent = todayCount;
}

/* ══ GAMIFIED VOCABULARY SECTIONS ══ */
function startQuiz() {
  quizQ = 0; quizScore = 0;
  if (vocab.length < 4) {
    el.quizWrap.innerHTML=`<div class="no-quiz">You need at least <strong>4 saved words</strong> in history to generate a dynamic quiz session. Look up more words!</div>`;
    return;
  }
  quizTotal = Math.min(10, vocab.length);
  renderQuizHead(); 
  nextQuizQ();
}

function renderQuizHead() {
  el.quizWrap.innerHTML=`
    <div class="quiz-head">
      <h2>Word Quiz</h2>
      <div class="quiz-score-bar">Score: <strong id="q-score">0</strong>/${quizTotal} &nbsp;·&nbsp; Question <strong id="q-num">1</strong>/${quizTotal}</div>
    </div>
    <div id="q-area"></div>`;
}

function nextQuizQ() {
  if(quizQ >= quizTotal){ showQuizResult(); return; }
  $('q-score').textContent = quizScore; 
  $('q-num').textContent   = quizQ + 1;
  
  const sh = [...vocab].sort(()=>Math.random()-0.5);
  const ans = sh[0], opts = [...sh.slice(1,4), ans].sort(()=>Math.random()-0.5);
  const area = $('q-area');
  
  area.innerHTML=`<div class="quiz-card">
    <p class="quiz-q-label">What word matches this definition?</p>
    <p class="quiz-def">${escHtml(ans.meanings[0]?.defs[0]?.d||'—')}</p>
    <div class="quiz-opts">${opts.map(o=>`<button class="quiz-opt" data-correct="${o.id===ans.id}">${escHtml(o.word)}</button>`).join('')}</div>
    <button class="quiz-next" id="q-next">Next →</button>
  </div>`;
  
  area.querySelectorAll('.quiz-opt').forEach(btn=>{
    btn.addEventListener('click', () => {
      if(btn.dataset.correct === 'true'){
        quizScore++; 
        btn.classList.add('correct');
      } else {
        btn.classList.add('wrong');
        area.querySelector('[data-correct="true"]').classList.add('correct');
      }
      area.querySelectorAll('.quiz-opt').forEach(b=>b.disabled=true);
      $('q-next').classList.add('show');
    });
  });
  $('q-next').addEventListener('click', () => { quizQ++; renderQuizHead(); nextQuizQ(); });
}

function showQuizResult(){
  const pct = Math.round((quizScore / quizTotal) * 100);
  const msg = pct === 100 ? '🏆 Perfect score!' : pct >= 60 ? '✓ Great job!' : '📖 Keep reading!';
  el.quizWrap.innerHTML=`<div class="quiz-result">
    <h3>Quiz Complete!</h3>
    <div class="quiz-big-score">${quizScore}/${quizTotal}</div>
    <p>${msg}</p>
    <button class="danger-btn" style="background:var(--accent);color:white;min-width:160px;" id="q-retry">Play Again</button>
  </div>`;
  $('q-retry').addEventListener('click', startQuiz);
}

/* ── UI Notification Layout Toast Elements ── */
let toastTimer;
function toast(msg, ms=2800){
  clearTimeout(toastTimer);
  el.toast.textContent = msg; 
  el.toast.classList.remove('hidden');
  toastTimer = setTimeout(()=>el.toast.classList.add('hidden'), ms);
}

function tts(text, lang='en'){
  if(!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; 
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(s){return String(s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;');}

/* ── Service Workers Fallbacks ── */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); 
  deferredPrompt = e; 
  el.installBanner.classList.remove('hidden');
});
el.installYes.addEventListener('click', async () => {
  el.installBanner.classList.add('hidden'); 
  if(!deferredPrompt) return;
  deferredPrompt.prompt(); 
  const{outcome} = await deferredPrompt.userChoice;
  if(outcome === 'accepted') toast('📲 Lexis installed!'); 
  deferredPrompt = null;
});
el.installNo.addEventListener('click', () => { 
  el.installBanner.classList.add('hidden'); 
  deferredPrompt = null; 
});

/* ── Global Variable Exports ── */
window.lookupWord = lookupWord;
window.tts        = tts;
window.toast      = toast;
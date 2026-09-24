(function(){
'use strict';

const D = window.__data;
const SEC = window.__security;
const RL = window.__ratelimit;
const MQ = window.__muqattaat;
const DECOY = window.__decoy;
const KEYS = D.KEYS;

let newsData = loadJSON(KEYS.NEWS, D.DEFAULT_NEWS);
let tickerData = loadJSON(KEYS.TICKER, D.DEFAULT_TICKER);
let settings = Object.assign({}, D.DEFAULT_SETTINGS, loadJSON(KEYS.SETTINGS, {}));
let mostReadData = loadJSON(KEYS.MOSTREAD, D.DEFAULT_MOSTREAD);
let eliteData = loadJSON(KEYS.ELITE, D.DEFAULT_ELITE);

let currentPage = 'home';
let filterTimeout = null;
let sessionTimer = null;
const SESSION_TIMEOUT = 30 * 60 * 1000;

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return JSON.parse(JSON.stringify(fallback));
    const parsed = JSON.parse(raw);
    return parsed || JSON.parse(JSON.stringify(fallback));
  }catch(e){ return JSON.parse(JSON.stringify(fallback)); }
}
function saveJSON(key, data){
  try{ localStorage.setItem(key, JSON.stringify(data)); return true; }
  catch(e){ return false; }
}
function uid(p){ return (p || 'n') + Date.now() + Math.floor(Math.random() * 1000); }
function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s){ return escapeHtml(s); }
function plural(n, o, t, f, m){
  if(n === 1) return o;
  if(n === 2) return t;
  if(n >= 3 && n <= 10) return n + ' ' + f;
  return n + ' ' + m;
}
function relativeTime(m){
  m = Math.max(0, Math.floor(m));
  if(m < 1) return 'الآن';
  if(m < 60) return 'منذ ' + plural(m, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة');
  const h = Math.floor(m / 60);
  if(h < 24) return 'منذ ' + plural(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
  const d = Math.floor(h / 24);
  return 'منذ ' + plural(d, 'يوم', 'يومين', 'أيام', 'يوماً');
}
function minutesAgo(t){ return (Date.now() - t) / 60000; }
function catLabel(cat){
  const map = {
    breaking: { tag:'◈ عاجل', cls:'news-card__tag--breaking', stack:'stack-card__cat--red', badge:'عاجل' },
    official: { tag:'بيان رسمي', cls:'news-card__tag--official', stack:'', badge:'رسمي' },
    reports: { tag:'تقرير', cls:'', stack:'', badge:'تقرير' },
    condolence: { tag:'تعازي', cls:'', stack:'', badge:'تعازي' }
  };
  return map[cat] || { tag:'خبر', cls:'', stack:'', badge:'خبر' };
}

const toastContainer = document.getElementById('toastContainer');
const toastIcons = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
function toast(msg, type){
  type = type || 'info';
  const el = document.createElement('div');
  el.className = 'toast toast--' + type;
  el.innerHTML = '<span class="toast__icon">' + (toastIcons[type] || toastIcons.info) + '</span><span>' + escapeHtml(msg) + '</span>';
  toastContainer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-show'));
  setTimeout(() => {
    el.classList.remove('is-show');
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

function renderTicker(){
  const track = document.getElementById('tickerTrack');
  if(!track) return;
  if(!tickerData.length){ track.innerHTML = ''; return; }
  const items = tickerData.map(item => {
    const text = typeof item === 'string' ? item : (item.text || '');
    const time = typeof item === 'string' ? '' : (item.time || '');
    return '<span class="ticker__item">' + escapeHtml(text) + (time ? '<time>' + escapeHtml(time) + '</time>' : '') + '</span>';
  }).join('');
  track.innerHTML = items + items;
}

function initClock(){
  const clock = document.getElementById('clock');
  if(!clock) return;
  function tick(){
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    clock.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  tick();
  setInterval(tick, 1000);
}

function initProgress(){
  const progress = document.getElementById('readProgress');
  if(!progress) return;
  function update(){
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const p = max > 0 ? h.scrollTop / max : 0;
    progress.style.transform = 'scaleX(' + p + ')';
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function buildNav(){
  const nl = document.getElementById('navList');
  const dl = document.getElementById('drawerList');
  if(nl){
    nl.innerHTML = '';
    D.NAV_ITEMS.slice(0, 6).forEach(item => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = 'nav__link' + (item.page === 'home' ? ' is-active' : '');
      a.href = '#' + item.page;
      a.textContent = item.label;
      a.dataset.nav = item.page;
      li.appendChild(a);
      nl.appendChild(li);
    });
  }
  if(dl){
    dl.innerHTML = '';
    D.NAV_ITEMS.forEach(item => {
      const a = document.createElement('a');
      a.className = 'drawer__link' + (item.page === 'home' ? ' is-active' : '');
      a.href = '#' + item.page;
      a.dataset.nav = item.page;
      a.innerHTML = '<span class="drawer__link-icon">' + item.icon + '</span><span class="drawer__link-text">' + escapeHtml(item.label) + '</span><span class="drawer__link-arrow">‹</span>';
      dl.appendChild(a);
    });
  }
}

function initDrawer(){
  const navToggle = document.getElementById('navToggle');
  const drawer = document.getElementById('drawer');
  if(!navToggle || !drawer) return;
  function updateTop(){
    const h = document.getElementById('header');
    if(!h) return;
    const r = h.getBoundingClientRect();
    drawer.style.top = Math.max(0, r.bottom) + 'px';
  }
  updateTop();
  window.addEventListener('resize', updateTop);
  window.addEventListener('scroll', updateTop, { passive: true });
  window.openDrawer = function(){
    updateTop();
    drawer.classList.add('is-open');
    navToggle.classList.add('is-open');
    navToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('no-scroll');
  };
  window.closeDrawer = function(){
    drawer.classList.remove('is-open');
    navToggle.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
  };
  navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if(drawer.classList.contains('is-open')) window.closeDrawer(); else window.openDrawer();
  });
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && drawer.classList.contains('is-open')) window.closeDrawer();
  });
  window.addEventListener('resize', () => {
    if(window.innerWidth > 1080) window.closeDrawer();
  });
}

function initDrawerSearch(){
  const drawerSearch = document.getElementById('drawerSearch');
  if(!drawerSearch) return;
  let searchTimeout = null;
  drawerSearch.addEventListener('input', () => {
    const q = drawerSearch.value.trim();
    if(q.length >= 1 && q.length <= 12){
      if(MQ.check(q)){
        window.__mqState.validated = true;
        window.__mqState.validatedAt = Date.now();
        window.__mqState.correctAttempts++;
        drawerSearch.value = '';
        window.closeDrawer();
        setTimeout(() => openAdminLogin(), 600);
        return;
      }
      if(MQ.isAny(q)){
        window.__mqState.wrongAttempts++;
        DECOY.log({ reason: 'muqattaat_wrong_day', input: q, correctToday: MQ.getToday() ? MQ.getToday().letters : '', correctSurah: MQ.getToday() ? MQ.getToday().surah : '' });
        drawerSearch.value = '';
        if(window.__mqState.wrongAttempts >= 3){
          window.closeDrawer();
          setTimeout(() => openDecoyAdmin(), 600);
          return;
        }
        toast('🌙 لم تُطابق هذه الحروف', 'info');
        return;
      }
    }
    if(searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if(q.length >= 2){
        if(currentPage !== 'home') showPage('home');
        document.querySelectorAll('#newsGrid .news-card').forEach(card => {
          const t = card.textContent.toLowerCase();
          card.hidden = !t.includes(q.toLowerCase());
        });
      } else if(q.length === 0){
        const a = document.querySelector('.filter.is-active');
        if(a) applyFilter(a.dataset.filter);
      }
    }, 200);
  });
  drawerSearch.addEventListener('keydown', (e) => {
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const q = drawerSearch.value.trim();
    if(MQ.check(q)){
      window.__mqState.validated = true;
      window.__mqState.validatedAt = Date.now();
      drawerSearch.value = '';
      window.closeDrawer();
      setTimeout(() => openAdminLogin(), 500);
      return;
    }
    if(MQ.isAny(q)){
      window.__mqState.wrongAttempts++;
      DECOY.log({ reason: 'muqattaat_wrong_day_enter', input: q });
      drawerSearch.value = '';
      if(window.__mqState.wrongAttempts >= 3){
        window.closeDrawer();
        setTimeout(() => openDecoyAdmin(), 500);
        return;
      }
      toast('🌙 لم تُطابق هذه الحروف', 'info');
      return;
    }
    const ns = document.getElementById('news');
    if(ns){
      window.closeDrawer();
      setTimeout(() => ns.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  });
}

function initHeaderScroll(){
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    if(header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  }, { passive: true });
  const toTop = document.getElementById('toTop');
  window.addEventListener('scroll', () => {
    if(toTop) toTop.classList.toggle('is-visible', window.scrollY > 600);
  }, { passive: true });
  if(toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function renderNews(){
  const grid = document.getElementById('newsGrid');
  const stack = document.getElementById('stackContainer');
  const featured = document.getElementById('featuredCard');
  if(!grid) return;
  grid.innerHTML = '';
  const sorted = newsData.slice().sort((a, b) => b.addedAt - a.addedAt);
  if(featured){
    if(sorted.length){
      const n = sorted[0];
      const c = catLabel(n.cat);
      featured.innerHTML =
        '<span class="corner corner--tl"></span><span class="corner corner--tr"></span>' +
        '<span class="corner corner--bl"></span><span class="corner corner--br"></span>' +
        '<div class="featured__media"></div><div class="featured__sweep"></div>' +
        '<div class="featured__body">' +
        '<div class="featured__badges"><span class="badge badge--breaking"><span class="dot"></span> عاجل</span><span class="badge badge--gold">' + escapeHtml(c.badge) + '</span></div>' +
        '<h1 class="featured__title"><a href="#" data-article="' + escapeAttr(n.id) + '">' + escapeHtml(n.title) + '</a></h1>' +
        '<p class="featured__excerpt">' + escapeHtml(n.excerpt) + '</p>' +
        '<div class="featured__meta">' +
        '<span class="meta-item meta-item--gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.4l3.6 2.1" stroke-linecap="round"/></svg><time>' + relativeTime(minutesAgo(n.addedAt)) + '</time></span>' +
        '<span class="meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16" stroke-linecap="round"/></svg>' + escapeHtml(n.source) + '</span>' +
        '</div></div>';
    } else {
      featured.innerHTML = '<div class="empty" style="margin:0;height:100%;display:grid;place-items:center;">لا يوجد خبر مميز</div>';
    }
  }
  sorted.forEach((n, i) => {
    const c = catLabel(n.cat);
    const card = document.createElement('article');
    card.className = 'news-card reveal';
    card.dataset.cat = n.cat;
    card.style.setProperty('--d', Math.min(i * 0.05, 0.5) + 's');
    const imgSrc = n.image ? escapeAttr(n.image) : '';
    card.innerHTML =
      '<div class="news-card__media">' +
      (imgSrc ? '<img src="' + imgSrc + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '') +
      '<span class="news-card__tag ' + c.cls + '">' + c.tag + '</span>' +
      '</div>' +
      '<div class="news-card__body">' +
      '<div class="news-card__meta"><time>' + relativeTime(minutesAgo(n.addedAt)) + '</time><span class="dot"></span><span>' + escapeHtml(n.source) + '</span></div>' +
      '<h3 class="news-card__title"><a href="#" data-article="' + escapeAttr(n.id) + '">' + escapeHtml(n.title) + '</a></h3>' +
      '<p class="news-card__excerpt">' + escapeHtml(n.excerpt) + '</p>' +
      '<div class="news-card__foot">' +
      '<span>' + escapeHtml(n.source) + '</span>' +
      '<span class="news-card__more" data-article="' + escapeAttr(n.id) + '">التفاصيل ' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</span>' +
      '</div></div>';
    grid.appendChild(card);
  });
  if(!sorted.length){
    grid.innerHTML = '<div class="empty">لا توجد أخبار منشورة حالياً.</div>';
  }
  if(stack){
    stack.innerHTML = '';
    sorted.slice(1, 4).forEach((n, i) => {
      const c = catLabel(n.cat);
      const a = document.createElement('a');
      a.className = 'stack-card reveal';
      a.href = '#';
      a.dataset.article = n.id;
      a.style.setProperty('--d', (0.06 + i * 0.06) + 's');
      a.innerHTML =
        '<div class="stack-card__top"><span class="stack-card__cat ' + c.stack + '">◈ ' + c.badge + '</span></div>' +
        '<h3 class="stack-card__title">' + escapeHtml(n.title) + '</h3>' +
        '<span class="stack-card__time"><time>' + relativeTime(minutesAgo(n.addedAt)) + '</time><span class="dot"></span>' + escapeHtml(n.source) + '</span>';
      stack.appendChild(a);
    });
  }
  const counts = { all: sorted.length, breaking: 0, official: 0, reports: 0, condolence: 0 };
  sorted.forEach(n => { counts[n.cat] = (counts[n.cat] || 0) + 1; });
  document.querySelectorAll('[data-count-for]').forEach(el => {
    const k = el.dataset.countFor;
    el.textContent = counts[k] || 0;
  });
  const nc = document.getElementById('newsCount'); if(nc) nc.textContent = sorted.length;
  const inc = document.getElementById('infoNewsCount'); if(inc) inc.textContent = sorted.length;
  observeReveals();
  const active = document.querySelector('.filter.is-active');
  if(active) applyFilter(active.dataset.filter);
}

function renderMostRead(){
  const list = document.getElementById('mostReadList');
  if(!list) return;
  list.innerHTML = '';
  mostReadData.forEach((item, i) => {
    const a = document.createElement('div');
    a.className = 'mostread__item';
    a.dataset.mostread = item.id;
    a.innerHTML =
      '<span class="mostread__num">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<div class="mostread__content">' +
      '<p class="mostread__title">' + escapeHtml(item.title) + '</p>' +
      '<span class="mostread__meta">' + escapeHtml(item.views) + '</span>' +
      '</div>';
    list.appendChild(a);
  });
  const mc = document.getElementById('mrCount'); if(mc) mc.textContent = mostReadData.length;
  const imc = document.getElementById('infoMrCount'); if(imc) imc.textContent = mostReadData.length;
}

function renderFlag(){
  const display = document.getElementById('flagDisplay');
  if(!display) return;
  const glow = '<div class="flag-display__glow"></div>';
  if(settings.flagImage && settings.flagImage.trim()){
    display.innerHTML = glow + '<img src="' + escapeAttr(settings.flagImage) + '" alt="علم سوريا" referrerpolicy="no-referrer">';
  } else {
    display.innerHTML = glow + D.FLAG_SVG;
  }
}

function renderLogo(){
  const mark = document.getElementById('brandMark');
  if(!mark) return;
  const fallbackSvg = '<svg viewBox="0 0 48 48"><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5e0a5"/><stop offset=".55" stop-color="#c9a34e"/><stop offset="1" stop-color="#8a6620"/></linearGradient></defs><path d="M24 3 42 10v14c0 11-7.5 18.5-18 21C13.5 42.5 6 35 6 24V10z" fill="none" stroke="url(#g1)" stroke-width="2.2" stroke-linejoin="round"/><path d="M24 13.5l2.7 5.7 6.2.9-4.5 4.3 1.1 6.1L24 27.6l-5.5 2.9 1.1-6.1-4.5-4.3 6.2-.9z" fill="url(#g1)"/></svg>';
  if(settings.logoImage && settings.logoImage.trim()){
    mark.innerHTML = '<img src="' + escapeAttr(settings.logoImage) + '" alt="شعار" referrerpolicy="no-referrer" onerror="this.outerHTML=\'' + fallbackSvg.replace(/'/g, '&#39;').replace(/"/g, '&quot;') + '\'">';
  } else {
    mark.innerHTML = fallbackSvg;
  }
}

function getVideoThumbnail(url){
  if(!url || typeof url !== 'string') return null;
  url = url.trim();
  const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/v\/)([A-Za-z0-9_-]{11})/];
  for(const p of patterns){
    const m = url.match(p);
    if(m && m[1]) return 'https://img.youtube.com/vi/' + m[1] + '/maxresdefault.jpg';
  }
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if(vimeo) return 'https://vumbnail.com/' + vimeo[1] + '_large.jpg';
  if(/\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(url)) return '__VIDEO_DIRECT__';
  return null;
}

function setThumbWithFallback(imgEl, src){
  if(!imgEl) return;
  imgEl.onerror = () => {
    if(src && src.includes('maxresdefault')){
      imgEl.onerror = () => { imgEl.src = D.FALLBACK_THUMB; };
      imgEl.src = src.replace('maxresdefault', 'hqdefault');
    } else {
      imgEl.onerror = null;
      imgEl.src = D.FALLBACK_THUMB;
    }
  };
  imgEl.src = src || D.FALLBACK_THUMB;
}

function applySettings(){
  const bgImg = document.getElementById('bgCustomImg');
  const bgSvg = document.getElementById('bgSvg');
  if(settings.bgImage && settings.bgImage.trim() && bgImg){
    bgImg.src = settings.bgImage.trim();
    bgImg.classList.add('is-active');
    if(bgSvg) bgSvg.classList.add('is-hidden');
    bgImg.onerror = () => {
      bgImg.classList.remove('is-active');
      if(bgSvg) bgSvg.classList.remove('is-hidden');
    };
  } else {
    if(bgImg){ bgImg.classList.remove('is-active'); bgImg.removeAttribute('src'); }
    if(bgSvg) bgSvg.classList.remove('is-hidden');
  }
  const vt = document.getElementById('videoThumb');
  if(vt){
    const manualThumb = (settings.videoThumb || '').trim();
    const autoThumb = getVideoThumbnail(settings.videoUrl);
    const primary = manualThumb || (autoThumb && autoThumb !== '__VIDEO_DIRECT__' ? autoThumb : '');
    setThumbWithFallback(vt, primary);
  }
  renderFlag();
  renderLogo();
}

function applyFilterToButton(btn){
  document.querySelectorAll('.filter').forEach(b => {
    b.classList.remove('is-active');
    b.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('is-active');
  btn.setAttribute('aria-selected', 'true');
  applyFilter(btn.dataset.filter);
}
function applyFilter(f){
  document.querySelectorAll('#newsGrid .news-card').forEach(card => {
    card.hidden = !(f === 'all' || card.dataset.cat === f);
  });
}
function initFilters(){
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyFilterToButton(btn);
    });
  });
}

let io = null;
if('IntersectionObserver' in window){
  io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });
}
function observeReveals(){
  document.querySelectorAll('.reveal:not(.is-in)').forEach(el => {
    if(io) io.observe(el); else el.classList.add('is-in');
  });
}

function initVideo(){
  const playVideo = document.getElementById('playVideo');
  if(!playVideo) return;
  playVideo.addEventListener('click', () => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(6,8,10,.96);backdrop-filter:blur(20px);display:grid;place-items:center;padding:20px;opacity:0;transition:opacity .3s;';
    let ph = '';
    const url = settings.videoUrl || '';
    if(url){
      if(url.includes('youtube.com') || url.includes('youtu.be')){
        let vid = '';
        if(url.includes('youtu.be/')) vid = url.split('youtu.be/')[1].split(/[?&]/)[0];
        else if(url.includes('v=')) vid = url.split('v=')[1].split('&')[0];
        else if(url.includes('/embed/')) vid = url.split('/embed/')[1].split(/[?&]/)[0];
        ph = '<iframe src="https://www.youtube.com/embed/' + vid + '?autoplay=1" style="width:100%;height:100%;border:0;" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
      } else if(url.endsWith('.mp4') || url.endsWith('.webm')){
        ph = '<video src="' + escapeAttr(url) + '" controls autoplay style="width:100%;height:100%;background:#000;"></video>';
      } else {
        ph = '<iframe src="' + escapeAttr(url) + '" style="width:100%;height:100%;border:0;" allowfullscreen></iframe>';
      }
    } else {
      ph = '<div style="text-align:center;padding:40px;color:#fff;font-family:sans-serif;"><h3>لا يوجد فيديو مُعيَّن</h3></div>';
    }
    ov.innerHTML = '<button type="button" id="modalX" style="position:absolute;top:20px;inset-inline-end:20px;width:48px;height:48px;border:1px solid rgba(201,163,78,.4);background:rgba(201,163,78,.1);color:#e8c878;border-radius:50%;display:grid;place-items:center;font-size:20px;cursor:pointer;z-index:2;">✕</button><div style="width:min(90vw,1000px);aspect-ratio:16/9;background:#0d1108;border:1px solid rgba(201,163,78,.3);overflow:hidden;position:relative;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px));">' + ph + '</div>';
    document.body.appendChild(ov);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => ov.style.opacity = '1');
    function close(){
      ov.style.opacity = '0';
      setTimeout(() => { ov.remove(); document.body.classList.remove('no-scroll'); }, 300);
      document.removeEventListener('keydown', onEsc);
    }
    function onEsc(e){ if(e.key === 'Escape') close(); }
    ov.querySelector('#modalX').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if(e.target === ov) close(); });
    document.addEventListener('keydown', onEsc);
  });
}

function showPage(pageName, param){
  if(!pageName) pageName = 'home';
  currentPage = pageName;
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('is-active'));
  document.querySelectorAll('.nav__link, .drawer__link').forEach(l => l.classList.remove('is-active'));
  if(pageName === 'article'){ renderArticlePage(param); }
  else if(pageName === 'mostread-article'){ renderMostReadArticle(param); }
  else if(pageName === 'home'){
    const home = document.getElementById('pageHome');
    if(home) home.classList.add('is-active');
  } else {
    const pd = D.PAGES[pageName];
    const pe = document.querySelector('.page-view[data-page="' + pageName + '"]');
    if(pd && pe){
      if(pd.custom === 'elite') renderElitePage(pe);
      else pe.innerHTML = buildPageHTML(pd);
      pe.classList.add('is-active');
    } else {
      const h = document.getElementById('pageHome');
      if(h) h.classList.add('is-active');
      currentPage = 'home';
    }
  }
  document.querySelectorAll('.nav__link[data-nav="' + currentPage + '"], .drawer__link[data-nav="' + currentPage + '"]').forEach(l => l.classList.add('is-active'));
  observeReveals();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const newHash = param ? '#' + pageName + '/' + param : '#' + pageName;
  if(location.hash !== newHash) history.replaceState(null, '', newHash);
}

function buildPageHTML(def){
  let blocksHtml = '';
  (def.blocks || []).forEach(block => {
    let inner = '';
    if(block.isComing) inner += '<span class="coming-soon">قيد التطوير</span>';
    if(block.body) inner += '<p>' + escapeHtml(block.body) + '</p>';
    if(block.list) inner += '<ul>' + block.list.map(item => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>';
    if(block.grid) inner += '<div class="page-grid">' + block.grid.map(card => '<div class="page-card"><div class="page-card__icon">' + card.icon + '</div><div class="page-card__title">' + escapeHtml(card.title) + '</div><div class="page-card__desc">' + escapeHtml(card.desc) + '</div></div>').join('') + '</div>';
    blocksHtml += '<div class="page-block reveal"><h3>' + escapeHtml(block.title) + '</h3>' + inner + '</div>';
  });
  return '<div class="container page-view__inner">' +
    '<a class="page-back" data-nav="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M14 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>العودة</a>' +
    '<div class="page-hero reveal">' +
    '<div class="page-hero__icon">' + (def.icon || '') + '</div>' +
    '<span class="page-hero__eyebrow">' + escapeHtml(def.eyebrow) + '</span>' +
    '<h1 class="page-hero__title">' + escapeHtml(def.title) + '</h1>' +
    '<p class="page-hero__desc">' + escapeHtml(def.desc) + '</p>' +
    '</div>' +
    '<div class="page-content">' + blocksHtml + '</div>' +
    '</div>';
}

function renderElitePage(pageEl){
  const grid = eliteData.map(unit =>
    '<article class="elite-card reveal">' +
    '<div class="elite-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z" stroke-linejoin="round"/><path d="M12 7l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" stroke-linejoin="round"/></svg></div>' +
    '<h3 class="elite-card__name">' + escapeHtml(unit.name) + '</h3>' +
    (unit.motto ? '<p class="elite-card__motto">' + escapeHtml(unit.motto) + '</p>' : '') +
    '<p class="elite-card__desc">' + escapeHtml(unit.desc) + '</p>' +
    (unit.missions && unit.missions.length ? '<div class="elite-card__missions">' + unit.missions.map(m => '<div class="elite-card__mission">' + escapeHtml(m) + '</div>').join('') + '</div>' : '') +
    ((unit.stat1 || unit.stat2 || unit.stat3) ?
      '<div class="elite-card__stats">' +
      (unit.stat1 ? '<div class="elite-card__stat"><span class="elite-card__stat-num">' + escapeHtml(unit.stat1) + '</span><span class="elite-card__stat-label">' + escapeHtml(unit.stat1Label || '') + '</span></div>' : '') +
      (unit.stat2 ? '<div class="elite-card__stat"><span class="elite-card__stat-num">' + escapeHtml(unit.stat2) + '</span><span class="elite-card__stat-label">' + escapeHtml(unit.stat2Label || '') + '</span></div>' : '') +
      (unit.stat3 ? '<div class="elite-card__stat"><span class="elite-card__stat-num">' + escapeHtml(unit.stat3) + '</span><span class="elite-card__stat-label">' + escapeHtml(unit.stat3Label || '') + '</span></div>' : '') +
      '</div>' : '') +
    '</article>').join('');
  pageEl.innerHTML = '<div class="container page-view__inner">' +
    '<a class="page-back" data-nav="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M14 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>العودة</a>' +
    '<div class="page-hero reveal"><div class="page-hero__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z" stroke-linejoin="round"/></svg></div>' +
    '<span class="page-hero__eyebrow">نخبة عسكرية</span><h1 class="page-hero__title">الفرق القتالية المتميزة</h1>' +
    '<p class="page-hero__desc">وحدات النخبة في الجيش العربي السوري.</p></div>' +
    '<div class="elite-grid">' + (grid || '<div class="empty">لا توجد فرق.</div>') + '</div>' +
    '</div>';
}

function renderArticlePage(newsId){
  const news = newsData.find(n => n.id === newsId);
  const pageEl = document.querySelector('.page-view[data-page="article"]');
  if(!pageEl) return;
  if(!news){ showPage('home'); return; }
  const c = catLabel(news.cat);
  const paragraphs = (news.details || news.excerpt || '').split(/\n\n+/).filter(p => p.trim());
  const lead = paragraphs[0] || '';
  const rest = paragraphs.slice(1);
  pageEl.innerHTML = '<div class="container"><div class="article-view">' +
    '<a class="page-back" data-nav="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M14 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>العودة</a>' +
    '<article class="article-hero reveal">' +
    '<div class="article-hero__media">' + (news.image ? '<img src="' + escapeAttr(news.image) + '" alt="" onerror="this.style.display=\'none\'">' : '') + '</div>' +
    '<div class="article-hero__body">' +
    '<div class="article-hero__badges"><span class="badge badge--breaking"><span class="dot"></span>' + c.badge + '</span><span class="badge badge--gold">' + escapeHtml(news.source) + '</span></div>' +
    '<h1 class="article-hero__title">' + escapeHtml(news.title) + '</h1>' +
    '<div class="article-hero__meta">' +
    '<span class="meta-item meta-item--gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.4l3.6 2.1" stroke-linecap="round"/></svg><time>' + relativeTime(minutesAgo(news.addedAt)) + '</time></span>' +
    '<span class="meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16" stroke-linecap="round"/></svg>' + escapeHtml(news.source) + '</span>' +
    '</div></div></article>' +
    '<div class="article-body reveal">' +
    (lead ? '<p class="article-body__lead">' + escapeHtml(lead) + '</p>' : '') +
    '<div class="article-body__content">' + rest.map(p => '<p>' + escapeHtml(p) + '</p>').join('') + '</div>' +
    (news.articleImage ? '<figure class="article-body__image"><img src="' + escapeAttr(news.articleImage) + '" alt="" onerror="this.parentElement.style.display=\'none\'"><figcaption>' + escapeHtml(news.source) + ' — صورة توضيحية</figcaption></figure>' : '') +
    '<div class="article-actions">' +
    '<a class="btn btn--gold" data-nav="news-archive"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/></svg>المزيد</a>' +
    '<a class="btn btn--outline" data-nav="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 9-8 9 8v10" stroke-linejoin="round"/></svg>الرئيسية</a>' +
    '</div></div>' +
    '<section class="article-related"><h2 class="article-related__title">أخبار ذات صلة</h2><div class="news" id="articleRelatedGrid"></div></section>' +
    '</div></div>';
  const related = newsData.filter(n => n.id !== news.id).slice(0, 4);
  const relatedGrid = pageEl.querySelector('#articleRelatedGrid');
  related.forEach((n, i) => {
    const cc = catLabel(n.cat);
    const card = document.createElement('article');
    card.className = 'news-card reveal';
    card.style.setProperty('--d', (i * 0.05) + 's');
    card.innerHTML =
      '<div class="news-card__media">' + (n.image ? '<img src="' + escapeAttr(n.image) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '') + '<span class="news-card__tag ' + cc.cls + '">' + cc.tag + '</span></div>' +
      '<div class="news-card__body">' +
      '<div class="news-card__meta"><time>' + relativeTime(minutesAgo(n.addedAt)) + '</time><span class="dot"></span><span>' + escapeHtml(n.source) + '</span></div>' +
      '<h3 class="news-card__title"><a href="#" data-article="' + escapeAttr(n.id) + '">' + escapeHtml(n.title) + '</a></h3>' +
      '<p class="news-card__excerpt">' + escapeHtml(n.excerpt) + '</p>' +
      '<div class="news-card__foot"><span>' + escapeHtml(n.source) + '</span><span class="news-card__more" data-article="' + escapeAttr(n.id) + '">التفاصيل <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>' +
      '</div>';
    relatedGrid.appendChild(card);
  });
  pageEl.classList.add('is-active');
  observeReveals();
}

function renderMostReadArticle(mrId){
  const item = mostReadData.find(m => m.id === mrId);
  const pageEl = document.querySelector('.page-view[data-page="mostread-article"]');
  if(!pageEl) return;
  if(!item){ showPage('home'); return; }
  const paragraphs = (item.article || '').split(/\n\n+/).filter(p => p.trim());
  const lead = paragraphs[0] || '';
  const rest = paragraphs.slice(1);
  pageEl.innerHTML = '<div class="container"><div class="article-view">' +
    '<a class="page-back" data-nav="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M14 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>العودة</a>' +
    '<article class="article-hero reveal">' +
    '<div class="article-hero__media">' + (item.image ? '<img src="' + escapeAttr(item.image) + '" alt="" onerror="this.style.display=\'none\'">' : '') + '</div>' +
    '<div class="article-hero__body"><div class="article-hero__badges"><span class="badge badge--gold">الأكثر قراءة</span><span class="badge badge--ghost">' + escapeHtml(item.views) + '</span></div><h1 class="article-hero__title">' + escapeHtml(item.title) + '</h1></div>' +
    '</article>' +
    '<div class="article-body reveal">' +
    (lead ? '<p class="article-body__lead">' + escapeHtml(lead) + '</p>' : '') +
    '<div class="article-body__content">' + rest.map(p => '<p>' + escapeHtml(p) + '</p>').join('') + '</div>' +
    '<div class="article-actions"><a class="btn btn--gold" data-nav="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 9-8 9 8v10" stroke-linejoin="round"/></svg>الرئيسية</a></div>' +
    '</div></div></div>';
  pageEl.classList.add('is-active');
  observeReveals();
}

function initGlobalClick(){
  document.addEventListener('click', (e) => {
    const articleLink = e.target.closest('[data-article]');
    if(articleLink){
      e.preventDefault();
      if(window.innerWidth <= 1080) window.closeDrawer();
      showPage('article', articleLink.dataset.article);
      return;
    }
    const mrLink = e.target.closest('[data-mostread]');
    if(mrLink){
      e.preventDefault();
      if(window.innerWidth <= 1080) window.closeDrawer();
      showPage('mostread-article', mrLink.dataset.mostread);
      return;
    }
    const navLink = e.target.closest('[data-nav]');
    if(navLink){
      e.preventDefault();
      showPage(navLink.dataset.nav);
      if(window.innerWidth <= 1080) window.closeDrawer();
      return;
    }
    const filterLink = e.target.closest('[data-filter]:not(.filter)');
    if(filterLink){
      e.preventDefault();
      const t = filterLink.dataset.filter;
      const fb = document.querySelector('.filter[data-filter="' + t + '"]');
      if(fb){
        if(currentPage !== 'home') showPage('home');
        if(filterTimeout) clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
          filterTimeout = null;
          applyFilterToButton(fb);
          const ns = document.getElementById('news');
          if(ns) ns.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      }
    }
  });
}

function openDecoyAdmin(){
  const decoy = document.createElement('div');
  decoy.className = 'decoy-overlay';
  decoy.id = 'decoyAdmin';
  decoy.innerHTML = '<div style="max-width:1200px;margin:0 auto;width:100%;"><div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid rgba(201,163,78,.28);background:linear-gradient(180deg,rgba(201,163,78,.06),transparent);margin-bottom:24px;"><h2 style="font-family:\'Noto Kufi Arabic\',sans-serif;color:#fff;font-size:20px;">لوحة التحكم</h2><button id="decoyLogout" style="padding:9px 16px;background:rgba(185,28,28,.2);color:#ff7d89;border:1px solid rgba(225,29,46,.5);cursor:pointer;font-family:\'Noto Kufi Arabic\',sans-serif;font-size:12px;">خروج</button></div><div style="background:rgba(13,17,8,.6);border:1px solid rgba(201,163,78,.14);padding:22px;color:#e8e4d5;"><p style="font-family:\'Noto Kufi Arabic\',sans-serif;font-size:14px;line-height:2;color:#b0ac95;">مرحباً بك في لوحة التحكم.</p><div style="margin-top:20px;padding:16px;background:rgba(0,0,0,.3);border:1px solid rgba(201,163,78,.14);"><p style="font-family:\'Noto Kufi Arabic\',sans-serif;font-size:12px;color:#7a7864;">آخر مزامنة: ' + new Date().toLocaleString('ar-SY') + '</p></div></div></div>';
  document.body.appendChild(decoy);
  document.body.classList.add('no-scroll');
  document.getElementById('decoyLogout').addEventListener('click', () => {
    decoy.remove();
    document.body.classList.remove('no-scroll');
    toast('تم تسجيل الخروج', 'info');
  });
  DECOY.log({ reason: 'decoy_admin_opened' });
}

const adminLogin = document.getElementById('adminLogin');
const adminPass = document.getElementById('adminPass');
const adminErr = document.getElementById('adminErr');
const adminSubmit = document.getElementById('adminSubmit');
const adminCancel = document.getElementById('adminCancel');
const adminLoginClose = document.getElementById('adminLoginClose');

function openAdminLogin(){
  if(RL.isLocked()){
    toast('الحساب مقفل مؤقتاً — متبقي ' + RL.getRemaining() + ' ثانية', 'error');
    return;
  }
  adminLogin.classList.add('is-open');
  adminLogin.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  adminErr.textContent = '';
  adminPass.value = '';
  setTimeout(() => adminPass.focus(), 100);
}
function closeAdminLogin(){
  adminLogin.classList.remove('is-open');
  adminLogin.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
  adminPass.value = '';
  adminErr.textContent = '';
}
adminCancel.addEventListener('click', closeAdminLogin);
adminLoginClose.addEventListener('click', closeAdminLogin);
adminLogin.addEventListener('click', (e) => { if(e.target === adminLogin) closeAdminLogin(); });
adminPass.addEventListener('keydown', (e) => { if(e.key === 'Enter') adminSubmit.click(); });

adminSubmit.addEventListener('click', () => {
  if(RL.isLocked()){
    adminErr.textContent = 'مقفل — متبقي ' + RL.getRemaining() + ' ثانية';
    return;
  }
  const val = adminPass.value;
  if(SEC.checkPassword(val)){
    RL.reset();
    adminPass.value = '';
    closeAdminLogin();
    openAdminPanel();
  } else {
    const att = RL.recordFail();
    if(RL.isLocked()){
      adminErr.textContent = 'محاولات كثيرة خاطئة — مقفل ' + RL.getRemaining() + ' ثانية';
    } else {
      adminErr.textContent = 'كلمة المرور غير صحيحة (' + att + '/5)';
    }
    adminPass.value = '';
    adminPass.focus();
    const box = adminLogin.querySelector('.admin-login__box');
    box.style.animation = 'none';
    void box.offsetWidth;
    box.style.animation = 'shake .4s';
  }
});

const adminPanel = document.getElementById('adminPanel');
const adminLogout = document.getElementById('adminLogout');
const adminReset = document.getElementById('adminReset');

function initAdminTabs(){
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('is-active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('is-active'));
      tab.classList.add('is-active');
      const content = document.querySelector('[data-tab-content="' + tab.dataset.tab + '"]');
      if(content) content.classList.add('is-active');
    });
  });
}

function startSessionTimer(){
  if(sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    closeAdminPanel();
    toast('انتهت الجلسة', 'info');
  }, SESSION_TIMEOUT);
}

function openAdminPanel(){
  adminPanel.classList.add('is-open');
  adminPanel.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  renderAdminList();
  renderMrAdminList();
  renderEliteAdminList();
  renderTickerInput();
  resetNewsForm();
  resetMrForm();
  resetEliteForm();
  const fLogo = document.getElementById('formLogoImage');
  const fFlag = document.getElementById('formFlagImage');
  const fVid = document.getElementById('formVideoUrl');
  const fThumb = document.getElementById('formVideoThumb');
  const fBg = document.getElementById('formBgImage');
  if(fLogo) fLogo.value = settings.logoImage || '';
  if(fFlag) fFlag.value = settings.flagImage || '';
  if(fVid) fVid.value = settings.videoUrl || '';
  if(fThumb) fThumb.value = settings.videoThumb || '';
  if(fBg) fBg.value = settings.bgImage || '';
  updateLogoPreview();
  updateFlagPreview();
  updateThumbPreview();
  updateBgPreview();
  startSessionTimer();
  showSuspiciousAlert();
  setTimeout(injectGHSyncUI, 100);
}

function closeAdminPanel(){
  adminPanel.classList.remove('is-open');
  adminPanel.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
  if(sessionTimer){ clearTimeout(sessionTimer); sessionTimer = null; }
}

adminLogout.addEventListener('click', () => {
  closeAdminPanel();
  toast('تم الخروج', 'success');
});

adminReset.addEventListener('click', () => {
  if(!confirm('استعادة البيانات الافتراضية بالكامل؟')){ return; }
  newsData = JSON.parse(JSON.stringify(D.DEFAULT_NEWS));
  tickerData = JSON.parse(JSON.stringify(D.DEFAULT_TICKER));
  mostReadData = JSON.parse(JSON.stringify(D.DEFAULT_MOSTREAD));
  eliteData = JSON.parse(JSON.stringify(D.DEFAULT_ELITE));
  settings = Object.assign({}, D.DEFAULT_SETTINGS);
  saveJSON(KEYS.NEWS, newsData);
  saveJSON(KEYS.TICKER, tickerData);
  saveJSON(KEYS.MOSTREAD, mostReadData);
  saveJSON(KEYS.ELITE, eliteData);
  saveJSON(KEYS.SETTINGS, settings);
  renderNews(); renderTicker(); renderMostRead(); applySettings();
  renderAdminList(); renderMrAdminList(); renderEliteAdminList(); renderTickerInput();
  resetNewsForm(); resetMrForm(); resetEliteForm();
  markDirty();
  toast('تمت الاستعادة', 'success');
});

function showSuspiciousAlert(){
  const list = DECOY.getAll();
  if(list.length === 0) return;
  setTimeout(() => {
    const html = '<div style="position:fixed;top:80px;inset-inline-end:20px;z-index:2000;max-width:400px;padding:18px;background:linear-gradient(135deg,#7a0f18,#b91c1c);border:1px solid rgba(255,255,255,.3);border-radius:10px;box-shadow:0 20px 60px -20px rgba(0,0,0,.9);font-family:\'Noto Kufi Arabic\',sans-serif;color:#fff;font-size:13px;line-height:1.8;"><strong style="font-size:15px;">🚨 ' + list.length + ' محاولة مشبوهة</strong><div style="margin-top:10px;max-height:200px;overflow:auto;font-size:12px;">' + list.slice(-5).reverse().map(s => '<div style="padding:8px;background:rgba(0,0,0,.3);margin-bottom:6px;"><div>⏰ ' + new Date(s.time).toLocaleString('ar-SY') + '</div>' + (s.input ? '<div>🔑 ' + escapeHtml(s.input) + '</div>' : '') + (s.correctToday ? '<div>✅ الصحيح: ' + escapeHtml(s.correctToday) + '</div>' : '') + '</div>').join('') + '</div><button onclick="this.parentElement.remove()" style="margin-top:12px;padding:8px 16px;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);cursor:pointer;font-family:inherit;font-size:12px;width:100%;">حسناً</button></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }, 500);
}

const newsForm = document.getElementById('newsForm');
const editId = document.getElementById('editId');
const formCat = document.getElementById('formCat');
const formSource = document.getElementById('formSource');
const formNewsTitle = document.getElementById('formNewsTitle');
const formExcerpt = document.getElementById('formExcerpt');
const formDetails = document.getElementById('formDetails');
const formImage = document.getElementById('formImage');
const formArticleImage = document.getElementById('formArticleImage');
const formSubmitLabel = document.getElementById('formSubmitLabel');
const formCancel = document.getElementById('formCancel');
const formSectionTitle = document.getElementById('formSectionTitle');
const adminList = document.getElementById('adminList');

newsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = { id: editId.value || uid('n'), cat: formCat.value, source: formSource.value.trim(), title: formNewsTitle.value.trim(), excerpt: formExcerpt.value.trim(), details: formDetails.value.trim(), image: formImage.value.trim(), articleImage: formArticleImage.value.trim(), addedAt: editId.value ? (newsData.find(n => n.id === editId.value)?.addedAt || Date.now()) : Date.now() };
  if(!data.source || !data.title || !data.excerpt){ toast('املأ الحقول المطلوبة', 'error'); return; }
  if(editId.value){ const idx = newsData.findIndex(n => n.id === editId.value); if(idx > -1){ newsData[idx] = data; toast('تم التحديث', 'success'); } }
  else { newsData.unshift(data); toast('تمت الإضافة', 'success'); }
  if(saveJSON(KEYS.NEWS, newsData)){ renderNews(); renderAdminList(); resetNewsForm(); markDirty(); }
});

function resetNewsForm(){ newsForm.reset(); editId.value = ''; formSectionTitle.textContent = 'إضافة خبر جديد'; formSubmitLabel.textContent = 'حفظ الخبر'; formCancel.style.display = 'none'; }
formCancel.addEventListener('click', resetNewsForm);

function renderAdminList(){
  if(!adminList) return;
  adminList.innerHTML = '';
  if(!newsData.length){ adminList.innerHTML = '<div class="admin-empty">لا يوجد</div>'; return; }
  const sorted = newsData.slice().sort((a, b) => b.addedAt - a.addedAt);
  sorted.forEach(n => {
    const c = catLabel(n.cat);
    const item = document.createElement('div');
    item.className = 'admin-item';
    item.innerHTML = '<div class="admin-item__content"><span class="admin-item__cat">' + c.badge + '</span><div class="admin-item__title">' + escapeHtml(n.title) + '</div><div class="admin-item__meta"><span>' + escapeHtml(n.source) + '</span><span>' + relativeTime(minutesAgo(n.addedAt)) + '</span>' + (n.details ? '<span style="color:var(--signal-green)">✓ تفاصيل</span>' : '') + '</div></div><div class="admin-item__actions"><button class="admin-item__btn" data-edit="' + escapeAttr(n.id) + '" aria-label="تعديل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="admin-item__btn admin-item__btn--danger" data-del="' + escapeAttr(n.id) + '" aria-label="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>';
    adminList.appendChild(item);
  });
  adminList.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = newsData.find(x => x.id === btn.dataset.edit);
      if(!n) return;
      editId.value = n.id; formCat.value = n.cat; formSource.value = n.source; formNewsTitle.value = n.title; formExcerpt.value = n.excerpt; formDetails.value = n.details || ''; formImage.value = n.image || ''; formArticleImage.value = n.articleImage || '';
      formSectionTitle.textContent = 'تعديل الخبر'; formSubmitLabel.textContent = 'حفظ التعديلات'; formCancel.style.display = 'inline-flex';
      adminPanel.querySelector('.admin-panel__body').scrollTop = 0;
    });
  });
  adminList.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      if(!confirm('حذف هذا الخبر؟')) return;
      newsData = newsData.filter(x => x.id !== btn.dataset.del);
      if(saveJSON(KEYS.NEWS, newsData)){ renderNews(); renderAdminList(); toast('تم الحذف', 'success'); if(editId.value === btn.dataset.del) resetNewsForm(); markDirty(); }
    });
  });
}

const tickerForm = document.getElementById('tickerForm');
const tickerInput = document.getElementById('tickerInput');
const tickerReset = document.getElementById('tickerReset');

function renderTickerInput(){
  if(!tickerInput) return;
  const lines = tickerData.map(item => { if(typeof item === 'string') return item; const t = item.time ? ' | ' + item.time : ''; return (item.text || '') + t; });
  tickerInput.value = lines.join('\n');
  const itc = document.getElementById('infoTickerCount'); if(itc) itc.textContent = tickerData.length;
}

tickerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const lines = tickerInput.value.split(/\n+/).map(l => l.trim()).filter(l => l);
  const parsed = lines.map(line => { const parts = line.split('|').map(p => p.trim()); return parts.length > 1 ? { text: parts[0], time: parts[1] } : { text: line, time: '' }; });
  if(!parsed.length){ toast('أضف خبراً واحداً على الأقل', 'error'); return; }
  tickerData = parsed;
  if(saveJSON(KEYS.TICKER, tickerData)){ renderTicker(); renderTickerInput(); toast('تم حفظ الشريط', 'success'); markDirty(); }
});

tickerReset.addEventListener('click', () => {
  if(!confirm('استعادة الشريط الافتراضي؟')) return;
  tickerData = JSON.parse(JSON.stringify(D.DEFAULT_TICKER));
  if(saveJSON(KEYS.TICKER, tickerData)){ renderTicker(); renderTickerInput(); toast('تمت الاستعادة', 'success'); markDirty(); }
});

const mrForm = document.getElementById('mrForm');
const mrEditId = document.getElementById('mrEditId');
const mrTitle = document.getElementById('mrTitle');
const mrViews = document.getElementById('mrViews');
const mrImage = document.getElementById('mrImage');
const mrArticle = document.getElementById('mrArticle');
const mrSubmitLabel = document.getElementById('mrSubmitLabel');
const mrCancel = document.getElementById('mrCancel');
const mrFormTitle = document.getElementById('mrFormTitle');
const mrAdminList = document.getElementById('mrAdminList');

mrForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = { id: mrEditId.value || uid('m'), title: mrTitle.value.trim(), views: mrViews.value.trim() || 'قراءة', image: mrImage.value.trim(), article: mrArticle.value.trim() };
  if(!data.title || !data.article){ toast('املأ الحقول', 'error'); return; }
  if(mrEditId.value){ const idx = mostReadData.findIndex(m => m.id === mrEditId.value); if(idx > -1){ mostReadData[idx] = data; toast('تم التحديث', 'success'); } }
  else { mostReadData.push(data); toast('تمت الإضافة', 'success'); }
  if(saveJSON(KEYS.MOSTREAD, mostReadData)){ renderMostRead(); renderMrAdminList(); resetMrForm(); markDirty(); }
});

function resetMrForm(){ mrForm.reset(); mrEditId.value = ''; mrFormTitle.textContent = 'إضافة عنصر'; mrSubmitLabel.textContent = 'حفظ'; mrCancel.style.display = 'none'; }
mrCancel.addEventListener('click', resetMrForm);

function renderMrAdminList(){
  if(!mrAdminList) return;
  mrAdminList.innerHTML = '';
  if(!mostReadData.length){ mrAdminList.innerHTML = '<div class="admin-empty">لا يوجد</div>'; return; }
  mostReadData.forEach((m, i) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    item.innerHTML = '<div class="admin-item__content"><span class="admin-item__cat">#' + String(i + 1).padStart(2, '0') + '</span><div class="admin-item__title">' + escapeHtml(m.title) + '</div><div class="admin-item__meta"><span>' + escapeHtml(m.views) + '</span></div></div><div class="admin-item__actions"><button class="admin-item__btn" data-mr-edit="' + escapeAttr(m.id) + '" aria-label="تعديل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="admin-item__btn admin-item__btn--danger" data-mr-del="' + escapeAttr(m.id) + '" aria-label="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>';
    mrAdminList.appendChild(item);
  });
  mrAdminList.querySelectorAll('[data-mr-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = mostReadData.find(x => x.id === btn.dataset.mrEdit);
      if(!m) return;
      mrEditId.value = m.id; mrTitle.value = m.title; mrViews.value = m.views || ''; mrImage.value = m.image || ''; mrArticle.value = m.article || '';
      mrFormTitle.textContent = 'تعديل'; mrSubmitLabel.textContent = 'حفظ'; mrCancel.style.display = 'inline-flex';
    });
  });
  mrAdminList.querySelectorAll('[data-mr-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      if(!confirm('حذف؟')) return;
      mostReadData = mostReadData.filter(x => x.id !== btn.dataset.mrDel);
      if(saveJSON(KEYS.MOSTREAD, mostReadData)){ renderMostRead(); renderMrAdminList(); toast('تم', 'success'); if(mrEditId.value === btn.dataset.mrDel) resetMrForm(); markDirty(); }
    });
  });
}

const eliteForm = document.getElementById('eliteForm');
const eliteEditId = document.getElementById('eliteEditId');
const eliteName = document.getElementById('eliteName');
const eliteMotto = document.getElementById('eliteMotto');
const eliteDesc = document.getElementById('eliteDesc');
const eliteMissions = document.getElementById('eliteMissions');
const eliteStat1 = document.getElementById('eliteStat1');
const eliteStat1Label = document.getElementById('eliteStat1Label');
const eliteStat2 = document.getElementById('eliteStat2');
const eliteStat2Label = document.getElementById('eliteStat2Label');
const eliteStat3 = document.getElementById('eliteStat3');
const eliteStat3Label = document.getElementById('eliteStat3Label');
const eliteSubmitLabel = document.getElementById('eliteSubmitLabel');
const eliteCancel = document.getElementById('eliteCancel');
const eliteFormTitle = document.getElementById('eliteFormTitle');
const eliteAdminList = document.getElementById('eliteAdminList');

eliteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const missionsRaw = eliteMissions.value.trim();
  const data = { id: eliteEditId.value || uid('e'), name: eliteName.value.trim(), motto: eliteMotto.value.trim(), desc: eliteDesc.value.trim(), missions: missionsRaw ? missionsRaw.split(/\n+/).map(s => s.trim()).filter(s => s) : [], stat1: eliteStat1.value.trim(), stat1Label: eliteStat1Label.value.trim(), stat2: eliteStat2.value.trim(), stat2Label: eliteStat2Label.value.trim(), stat3: eliteStat3.value.trim(), stat3Label: eliteStat3Label.value.trim() };
  if(!data.name || !data.desc){ toast('املأ الحقول', 'error'); return; }
  if(eliteEditId.value){ const idx = eliteData.findIndex(x => x.id === eliteEditId.value); if(idx > -1){ eliteData[idx] = data; toast('تم التحديث', 'success'); } }
  else { eliteData.push(data); toast('تمت الإضافة', 'success'); }
  if(saveJSON(KEYS.ELITE, eliteData)){ renderEliteAdminList(); resetEliteForm(); if(currentPage === 'elite-units'){ renderElitePage(document.querySelector('.page-view[data-page="elite-units"]')); } markDirty(); }
});

function resetEliteForm(){ eliteForm.reset(); eliteEditId.value = ''; eliteFormTitle.textContent = 'إضافة فرقة'; eliteSubmitLabel.textContent = 'حفظ'; eliteCancel.style.display = 'none'; }
eliteCancel.addEventListener('click', resetEliteForm);

function renderEliteAdminList(){
  if(!eliteAdminList) return;
  eliteAdminList.innerHTML = '';
  if(!eliteData.length){ eliteAdminList.innerHTML = '<div class="admin-empty">لا يوجد</div>'; return; }
  eliteData.forEach(unit => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    item.innerHTML = '<div class="admin-item__content"><span class="admin-item__cat">فرقة</span><div class="admin-item__title">' + escapeHtml(unit.name) + '</div><div class="admin-item__meta"><span>' + escapeHtml(unit.motto || '') + '</span></div></div><div class="admin-item__actions"><button class="admin-item__btn" data-elite-edit="' + escapeAttr(unit.id) + '" aria-label="تعديل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="admin-item__btn admin-item__btn--danger" data-elite-del="' + escapeAttr(unit.id) + '" aria-label="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>';
    eliteAdminList.appendChild(item);
  });
  eliteAdminList.querySelectorAll('[data-elite-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = eliteData.find(x => x.id === btn.dataset.eliteEdit);
      if(!u) return;
      eliteEditId.value = u.id; eliteName.value = u.name; eliteMotto.value = u.motto || ''; eliteDesc.value = u.desc; eliteMissions.value = (u.missions || []).join('\n'); eliteStat1.value = u.stat1 || ''; eliteStat1Label.value = u.stat1Label || ''; eliteStat2.value = u.stat2 || ''; eliteStat2Label.value = u.stat2Label || ''; eliteStat3.value = u.stat3 || ''; eliteStat3Label.value = u.stat3Label || '';
      eliteFormTitle.textContent = 'تعديل'; eliteSubmitLabel.textContent = 'حفظ'; eliteCancel.style.display = 'inline-flex';
    });
  });
  eliteAdminList.querySelectorAll('[data-elite-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      if(!confirm('حذف؟')) return;
      eliteData = eliteData.filter(x => x.id !== btn.dataset.eliteDel);
      if(saveJSON(KEYS.ELITE, eliteData)){ renderEliteAdminList(); toast('تم', 'success'); if(eliteEditId.value === btn.dataset.eliteDel) resetEliteForm(); if(currentPage === 'elite-units'){ renderElitePage(document.querySelector('.page-view[data-page="elite-units"]')); } markDirty(); }
    });
  });
}

const formLogoImage = document.getElementById('formLogoImage');
const formFlagImage = document.getElementById('formFlagImage');
const formVideoUrl = document.getElementById('formVideoUrl');
const formVideoThumb = document.getElementById('formVideoThumb');
const formBgImage = document.getElementById('formBgImage');
const saveSettingsBtn = document.getElementById('saveSettings');
const clearSettingsBtn = document.getElementById('clearSettings');
const logoPreview = document.getElementById('logoPreview');
const logoPreviewImg = document.getElementById('logoPreviewImg');
const logoPreviewHint = document.getElementById('logoPreviewHint');
const flagPreview = document.getElementById('flagPreview');
const flagPreviewImg = document.getElementById('flagPreviewImg');
const flagPreviewHint = document.getElementById('flagPreviewHint');
const thumbPreview = document.getElementById('thumbPreview');
const thumbPreviewImg = document.getElementById('thumbPreviewImg');
const thumbPreviewHint = document.getElementById('thumbPreviewHint');
const bgPreview = document.getElementById('bgPreview');
const bgPreviewImg = document.getElementById('bgPreviewImg');

function updatePreview(input, container, imgEl, hintEl, hintText){
  if(!input || !container || !imgEl) return;
  const url = input.value.trim();
  if(url){
    imgEl.src = url;
    imgEl.onerror = () => { container.style.display = 'none'; };
    container.style.display = 'block';
    if(hintEl && hintText){ hintEl.textContent = hintText; hintEl.style.display = 'block'; hintEl.style.color = 'var(--signal-green)'; }
  } else {
    container.style.display = 'none';
    if(hintEl) hintEl.style.display = 'none';
  }
}
function updateLogoPreview(){ updatePreview(formLogoImage, logoPreview, logoPreviewImg, logoPreviewHint, '✓ معاينة الشعار'); }
function updateFlagPreview(){ updatePreview(formFlagImage, flagPreview, flagPreviewImg, flagPreviewHint, '✓ معاينة العلم'); }
function updateBgPreview(){ updatePreview(formBgImage, bgPreview, bgPreviewImg, null, ''); }

function updateThumbPreview(){
  if(!thumbPreview || !thumbPreviewImg) return;
  const manualUrl = formVideoThumb.value.trim();
  const videoUrl = formVideoUrl.value.trim();
  let src = '', hint = '';
  if(manualUrl){ src = manualUrl; hint = '✓ صورة يدوية'; }
  else if(videoUrl){
    const auto = getVideoThumbnail(videoUrl);
    if(auto === '__VIDEO_DIRECT__'){ hint = 'ℹ فيديو مباشر'; }
    else if(auto){ src = auto; hint = '✓ مستخرجة تلقائياً'; }
    else { src = D.FALLBACK_THUMB; hint = '⚠ مصدر غير معروف'; }
  } else {
    thumbPreview.style.display = 'none';
    if(thumbPreviewHint) thumbPreviewHint.style.display = 'none';
    return;
  }
  if(src){
    thumbPreviewImg.src = src;
    thumbPreviewImg.onerror = () => { thumbPreviewImg.src = D.FALLBACK_THUMB; };
    thumbPreview.style.display = 'block';
    if(thumbPreviewHint){ thumbPreviewHint.textContent = hint; thumbPreviewHint.style.display = 'block'; thumbPreviewHint.style.color = hint.startsWith('⚠') ? 'var(--signal-amber)' : 'var(--signal-green)'; }
  } else {
    thumbPreview.style.display = 'none';
    if(thumbPreviewHint){ thumbPreviewHint.textContent = hint; thumbPreviewHint.style.display = 'block'; thumbPreviewHint.style.color = 'var(--text-3)'; }
  }
}

formLogoImage.addEventListener('input', updateLogoPreview);
formFlagImage.addEventListener('input', updateFlagPreview);
formVideoUrl.addEventListener('input', updateThumbPreview);
formVideoThumb.addEventListener('input', updateThumbPreview);
formBgImage.addEventListener('input', updateBgPreview);

saveSettingsBtn.addEventListener('click', () => {
  settings.logoImage = formLogoImage.value.trim();
  settings.flagImage = formFlagImage.value.trim();
  settings.videoUrl = formVideoUrl.value.trim();
  settings.videoThumb = formVideoThumb.value.trim();
  settings.bgImage = formBgImage.value.trim();
  if(saveJSON(KEYS.SETTINGS, settings)){ applySettings(); toast('تم حفظ الإعدادات', 'success'); markDirty(); }
  else { toast('تعذّر الحفظ', 'error'); }
});

clearSettingsBtn.addEventListener('click', () => {
  if(!confirm('مسح جميع الإعدادات؟')) return;
  settings = Object.assign({}, D.DEFAULT_SETTINGS);
  saveJSON(KEYS.SETTINGS, settings);
  applySettings();
  formLogoImage.value = ''; formFlagImage.value = ''; formVideoUrl.value = ''; formVideoThumb.value = ''; formBgImage.value = '';
  updateLogoPreview(); updateFlagPreview(); updateThumbPreview(); updateBgPreview();
  toast('تم مسح الإعدادات', 'info');
  markDirty();
});

function initNotifications(){
  const btn = document.getElementById('notifyBtn');
  if(!btn) return;
  const isSupported = 'Notification' in window;
  if(!isSupported){ btn.style.display = 'none'; return; }
  const savedState = localStorage.getItem('mod_notif_enabled') === 'true';
  updateButton(savedState && Notification.permission === 'granted');
  btn.addEventListener('click', async () => {
    if(!isSupported) return;
    if(Notification.permission === 'denied'){ toast('الإشعارات محظورة — فعّلها من إعدادات المتصفح', 'error'); return; }
    if(Notification.permission === 'granted'){
      const enabled = localStorage.getItem('mod_notif_enabled') === 'true';
      const newState = !enabled;
      localStorage.setItem('mod_notif_enabled', String(newState));
      updateButton(newState);
      toast(newState ? 'تم تفعيل الإشعارات' : 'تم إيقاف الإشعارات', newState ? 'success' : 'info');
      return;
    }
    try{
      const perm = await Notification.requestPermission();
      if(perm === 'granted'){
        localStorage.setItem('mod_notif_enabled', 'true');
        updateButton(true);
        toast('تم تفعيل الإشعارات بنجاح', 'success');
        try{ new Notification('وزارة الدفاع', { body: 'تم تفعيل الإشعارات بنجاح — ستصلك آخر الأخبار العاجلة' }); }catch(e){}
      } else {
        updateButton(false);
        toast('لم يتم تفعيل الإشعارات', 'info');
      }
    }catch(e){ toast('تعذّر تفعيل الإشعارات', 'error'); }
  });
  function updateButton(active){
    if(active){ btn.classList.add('is-active'); btn.setAttribute('aria-label', 'إيقاف الإشعارات'); btn.setAttribute('title', 'إيقاف الإشعارات'); }
    else { btn.classList.remove('is-active'); btn.setAttribute('aria-label', 'تفعيل الإشعارات'); btn.setAttribute('title', 'تفعيل الإشعارات'); }
    if(Notification.permission === 'denied'){ btn.classList.add('is-denied'); }
  }
}

const GH = { owner: 'jumaaalkurdi', repo: 'mod-defense', branch: 'main', path: 'content' };
const TOKEN_KEY = 'mod_gh_token';
const DIRTY_KEY = 'mod_dirty';

function getToken(){ return localStorage.getItem(TOKEN_KEY) || ''; }
function saveToken(t){ localStorage.setItem(TOKEN_KEY, t); }
function isDirty(){ return localStorage.getItem(DIRTY_KEY) === 'true'; }
function setDirty(v){ localStorage.setItem(DIRTY_KEY, v ? 'true' : 'false'); }
function markDirty(){ setDirty(true); updateGHSyncHint(); }

function ghRawUrl(file){ return 'https://raw.githubusercontent.com/' + GH.owner + '/' + GH.repo + '/' + GH.branch + '/' + GH.path + '/' + file + '?t=' + Date.now(); }
function ghApiUrl(file){ return 'https://api.github.com/repos/' + GH.owner + '/' + GH.repo + '/contents/' + GH.path + '/' + file; }
function b64Encode(str){ return btoa(unescape(encodeURIComponent(str))); }

async function ghReadFile(file){
  try{ const res = await fetch(ghRawUrl(file), { cache: 'no-store' }); if(!res.ok) return null; return await res.json(); }
  catch(e){ return null; }
}

async function ghGetSha(file){
  const token = getToken();
  if(!token) return null;
  try{
    const res = await fetch(ghApiUrl(file) + '?ref=' + GH.branch, { headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' } });
    if(!res.ok) return null;
    const d = await res.json();
    return d.sha;
  }catch(e){ return null; }
}

async function ghWriteFile(file, data, message){
  const token = getToken();
  if(!token) throw new Error('أدخل GitHub Token من الإعدادات');
  const sha = await ghGetSha(file);
  const body = { message: message || ('تحديث ' + file), content: b64Encode(JSON.stringify(data, null, 2) + '\n'), branch: GH.branch };
  if(sha) body.sha = sha;
  const res = await fetch(ghApiUrl(file), { method: 'PUT', headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if(!res.ok){
    const err = await res.json().catch(() => ({}));
    if(res.status === 401) throw new Error('التوكن غير صالح');
    if(res.status === 403) throw new Error('لا تملك صلاحية الكتابة');
    if(res.status === 404) throw new Error('الريبو غير موجود');
    if(res.status === 409) throw new Error('تعارض — أعد المحاولة');
    throw new Error(err.message || 'فشل الرفع');
  }
  return res.json();
}

async function ghPublishAll(){
  if(!getToken()){ toast('أدخل GitHub Token من الإعدادات', 'error'); return false; }
  try{
    await ghWriteFile('news.json', newsData, 'تحديث الأخبار');
    await ghWriteFile('ticker.json', tickerData, 'تحديث الشريط العاجل');
    await ghWriteFile('mostread.json', mostReadData, 'تحديث الأكثر قراءة');
    await ghWriteFile('elite.json', eliteData, 'تحديث الفرق القتالية');
    await ghWriteFile('settings.json', settings, 'تحديث الإعدادات');
    setDirty(false);
    updateGHSyncHint();
    toast('✅ تم النشر — سيظهر للزوار خلال دقيقة', 'success');
    return true;
  }catch(e){ toast('فشل النشر: ' + e.message, 'error'); return false; }
}

async function ghLoadAll(){
  const [news, ticker, mostRead, elite, settingsRemote] = await Promise.all([
    ghReadFile('news.json'), ghReadFile('ticker.json'), ghReadFile('mostread.json'), ghReadFile('elite.json'), ghReadFile('settings.json')
  ]);
  let changed = false;
  if(news && Array.isArray(news) && news.length){ newsData = news; saveJSON(KEYS.NEWS, newsData); changed = true; }
  if(ticker && Array.isArray(ticker) && ticker.length){ tickerData = ticker; saveJSON(KEYS.TICKER, tickerData); changed = true; }
  if(mostRead && Array.isArray(mostRead) && mostRead.length){ mostReadData = mostRead; saveJSON(KEYS.MOSTREAD, mostReadData); changed = true; }
  if(elite && Array.isArray(elite) && elite.length){ eliteData = elite; saveJSON(KEYS.ELITE, eliteData); changed = true; }
  if(settingsRemote && typeof settingsRemote === 'object'){ settings = Object.assign({}, D.DEFAULT_SETTINGS, settingsRemote); saveJSON(KEYS.SETTINGS, settings); changed = true; }
  return changed;
}

function injectGHSyncUI(){
  const settingsTab = document.querySelector('[data-tab-content="settings"]');
  if(!settingsTab) return;
  if(document.getElementById('ghSyncBlock')) return;
  const targetForm = settingsTab.querySelector('.admin-form');
  if(!targetForm) return;

  const block = document.createElement('div');
  block.id = 'ghSyncBlock';
  block.style.cssText = 'padding:18px;margin-bottom:20px;background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.3);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px));';
  block.innerHTML = '<div style="font-family:\'Noto Kufi Arabic\',sans-serif;font-weight:800;font-size:14px;color:#4ade80;margin-bottom:14px;display:flex;align-items:center;gap:10px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>مزامنة GitHub (نشر للزوار)</div><div style="display:flex;flex-direction:column;gap:12px;"><label style="font-family:\'Noto Kufi Arabic\',sans-serif;font-size:12px;color:#4ade80;font-weight:700;">GitHub Token (صلاحية repo)</label><input type="password" id="ghTokenInput" dir="ltr" placeholder="ghp_..." value="' + (getToken() || '') + '" style="padding:11px 13px;background:rgba(0,0,0,.5);border:1px solid rgba(201,163,78,.28);color:#fff;font-family:\'Black Ops One\',monospace;font-size:14px;direction:ltr;clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);outline:none;width:100%;"><small style="font-family:\'Noto Kufi Arabic\',sans-serif;font-size:11px;color:#7a7864;">أنشئ توكن من: <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" style="color:#e8c878;">github.com/settings/tokens</a></small><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;"><button type="button" id="ghPublishBtn" style="flex:1;padding:12px 20px;background:linear-gradient(135deg,#c9a34e,#e8c878);color:#06070a;border:0;font-family:\'Noto Kufi Arabic\',sans-serif;font-weight:800;font-size:13px;cursor:pointer;clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);min-width:140px;">📤 نشر للزوار</button><button type="button" id="ghPullBtn" style="flex:1;padding:12px 20px;background:rgba(0,0,0,.4);color:#e8c878;border:1px solid rgba(201,163,78,.4);font-family:\'Noto Kufi Arabic\',sans-serif;font-weight:700;font-size:13px;cursor:pointer;clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);min-width:140px;">📥 تحميل من GitHub</button></div><div id="ghSyncHint" style="font-family:\'Noto Kufi Arabic\',sans-serif;font-size:11.5px;color:#7a7864;margin-top:4px;"></div></div>';

  targetForm.insertBefore(block, targetForm.firstChild);

  document.getElementById('ghTokenInput').addEventListener('change', (e) => { saveToken(e.target.value.trim()); updateGHSyncHint(); });

  document.getElementById('ghPublishBtn').addEventListener('click', async () => {
    const b = document.getElementById('ghPublishBtn');
    const orig = b.innerHTML;
    b.innerHTML = '⏳ جارٍ النشر...';
    b.disabled = true;
    await ghPublishAll();
    b.innerHTML = orig;
    b.disabled = false;
  });

  document.getElementById('ghPullBtn').addEventListener('click', async () => {
    const b = document.getElementById('ghPullBtn');
    const orig = b.innerHTML;
    b.innerHTML = '⏳ جارٍ التحميل...';
    b.disabled = true;
    try{
      const changed = await ghLoadAll();
      if(changed){ renderNews(); renderTicker(); renderMostRead(); applySettings(); renderAdminList(); renderMrAdminList(); renderEliteAdminList(); renderTickerInput(); toast('تم التحميل من GitHub', 'success'); }
      else { toast('لا توجد بيانات جديدة', 'info'); }
    }catch(e){ toast('فشل: ' + e.message, 'error'); }
    b.innerHTML = orig;
    b.disabled = false;
  });

  updateGHSyncHint();
}

function updateGHSyncHint(){
  const hint = document.getElementById('ghSyncHint');
  if(!hint) return;
  const parts = [];
  parts.push(isDirty() ? '⚠️ هناك تعديلات غير منشورة' : '✅ كل التعديلات منشورة');
  if(!getToken()) parts.push('🔑 لم يتم إدخال Token');
  hint.textContent = parts.join(' • ');
}

async function ghBoot(){
  if(!isDirty()){
    try { const changed = await ghLoadAll(); if(changed) console.log('✅ Loaded from GitHub'); }
    catch(e){ console.warn('GitHub load failed:', e); }
  } else { console.log('⚠️ Local changes pending'); }
  init();
}

function handleInitialHash(){
  const hash = location.hash.replace('#', '');
  if(!hash) return;
  const parts = hash.split('/');
  const pageName = parts[0];
  const param = parts[1] || null;
  if(pageName === 'article' && param) showPage('article', param);
  else if(pageName === 'mostread-article' && param) showPage('mostread-article', param);
  else if(pageName === 'home' || D.PAGES[pageName]) showPage(pageName);
}

function init(){
  const yearEl = document.getElementById('year'); if(yearEl) yearEl.textContent = new Date().getFullYear();
  const drawerYearEl = document.getElementById('drawerYear'); if(drawerYearEl) drawerYearEl.textContent = new Date().getFullYear();

  buildNav();
  initDrawer();
  initDrawerSearch();
  initHeaderScroll();
  initFilters();
  initGlobalClick();
  initVideo();
  initClock();
  initProgress();
  initAdminTabs();
  initNotifications();

  renderTicker();
  renderNews();
  renderMostRead();
  applySettings();
  observeReveals();

  handleInitialHash();

  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '') || 'home';
    const parts = hash.split('/');
    const pageName = parts[0];
    const param = parts[1] || null;
    if(pageName === 'article' && param) showPage('article', param);
    else if(pageName === 'mostread-article' && param) showPage('mostread-article', param);
    else if(pageName === 'home' || D.PAGES[pageName]) showPage(pageName);
  });

  const bgPhoto = document.getElementById('bgCustomImg');
  if(bgPhoto && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    let raf = false;
    window.addEventListener('scroll', () => {
      if(raf) return;
      raf = true;
      requestAnimationFrame(() => {
        if(bgPhoto.classList.contains('is-active')){
          const y = window.scrollY * 0.06;
          bgPhoto.style.transform = 'scale(1.08) translateY(' + y + 'px)';
        }
        raf = false;
      });
    }, { passive: true });
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ghBoot);
} else {
  ghBoot();
}

})();

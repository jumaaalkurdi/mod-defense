import {
  escapeHtml, escapeAttr, relativeTime, minutesAgo, catLabel,
  getVideoThumbnail, setThumbWithFallback, safeGet
} from './utils.js';

const D = window.__data;

const toastIcons = {
  success:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5L20 7"/></svg>',
  error:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 9v4M12 17h.01"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>'
};

export function toast(msg, type){
  if(!type) type = 'info';
  const c = safeGet('toastContainer');
  if(!c) return;
  const el = document.createElement('div');
  el.className = 'toast toast--' + type;
  el.innerHTML = '<span class="toast__icon">' + (toastIcons[type] || toastIcons.info) + '</span><span>' + escapeHtml(msg) + '</span>';
  c.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-show'));
  setTimeout(() => {
    el.classList.remove('is-show');
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

export function renderTicker(data){
  const track = safeGet('tickerTrack');
  if(!track) return;
  if(!data || !data.length){ track.innerHTML = ''; return; }
  const html = data.map(item => {
    const text = typeof item === 'string' ? item : (item.text || '');
    const time = typeof item === 'string' ? '' : (item.time_label || item.time || '');
    return '<span class="ticker__item">' + escapeHtml(text) +
      (time ? '<time>' + escapeHtml(time) + '</time>' : '') + '</span>';
  }).join('');
  track.innerHTML = html + html;
}

export function initClock(){
  const clock = safeGet('clock');
  if(!clock) return;
  const p = n => String(n).padStart(2, '0');
  const tick = () => {
    const d = new Date();
    clock.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };
  tick();
  setInterval(tick, 1000);
}

export function initProgress(){
  const p = safeGet('readProgress');
  if(!p) return;
  const update = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const ratio = max > 0 ? h.scrollTop / max : 0;
    p.style.transform = 'scaleX(' + ratio + ')';
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

export function buildNav(){
  const nl = safeGet('navList');
  const dl = safeGet('drawerList');
  if(nl){
    nl.innerHTML = D.NAV_ITEMS.slice(0, 5).map(item =>
      '<li><a class="nav__link' + (item.page === 'home' ? ' is-active' : '') +
      '" href="#' + item.page + '" data-nav="' + item.page + '">' +
      escapeHtml(item.label) + '</a></li>'
    ).join('');
  }
  if(dl){
    dl.innerHTML = D.NAV_ITEMS.map(item =>
      '<a class="drawer__link' + (item.page === 'home' ? ' is-active' : '') +
      '" href="#' + item.page + '" data-nav="' + item.page + '">' +
      '<span class="drawer__link-icon">' + item.icon + '</span>' +
      '<span class="drawer__link-text">' + escapeHtml(item.label) + '</span>' +
      '<span class="drawer__link-arrow">‹</span></a>'
    ).join('');
  }
}

export function initDrawer(){
  const navToggle = safeGet('navToggle');
  const drawer = safeGet('drawer');
  const overlay = safeGet('drawerOverlay');
  if(!navToggle || !drawer) return;

  const updateTop = () => {
    const h = safeGet('header');
    if(!h) return;
    const r = h.getBoundingClientRect();
    drawer.style.top = Math.max(0, r.bottom) + 'px';
  };
  updateTop();
  window.addEventListener('resize', updateTop);
  window.addEventListener('scroll', updateTop, { passive: true });

  const open = () => {
    updateTop();
    drawer.classList.add('is-open');
    if(overlay) overlay.classList.add('is-open');
    navToggle.classList.add('is-open');
    navToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('no-scroll');
  };
  const close = () => {
    drawer.classList.remove('is-open');
    if(overlay) overlay.classList.remove('is-open');
    navToggle.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
  };
  window.openDrawer = open;
  window.closeDrawer = close;
  navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if(drawer.classList.contains('is-open')) close(); else open();
  });
  if(overlay) overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && drawer.classList.contains('is-open')) close();
  });
  window.addEventListener('resize', () => {
    if(window.innerWidth > 1080) close();
  });
}

export function initDrawerSearch(){
  const input = safeGet('drawerSearch');
  if(!input) return;
  let t = null;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    clearTimeout(t);
    t = setTimeout(() => {
      const cards = document.querySelectorAll('#newsGrid .news-card');
      if(!q){
        const active = document.querySelector('.filter.is-active');
        if(active){
          const f = active.dataset.filter;
          cards.forEach(c => { c.hidden = !(f === 'all' || c.dataset.cat === f); });
        } else {
          cards.forEach(c => { c.hidden = false; });
        }
        return;
      }
      if(q.length < 2) return;
      cards.forEach(c => { c.hidden = !c.textContent.toLowerCase().includes(q); });
    }, 200);
  });
  input.addEventListener('keydown', (e) => {
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const ns = safeGet('news');
    if(ns){
      if(window.closeDrawer) window.closeDrawer();
      setTimeout(() => ns.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  });
}

export function initHeaderScroll(){
  const header = safeGet('header');
  const toTop = safeGet('toTop');
  window.addEventListener('scroll', () => {
    if(header) header.classList.toggle('is-scrolled', window.scrollY > 8);
    if(toTop) toTop.classList.toggle('is-visible', window.scrollY > 600);
  }, { passive: true });
  if(toTop) toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

let io = null;
export function initReveal(){
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
}
export function observeReveals(root){
  root = root || document;
  root.querySelectorAll('.reveal:not(.is-in)').forEach(el => {
    if(io) io.observe(el);
    else el.classList.add('is-in');
  });
}

export function renderNews(newsData){
  const grid = safeGet('newsGrid');
  const stack = safeGet('stackContainer');
  const featured = safeGet('featuredCard');
  if(!grid) return;
  grid.innerHTML = '';

  const sorted = newsData.slice().sort((a, b) => {
    const ta = new Date(a.published_at || 0).getTime();
    const tb = new Date(b.published_at || 0).getTime();
    return tb - ta;
  });

  if(featured){
    if(sorted.length){
      const n = sorted[0];
      const c = catLabel(n.cat);
      const ts = n.published_at;
      featured.innerHTML =
        '<span class="corner corner--tl"></span><span class="corner corner--tr"></span>' +
        '<span class="corner corner--bl"></span><span class="corner corner--br"></span>' +
        '<div class="featured__media"></div><div class="featured__sweep"></div>' +
        '<div class="featured__body">' +
        '<div class="featured__badges">' +
        (n.cat === 'breaking' ? '<span class="badge badge--breaking"><span class="dot"></span> عاجل</span>' : '') +
        '<span class="badge badge--gold">' + escapeHtml(c.badge) + '</span>' +
        '</div>' +
        '<h1 class="featured__title"><a href="#" data-article="' + escapeAttr(n.id) + '">' + escapeHtml(n.title) + '</a></h1>' +
        '<p class="featured__excerpt">' + escapeHtml(n.excerpt) + '</p>' +
        '<div class="featured__meta">' +
        '<span class="meta-item meta-item--gold"><time>' + relativeTime(minutesAgo(ts)) + '</time></span>' +
        '<span class="meta-item">' + escapeHtml(n.source) + '</span>' +
        '</div></div>';
    } else {
      featured.innerHTML = '<div class="empty" style="margin:auto;">لا يوجد خبر مميز</div>';
    }
  }

  sorted.forEach((n, i) => {
    const c = catLabel(n.cat);
    const ts = n.published_at;
    const card = document.createElement('article');
    card.className = 'news-card reveal';
    card.dataset.cat = n.cat;
    card.style.setProperty('--d', Math.min(i * 0.04, 0.4) + 's');
    const imgSrc = n.image ? escapeAttr(n.image) : '';
    card.innerHTML =
      '<div class="news-card__media">' +
      (imgSrc ? '<img src="' + imgSrc + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
      '<span class="news-card__tag ' + c.cls + '">' + c.tag + '</span>' +
      '</div>' +
      '<div class="news-card__body">' +
      '<div class="news-card__meta"><time>' + relativeTime(minutesAgo(ts)) + '</time><span class="dot"></span><span>' + escapeHtml(n.source) + '</span></div>' +
      '<h3 class="news-card__title"><a href="#" data-article="' + escapeAttr(n.id) + '">' + escapeHtml(n.title) + '</a></h3>' +
      '<p class="news-card__excerpt">' + escapeHtml(n.excerpt) + '</p>' +
      '<div class="news-card__foot">' +
      '<span>' + escapeHtml(n.source) + '</span>' +
      '<span class="news-card__more" data-article="' + escapeAttr(n.id) + '">التفاصيل ›</span>' +
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
      const ts = n.published_at;
      const a = document.createElement('a');
      a.className = 'stack-card reveal';
      a.href = '#';
      a.dataset.article = n.id;
      a.style.setProperty('--d', (0.06 + i * 0.06) + 's');
      a.innerHTML =
        '<div class="stack-card__top"><span class="stack-card__cat ' + c.stack + '">◈ ' + c.badge + '</span></div>' +
        '<h3 class="stack-card__title">' + escapeHtml(n.title) + '</h3>' +
        '<span class="stack-card__time"><time>' + relativeTime(minutesAgo(ts)) + '</time><span class="dot"></span>' + escapeHtml(n.source) + '</span>';
      stack.appendChild(a);
    });
  }

  const counts = { all: sorted.length, breaking:0, official:0, reports:0, condolence:0 };
  sorted.forEach(n => { counts[n.cat] = (counts[n.cat] || 0) + 1; });
  document.querySelectorAll('[data-count-for]').forEach(el => {
    el.textContent = counts[el.dataset.countFor] || 0;
  });
  const nc = safeGet('newsCount');
  if(nc) nc.textContent = sorted.length;

  observeReveals();
}

export function renderMostRead(list){
  const container = safeGet('mostReadList');
  if(!container) return;
  container.innerHTML = '';
  if(!list.length){
    container.innerHTML = '<div class="empty" style="padding:24px;font-size:13px;">لا يوجد محتوى</div>';
    return;
  }
  list.forEach((item, i) => {
    const a = document.createElement('div');
    a.className = 'mostread__item';
    a.dataset.mostread = item.id;
    a.innerHTML =
      '<span class="mostread__num">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<div class="mostread__content">' +
      '<p class="mostread__title">' + escapeHtml(item.title) + '</p>' +
      '<span class="mostread__meta">' + escapeHtml(item.views_label || '') + '</span>' +
      '</div>';
    container.appendChild(a);
  });
}

export function renderFlag(settings){
  const display = safeGet('flagDisplay');
  if(!display) return;
  const glow = '<div class="flag-display__glow"></div>';
  if(settings && settings.flag_image && settings.flag_image.trim()){
    display.innerHTML = glow + '<img src="' + escapeAttr(settings.flag_image) + '" alt="علم سوريا">';
  } else {
    display.innerHTML = glow + D.FLAG_SVG;
  }
}

export function renderLogo(settings){
  const mark = safeGet('brandMark');
  if(!mark) return;
  const fallback =
    '<svg viewBox="0 0 48 48"><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#f5e0a5"/><stop offset=".55" stop-color="#c9a34e"/><stop offset="1" stop-color="#8a6620"/>' +
    '</linearGradient></defs>' +
    '<path d="M24 3 42 10v14c0 11-7.5 18.5-18 21C13.5 42.5 6 35 6 24V10z" fill="none" stroke="url(#g1)" stroke-width="2.2"/>' +
    '<path d="M24 13.5l2.7 5.7 6.2.9-4.5 4.3 1.1 6.1L24 27.6l-5.5 2.9 1.1-6.1-4.5-4.3 6.2-.9z" fill="url(#g1)"/></svg>';
  if(settings && settings.logo_image && settings.logo_image.trim()){
    mark.innerHTML = '<img src="' + escapeAttr(settings.logo_image) + '" alt="شعار">';
  } else {
    mark.innerHTML = fallback;
  }
}

export function applySettings(settings){
  const bgImg = safeGet('bgCustomImg');
  const bgSvg = safeGet('bgSvg');
  if(settings && settings.bg_image && settings.bg_image.trim() && bgImg){
    bgImg.src = settings.bg_image.trim();
    bgImg.classList.add('is-active');
    if(bgSvg) bgSvg.classList.add('is-hidden');
  } else {
    if(bgImg){
      bgImg.classList.remove('is-active');
      bgImg.removeAttribute('src');
    }
    if(bgSvg) bgSvg.classList.remove('is-hidden');
  }
  const vt = safeGet('videoThumb');
  if(vt){
    const manual = settings && settings.video_thumb ? settings.video_thumb.trim() : '';
    const auto = settings ? getVideoThumbnail(settings.video_url) : null;
    const primary = manual || (auto && auto !== '__VIDEO_DIRECT__' ? auto : '');
    setThumbWithFallback(vt, primary);
  }
  renderFlag(settings);
  renderLogo(settings);
}

export function applyFilterToButton(btn){
  document.querySelectorAll('.filter').forEach(b => {
    b.classList.remove('is-active');
    b.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('is-active');
  btn.setAttribute('aria-selected', 'true');
  const f = btn.dataset.filter;
  document.querySelectorAll('#newsGrid .news-card').forEach(card => {
    card.hidden = !(f === 'all' || card.dataset.cat === f);
  });
}

export function initFilters(){
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyFilterToButton(btn);
    });
  });
}

export function showLoading(){
  let ov = document.getElementById('loadingOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'loadingOverlay';
    ov.className = 'loading-overlay';
    ov.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(ov);
  }
  requestAnimationFrame(() => ov.classList.add('is-show'));
}
export function hideLoading(){
  const ov = document.getElementById('loadingOverlay');
  if(!ov) return;
  ov.classList.remove('is-show');
  setTimeout(() => ov.remove(), 300);
}

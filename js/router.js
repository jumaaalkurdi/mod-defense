import { escapeHtml, escapeAttr, relativeTime, minutesAgo, catLabel, safeGet } from './utils.js';
import { observeReveals } from './ui.js';

const D = window.__data;
let _newsData = [];
let _mostRead = [];
let _eliteData = [];
let _currentPage = 'home';

export function setRouterData(data){
  if(data.news) _newsData = data.news;
  if(data.mostRead) _mostRead = data.mostRead;
  if(data.elite) _eliteData = data.elite;
}
export function currentPage(){ return _currentPage; }

export function showPage(pageName, param, push){
  if(push === undefined) push = true;
  if(!pageName) pageName = 'home';
  _currentPage = pageName;

  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('is-active'));
  document.querySelectorAll('.nav__link, .drawer__link').forEach(l => l.classList.remove('is-active'));

  if(pageName === 'article'){
    renderArticlePage(param);
  } else if(pageName === 'mostread-article'){
    renderMostReadArticle(param);
  } else if(pageName === 'home'){
    const home = safeGet('pageHome');
    if(home) home.classList.add('is-active');
  } else {
    const def = D.PAGES[pageName];
    const pe = document.querySelector('.page-view[data-page="' + pageName + '"]');
    if(def && pe){
      if(def.custom === 'elite') renderElitePage(pe);
      else pe.innerHTML = buildPageHTML(def);
      pe.classList.add('is-active');
    } else {
      const home = safeGet('pageHome');
      if(home) home.classList.add('is-active');
      _currentPage = 'home';
    }
  }

  document.querySelectorAll('.nav__link[data-nav="' + _currentPage + '"], .drawer__link[data-nav="' + _currentPage + '"]')
    .forEach(l => l.classList.add('is-active'));

  observeReveals();

  const targetHash = param ? '#' + pageName + '/' + param : '#' + pageName;
  if(push){
    if(location.hash !== targetHash) location.hash = targetHash;
  } else {
    history.replaceState(null, '', targetHash);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildPageHTML(def){
  let blocksHtml = '';
  (def.blocks || []).forEach(block => {
    let inner = '';
    if(block.isComing) inner += '<span class="coming-soon">قيد التطوير</span>';
    if(block.body) inner += '<p>' + escapeHtml(block.body) + '</p>';
    if(block.list) inner += '<ul>' + block.list.map(x => '<li>' + escapeHtml(x) + '</li>').join('') + '</ul>';
    blocksHtml += '<div class="page-block reveal"><h3>' + escapeHtml(block.title) + '</h3>' + inner + '</div>';
  });
  return '<div class="container page-view__inner">' +
    '<a class="page-back" data-nav="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M14 5l7 7-7 7" stroke-linecap="round"/></svg>العودة</a>' +
    '<div class="page-hero reveal">' +
    '<div class="page-hero__icon">' + (def.icon || '') + '</div>' +
    '<span class="page-hero__eyebrow">' + escapeHtml(def.eyebrow || '') + '</span>' +
    '<h1 class="page-hero__title">' + escapeHtml(def.title || '') + '</h1>' +
    '<p class="page-hero__desc">' + escapeHtml(def.desc || '') + '</p>' +
    '</div>' +
    '<div class="page-content">' + blocksHtml + '</div></div>';
}

function renderElitePage(pageEl){
  const grid = _eliteData.map(u =>
    '<article class="elite-card reveal">' +
    '<div class="elite-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z"/></svg></div>' +
    '<h3 class="elite-card__name">' + escapeHtml(u.name) + '</h3>' +
    (u.motto ? '<p class="elite-card__motto">' + escapeHtml(u.motto) + '</p>' : '') +
    '<p class="elite-card__desc">' + escapeHtml(u.description || '') + '</p>' +
    (u.missions && u.missions.length ? '<div class="elite-card__missions">' + u.missions.map(m => '<div class="elite-card__mission">' + escapeHtml(m) + '</div>').join('') + '</div>' : '') +
    ((u.stat1 || u.stat2 || u.stat3) ?
      '<div class="elite-card__stats">' +
      (u.stat1 ? '<div class="elite-card__stat"><span class="elite-card__stat-num">' + escapeHtml(u.stat1) + '</span><span class="elite-card__stat-label">' + escapeHtml(u.stat1_label || '') + '</span></div>' : '') +
      (u.stat2 ? '<div class="elite-card__stat"><span class="elite-card__stat-num">' + escapeHtml(u.stat2) + '</span><span class="elite-card__stat-label">' + escapeHtml(u.stat2_label || '') + '</span></div>' : '') +
      (u.stat3 ? '<div class="elite-card__stat"><span class="elite-card__stat-num">' + escapeHtml(u.stat3) + '</span><span class="elite-card__stat-label">' + escapeHtml(u.stat3_label || '') + '</span></div>' : '') +
      '</div>' : '') +
    '</article>'
  ).join('');

  pageEl.innerHTML = '<div class="container page-view__inner">' +
    '<a class="page-back" data-nav="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M14 5l7 7-7 7"/></svg>العودة</a>' +
    '<div class="page-hero reveal"><div class="page-hero__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z"/></svg></div>' +
    '<span class="page-hero__eyebrow">نخبة عسكرية</span>' +
    '<h1 class="page-hero__title">الفرق القتالية المتميزة</h1>' +
    '<p class="page-hero__desc">وحدات النخبة في الجيش العربي السوري.</p></div>' +
    '<div class="elite-grid">' + (grid || '<div class="empty">لا توجد فرق.</div>') + '</div></div>';
  observeReveals(pageEl);
}

function renderArticlePage(newsId){
  const news = _newsData.find(n => n.id === newsId);
  const pageEl = document.querySelector('.page-view[data-page="article"]');
  if(!pageEl) return;
  if(!news){ showPage('home', null, false); return; }

  const c = catLabel(news.cat);
  const ts = news.published_at;
  const paragraphs = (news.details || news.excerpt || '').split(/\n\n+/).filter(p => p.trim());
  const lead = paragraphs[0] || '';
  const rest = paragraphs.slice(1);

  pageEl.innerHTML = '<div class="container"><div class="article-view">' +
    '<a class="page-back" data-nav="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M14 5l7 7-7 7"/></svg>العودة</a>' +
    '<article class="article-hero reveal">' +
    '<div class="article-hero__media">' + (news.image ? '<img src="' + escapeAttr(news.image) + '" alt="">' : '') + '</div>' +
    '<div class="article-hero__body">' +
    '<div class="article-hero__badges">' +
    '<span class="badge badge--gold">' + escapeHtml(c.badge) + '</span>' +
    '<span class="badge badge--gold">' + escapeHtml(news.source) + '</span>' +
    '</div>' +
    '<h1 class="article-hero__title">' + escapeHtml(news.title) + '</h1>' +
    '<div class="article-hero__meta">' +
    '<span class="meta-item meta-item--gold"><time>' + relativeTime(minutesAgo(ts)) + '</time></span>' +
    '<span class="meta-item">' + escapeHtml(news.source) + '</span>' +
    '</div></div></article>' +
    '<div class="article-body reveal">' +
    (lead ? '<p class="article-body__lead">' + escapeHtml(lead) + '</p>' : '') +
    '<div class="article-body__content">' + rest.map(p => '<p>' + escapeHtml(p) + '</p>').join('') + '</div>' +
    '<div class="article-actions"><a class="btn btn--outline" data-nav="home">الرئيسية</a></div>' +
    '</div></div></div>';
  pageEl.classList.add('is-active');
  observeReveals(pageEl);
}

function renderMostReadArticle(mrId){
  const item = _mostRead.find(m => m.id === mrId);
  const pageEl = document.querySelector('.page-view[data-page="mostread-article"]');
  if(!pageEl) return;
  if(!item){ showPage('home', null, false); return; }

  const paragraphs = (item.article || '').split(/\n\n+/).filter(p => p.trim());

  pageEl.innerHTML = '<div class="container"><div class="article-view">' +
    '<a class="page-back" data-nav="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M14 5l7 7-7 7"/></svg>العودة</a>' +
    '<article class="article-hero reveal">' +
    '<div class="article-hero__media">' + (item.image ? '<img src="' + escapeAttr(item.image) + '" alt="">' : '') + '</div>' +
    '<div class="article-hero__body">' +
    '<div class="article-hero__badges"><span class="badge badge--gold">الأكثر قراءة</span></div>' +
    '<h1 class="article-hero__title">' + escapeHtml(item.title) + '</h1>' +
    '</div></article>' +
    '<div class="article-body reveal">' +
    paragraphs.map(p => '<p>' + escapeHtml(p) + '</p>').join('') +
    '<div class="article-actions"><a class="btn btn--gold" data-nav="home">الرئيسية</a></div>' +
    '</div></div></div>';
  pageEl.classList.add('is-active');
  observeReveals(pageEl);
}

export function initRouter(onNavigate){
  const handle = () => {
    const hash = location.hash.replace(/^#/, '') || 'home';
    const parts = hash.split('/');
    const page = parts[0] || 'home';
    const param = parts[1] || null;
    if(page === 'article' && param) showPage('article', param, false);
    else if(page === 'mostread-article' && param) showPage('mostread-article', param, false);
    else if(page === 'home' || D.PAGES[page]) showPage(page, null, false);
    else showPage('home', null, false);
    if(onNavigate) onNavigate(page, param);
  };
  window.addEventListener('hashchange', handle);
  handle();
}

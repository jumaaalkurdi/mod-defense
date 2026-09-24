import { CONFIG, isConfigured } from './config.js';
import * as auth from './auth.js';
import * as api from './api.js';
import {
  initClock, initProgress, buildNav, initDrawer, initDrawerSearch,
  initHeaderScroll, initReveal, observeReveals,
  renderTicker, renderNews, renderMostRead, applySettings,
  toast, initFilters
} from './ui.js';
import { initRouter, showPage, setRouterData } from './router.js';
import {
  initAdminUI, initAdminTabs, initNewsForm, initTickerForm,
  initMrForm, initEliteForm, initSettingsUI,
  setAdminData, openAdminPanel
} from './admin.js';
import { getYouTubeId, safeGet } from './utils.js';

let state = { news: [], ticker: [], mostRead: [], elite: [], settings: {} };

function initVideo(){
  const btn = safeGet('playVideo');
  if(!btn) return;
  btn.addEventListener('click', () => {
    const url = state.settings.video_url || '';
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(6,8,10,.96);backdrop-filter:blur(20px);display:grid;place-items:center;padding:20px;opacity:0;transition:opacity .3s;';
    let ph = '';
    if(url){
      const ytId = getYouTubeId(url);
      if(ytId){
        ph = '<iframe src="https://www.youtube-nocookie.com/embed/' + ytId + '?autoplay=1&rel=0" style="width:100%;height:100%;border:0;" allowfullscreen></iframe>';
      } else if(/\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(url)){
        ph = '<video src="' + url + '" controls autoplay style="width:100%;height:100%;background:#000;"></video>';
      } else {
        ph = '<iframe src="' + url + '" style="width:100%;height:100%;border:0;" allowfullscreen></iframe>';
      }
    } else {
      ph = '<div style="text-align:center;padding:40px;color:#fff;"><h3>لا يوجد فيديو</h3></div>';
    }
    ov.innerHTML =
      '<button id="modalX" style="position:absolute;top:20px;inset-inline-end:20px;width:48px;height:48px;border:1px solid rgba(201,163,78,.4);background:rgba(201,163,78,.1);color:#e8c878;border-radius:50%;display:grid;place-items:center;font-size:20px;cursor:pointer;z-index:2;">✕</button>' +
      '<div style="width:min(90vw,1000px);aspect-ratio:16/9;background:#0d1108;border:1px solid rgba(201,163,78,.3);overflow:hidden;position:relative;">' + ph + '</div>';
    document.body.appendChild(ov);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => ov.style.opacity = '1');
    const close = () => {
      ov.style.opacity = '0';
      setTimeout(() => { ov.remove(); document.body.classList.remove('no-scroll'); }, 300);
      document.removeEventListener('keydown', onEsc);
    };
    const onEsc = (e) => { if(e.key === 'Escape') close(); };
    ov.querySelector('#modalX').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if(e.target === ov) close(); });
    document.addEventListener('keydown', onEsc);
  });
}

function initGlobalClick(){
  document.addEventListener('click', (e) => {
    const articleLink = e.target.closest('[data-article]');
    if(articleLink){
      e.preventDefault();
      if(window.innerWidth <= 1080 && window.closeDrawer) window.closeDrawer();
      showPage('article', articleLink.dataset.article);
      return;
    }
    const mrLink = e.target.closest('[data-mostread]');
    if(mrLink){
      e.preventDefault();
      if(window.innerWidth <= 1080 && window.closeDrawer) window.closeDrawer();
      showPage('mostread-article', mrLink.dataset.mostread);
      return;
    }
    const navLink = e.target.closest('[data-nav]');
    if(navLink){
      e.preventDefault();
      showPage(navLink.dataset.nav);
      if(window.innerWidth <= 1080 && window.closeDrawer) window.closeDrawer();
      return;
    }
    const filterLink = e.target.closest('[data-filter]:not(.filter)');
    if(filterLink){
      e.preventDefault();
      const t = filterLink.dataset.filter;
      const fb = document.querySelector('.filter[data-filter="' + t + '"]');
      if(fb){
        const ap = document.querySelector('.page-view.is-active');
        if(!ap || ap.dataset.page !== 'home') showPage('home');
        setTimeout(() => {
          fb.click();
          const ns = safeGet('news');
          if(ns) ns.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      }
    }
  });
}

function initNotifications(){
  const btn = safeGet('notifyBtn');
  if(!btn) return;
  if(!('Notification' in window)){ btn.style.display = 'none'; return; }

  const saved = localStorage.getItem('mod_notif') === 'true';
  update(saved && Notification.permission === 'granted');

  btn.addEventListener('click', async () => {
    if(Notification.permission === 'denied'){
      toast('الإشعارات محظورة', 'error'); return;
    }
    if(Notification.permission === 'granted'){
      const enabled = localStorage.getItem('mod_notif') === 'true';
      const next = !enabled;
      localStorage.setItem('mod_notif', String(next));
      update(next);
      toast(next ? 'تم تفعيل الإشعارات' : 'تم إيقاف الإشعارات', next ? 'success' : 'info');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if(perm === 'granted'){
        localStorage.setItem('mod_notif', 'true');
        update(true);
        toast('تم تفعيل الإشعارات', 'success');
      } else {
        update(false);
        toast('لم يتم التفعيل', 'info');
      }
    } catch(e){ toast('تعذّر التفعيل', 'error'); }
  });

  function update(active){
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-label', active ? 'إيقاف الإشعارات' : 'تفعيل الإشعارات');
    if(Notification.permission === 'denied') btn.classList.add('is-denied');
  }
}

function initInstallButton(){
  const btn = safeGet('installBtn');
  if(!btn) return;

  let deferredPrompt = null;

  function checkStandalone(){
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if(isStandalone) btn.style.display = 'none';
    return isStandalone;
  }
  if(checkStandalone()) return;

  setTimeout(() => {
    if(!checkStandalone()) btn.style.display = 'grid';
  }, 2500);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.style.display = 'grid';
  });

  window.addEventListener('appinstalled', () => {
    btn.style.display = 'none';
    deferredPrompt = null;
    toast('تم تثبيت التطبيق!', 'success');
  });

  btn.addEventListener('click', async () => {
    if(deferredPrompt){
      deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        if(choice.outcome === 'accepted'){
          toast('جارٍ التثبيت...', 'success');
        }
      } catch(e){}
      deferredPrompt = null;
      return;
    }
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if(isIOS){
      toast('للتثبيت: زر المشاركة ↗ ثم "إضافة إلى الشاشة الرئيسية"', 'info');
      return;
    }
    toast('للتثبيت: قائمة المتصفح ⋮ ثم "تثبيت التطبيق"', 'info');
  });
}

function initPWA(){
  if(!CONFIG.FEATURES.PWA) return;
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}

async function loadAll(){
  const results = await Promise.all([
    api.fetchNews().catch(() => []),
    api.fetchTicker().catch(() => []),
    api.fetchMostRead().catch(() => []),
    api.fetchElite().catch(() => []),
    api.fetchSettings().catch(() => ({}))
  ]);
  state.news = results[0];
  state.ticker = results[1];
  state.mostRead = results[2];
  state.elite = results[3];
  state.settings = results[4] || {};

  setRouterData({ news: state.news, mostRead: state.mostRead, elite: state.elite });
  setAdminData({ news: state.news, mostRead: state.mostRead, elite: state.elite, settings: state.settings, onDataChange: handleDataChange });

  renderTicker(state.ticker);
  renderNews(state.news);
  renderMostRead(state.mostRead);
  applySettings(state.settings);
}

function handleDataChange(type, payload){
  if(type === 'news'){
    state.news = payload;
    setRouterData({ news: payload });
    renderNews(payload);
  } else if(type === 'mostread'){
    state.mostRead = payload;
    setRouterData({ mostRead: payload });
    renderMostRead(payload);
  } else if(type === 'elite'){
    state.elite = payload;
    setRouterData({ elite: payload });
  } else if(type === 'settings'){
    state.settings = payload;
    applySettings(payload);
  } else if(type === 'ticker'){
    api.fetchTickerFresh().then(t => {
      state.ticker = t;
      renderTicker(t);
    });
  }
}

async function init(){
  const y = safeGet('year');
  if(y) y.textContent = new Date().getFullYear();

  if(!isConfigured()){
    toast('عدّل js/config.js ببيانات GitHub', 'error');
  }

  initClock();
  initProgress();
  buildNav();
  initDrawer();
  initDrawerSearch();
  initHeaderScroll();
  initReveal();
  initFilters();
  initVideo();
  initGlobalClick();
  initNotifications();
  initInstallButton();
  initPWA();

  initAdminUI();
  initAdminTabs();
  initNewsForm();
  initTickerForm();
  initMrForm();
  initEliteForm();
  initSettingsUI();

  await auth.initAuth();
  await loadAll();
  initRouter();

  const bgPhoto = safeGet('bgCustomImg');
  if(bgPhoto && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    let raf = false;
    window.addEventListener('scroll', () => {
      if(raf) return;
      raf = true;
      requestAnimationFrame(() => {
        if(bgPhoto.classList.contains('is-active')){
          const yy = window.scrollY * 0.06;
          bgPhoto.style.transform = 'scale(1.08) translateY(' + yy + 'px)';
        }
        raf = false;
      });
    }, { passive: true });
  }

  observeReveals();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

import { escapeHtml, escapeAttr, relativeTime, minutesAgo, catLabel, safeGet, getVideoThumbnail } from './utils.js';
import { toast, applySettings, showLoading, hideLoading } from './ui.js';
import * as api from './api.js';
import * as auth from './auth.js';
import { setRouterData, showPage, currentPage } from './router.js';

const D = window.__data;

let _news = [];
let _mostRead = [];
let _elite = [];
let _settings = {};
let _onDataChange = null;

export function setAdminData(data){
  if(data.news) _news = data.news;
  if(data.mostRead) _mostRead = data.mostRead;
  if(data.elite) _elite = data.elite;
  if(data.settings) _settings = data.settings;
  if(data.onDataChange) _onDataChange = data.onDataChange;
}

const adminLogin = () => safeGet('adminLogin');
const adminPanel = () => safeGet('adminPanel');

export function openAdminLogin(){
  if(auth.isLoggedIn()){ openAdminPanel(); return; }
  const m = adminLogin();
  if(!m) return;
  m.classList.add('is-open');
  m.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
}

export function closeAdminLogin(){
  const m = adminLogin();
  if(!m) return;
  m.classList.remove('is-open');
  m.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
}

export function openAdminPanel(){
  if(!auth.isLoggedIn()){ toast('يجب تسجيل الدخول', 'error'); return; }
  const p = adminPanel();
  if(!p) return;
  p.classList.add('is-open');
  p.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');

  const ue = safeGet('adminUserEmail');
  const user = auth.getUser();
  if(ue) ue.textContent = user ? ('@' + user.login) : 'مدير';

  renderNewsList();
  renderMrList();
  renderEliteList();
  renderTickerInput();
  fillSettingsForm();
  resetNewsForm();
  resetMrForm();
  resetEliteForm();
}

export function closeAdminPanel(){
  const p = adminPanel();
  if(!p) return;
  p.classList.remove('is-open');
  p.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
}

export function initAdminTabs(){
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

export function initAdminUI(){
  const adminBtn = safeGet('adminBtn');
  if(adminBtn) adminBtn.addEventListener('click', openAdminLogin);

  const cancel = safeGet('adminCancel');
  if(cancel) cancel.addEventListener('click', closeAdminLogin);

  const closeBtn = safeGet('adminLoginClose');
  if(closeBtn) closeBtn.addEventListener('click', closeAdminLogin);

  const login = adminLogin();
  if(login) login.addEventListener('click', (e) => {
    if(e.target === login) closeAdminLogin();
  });

  const panelClose = safeGet('adminClose');
  if(panelClose) panelClose.addEventListener('click', closeAdminPanel);

  document.addEventListener('keydown', (e) => {
    if(e.key !== 'Escape') return;
    const l = adminLogin();
    const p = adminPanel();
    if(l && l.classList.contains('is-open')) closeAdminLogin();
    else if(p && p.classList.contains('is-open')) closeAdminPanel();
  });

  const loginForm = safeGet('loginForm');
  if(loginForm){
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = safeGet('loginToken').value.trim();
      const remember = safeGet('loginRemember').checked;
      const btnLabel = safeGet('loginSubmitLabel');
      if(btnLabel) btnLabel.textContent = 'جارٍ التحقق...';
      try {
        await auth.signIn(token, remember);
        loginForm.reset();
        closeAdminLogin();
        setTimeout(openAdminPanel, 250);
        const user = auth.getUser();
        toast('مرحباً ' + (user && (user.name || user.login) || ''), 'success');
      } catch(err){
        toast(err.message || 'فشل الدخول', 'error');
      } finally {
        if(btnLabel) btnLabel.textContent = 'دخول';
      }
    });
  }

  const logout = safeGet('adminLogout');
  if(logout) logout.addEventListener('click', () => {
    auth.signOut();
    closeAdminPanel();
    toast('تم تسجيل الخروج', 'info');
  });

  const reset = safeGet('adminReset');
  if(reset) reset.addEventListener('click', async () => {
    if(!confirm('سيتم مسح كل البيانات. متابعة؟')) return;
    try {
      showLoading();
      await api.replaceTicker([]);
      await api.clearAllNews();
      await api.clearAllMostRead();
      await api.clearAllElite();
      await api.saveSettings({ logo_image: '', flag_image: '', video_url: '', video_thumb: '', bg_image: '' });
      toast('تم المسح', 'success');
      setTimeout(() => location.reload(), 900);
    } catch(err){
      toast('فشل: ' + (err.message || ''), 'error');
    } finally {
      hideLoading();
    }
  });
}

function resetNewsForm(){
  const form = safeGet('newsForm');
  if(!form) return;
  form.reset();
  safeGet('editId').value = '';
  safeGet('formSectionTitle').textContent = 'إضافة خبر جديد';
  safeGet('formSubmitLabel').textContent = 'حفظ الخبر';
  safeGet('formCancel').style.display = 'none';
}

export function initNewsForm(){
  const form = safeGet('newsForm');
  if(!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = safeGet('editId').value;
    const data = {
      cat: safeGet('formCat').value,
      source: safeGet('formSource').value.trim(),
      title: safeGet('formNewsTitle').value.trim(),
      excerpt: safeGet('formExcerpt').value.trim(),
      details: safeGet('formDetails').value.trim(),
      image: safeGet('formImage').value.trim(),
      article_image: safeGet('formArticleImage').value.trim()
    };
    if(!data.source || !data.title || !data.excerpt){
      toast('املأ الحقول المطلوبة', 'error'); return;
    }
    try {
      showLoading();
      if(id){
        await api.updateNews(id, data);
        toast('تم التحديث', 'success');
      } else {
        await api.createNews(data);
        toast('تمت الإضافة', 'success');
      }
      await refreshNews();
      resetNewsForm();
    } catch(err){
      toast('فشل: ' + (err.message || ''), 'error');
    } finally {
      hideLoading();
    }
  });

  const cancel = safeGet('formCancel');
  if(cancel) cancel.addEventListener('click', resetNewsForm);
}

async function refreshNews(){
  _news = await api.fetchNewsFresh();
  setRouterData({ news: _news });
  renderNewsList();
  if(_onDataChange) _onDataChange('news', _news);
}

function renderNewsList(){
  const container = safeGet('adminList');
  if(!container) return;
  if(!_news.length){
    container.innerHTML = '<div class="admin-empty">لا يوجد محتوى بعد</div>';
    return;
  }
  const sorted = _news.slice().sort((a, b) =>
    new Date(b.published_at || 0) - new Date(a.published_at || 0)
  );
  container.innerHTML = sorted.map(n => {
    const c = catLabel(n.cat);
    const ts = n.published_at;
    return '<div class="admin-item">' +
      '<div class="admin-item__content">' +
      '<span class="admin-item__cat">' + escapeHtml(c.badge) + '</span>' +
      '<div class="admin-item__title">' + escapeHtml(n.title) + '</div>' +
      '<div class="admin-item__meta"><span>' + escapeHtml(n.source) + '</span><span>' + relativeTime(minutesAgo(ts)) + '</span></div>' +
      '</div>' +
      '<div class="admin-item__actions">' +
      '<button class="admin-item__btn" data-edit="' + escapeAttr(n.id) + '">تعديل</button>' +
      '<button class="admin-item__btn admin-item__btn--danger" data-del="' + escapeAttr(n.id) + '">حذف</button>' +
      '</div></div>';
  }).join('');

  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = _news.find(x => x.id === btn.dataset.edit);
      if(!n) return;
      safeGet('editId').value = n.id;
      safeGet('formCat').value = n.cat;
      safeGet('formSource').value = n.source;
      safeGet('formNewsTitle').value = n.title;
      safeGet('formExcerpt').value = n.excerpt;
      safeGet('formDetails').value = n.details || '';
      safeGet('formImage').value = n.image || '';
      safeGet('formArticleImage').value = n.article_image || '';
      safeGet('formSectionTitle').textContent = 'تعديل الخبر';
      safeGet('formSubmitLabel').textContent = 'حفظ التعديلات';
      safeGet('formCancel').style.display = 'inline-flex';
    });
  });

  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if(!confirm('حذف هذا الخبر؟')) return;
      try {
        showLoading();
        await api.deleteNews(btn.dataset.del);
        toast('تم الحذف', 'success');
        if(safeGet('editId').value === btn.dataset.del) resetNewsForm();
        await refreshNews();
      } catch(err){
        toast('فشل: ' + (err.message || ''), 'error');
      } finally {
        hideLoading();
      }
    });
  });
}

function renderTickerInput(){
  const input = safeGet('tickerInput');
  if(!input) return;
  api.fetchTickerFresh().then(list => {
    input.value = list.map(it => {
      const t = it.time_label ? ' | ' + it.time_label : '';
      return (it.text || '') + t;
    }).join('\n');
  }).catch(() => {});
}

export function initTickerForm(){
  const form = safeGet('tickerForm');
  if(!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = safeGet('tickerInput').value;
    const lines = raw.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if(!lines.length){ toast('أضف خبراً واحداً', 'error'); return; }
    const parsed = lines.map(line => {
      const parts = line.split('|').map(p => p.trim());
      return parts.length > 1 ? { text: parts[0], time: parts[1] } : { text: line, time: '' };
    });
    try {
      showLoading();
      await api.replaceTicker(parsed);
      toast('تم حفظ الشريط', 'success');
      if(_onDataChange) _onDataChange('ticker');
    } catch(err){
      toast('فشل: ' + (err.message || ''), 'error');
    } finally {
      hideLoading();
    }
  });

  const reset = safeGet('tickerReset');
  if(reset) reset.addEventListener('click', async () => {
    if(!confirm('مسح الشريط بالكامل؟')) return;
    try {
      showLoading();
      await api.replaceTicker([]);
      renderTickerInput();
      toast('تم المسح', 'info');
      if(_onDataChange) _onDataChange('ticker');
    } catch(err){
      toast('فشل', 'error');
    } finally {
      hideLoading();
    }
  });
}

function resetMrForm(){
  const form = safeGet('mrForm');
  if(!form) return;
  form.reset();
  safeGet('mrEditId').value = '';
  safeGet('mrFormTitle').textContent = 'إضافة عنصر';
  safeGet('mrSubmitLabel').textContent = 'حفظ';
  safeGet('mrCancel').style.display = 'none';
}

export function initMrForm(){
  const form = safeGet('mrForm');
  if(!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = safeGet('mrEditId').value;
    const data = {
      title: safeGet('mrTitle').value.trim(),
      views_label: safeGet('mrViews').value.trim() || 'قراءة',
      image: safeGet('mrImage').value.trim(),
      article: safeGet('mrArticle').value.trim()
    };
    if(!data.title || !data.article){ toast('املأ الحقول', 'error'); return; }
    if(id) data.id = id;
    try {
      showLoading();
      await api.upsertMostRead(data);
      toast(id ? 'تم التحديث' : 'تمت الإضافة', 'success');
      _mostRead = await api.fetchMostReadFresh();
      setRouterData({ mostRead: _mostRead });
      renderMrList();
      resetMrForm();
      if(_onDataChange) _onDataChange('mostread', _mostRead);
    } catch(err){
      toast('فشل: ' + (err.message || ''), 'error');
    } finally {
      hideLoading();
    }
  });

  const cancel = safeGet('mrCancel');
  if(cancel) cancel.addEventListener('click', resetMrForm);
}

function renderMrList(){
  const container = safeGet('mrAdminList');
  if(!container) return;
  if(!_mostRead.length){
    container.innerHTML = '<div class="admin-empty">لا يوجد</div>';
    return;
  }
  container.innerHTML = _mostRead.map((m, i) =>
    '<div class="admin-item">' +
    '<div class="admin-item__content">' +
    '<span class="admin-item__cat">#' + String(i + 1).padStart(2, '0') + '</span>' +
    '<div class="admin-item__title">' + escapeHtml(m.title) + '</div>' +
    '<div class="admin-item__meta"><span>' + escapeHtml(m.views_label || '') + '</span></div>' +
    '</div>' +
    '<div class="admin-item__actions">' +
    '<button class="admin-item__btn" data-mr-edit="' + escapeAttr(m.id) + '">تعديل</button>' +
    '<button class="admin-item__btn admin-item__btn--danger" data-mr-del="' + escapeAttr(m.id) + '">حذف</button>' +
    '</div></div>'
  ).join('');

  container.querySelectorAll('[data-mr-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = _mostRead.find(x => x.id === btn.dataset.mrEdit);
      if(!m) return;
      safeGet('mrEditId').value = m.id;
      safeGet('mrTitle').value = m.title;
      safeGet('mrViews').value = m.views_label || '';
      safeGet('mrImage').value = m.image || '';
      safeGet('mrArticle').value = m.article || '';
      safeGet('mrFormTitle').textContent = 'تعديل';
      safeGet('mrSubmitLabel').textContent = 'حفظ';
      safeGet('mrCancel').style.display = 'inline-flex';
    });
  });

  container.querySelectorAll('[data-mr-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if(!confirm('حذف؟')) return;
      try {
        showLoading();
        await api.deleteMostRead(btn.dataset.mrDel);
        _mostRead = await api.fetchMostReadFresh();
        setRouterData({ mostRead: _mostRead });
        renderMrList();
        toast('تم', 'success');
        if(_onDataChange) _onDataChange('mostread', _mostRead);
      } catch(err){
        toast('فشل', 'error');
      } finally {
        hideLoading();
      }
    });
  });
}

function resetEliteForm(){
  const form = safeGet('eliteForm');
  if(!form) return;
  form.reset();
  safeGet('eliteEditId').value = '';
  safeGet('eliteFormTitle').textContent = 'إضافة فرقة';
  safeGet('eliteSubmitLabel').textContent = 'حفظ';
  safeGet('eliteCancel').style.display = 'none';
}

export function initEliteForm(){
  const form = safeGet('eliteForm');
  if(!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = safeGet('eliteEditId').value;
    const missionsRaw = safeGet('eliteMissions').value.trim();
    const data = {
      name: safeGet('eliteName').value.trim(),
      motto: safeGet('eliteMotto').value.trim(),
      description: safeGet('eliteDesc').value.trim(),
      missions: missionsRaw ? missionsRaw.split(/\n+/).map(s => s.trim()).filter(Boolean) : [],
      stat1: safeGet('eliteStat1').value.trim(),
      stat1_label: safeGet('eliteStat1Label').value.trim(),
      stat2: safeGet('eliteStat2').value.trim(),
      stat2_label: safeGet('eliteStat2Label').value.trim(),
      stat3: safeGet('eliteStat3').value.trim(),
      stat3_label: safeGet('eliteStat3Label').value.trim()
    };
    if(!data.name || !data.description){ toast('املأ الحقول', 'error'); return; }
    if(id) data.id = id;
    try {
      showLoading();
      await api.upsertElite(data);
      toast(id ? 'تم التحديث' : 'تمت الإضافة', 'success');
      _elite = await api.fetchEliteFresh();
      setRouterData({ elite: _elite });
      renderEliteList();
      resetEliteForm();
      if(currentPage() === 'elite-units') showPage('elite-units', null, false);
      if(_onDataChange) _onDataChange('elite', _elite);
    } catch(err){
      toast('فشل: ' + (err.message || ''), 'error');
    } finally {
      hideLoading();
    }
  });

  const cancel = safeGet('eliteCancel');
  if(cancel) cancel.addEventListener('click', resetEliteForm);
}

function renderEliteList(){
  const container = safeGet('eliteAdminList');
  if(!container) return;
  if(!_elite.length){
    container.innerHTML = '<div class="admin-empty">لا يوجد</div>';
    return;
  }
  container.innerHTML = _elite.map(u =>
    '<div class="admin-item">' +
    '<div class="admin-item__content">' +
    '<span class="admin-item__cat">فرقة</span>' +
    '<div class="admin-item__title">' + escapeHtml(u.name) + '</div>' +
    '<div class="admin-item__meta"><span>' + escapeHtml(u.motto || '') + '</span></div>' +
    '</div>' +
    '<div class="admin-item__actions">' +
    '<button class="admin-item__btn" data-elite-edit="' + escapeAttr(u.id) + '">تعديل</button>' +
    '<button class="admin-item__btn admin-item__btn--danger" data-elite-del="' + escapeAttr(u.id) + '">حذف</button>' +
    '</div></div>'
  ).join('');

  container.querySelectorAll('[data-elite-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = _elite.find(x => x.id === btn.dataset.eliteEdit);
      if(!u) return;
      safeGet('eliteEditId').value = u.id;
      safeGet('eliteName').value = u.name;
      safeGet('eliteMotto').value = u.motto || '';
      safeGet('eliteDesc').value = u.description || '';
      safeGet('eliteMissions').value = (u.missions || []).join('\n');
      safeGet('eliteStat1').value = u.stat1 || '';
      safeGet('eliteStat1Label').value = u.stat1_label || '';
      safeGet('eliteStat2').value = u.stat2 || '';
      safeGet('eliteStat2Label').value = u.stat2_label || '';
      safeGet('eliteStat3').value = u.stat3 || '';
      safeGet('eliteStat3Label').value = u.stat3_label || '';
      safeGet('eliteFormTitle').textContent = 'تعديل';
      safeGet('eliteSubmitLabel').textContent = 'حفظ';
      safeGet('eliteCancel').style.display = 'inline-flex';
    });
  });

  container.querySelectorAll('[data-elite-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if(!confirm('حذف؟')) return;
      try {
        showLoading();
        await api.deleteElite(btn.dataset.eliteDel);
        _elite = await api.fetchEliteFresh();
        setRouterData({ elite: _elite });
        renderEliteList();
        toast('تم', 'success');
        if(currentPage() === 'elite-units') showPage('elite-units', null, false);
        if(_onDataChange) _onDataChange('elite', _elite);
      } catch(err){
        toast('فشل', 'error');
      } finally {
        hideLoading();
      }
    });
  });
}

function fillSettingsForm(){
  const f1 = safeGet('formLogoImage'); if(f1) f1.value = _settings.logo_image || '';
  const f2 = safeGet('formFlagImage'); if(f2) f2.value = _settings.flag_image || '';
  const f3 = safeGet('formVideoUrl'); if(f3) f3.value = _settings.video_url || '';
  const f4 = safeGet('formVideoThumb'); if(f4) f4.value = _settings.video_thumb || '';
  const f5 = safeGet('formBgImage'); if(f5) f5.value = _settings.bg_image || '';
  updateLogoPreview();
  updateFlagPreview();
  updateThumbPreview();
  updateBgPreview();
}

function updatePreview(input, container, imgEl, hintEl, hintText){
  if(!input || !container || !imgEl) return;
  const url = input.value.trim();
  if(url){
    imgEl.src = url;
    imgEl.onerror = () => { container.style.display = 'none'; };
    container.style.display = 'block';
    if(hintEl && hintText){
      hintEl.textContent = hintText;
      hintEl.style.display = 'block';
    }
  } else {
    container.style.display = 'none';
    if(hintEl) hintEl.style.display = 'none';
  }
}
function updateLogoPreview(){
  updatePreview(safeGet('formLogoImage'), safeGet('logoPreview'), safeGet('logoPreviewImg'), safeGet('logoPreviewHint'), 'معاينة الشعار');
}
function updateFlagPreview(){
  updatePreview(safeGet('formFlagImage'), safeGet('flagPreview'), safeGet('flagPreviewImg'), safeGet('flagPreviewHint'), 'معاينة العلم');
}
function updateBgPreview(){
  updatePreview(safeGet('formBgImage'), safeGet('bgPreview'), safeGet('bgPreviewImg'), null, '');
}
function updateThumbPreview(){
  const tp = safeGet('thumbPreview');
  const ti = safeGet('thumbPreviewImg');
  const th = safeGet('thumbPreviewHint');
  const fv = safeGet('formVideoUrl');
  const ft = safeGet('formVideoThumb');
  if(!tp || !ti || !fv || !ft) return;

  const manual = ft.value.trim();
  const video = fv.value.trim();
  let src = '', hint = '';

  if(manual){ src = manual; hint = 'صورة يدوية'; }
  else if(video){
    const auto = getVideoThumbnail(video);
    if(auto === '__VIDEO_DIRECT__'){ hint = 'فيديو مباشر'; }
    else if(auto){ src = auto; hint = 'مستخرجة تلقائياً'; }
    else { src = D.FALLBACK_THUMB; hint = 'مصدر غير معروف'; }
  } else {
    tp.style.display = 'none';
    if(th) th.style.display = 'none';
    return;
  }

  if(src){
    ti.src = src;
    ti.onerror = () => { ti.src = D.FALLBACK_THUMB; };
    tp.style.display = 'block';
    if(th){ th.textContent = hint; th.style.display = 'block'; }
  } else {
    tp.style.display = 'none';
    if(th){ th.textContent = hint; th.style.display = 'block'; }
  }
}

export function initSettingsUI(){
  const fl = safeGet('formLogoImage');
  const ff = safeGet('formFlagImage');
  const fv = safeGet('formVideoUrl');
  const ft = safeGet('formVideoThumb');
  const fb = safeGet('formBgImage');

  if(fl) fl.addEventListener('input', updateLogoPreview);
  if(ff) ff.addEventListener('input', updateFlagPreview);
  if(fv) fv.addEventListener('input', updateThumbPreview);
  if(ft) ft.addEventListener('input', updateThumbPreview);
  if(fb) fb.addEventListener('input', updateBgPreview);

  const save = safeGet('saveSettings');
  if(save) save.addEventListener('click', async () => {
    const payload = {
      logo_image: safeGet('formLogoImage').value.trim(),
      flag_image: safeGet('formFlagImage').value.trim(),
      video_url: safeGet('formVideoUrl').value.trim(),
      video_thumb: safeGet('formVideoThumb').value.trim(),
      bg_image: safeGet('formBgImage').value.trim()
    };
    try {
      showLoading();
      _settings = await api.saveSettings(payload);
      applySettings(_settings);
      toast('تم حفظ الإعدادات', 'success');
      if(_onDataChange) _onDataChange('settings', _settings);
    } catch(err){
      toast('فشل: ' + (err.message || ''), 'error');
    } finally {
      hideLoading();
    }
  });

  const clear = safeGet('clearSettings');
  if(clear) clear.addEventListener('click', async () => {
    if(!confirm('مسح جميع الإعدادات؟')) return;
    try {
      showLoading();
      _settings = await api.saveSettings({ logo_image: '', flag_image: '', video_url: '', video_thumb: '', bg_image: '' });
      applySettings(_settings);
      fillSettingsForm();
      toast('تم المسح', 'info');
      if(_onDataChange) _onDataChange('settings', _settings);
    } catch(err){
      toast('فشل', 'error');
    } finally {
      hideLoading();
    }
  });
}

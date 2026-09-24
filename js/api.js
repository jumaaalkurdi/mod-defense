import { CONFIG, GITHUB_API, cdnUrl } from './config.js';
import { getToken } from './auth.js';
import { b64Encode } from './utils.js';

const cache = new Map();
function cached(key, ttl, fn){
  const now = Date.now();
  const hit = cache.get(key);
  if(hit && (now - hit.t) < ttl) return Promise.resolve(hit.v);
  return fn().then(v => { cache.set(key, { v, t: now }); return v; });
}
export function invalidate(prefix){
  for(const k of cache.keys()) if(!prefix || k.startsWith(prefix)) cache.delete(k);
}

async function readJSON(path, bust){
  const url = cdnUrl(path) + (bust ? '?v=' + Date.now() : '');
  const res = await fetch(url, { cache: bust ? 'no-store' : 'default' });
  if(!res.ok){
    if(res.status === 404) return null;
    throw new Error('فشل قراءة ' + path);
  }
  return res.json();
}

async function getFileMeta(path){
  const { OWNER, REPO, BRANCH } = CONFIG.GITHUB;
  const token = getToken();
  if(!token) throw new Error('يجب تسجيل الدخول');
  const res = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' }
  });
  if(res.status === 404) return null;
  if(!res.ok){
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'فشل قراءة الملف');
  }
  return res.json();
}

async function writeJSON(path, data, message){
  const { OWNER, REPO, BRANCH } = CONFIG.GITHUB;
  const token = getToken();
  if(!token) throw new Error('يجب تسجيل الدخول');
  const existing = await getFileMeta(path);
  const content = b64Encode(JSON.stringify(data, null, 2) + '\n');
  const body = { message: message || 'تحديث', content, branch: BRANCH };
  if(existing && existing.sha) body.sha = existing.sha;
  const res = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if(!res.ok){
    const err = await res.json().catch(() => ({}));
    if(res.status === 409) throw new Error('تعارض - أعد التحميل');
    if(res.status === 403) throw new Error('لا تملك صلاحية');
    throw new Error(err.message || 'فشل الحفظ');
  }
  return res.json();
}

export async function fetchNews(){
  return cached('news', CONFIG.CACHE.NEWS_TTL_MS, async () => {
    const data = await readJSON('news.json');
    return Array.isArray(data) ? data : [];
  });
}
export async function fetchNewsFresh(){
  invalidate('news');
  const data = await readJSON('news.json', true);
  return Array.isArray(data) ? data : [];
}
export async function createNews(payload){
  const list = await fetchNewsFresh();
  const item = {
    id: 'n_' + Date.now().toString(36),
    title: payload.title, excerpt: payload.excerpt, details: payload.details || '',
    cat: payload.cat || 'reports', source: payload.source,
    image: payload.image || '', article_image: payload.article_image || '',
    views: 0, published_at: new Date().toISOString()
  };
  list.unshift(item);
  await writeJSON('news.json', list, 'إضافة خبر');
  invalidate('news');
  return item;
}
export async function updateNews(id, payload){
  const list = await fetchNewsFresh();
  const idx = list.findIndex(n => n.id === id);
  if(idx === -1) throw new Error('غير موجود');
  list[idx] = Object.assign({}, list[idx], payload);
  await writeJSON('news.json', list, 'تحديث خبر');
  invalidate('news');
  return list[idx];
}
export async function deleteNews(id){
  const list = await fetchNewsFresh();
  await writeJSON('news.json', list.filter(n => n.id !== id), 'حذف خبر');
  invalidate('news');
}
export async function clearAllNews(){
  await writeJSON('news.json', [], 'مسح كل الأخبار');
  invalidate('news');
}

export async function fetchTicker(){
  return cached('ticker', 60000, async () => {
    const data = await readJSON('ticker.json');
    return Array.isArray(data) ? data : [];
  });
}
export async function fetchTickerFresh(){
  invalidate('ticker');
  const data = await readJSON('ticker.json', true);
  return Array.isArray(data) ? data : [];
}
export async function replaceTicker(items){
  const rows = items.map((it, i) => ({
    id: 't_' + i + '_' + Date.now().toString(36),
    text: it.text, time_label: it.time || '', order_idx: i
  }));
  await writeJSON('ticker.json', rows, 'تحديث الشريط');
  invalidate('ticker');
  return rows;
}

export async function fetchMostRead(){
  return cached('mr', 60000, async () => {
    const data = await readJSON('mostread.json');
    return Array.isArray(data) ? data : [];
  });
}
export async function fetchMostReadFresh(){
  invalidate('mr');
  const data = await readJSON('mostread.json', true);
  return Array.isArray(data) ? data : [];
}
export async function upsertMostRead(item){
  const list = await fetchMostReadFresh();
  if(item.id){
    const idx = list.findIndex(m => m.id === item.id);
    if(idx === -1) throw new Error('غير موجود');
    list[idx] = Object.assign({}, list[idx], item);
    await writeJSON('mostread.json', list, 'تحديث عنصر');
  } else {
    item.id = 'm_' + Date.now().toString(36);
    item.order_idx = list.length;
    list.push(item);
    await writeJSON('mostread.json', list, 'إضافة عنصر');
  }
  invalidate('mr');
  return item;
}
export async function deleteMostRead(id){
  const list = await fetchMostReadFresh();
  await writeJSON('mostread.json', list.filter(m => m.id !== id), 'حذف عنصر');
  invalidate('mr');
}
export async function clearAllMostRead(){
  await writeJSON('mostread.json', [], 'مسح الأكثر قراءة');
  invalidate('mr');
}

export async function fetchElite(){
  return cached('elite', 60000, async () => {
    const data = await readJSON('elite.json');
    return Array.isArray(data) ? data : [];
  });
}
export async function fetchEliteFresh(){
  invalidate('elite');
  const data = await readJSON('elite.json', true);
  return Array.isArray(data) ? data : [];
}
export async function upsertElite(item){
  const list = await fetchEliteFresh();
  if(item.id){
    const idx = list.findIndex(u => u.id === item.id);
    if(idx === -1) throw new Error('غير موجود');
    list[idx] = Object.assign({}, list[idx], item);
    await writeJSON('elite.json', list, 'تحديث فرقة');
  } else {
    item.id = 'e_' + Date.now().toString(36);
    item.order_idx = list.length;
    list.push(item);
    await writeJSON('elite.json', list, 'إضافة فرقة');
  }
  invalidate('elite');
  return item;
}
export async function deleteElite(id){
  const list = await fetchEliteFresh();
  await writeJSON('elite.json', list.filter(u => u.id !== id), 'حذف فرقة');
  invalidate('elite');
}
export async function clearAllElite(){
  await writeJSON('elite.json', [], 'مسح الفرق');
  invalidate('elite');
}

export async function fetchSettings(){
  return cached('settings', CONFIG.CACHE.SETTINGS_TTL_MS, async () => {
    const data = await readJSON('settings.json');
    return data && typeof data === 'object' ? data : {};
  });
}
export async function fetchSettingsFresh(){
  invalidate('settings');
  const data = await readJSON('settings.json', true);
  return data && typeof data === 'object' ? data : {};
}
export async function saveSettings(payload){
  const current = await fetchSettingsFresh();
  const merged = Object.assign({}, current, payload);
  await writeJSON('settings.json', merged, 'تحديث الإعدادات');
  invalidate('settings');
  return merged;
}

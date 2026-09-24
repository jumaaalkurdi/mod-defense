export function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
export const escapeAttr = escapeHtml;

export function plural(n, one, two, few, many){
  if(n === 1) return one;
  if(n === 2) return two;
  if(n >= 3 && n <= 10) return n + ' ' + few;
  return n + ' ' + many;
}

export function relativeTime(minutes){
  minutes = Math.max(0, Math.floor(minutes));
  if(minutes < 1) return 'الآن';
  if(minutes < 60) return 'منذ ' + plural(minutes, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة');
  const h = Math.floor(minutes / 60);
  if(h < 24) return 'منذ ' + plural(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
  const d = Math.floor(h / 24);
  if(d < 30) return 'منذ ' + plural(d, 'يوم', 'يومين', 'أيام', 'يوماً');
  const mo = Math.floor(d / 30);
  return 'منذ ' + plural(mo, 'شهر', 'شهرين', 'أشهر', 'شهراً');
}

export function minutesAgo(ts){
  if(!ts) return 0;
  const t = typeof ts === 'number' ? ts : new Date(ts).getTime();
  return (Date.now() - t) / 60000;
}

export function catLabel(cat){
  const map = {
    breaking:   { tag:'◈ عاجل',    cls:'news-card__tag--breaking', stack:'stack-card__cat--red', badge:'عاجل' },
    official:   { tag:'بيان رسمي', cls:'news-card__tag--official', stack:'',                    badge:'رسمي' },
    reports:    { tag:'تقرير',     cls:'',                          stack:'',                    badge:'تقرير' },
    condolence: { tag:'تعزية',     cls:'',                          stack:'',                    badge:'تعازي' }
  };
  return map[cat] || { tag:'خبر', cls:'', stack:'', badge:'خبر' };
}

export function getVideoThumbnail(url){
  if(!url || typeof url !== 'string') return null;
  url = url.trim();
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if(yt && yt[1]) return 'https://img.youtube.com/vi/' + yt[1] + '/maxresdefault.jpg';
  if(/\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(url)) return '__VIDEO_DIRECT__';
  return null;
}

export function getYouTubeId(url){
  if(!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function setThumbWithFallback(imgEl, src, fallback){
  if(!imgEl) return;
  const fb = fallback || (window.__data && window.__data.FALLBACK_THUMB);
  imgEl.onerror = () => {
    if(src && src.includes('maxresdefault')){
      imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = fb; };
      imgEl.src = src.replace('maxresdefault', 'hqdefault');
    } else {
      imgEl.onerror = null;
      imgEl.src = fb;
    }
  };
  imgEl.src = src || fb;
}

export function safeGet(id){ return document.getElementById(id); }

export function b64Encode(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}

(function(){
'use strict';

const _k = 0x5A;
const _d = [121,107,104,105,110,111,62,59,40,49,106,34,107,111,110,105,104,107,121];

window.__security = {
  checkPassword: function(inp){
    if(typeof inp !== 'string' || inp.length === 0) return false;
    let ref = '';
    for(let i = 0; i < _d.length; i++) ref += String.fromCharCode(_d[i] ^ _k);
    if(inp.length !== ref.length) return false;
    let diff = 0;
    for(let i = 0; i < inp.length; i++) diff |= inp.charCodeAt(i) ^ ref.charCodeAt(i);
    return diff === 0;
  }
};

const RL_KEY = 'mod_rl_v7';
const RL_MAX = 5;
const RL_LOCK_MS = 15 * 60 * 1000;
function loadRL(){ try{ return JSON.parse(localStorage.getItem(RL_KEY)) || { att:0, lockUntil:0 }; }catch(e){ return { att:0, lockUntil:0 }; } }
function saveRL(data){ try{ localStorage.setItem(RL_KEY, JSON.stringify(data)); }catch(e){} }

window.__ratelimit = {
  isLocked: function(){ const d = loadRL(); return Date.now() < d.lockUntil; },
  getRemaining: function(){ const d = loadRL(); return Math.ceil((d.lockUntil - Date.now()) / 1000); },
  recordFail: function(){ const d = loadRL(); d.att++; if(d.att >= RL_MAX){ d.lockUntil = Date.now() + RL_LOCK_MS; d.att = 0; } saveRL(d); return d.att; },
  getAttempts: function(){ return loadRL().att; },
  reset: function(){ saveRL({ att:0, lockUntil:0 }); }
};

const MUQATTAAT = [
  { n:1, surah:'البقرة', letters:'الم' },
  { n:2, surah:'آل عمران', letters:'الم' },
  { n:3, surah:'الأعراف', letters:'المص' },
  { n:4, surah:'يونس', letters:'الر' },
  { n:5, surah:'هود', letters:'الر' },
  { n:6, surah:'يوسف', letters:'الر' },
  { n:7, surah:'الرعد', letters:'المر' },
  { n:8, surah:'إبراهيم', letters:'الر' },
  { n:9, surah:'الحجر', letters:'الر' },
  { n:10, surah:'مريم', letters:'كهيعص' },
  { n:11, surah:'طه', letters:'طه' },
  { n:12, surah:'الشعراء', letters:'طسم' },
  { n:13, surah:'النمل', letters:'طس' },
  { n:14, surah:'القصص', letters:'طسم' },
  { n:15, surah:'العنكبوت', letters:'الم' },
  { n:16, surah:'الروم', letters:'الم' },
  { n:17, surah:'لقمان', letters:'الم' },
  { n:18, surah:'السجدة', letters:'الم' },
  { n:19, surah:'يس', letters:'يس' },
  { n:20, surah:'ص', letters:'ص' },
  { n:21, surah:'غافر', letters:'حم' },
  { n:22, surah:'فصلت', letters:'حم' },
  { n:23, surah:'الشورى', letters:'حم عسق' },
  { n:24, surah:'الزخرف', letters:'حم' },
  { n:25, surah:'الدخان', letters:'حم' },
  { n:26, surah:'الجاثية', letters:'حم' },
  { n:27, surah:'الأحقاف', letters:'حم' },
  { n:28, surah:'ق', letters:'ق' },
  { n:29, surah:'القلم', letters:'ن' }
];

const ALL_MQ = ['الم','المص','الر','المر','كهيعص','طه','طسم','طس','يس','ص','حم','حم عسق','ق','ن'];

function cleanMq(s){
  return String(s||'').trim().replace(/\s+/g, '').replace(/[أإآٱ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/[ةه]/g, 'ه').toLowerCase();
}

window.__muqattaat = {
  getToday: function(){
    const d = new Date();
    let day = d.getDate();
    if(day > 29) day = day - 29;
    const entry = MUQATTAAT.find(m => m.n === day);
    return entry ? { surah: entry.surah, letters: entry.letters, day: day } : null;
  },
  check: function(input){ const today = this.getToday(); if(!today) return false; return cleanMq(input) === cleanMq(today.letters); },
  isAny: function(input){ const c = cleanMq(input); if(c.length < 1 || c.length > 8) return false; return ALL_MQ.some(m => cleanMq(m) === c); },
  list: MUQATTAAT
};

const SUSPECTS_KEY = 'mod_suspects_v7';
function loadSuspects(){ try{ return JSON.parse(sessionStorage.getItem(SUSPECTS_KEY)) || []; }catch(e){ return []; } }
function saveSuspects(arr){ try{ if(arr.length > 50) arr = arr.slice(-50); sessionStorage.setItem(SUSPECTS_KEY, JSON.stringify(arr)); }catch(e){} }

window.__decoy = {
  log: function(entry){ try{ const log = loadSuspects(); log.push({ ...entry, time: new Date().toISOString(), ua: navigator.userAgent.substring(0, 120), lang: navigator.language, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }); saveSuspects(log); }catch(e){} },
  getAll: loadSuspects,
  clear: function(){ saveSuspects([]); }
};

window.__mqState = { validated: false, validatedAt: 0, correctAttempts: 0, wrongAttempts: 0 };
})();

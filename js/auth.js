import { CONFIG, GITHUB_API } from './config.js';

const TOKEN_KEY = 'mod_admin_token';
let _token = null;
let _user  = null;
const listeners = new Set();

export function onAuthChange(fn){ listeners.add(fn); return () => listeners.delete(fn); }
function emit(){ listeners.forEach(fn => { try { fn(_user); } catch(e){} }); }

export function getToken(){ return _token; }
export function getUser(){ return _user; }
export function isLoggedIn(){ return Boolean(_token && _user); }

function saveToken(token, remember){
  _token = token;
  if(remember) localStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.setItem(TOKEN_KEY, token);
}

function clearToken(){
  _token = null;
  _user = null;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

function loadStoredToken(){
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

async function validateToken(token){
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });
  if(!res.ok){
    if(res.status === 401) throw new Error('مفتاح غير صالح');
    throw new Error('فشل التحقق');
  }
  return res.json();
}

async function validateRepo(token){
  const { OWNER, REPO } = CONFIG.GITHUB;
  const res = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });
  if(!res.ok){
    if(res.status === 404) throw new Error('الريبو غير موجود');
    if(res.status === 403) throw new Error('لا تملك صلاحية');
    throw new Error('فشل التحقق من الريبو');
  }
  const data = await res.json();
  if(!data.permissions || !data.permissions.push){
    throw new Error('المفتاح لا يملك صلاحية الكتابة');
  }
  return data;
}

export async function initAuth(){
  const stored = loadStoredToken();
  if(!stored) return;
  try {
    const user = await validateToken(stored);
    _token = stored;
    _user = { login: user.login, name: user.name };
    emit();
  } catch(e){
    clearToken();
  }
}

export async function signIn(token, remember){
  if(remember === undefined) remember = true;
  if(!token || !token.trim()) throw new Error('أدخل المفتاح');
  token = token.trim();
  const user = await validateToken(token);
  await validateRepo(token);
  saveToken(token, remember);
  _user = { login: user.login, name: user.name };
  emit();
  return _user;
}

export function signOut(){
  clearToken();
  emit();
}

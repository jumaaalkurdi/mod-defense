export const CONFIG = {
  GITHUB: {
    OWNER:       'jumaaalkurdi',
    REPO:        'mod-defense',
    BRANCH:      'main',
    CONTENT_DIR: 'content'
  },
  SITE: {
    NAME: 'وزارة الدفاع — المركز الإعلامي',
    LANG: 'ar',
    DIR:  'rtl'
  },
  CACHE: {
    NEWS_TTL_MS:     60_000,
    SETTINGS_TTL_MS: 300_000
  },
  FEATURES: {
    PWA:      true,
    REALTIME: false
  },
  VERSION: '3.0.1'
};

export const GITHUB_API = 'https://api.github.com';
export const GITHUB_RAW = 'https://raw.githubusercontent.com';

export function cdnUrl(path){
  const { OWNER, REPO, BRANCH, CONTENT_DIR } = CONFIG.GITHUB;
  return `${GITHUB_RAW}/${OWNER}/${REPO}/${BRANCH}/${CONTENT_DIR}/${path}`;
}

export function isConfigured(){
  return CONFIG.GITHUB.OWNER &&
         !CONFIG.GITHUB.OWNER.includes('YOUR-') &&
         CONFIG.GITHUB.REPO;
}

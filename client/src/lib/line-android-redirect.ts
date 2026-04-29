export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export function isLineAndroid(): boolean {
  const ua = navigator.userAgent;
  return /android/i.test(ua) && /Line\//i.test(ua);
}

export function getChromeIntentUrl(): string {
  const host = window.location.hostname;
  const path = window.location.pathname + window.location.search;
  return `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
}

export function redirectToChrome(): boolean {
  if (!isLineAndroid()) return false;
  const host = window.location.hostname;
  const path = window.location.pathname + window.location.search;
  window.location.href = `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
  return true;
}

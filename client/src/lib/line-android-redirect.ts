export function isLineAndroid(): boolean {
  const ua = navigator.userAgent;
  return /android/i.test(ua) && /Line\//i.test(ua);
}

export function isLineIOS(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /Line\//i.test(ua);
}

export function redirectIfLineWebview(): boolean {
  const url = window.location.href;

  if (isLineAndroid()) {
    const host = window.location.hostname;
    const path = window.location.pathname + window.location.search;
    window.location.href = `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
    return true;
  }

  if (isLineIOS()) {
    window.location.href = url.replace(/^https?:\/\//, "x-safari-https://");
    return true;
  }

  return false;
}

export function isLineWebview(): boolean {
  return isLineAndroid() || isLineIOS();
}

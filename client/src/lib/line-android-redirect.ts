export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export function isLineIOS(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /Line\//i.test(ua);
}

export function redirectIfLineWebview(): boolean {
  if (isLineIOS()) {
    const url = window.location.href;
    window.location.href = url.replace(/^https?:\/\//, "x-safari-https://");
    return true;
  }
  return false;
}

export function isLineWebview(): boolean {
  return isAndroid();
}

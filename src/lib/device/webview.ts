/**
 * 안드로이드 앱(WebView) 내부에서 실행 중인지 판별.
 * MainActivity.java가 User-Agent 끝에 " ModelBeautyApp"을 붙여준다.
 */
export function isAppWebView(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return navigator.userAgent.includes("ModelBeautyApp");
}

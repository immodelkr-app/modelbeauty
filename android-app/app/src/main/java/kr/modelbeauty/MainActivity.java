package kr.modelbeauty;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;

import javax.crypto.Cipher;

public class MainActivity extends AppCompatActivity {

    private WebView mWebView;
    private View mSplashOverlay;
    private boolean mSplashHidden = false;
    private ValueCallback<Uri[]> mUploadMessage;
    private final static int FILE_CHOOSER_RESULT_CODE = 1001;
    // 페이지 로딩이 지연되더라도 스플래시가 무한정 떠 있지 않도록 하는 최대 대기 시간
    private final static long SPLASH_TIMEOUT_MS = 6000;

    // 실서비스 웹사이트 URL
    private static final String TARGET_URL = "https://www.modelbeauty.kr";

    // 지문 로그인용 Android Keystore 키 별칭 및 저장 정보
    // RSA 키 쌍 방식: 개인키(복호화)만 지문 인증을 요구하고 공개키(암호화)는 인증 없이도
    // 사용 가능하므로, Supabase 세션이 백그라운드에서 자동 갱신되어 refresh_token이 바뀌어도
    // 지문 프롬프트 없이 저장값을 최신 상태로 계속 동기화할 수 있다(syncCredential 참고).
    private static final String BIOMETRIC_KEY_ALIAS = "modelbeauty_biometric_key";
    private static final String BIOMETRIC_PREFS_NAME = "biometric_prefs";
    private static final String PREF_CIPHERTEXT = "ciphertext";
    private static final String RSA_TRANSFORMATION = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding";

    // 앱 푸시(FCM) 관련 요청 코드
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 2001;

    // FcmService(별도 컴포넌트)가 토큰 갱신을 웹뷰로 즉시 전달할 수 있도록 유지하는 현재 액티비티 참조
    private static MainActivity sCurrentInstance;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        sCurrentInstance = this;

        // Android 15(targetSdk 35+)부터는 앱이 기본적으로 엣지투엣지로 표시되어, 인셋을
        // 직접 처리하지 않으면 상태바/내비게이션 바에 콘텐츠(웹뷰 상단 헤더, 하단 버튼 등)가
        // 가려질 수 있다. 시스템 바 영역만큼 루트 뷰에 패딩을 주어 기존과 동일하게 보이도록 유지.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        setContentView(R.layout.activity_main);
        mSplashOverlay = findViewById(R.id.splash_overlay);

        View rootView = findViewById(R.id.main_root);
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, windowInsets) -> {
            Insets systemBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        // 자바 코드로 웹뷰 생성 후 컨테이너에 추가
        mWebView = new WebView(this);
        FrameLayout webViewContainer = findViewById(R.id.webview_container);
        webViewContainer.addView(mWebView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // 웹뷰 기본 설정
        initWebViewSettings();

        // 앱 푸시 알림 표시 권한 요청 (Android 13+)
        requestNotificationPermissionIfNeeded();

        // 로딩이 오래 걸려도 스플래시가 영구히 남지 않도록 안전장치
        new Handler(Looper.getMainLooper()).postDelayed(this::hideSplash, SPLASH_TIMEOUT_MS);

        // 뒤로가기 버튼 콜백 설정 (물리 뒤로가기 클릭 시 웹뷰 히스토리 이동)
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (mWebView.canGoBack()) {
                    mWebView.goBack();
                } else {
                    finish(); // 더 이상 뒤로갈 페이지가 없으면 앱 종료
                }
            }
        });

        // URL 로드 시작 (모카/IMFF 등에서 딥링크로 들어온 경우 해당 경로로, 아니면 기본 홈으로)
        mWebView.loadUrl(resolveTargetUrl(getIntent()));
    }

    // 앱이 이미 실행 중인 상태(singleTask)에서 딥링크로 재호출된 경우 처리
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (mWebView != null) {
            mWebView.loadUrl(resolveTargetUrl(intent));
        }
    }

    // 신뢰할 수 있는 실서비스 호스트만 허용 (교차 앱 스크립팅 방지용 화이트리스트)
    private static final String TRUSTED_HOST = "www.modelbeauty.kr";

    // MainActivity는 android:exported="true"이므로 다른 앱(악성 앱 포함)이 임의의 Intent를
    // 직접 보낼 수 있다. 그 Intent에 담긴 값(딥링크 path, 푸시 링크 등)을 검증 없이
    // WebView.loadUrl()에 넘기면 javascript:/file:// 스킴이나 피싱 도메인을 로드시켜
    // AndroidBiometric/AndroidPush JS 브릿지를 악용당할 수 있다(Cross-App Scripting).
    // 따라서 외부에서 들어온 값은 반드시 TRUSTED_HOST로만 귀결되는지 검증한다.
    private boolean isTrustedUrl(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        String host = uri.getHost();
        return "https".equals(scheme) && TRUSTED_HOST.equals(host);
    }

    // modelbeauty://open?path=/products/123 형태의 딥링크에서 path 쿼리 파라미터를 꺼내
    // 실서비스 URL 뒤에 붙여준다. 딥링크가 아니거나 path가 없으면 기본 홈 URL을 반환.
    // 푸시 알림을 탭해서 들어온 경우(FcmService.EXTRA_LINK_URL)가 최우선.
    private String resolveTargetUrl(Intent intent) {
        String pushLinkUrl = (intent != null) ? intent.getStringExtra(FcmService.EXTRA_LINK_URL) : null;
        if (pushLinkUrl != null && !pushLinkUrl.isEmpty() && isTrustedUrl(pushLinkUrl)) {
            return pushLinkUrl;
        }

        Uri data = (intent != null) ? intent.getData() : null;
        if (data == null) {
            return TARGET_URL;
        }
        String path = data.getQueryParameter("path");
        if (path == null || path.isEmpty()) {
            return TARGET_URL;
        }
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        // path 값 자체로 스킴/호스트를 바꿔치기(예: "//evil.com" → 프로토콜 상대 URL)하지
        // 못하도록, 최종적으로 만들어진 URL이 여전히 신뢰 호스트인지 다시 한번 검증한다.
        String candidate = TARGET_URL + path;
        return isTrustedUrl(candidate) ? candidate : TARGET_URL;
    }

    @Override
    protected void onPause() {
        super.onPause();
        // 백그라운드로 전환되면 웹뷰 타이머/렌더링을 멈춰 불필요한 CPU/메모리 사용을 줄인다
        // (Google Play 정책: 비트맵 등은 앱이 보이지 않는 상태에서 장시간 메모리에 유지되면 안 됨)
        if (mWebView != null) {
            mWebView.onPause();
            mWebView.pauseTimers();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mWebView != null) {
            mWebView.onResume();
            mWebView.resumeTimers();
        }
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        // 시스템이 메모리 부족을 알리면(백그라운드 캐시 단계 이상) 웹뷰 렌더 캐시를 비워
        // 앱이 비트맵/RSS 메모리를 과도하게 붙들고 있지 않도록 한다
        if (mWebView != null && level >= TRIM_MEMORY_BACKGROUND) {
            mWebView.clearCache(false);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (sCurrentInstance == this) {
            sCurrentInstance = null;
        }
        // 웹뷰가 액티비티 소멸 후에도 렌더러/네이티브 리소스를 붙들고 있지 않도록 명시적으로 해제
        if (mWebView != null) {
            FrameLayout webViewContainer = findViewById(R.id.webview_container);
            if (webViewContainer != null) {
                webViewContainer.removeView(mWebView);
            }
            mWebView.stopLoading();
            mWebView.clearHistory();
            mWebView.removeAllViews();
            mWebView.destroy();
            mWebView = null;
        }
    }

    // ===================== 앱 푸시(FCM) 관련 =====================

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        NOTIFICATION_PERMISSION_REQUEST_CODE);
            }
        }
    }

    // FcmService.onNewToken()에서 새 토큰이 발급될 때마다 호출되어, 웹뷰가 떠 있으면 즉시 JS로 전달한다.
    // (웹뷰가 아직 없거나 다른 화면일 때는 무시 — 웹 쪽에서 다음 페이지 로드/로그인 시점에
    //  window.AndroidPush.getToken()으로 캐시된 토큰을 다시 읽어가므로 유실되지 않는다)
    static void notifyNewFcmToken(String token) {
        MainActivity activity = sCurrentInstance;
        if (activity == null) return;
        activity.runOnUiThread(() ->
                activity.notifyJs("window.__onFcmToken && window.__onFcmToken(" + activity.jsString(token) + ")"));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initWebViewSettings() {
        WebSettings settings = mWebView.getSettings();
        
        // 필수 웹 기능 활성화
        settings.setJavaScriptEnabled(true); // 자바스크립트 허용
        settings.setDomStorageEnabled(true); // 로컬 스토리지 활성화 (로그인 세션 유지용)
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        
        // 화면 레이아웃 맞춤
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // 카카오톡 공유 등 window.open()으로 새 창을 여는 스크립트 지원
        // (미설정 시 window.open()이 null을 반환해 카카오 SDK가 즉시 에러를 던짐)
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        // 💡 앱 접속 식별을 위한 커스텀 User-Agent 덧붙이기
        // 웹사이트(Next.js)에서 브라우저 정보를 체크하여 "ModelBeautyApp"이 포함되어 있으면 앱 뷰로 인지할 수 있습니다.
        String defaultUserAgent = settings.getUserAgentString();
        settings.setUserAgentString(defaultUserAgent + " ModelBeautyApp");

        // 앱 내부에서 페이지 이동 처리
        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // 결제 앱 실행 등 외부 앱 스킴 가로채기 처리 (토스, 신한 등 카드 결제 연동)
                if (url.startsWith("http:") || url.startsWith("https:")) {
                    return false; // 웹뷰 내에서 일반 링크 이동 허용
                } else {
                    return handleExternalUrl(url);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                hideSplash();
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                // 네트워크 오류 시에도 스플래시에 갇히지 않도록 즉시 해제
                hideSplash();
            }
        });

        // 파일 업로드(사진 리뷰 등록 등) 가로채기 지원
        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                
                if (mUploadMessage != null) {
                    mUploadMessage.onReceiveValue(null);
                    mUploadMessage = null;
                }

                mUploadMessage = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_RESULT_CODE);
                } catch (Exception e) {
                    mUploadMessage = null;
                    return false;
                }
                return true;
            }

            // window.open()으로 열리는 새 창(카카오톡 공유 팝업 등)을 가로채서
            // 시스템 인텐트로 넘긴다 (카카오톡 앱 딥링크는 앱 실행, 일반 URL은 외부 브라우저로 이동)
            // 카카오 하이브리드 앱 가이드 권장사항: 팝업 웹뷰는 실제 뷰 계층에 추가하고,
            // window.close() 호출 시(onCloseWindow) 반드시 제거해야 리다이렉트 스크립트가
            // 정상 동작한다(뷰 계층에 붙지 않은 웹뷰는 일부 기기에서 내부 리다이렉트가 멈출 수 있음).
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView transportWebView = new WebView(MainActivity.this);
                transportWebView.getSettings().setJavaScriptEnabled(true);
                transportWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView childView, String url) {
                        return handleExternalUrl(url);
                    }
                });
                transportWebView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        FrameLayout webViewContainer = findViewById(R.id.webview_container);
                        if (webViewContainer != null) {
                            webViewContainer.removeView(window);
                        }
                        window.destroy();
                    }
                });

                // 화면에 보이지 않아야 하므로 크기는 0으로 두되, 리다이렉트가 끊기지 않도록
                // 뷰 계층에는 반드시 추가한다.
                FrameLayout webViewContainer = findViewById(R.id.webview_container);
                if (webViewContainer != null) {
                    webViewContainer.addView(transportWebView, new FrameLayout.LayoutParams(0, 0));
                }

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(transportWebView);
                resultMsg.sendToTarget();
                return true;
            }
        });

        // 지문 로그인용 JS 브릿지 등록 (웹에서 window.AndroidBiometric으로 접근)
        mWebView.addJavascriptInterface(new BiometricBridge(), "AndroidBiometric");

        // 앱 푸시(FCM)용 JS 브릿지 등록 (웹에서 window.AndroidPush으로 접근)
        mWebView.addJavascriptInterface(new PushBridge(), "AndroidPush");
    }

    // 웹뷰에서 http(s)가 아닌 외부 스킴 URL을 처리한다. 카카오톡 공유 등 일부 SDK는
    // "intent://...#Intent;scheme=...;package=...;S.browser_fallback_url=...;end" 형식의
    // Android 전용 intent URI를 반환하는데, 이 형식은 Uri.parse() + ACTION_VIEW로는 제대로
    // 해석되지 않고(scheme이 "intent"인 일반 URI로 오인되어 해당 앱을 못 찾음) 예외 없이
    // 조용히 실패한다. Intent.parseUri(URI_INTENT_SCHEME)로 별도 파싱해야 한다.
    private boolean handleExternalUrl(String url) {
        try {
            if (url.startsWith("intent://") || url.startsWith("intent:")) {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                if (intent.resolveActivity(getPackageManager()) != null) {
                    startActivity(intent);
                } else {
                    String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                    if (fallbackUrl != null) {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl)));
                    }
                }
            } else {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            }
        } catch (Exception e) {
            // 해당 URL을 처리할 앱이 없는 경우 등은 무시
        }
        return true;
    }

    // 웹(JS)에서 window.AndroidPush.getToken()으로 호출하는 브릿지.
    // FcmService가 SharedPreferences에 저장해둔 최신 FCM 토큰을 동기로 반환한다(없으면 빈 문자열).
    private class PushBridge {
        @JavascriptInterface
        public String getToken() {
            SharedPreferences prefs = getSharedPreferences(FcmService.PREFS_NAME, MODE_PRIVATE);
            String token = prefs.getString(FcmService.PREF_TOKEN, "");
            return token != null ? token : "";
        }
    }

    // 스플래시 오버레이를 부드럽게 사라지게 함 (페이지 로딩 완료/오류/타임아웃 중 가장 먼저 발생하는 시점에 1회만 실행)
    private void hideSplash() {
        if (mSplashHidden || mSplashOverlay == null) return;
        mSplashHidden = true;
        mSplashOverlay.animate()
                .alpha(0f)
                .setDuration(250)
                .withEndAction(() -> mSplashOverlay.setVisibility(View.GONE))
                .start();
    }

    // 파일 선택 완료 후 업로드 정보 전달
    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (mUploadMessage == null) return;
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            mUploadMessage.onReceiveValue(result);
            mUploadMessage = null;
        }
    }

    // ===================== 지문 로그인(생체 인증) 관련 =====================

    private interface OnBiometricSuccess {
        void run(BiometricPrompt.AuthenticationResult result);
    }

    private interface OnBiometricError {
        void run(String message);
    }

    // 웹(JS)에서 window.AndroidBiometric.xxx()로 호출하는 브릿지.
    // 주의: @JavascriptInterface 메서드는 WebView 내부 스레드(백그라운드)에서 호출되므로
    // BiometricPrompt 표시/evaluateJavascript 호출은 반드시 runOnUiThread로 감싼다.
    private class BiometricBridge {

        @JavascriptInterface
        public String checkAvailability() {
            BiometricManager biometricManager = BiometricManager.from(MainActivity.this);
            int canAuth = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
            boolean hardwareAvailable = canAuth == BiometricManager.BIOMETRIC_SUCCESS;
            SharedPreferences prefs = getSharedPreferences(BIOMETRIC_PREFS_NAME, MODE_PRIVATE);
            boolean credentialSaved = prefs.contains(PREF_CIPHERTEXT);
            return "{\"hardwareAvailable\":" + hardwareAvailable + ",\"credentialSaved\":" + credentialSaved + "}";
        }

        // 회원가입 완료 화면 / 마이페이지에서 호출: 지문 인증(본인 확인) 후 현재 세션의
        // refresh token을 RSA 공개키로 암호화해 저장. 암호화 자체는 인증이 필요 없지만,
        // 등록 시점에는 기기 소유자 확인을 위해 지문 프롬프트를 그대로 띄운다.
        @JavascriptInterface
        public void saveCredential(String refreshToken) {
            runOnUiThread(() -> {
                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle("지문 로그인 등록")
                        .setSubtitle("지문을 인증하면 다음부터 지문으로 로그인할 수 있어요")
                        .setNegativeButtonText("취소")
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                        .build();
                BiometricPrompt biometricPrompt = new BiometricPrompt(MainActivity.this,
                        ContextCompat.getMainExecutor(MainActivity.this),
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                super.onAuthenticationSucceeded(result);
                                if (encryptAndStoreCredential(refreshToken)) {
                                    notifyJs("window.__onBiometricEnrollResult && window.__onBiometricEnrollResult(true, '')");
                                } else {
                                    notifyJs("window.__onBiometricEnrollResult && window.__onBiometricEnrollResult(false, '')");
                                }
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, CharSequence errString) {
                                super.onAuthenticationError(errorCode, errString);
                                notifyJs("window.__onBiometricEnrollResult && window.__onBiometricEnrollResult(false, " + jsString(errString.toString()) + ")");
                            }
                        });
                biometricPrompt.authenticate(promptInfo);
            });
        }

        // 세션이 백그라운드에서 자동 갱신되어 refresh_token이 바뀔 때마다 호출: 이미 등록된
        // 기기에서만, 지문 프롬프트 없이 저장값을 최신 토큰으로 조용히 동기화한다.
        // (RSA 공개키 암호화는 인증이 필요 없으므로 가능 — 복호화만 지문이 필요하다)
        @JavascriptInterface
        public void syncCredential(String refreshToken) {
            SharedPreferences prefs = getSharedPreferences(BIOMETRIC_PREFS_NAME, MODE_PRIVATE);
            if (!prefs.contains(PREF_CIPHERTEXT)) return;
            encryptAndStoreCredential(refreshToken);
        }

        // 로그인 화면에서 호출: 지문 인증 성공 시 저장된 refresh token을 복호화해 웹으로 전달
        @JavascriptInterface
        public void login() {
            runOnUiThread(() -> {
                try {
                    Cipher cipher = getDecryptCipher();
                    BiometricPrompt.CryptoObject cryptoObject = new BiometricPrompt.CryptoObject(cipher);
                    showBiometricPrompt(
                            "지문으로 로그인",
                            "등록한 지문으로 로그인하세요",
                            cryptoObject,
                            result -> {
                                try {
                                    Cipher c = result.getCryptoObject().getCipher();
                                    String ciphertextB64 = getSharedPreferences(BIOMETRIC_PREFS_NAME, MODE_PRIVATE)
                                            .getString(PREF_CIPHERTEXT, null);
                                    byte[] ciphertext = Base64.decode(ciphertextB64, Base64.NO_WRAP);
                                    byte[] decrypted = c.doFinal(ciphertext);
                                    String token = new String(decrypted, StandardCharsets.UTF_8);
                                    notifyJs("window.__onBiometricLoginResult && window.__onBiometricLoginResult(true, " + jsString(token) + ", '')");
                                } catch (Exception e) {
                                    notifyJs("window.__onBiometricLoginResult && window.__onBiometricLoginResult(false, null, " + jsString(e.getMessage()) + ")");
                                }
                            },
                            errorMessage -> notifyJs("window.__onBiometricLoginResult && window.__onBiometricLoginResult(false, null, " + jsString(errorMessage) + ")")
                    );
                } catch (KeyPermanentlyInvalidatedException e) {
                    // 지문 재등록 등으로 키가 무효화된 경우: 저장된 자격증명을 지우고 재등록을 유도
                    clearStoredCredential();
                    notifyJs("window.__onBiometricLoginResult && window.__onBiometricLoginResult(false, null, 'invalidated')");
                } catch (Exception e) {
                    notifyJs("window.__onBiometricLoginResult && window.__onBiometricLoginResult(false, null, " + jsString(e.getMessage()) + ")");
                }
            });
        }

        // 마이페이지에서 지문 로그인을 끌 때 호출
        @JavascriptInterface
        public void clearCredential() {
            clearStoredCredential();
        }
    }

    private void clearStoredCredential() {
        getSharedPreferences(BIOMETRIC_PREFS_NAME, MODE_PRIVATE).edit().clear().apply();
    }

    private void showBiometricPrompt(String title, String subtitle, BiometricPrompt.CryptoObject cryptoObject,
                                      OnBiometricSuccess onSuccess, OnBiometricError onError) {
        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setNegativeButtonText("취소")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .build();

        BiometricPrompt biometricPrompt = new BiometricPrompt(MainActivity.this,
                ContextCompat.getMainExecutor(MainActivity.this),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        onSuccess.run(result);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        onError.run(errString.toString());
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                        // 지문 불일치 등 단순 실패는 프롬프트가 자체적으로 재시도를 유도하므로 별도 처리 없음
                    }
                });

        biometricPrompt.authenticate(promptInfo, cryptoObject);
    }

    // 등록된 키가 있으면 반환하고, 없으면 새로 생성한다. 과거(AES 대칭키 방식) 버전에서
    // 등록된 키가 남아있으면 새 방식과 호환되지 않으므로 삭제 후 재생성을 유도한다.
    private KeyPair getOrCreateKeyPair() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);

        if (keyStore.containsAlias(BIOMETRIC_KEY_ALIAS)) {
            KeyStore.Entry entry = keyStore.getEntry(BIOMETRIC_KEY_ALIAS, null);
            if (entry instanceof KeyStore.PrivateKeyEntry) {
                KeyStore.PrivateKeyEntry privateEntry = (KeyStore.PrivateKeyEntry) entry;
                return new KeyPair(privateEntry.getCertificate().getPublicKey(), privateEntry.getPrivateKey());
            }
            // 이전 버전에서 등록된 키(다른 알고리즘)는 재사용할 수 없으므로 정리하고
            // 등록이 무효화된 것과 동일하게 처리해 재등록을 유도한다.
            keyStore.deleteEntry(BIOMETRIC_KEY_ALIAS);
            clearStoredCredential();
            throw new KeyPermanentlyInvalidatedException();
        }

        KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                BIOMETRIC_KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true)
                .build();
        keyPairGenerator.initialize(spec);
        return keyPairGenerator.generateKeyPair();
    }

    // 공개키 암호화 — Android Keystore는 개인키 사용에만 지문 인증을 요구하므로
    // (공개키는 비밀이 아니라 안전하게 노출 가능) 이 연산은 프롬프트 없이 바로 수행된다.
    private Cipher getEncryptCipher() throws Exception {
        Cipher cipher = Cipher.getInstance(RSA_TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKeyPair().getPublic());
        return cipher;
    }

    // 개인키 복호화 — 반드시 지문 인증(BiometricPrompt.CryptoObject)을 통해서만 사용 가능하다.
    private Cipher getDecryptCipher() throws Exception {
        SharedPreferences prefs = getSharedPreferences(BIOMETRIC_PREFS_NAME, MODE_PRIVATE);
        if (!prefs.contains(PREF_CIPHERTEXT)) {
            throw new IllegalStateException("no credential saved");
        }
        Cipher cipher = Cipher.getInstance(RSA_TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKeyPair().getPrivate());
        return cipher;
    }

    // 지문 인증 없이(공개키로) refresh token을 암호화해 저장. saveCredential(최초 등록)과
    // syncCredential(자동 토큰 갱신 시 재동기화) 양쪽에서 공유하는 로직.
    private boolean encryptAndStoreCredential(String refreshToken) {
        try {
            Cipher cipher = getEncryptCipher();
            byte[] encrypted = cipher.doFinal(refreshToken.getBytes(StandardCharsets.UTF_8));
            getSharedPreferences(BIOMETRIC_PREFS_NAME, MODE_PRIVATE).edit()
                    .putString(PREF_CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                    .apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void notifyJs(String script) {
        if (mWebView != null) {
            mWebView.evaluateJavascript(script, null);
        }
    }

    private String jsString(String s) {
        if (s == null) return "null";
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "") + "'";
    }
}

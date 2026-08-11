package kr.modelbeauty;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
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
import androidx.core.content.ContextCompat;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

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
    private static final String BIOMETRIC_KEY_ALIAS = "modelbeauty_biometric_key";
    private static final String BIOMETRIC_PREFS_NAME = "biometric_prefs";
    private static final String PREF_IV = "iv";
    private static final String PREF_CIPHERTEXT = "ciphertext";
    private static final String AES_TRANSFORMATION =
            KeyProperties.KEY_ALGORITHM_AES + "/" + KeyProperties.BLOCK_MODE_GCM + "/" + KeyProperties.ENCRYPTION_PADDING_NONE;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.activity_main);
        mSplashOverlay = findViewById(R.id.splash_overlay);

        // 자바 코드로 웹뷰 생성 후 컨테이너에 추가
        mWebView = new WebView(this);
        FrameLayout webViewContainer = findViewById(R.id.webview_container);
        webViewContainer.addView(mWebView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // 웹뷰 기본 설정
        initWebViewSettings();

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

        // URL 로드 시작
        mWebView.loadUrl(TARGET_URL);
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
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        // 스마트폰에 해당 결제/외부 앱이 설치되어 있지 않은 경우 처리
                        return true;
                    }
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
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView transportWebView = new WebView(MainActivity.this);
                transportWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView childView, String url) {
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        } catch (Exception e) {
                            // 해당 URL을 처리할 앱이 없는 경우 등은 무시
                        }
                        return true;
                    }
                });

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(transportWebView);
                resultMsg.sendToTarget();
                return true;
            }
        });

        // 지문 로그인용 JS 브릿지 등록 (웹에서 window.AndroidBiometric으로 접근)
        mWebView.addJavascriptInterface(new BiometricBridge(), "AndroidBiometric");
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

        // 회원가입 완료 화면 / 마이페이지에서 호출: 현재 세션의 refresh token을 지문으로 보호해 저장
        @JavascriptInterface
        public void saveCredential(String refreshToken) {
            runOnUiThread(() -> {
                try {
                    Cipher cipher = getEncryptCipher();
                    BiometricPrompt.CryptoObject cryptoObject = new BiometricPrompt.CryptoObject(cipher);
                    showBiometricPrompt(
                            "지문 로그인 등록",
                            "지문을 인증하면 다음부터 지문으로 로그인할 수 있어요",
                            cryptoObject,
                            result -> {
                                try {
                                    Cipher c = result.getCryptoObject().getCipher();
                                    byte[] encrypted = c.doFinal(refreshToken.getBytes(StandardCharsets.UTF_8));
                                    getSharedPreferences(BIOMETRIC_PREFS_NAME, MODE_PRIVATE).edit()
                                            .putString(PREF_IV, Base64.encodeToString(c.getIV(), Base64.NO_WRAP))
                                            .putString(PREF_CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                                            .apply();
                                    notifyJs("window.__onBiometricEnrollResult && window.__onBiometricEnrollResult(true, '')");
                                } catch (Exception e) {
                                    notifyJs("window.__onBiometricEnrollResult && window.__onBiometricEnrollResult(false, " + jsString(e.getMessage()) + ")");
                                }
                            },
                            errorMessage -> notifyJs("window.__onBiometricEnrollResult && window.__onBiometricEnrollResult(false, " + jsString(errorMessage) + ")")
                    );
                } catch (Exception e) {
                    notifyJs("window.__onBiometricEnrollResult && window.__onBiometricEnrollResult(false, " + jsString(e.getMessage()) + ")");
                }
            });
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

    private SecretKey getOrCreateSecretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);

        if (keyStore.containsAlias(BIOMETRIC_KEY_ALIAS)) {
            return (SecretKey) keyStore.getKey(BIOMETRIC_KEY_ALIAS, null);
        }

        KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                BIOMETRIC_KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true)
                .build();
        keyGenerator.init(spec);
        return keyGenerator.generateKey();
    }

    private Cipher getEncryptCipher() throws Exception {
        Cipher cipher = Cipher.getInstance(AES_TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey());
        return cipher;
    }

    private Cipher getDecryptCipher() throws Exception {
        SharedPreferences prefs = getSharedPreferences(BIOMETRIC_PREFS_NAME, MODE_PRIVATE);
        String ivB64 = prefs.getString(PREF_IV, null);
        if (ivB64 == null) {
            throw new IllegalStateException("no credential saved");
        }
        byte[] iv = Base64.decode(ivB64, Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance(AES_TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateSecretKey(), new GCMParameterSpec(128, iv));
        return cipher;
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

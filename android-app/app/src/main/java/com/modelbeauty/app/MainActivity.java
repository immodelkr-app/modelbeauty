package com.modelbeauty.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView mWebView;
    private ValueCallback<Uri[]> mUploadMessage;
    private final static int FILE_CHOOSER_RESULT_CODE = 1001;

    // 실서비스 웹사이트 URL
    private static final String TARGET_URL = "https://www.modelbeauty.kr";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 자바 코드로 웹뷰 생성 및 전체 화면 채우기
        mWebView = new WebView(this);
        setContentView(mWebView);

        // 웹뷰 기본 설정
        initWebViewSettings();

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
        });
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
}

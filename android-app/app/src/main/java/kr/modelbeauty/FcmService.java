package kr.modelbeauty;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

// ============================================================
// FcmService — 앱 푸시(FCM) 수신 처리
// AndroidManifest.xml의 default_notification_channel_id와 동일한 CHANNEL_ID를 사용한다.
// ============================================================
public class FcmService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "model_beauty_default";
    private static final String CHANNEL_NAME = "모델뷰티 알림";

    static final String PREFS_NAME = "fcm_prefs";
    static final String PREF_TOKEN = "token";

    // 알림 탭 시 MainActivity로 전달되는, 웹뷰에서 열어야 할 URL
    static final String EXTRA_LINK_URL = "push_link_url";

    private static final AtomicInteger sNotificationIdCounter = new AtomicInteger(1000);

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putString(PREF_TOKEN, token).apply();
        MainActivity.notifyNewFcmToken(token);
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);

        String title = null;
        String body = null;
        RemoteMessage.Notification notification = message.getNotification();
        if (notification != null) {
            title = notification.getTitle();
            body = notification.getBody();
        }

        Map<String, String> data = message.getData();
        if (title == null) title = data.get("title");
        if (body == null) body = data.get("body");
        String linkUrl = data.get("link_url");

        showNotification(title, body, linkUrl);
    }

    private void showNotification(String title, String body, String linkUrl) {
        createChannelIfNeeded();

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (linkUrl != null && !linkUrl.isEmpty()) {
            intent.putExtra(EXTRA_LINK_URL, linkUrl);
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        int notificationId = sNotificationIdCounter.incrementAndGet();
        PendingIntent pendingIntent = PendingIntent.getActivity(this, notificationId, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title != null ? title : "모델뷰티")
                .setContentText(body != null ? body : "")
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH);

        try {
            NotificationManagerCompat.from(this).notify(notificationId, builder.build());
        } catch (SecurityException e) {
            // 알림 권한이 아직 허용되지 않은 경우 — 조용히 무시 (앱은 정상 동작)
        }
    }

    private void createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null && manager.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
                manager.createNotificationChannel(channel);
            }
        }
    }
}

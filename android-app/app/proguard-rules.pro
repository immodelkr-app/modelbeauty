# Add project specific ProGuard rules here.
# You can control what code is kept or discarded by using Proguard rules.

# Keep JavascriptInterface methods
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebKit classes
-keep class android.webkit.** { *; }

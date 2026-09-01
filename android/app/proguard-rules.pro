# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# BRCommunity native Chrome controller is referenced by the Android manifest and
# React Native package registration. Keep the classes and their members so R8
# cannot remove or rename the native bridge/service contract.
-keep class com.anonymous.brcommunityandroidhelper.ChromeAccessibilityService { *; }
-keep class com.anonymous.brcommunityandroidhelper.ChromeControlModule { *; }
-keep class com.anonymous.brcommunityandroidhelper.ChromeControlPackage { *; }
-keep class com.anonymous.brcommunityandroidhelper.ChromeSessionPolicy { *; }

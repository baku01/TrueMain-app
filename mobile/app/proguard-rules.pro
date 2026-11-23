# kotlinx.serialization: keep @Serializable classes (sealed, data object, enum) and serializers.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keep @kotlinx.serialization.Serializable class lol.truemain.mobile.** { *; }
-keep class lol.truemain.mobile.link.Plain** { *; }
-keep class lol.truemain.mobile.link.Sealed** { *; }
-keep class lol.truemain.mobile.link.Mode { *; }
-keep class lol.truemain.mobile.link.PcInfo** { *; }
-keep,includedescriptorclasses class lol.truemain.mobile.**$$serializer { *; }

# Bouncy Castle's lightweight API is called directly (no JCA provider); nothing reflective.
-dontwarn org.bouncycastle.**

# Google Play services Code Scanner / ML Kit: R8 full mode otherwise strips delegate
# activities and reflection-loaded registrars in release builds, crashing startScan().
-keep class com.google.mlkit.vision.codescanner.** { *; }
-keep class com.google.mlkit.vision.barcode.** { *; }
-keep class com.google.mlkit.common.** { *; }
-keep class com.google.android.gms.internal.code_scanner.** { *; }
-keep class com.google.android.gms.common.moduleinstall.** { *; }
-keep class * extends com.google.mlkit.common.sdkinternal.MlKitContext { *; }
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.**

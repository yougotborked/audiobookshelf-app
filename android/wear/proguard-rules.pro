# kotlinx.serialization generates a companion .serializer() for each @Serializable class and
# reaches it from the generated descriptors. R8 has rules for this built in since AGP 8, but the
# companions are only kept when the serializable classes themselves are, and nothing in this
# module holds a static reference to WearQueue at a point R8 can see.
-keepclassmembers class com.podshelf.wearsync.** {
    *** Companion;
}
-keepclasseswithmembers class com.podshelf.wearsync.** {
    kotlinx.serialization.KSerializer serializer(...);
}

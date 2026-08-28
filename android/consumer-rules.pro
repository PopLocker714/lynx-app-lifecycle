# Методы модуля находятся рефлексией: LynxModuleWrapper.findMethods() зовёт
# Class.getDeclaredMethods() и оставляет всё с @LynxMethod.
-keep class dev.lynxlab.lifecycle.LynxAppLifecycleModule { <init>(...); }
-keepclassmembers class dev.lynxlab.lifecycle.LynxAppLifecycleModule {
    @com.lynx.jsbridge.LynxMethod <methods>;
}
-keep class dev.lynxlab.lifecycle.LynxLibraryProviderImpl { *; }

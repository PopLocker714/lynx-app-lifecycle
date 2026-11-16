package dev.lynxlab.lifecycle

import android.app.Application
import com.lynx.jsbridge.LynxContextModule
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxNativeModule
import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.react.bridge.JavaOnlyMap
import com.lynx.tasm.behavior.LynxContext

private const val EVENT = "lynxappstatechange"

@LynxNativeModule(name = "LynxAppLifecycleModule")
class LynxAppLifecycleModule(
    context: LynxContext,
) : LynxContextModule(context) {
    companion object {
        /** Required before Activity startup only when the host removes the manifest provider. */
        @JvmStatic
        fun initialize(application: Application) {
            AppLifecycleStore.initialize(application)
        }
    }

    @Volatile private var destroyed = false
    private val listener: (LifecycleSnapshot) -> Unit = { snapshot ->
        if (!destroyed) mLynxContext?.sendGlobalEvent(EVENT, JavaOnlyArray.of(toMap(snapshot)))
    }

    init {
        AppLifecycleStore.addListener(listener)
    }

    private fun toMap(snapshot: LifecycleSnapshot): JavaOnlyMap {
        val map = JavaOnlyMap()
        map.putString("state", snapshot.state)
        map.putInt("generation", snapshot.generation)
        return map
    }

    @LynxMethod
    fun getState(): JavaOnlyMap {
        val snapshot = AppLifecycleStore.snapshot()
        if (snapshot != null) return toMap(snapshot)
        return JavaOnlyMap().apply { putString("error", "NOT_INITIALIZED") }
    }

    @LynxMethod
    fun getEventName(): String = EVENT

    override fun destroy() {
        destroyed = true
        AppLifecycleStore.removeListener(listener)
        super.destroy()
    }
}

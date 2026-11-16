package dev.lynxlab.lifecycle

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.os.Handler
import android.os.Looper

/** Tracks all Activities from process startup, independently of the lifetime of LynxViews. */
internal object AppLifecycleStore {
    private const val RECREATION_GRACE_MS = 700L
    private val tracker = ActivityStateTracker()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val listeners = mutableSetOf<(LifecycleSnapshot) -> Unit>()

    @Volatile private var current: LifecycleSnapshot? = null
    private var application: Application? = null
    private val finishRecreation =
        Runnable {
            tracker.finishRecreationGrace()
            publish()
        }

    fun initialize(app: Application) {
        check(Looper.myLooper() == Looper.getMainLooper()) {
            "Initialize app-lifecycle on the main thread before any Activity starts"
        }
        if (application != null) return
        application = app
        app.registerActivityLifecycleCallbacks(
            object : Application.ActivityLifecycleCallbacks {
                override fun onActivityStarted(activity: Activity) {
                    mainHandler.removeCallbacks(finishRecreation)
                    tracker.start(activity)
                    publish()
                }

                override fun onActivityStopped(activity: Activity) {
                    if (!tracker.stop(activity, activity.isChangingConfigurations)) return
                    mainHandler.removeCallbacks(finishRecreation)
                    if (tracker.awaitingRecreation) {
                        // Bounded grace covers Activity replacement; a failed replacement must settle.
                        mainHandler.postDelayed(finishRecreation, RECREATION_GRACE_MS)
                    }
                    publish()
                }

                override fun onActivityCreated(
                    activity: Activity,
                    savedInstanceState: Bundle?,
                ) = Unit

                override fun onActivityResumed(activity: Activity) = Unit

                override fun onActivityPaused(activity: Activity) = Unit

                override fun onActivitySaveInstanceState(
                    activity: Activity,
                    outState: Bundle,
                ) = Unit

                override fun onActivityDestroyed(activity: Activity) = Unit
            },
        )
    }

    fun snapshot(): LifecycleSnapshot? = current

    @Synchronized
    fun addListener(listener: (LifecycleSnapshot) -> Unit) {
        listeners.add(listener)
    }

    @Synchronized
    fun removeListener(listener: (LifecycleSnapshot) -> Unit) {
        listeners.remove(listener)
    }

    private fun publish() {
        val next = tracker.snapshot
        if (next == current) return
        current = next
        val targets = synchronized(this) { listeners.toList() }
        for (listener in targets) listener(next)
    }
}

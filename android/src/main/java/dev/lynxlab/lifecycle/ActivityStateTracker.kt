package dev.lynxlab.lifecycle

internal data class LifecycleSnapshot(
    val state: String,
    val generation: Int,
)

/** Main-thread state machine. Tokens identify Activity instances without retaining stopped ones. */
internal class ActivityStateTracker {
    private val started = mutableSetOf<Any>()
    var snapshot = LifecycleSnapshot("background", 0)
        private set
    var awaitingRecreation = false
        private set

    fun start(activity: Any) {
        started.add(activity)
        awaitingRecreation = false
        transition("active")
    }

    fun stop(
        activity: Any,
        changingConfigurations: Boolean,
    ): Boolean {
        if (!started.remove(activity)) return false
        if (started.isNotEmpty()) return true
        awaitingRecreation = changingConfigurations
        if (!changingConfigurations) transition("background")
        return true
    }

    fun finishRecreationGrace() {
        if (!awaitingRecreation) return
        awaitingRecreation = false
        if (started.isEmpty()) transition("background")
    }

    private fun transition(state: String) {
        if (snapshot.state != state) snapshot = LifecycleSnapshot(state, snapshot.generation + 1)
    }
}

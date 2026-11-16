package dev.lynxlab.lifecycle

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ActivityStateTrackerTest {
    @Test
    fun normalStartStopProducesCoherentSnapshots() {
        val tracker = ActivityStateTracker()
        val activity = Any()
        assertEquals(LifecycleSnapshot("background", 0), tracker.snapshot)
        tracker.start(activity)
        assertEquals(LifecycleSnapshot("active", 1), tracker.snapshot)
        tracker.stop(activity, false)
        assertEquals(LifecycleSnapshot("background", 2), tracker.snapshot)
    }

    @Test
    fun replacementWithinGraceDoesNotEmitBackground() {
        val tracker = ActivityStateTracker()
        val first = Any()
        val replacement = Any()
        tracker.start(first)
        tracker.stop(first, true)
        assertTrue(tracker.awaitingRecreation)
        assertEquals(LifecycleSnapshot("active", 1), tracker.snapshot)
        tracker.start(replacement)
        tracker.finishRecreationGrace()
        assertFalse(tracker.awaitingRecreation)
        assertEquals(LifecycleSnapshot("active", 1), tracker.snapshot)
        tracker.stop(replacement, false)
        assertEquals(LifecycleSnapshot("background", 2), tracker.snapshot)
    }

    @Test
    fun failedReplacementSettlesAfterGrace() {
        val tracker = ActivityStateTracker()
        val activity = Any()
        tracker.start(activity)
        tracker.stop(activity, true)
        tracker.finishRecreationGrace()
        tracker.finishRecreationGrace()
        assertEquals(LifecycleSnapshot("background", 2), tracker.snapshot)
    }

    @Test
    fun anotherStartedActivityKeepsProcessActive() {
        val tracker = ActivityStateTracker()
        val first = Any()
        val second = Any()
        tracker.start(first)
        tracker.start(second)
        tracker.stop(first, true)
        assertFalse(tracker.awaitingRecreation)
        tracker.finishRecreationGrace()
        assertEquals(LifecycleSnapshot("active", 1), tracker.snapshot)
        tracker.stop(second, false)
        assertEquals(LifecycleSnapshot("background", 2), tracker.snapshot)
    }

    @Test
    fun duplicateCallbacksCannotDriftActivityCount() {
        val tracker = ActivityStateTracker()
        val activity = Any()
        tracker.start(activity)
        tracker.start(activity)
        assertTrue(tracker.stop(activity, false))
        assertFalse(tracker.stop(activity, true))
        assertFalse(tracker.awaitingRecreation)
        assertEquals(LifecycleSnapshot("background", 2), tracker.snapshot)
    }

    @Test
    fun startupAfterGraceReturnsToActive() {
        val tracker = ActivityStateTracker()
        val first = Any()
        tracker.start(first)
        tracker.stop(first, true)
        tracker.finishRecreationGrace()
        tracker.start(Any())
        assertEquals(LifecycleSnapshot("active", 3), tracker.snapshot)
    }
}

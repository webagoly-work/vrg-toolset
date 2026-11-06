package hu.vrg.mobile.kit.ui

import hu.vrg.mobile.core.MiniState
import hu.vrg.mobile.core.MiniStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * What a feature's MINI shows while it works (WP M16): the home tile and the feature's own chips read [status].
 * `done` shows the check for a few seconds and goes back to idle; `error` stays until the next run.
 */
class MiniTrack(private val doneFor: Long = 4_000) {
    private val _status = MutableStateFlow(MiniStatus.IDLE)
    val status: StateFlow<MiniStatus> = _status
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var clear: Job? = null

    private fun set(s: MiniStatus) { clear?.cancel(); _status.value = s }

    fun run(progress: Float? = null) = set(MiniStatus.running(progress))
    fun waiting() = set(MiniStatus(MiniState.WAITING))
    fun fail() = set(MiniStatus(MiniState.ERROR))
    fun idle() = set(MiniStatus.IDLE)

    fun done() {
        set(MiniStatus(MiniState.DONE))
        clear = scope.launch { delay(doneFor); if (_status.value.state == MiniState.DONE) _status.value = MiniStatus.IDLE }
    }
}

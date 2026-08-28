package dev.lynxlab.lifecycle

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle
import com.lynx.jsbridge.LynxContextModule
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxNativeModule
import com.lynx.react.bridge.JavaOnlyMap
import com.lynx.tasm.LynxContext
import java.util.concurrent.atomic.AtomicInteger

/** Имя глобального события. Дельты, не начальное состояние. */
private const val EVENT = "lynxappstatechange"

private const val STATE_ACTIVE = "active"
private const val STATE_BACKGROUND = "background"

/**
 * Android-половина `@lynx-lab/app-lifecycle`.
 *
 * Наследуемся от LynxContextModule ради `mLynxContext.sendGlobalEvent`.
 * Конструктор обязан быть ровно `(LynxContext)`: CommonModuleCreator
 * проверяет протокол и зовёт этот конструктор сам.
 *
 * НАМЕРЕННО без androidx.lifecycle:lifecycle-process. ProcessLifecycleOwner
 * потребовал бы тащить зависимость в чужую сборку ради тридцати строк, а
 * шаблон Sparkling это AGP 7.4.2 и Kotlin 1.8.10, где лишний резолв — риск.
 * Application.ActivityLifecycleCallbacks доступен с API 14 и даёт то же самое,
 * если считать запущенные Activity.
 */
@LynxNativeModule(name = "LynxAppLifecycleModule")
class LynxAppLifecycleModule(context: LynxContext) : LynxContextModule(context) {

  private companion object Shared {
    /**
     * Счётчик и состояние — процесс-глобальные, потому что Activity общие
     * на процесс, а экземпляров модуля может быть несколько (по LynxView).
     */
    private val started = AtomicInteger(0)
    private val generation = AtomicInteger(0)

    @Volatile private var registered = false
    @Volatile private var currentState = STATE_BACKGROUND

    private val listeners = mutableSetOf<(String, Int) -> Unit>()

    fun snapshotState(): String = currentState
    fun snapshotGeneration(): Int = generation.get()

    @Synchronized
    fun addListener(l: (String, Int) -> Unit) { listeners.add(l) }

    @Synchronized
    fun removeListener(l: (String, Int) -> Unit) { listeners.remove(l) }

    @Synchronized
    private fun emit(state: String) {
      if (state == currentState) return
      currentState = state
      val g = generation.incrementAndGet()
      // Копия, чтобы слушатель мог отписаться внутри колбэка.
      for (l in listeners.toList()) l(state, g)
    }

    @Synchronized
    fun ensureRegistered(context: Context) {
      if (registered) return
      val app = context.applicationContext as? Application ?: return
      app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
        override fun onActivityStarted(activity: Activity) {
          if (started.incrementAndGet() == 1) emit(STATE_ACTIVE)
        }

        override fun onActivityStopped(activity: Activity) {
          // isChangingConfigurations НЕ проверяем: при повороте новая Activity
          // успевает получить onStart раньше, чем старая onStop, поэтому
          // счётчик не проседает до нуля и ложного background не будет.
          if (started.decrementAndGet() <= 0) {
            started.set(0)
            emit(STATE_BACKGROUND)
          }
        }

        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
        override fun onActivityResumed(activity: Activity) = Unit
        override fun onActivityPaused(activity: Activity) = Unit
        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
        override fun onActivityDestroyed(activity: Activity) = Unit
      })
      registered = true
      // Модуль создаётся лениво на BTS уже после того, как Activity стартовала,
      // поэтому первый onActivityStarted мы пропустили. Считаем активным.
      if (started.get() == 0) {
        started.set(1)
        currentState = STATE_ACTIVE
      }
    }
  }

  private val listener: (String, Int) -> Unit = { state, g ->
    val map = JavaOnlyMap()
    map.putString("state", state)
    map.putInt("generation", g)
    // sendGlobalEvent молча дропает, если GlobalEventEmitter ещё нет.
    // Это допустимо: начальное состояние JS берёт синхронным getState().
    mLynxContext?.sendGlobalEvent(EVENT, com.lynx.react.bridge.JavaOnlyArray.of(map))
  }

  init {
    ensureRegistered(mLynxContext)
    addListener(listener)
  }

  /** Синхронно. Возврат 'M' (JavaOnlyMap) подтверждён в whitelist returnTypeToChar. */
  @LynxMethod
  fun getState(): JavaOnlyMap {
    val map = JavaOnlyMap()
    map.putString("state", snapshotState())
    map.putInt("generation", snapshotGeneration())
    return map
  }

  /** Имя события, чтобы JS не хардкодил строку. Возврат 'T'. */
  @LynxMethod
  fun getEventName(): String = EVENT

  override fun destroy() {
    removeListener(listener)
    super.destroy()
  }
}

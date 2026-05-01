import { useEffect } from 'react'
import { useFeedbackStore } from '../../store/feedbackStore'

const TOAST_DURATION_MS = 2200
const ACTION_TOAST_DURATION_MS = 5600

export default function AppToast() {
  const message = useFeedbackStore((state) => state.message)
  const detail = useFeedbackStore((state) => state.detail)
  const tone = useFeedbackStore((state) => state.tone)
  const action = useFeedbackStore((state) => state.action)
  const version = useFeedbackStore((state) => state.version)
  const clearFeedback = useFeedbackStore((state) => state.clearFeedback)

  useEffect(() => {
    if (!message) {
      return
    }

    const duration = action || detail ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS
    const timer = window.setTimeout(() => {
      clearFeedback()
    }, duration)

    return () => {
      window.clearTimeout(timer)
    }
  }, [action, clearFeedback, detail, message, version])

  return (
    <div className="pointer-events-none absolute bottom-28 left-1/2 z-40 -translate-x-1/2">
      {message ? (
        <div
          className={`w-[min(92vw,560px)] rounded-2xl border px-4 py-3 text-sm shadow-soft backdrop-blur-xl transition ${
            tone === 'success'
              ? 'border-aurora/30 bg-slate-950/92 text-white'
              : tone === 'error'
                ? 'border-red-400/30 bg-red-950/75 text-red-50'
                : 'border-white/10 bg-slate-950/92 text-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div>{message}</div>
              {detail ? <div className="mt-1 break-all text-xs text-slate-400">{detail}</div> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {action ? (
                <button
                  type="button"
                  onClick={() => {
                    clearFeedback()
                    action.onAction()
                  }}
                  className="pointer-events-auto rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10"
                >
                  {action.label}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={clearFeedback}
                className="pointer-events-auto rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

import { useEffect } from 'react'
import { useFeedbackStore } from '../../store/feedbackStore'

const TOAST_DURATION_MS = 2200

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

    const timer = window.setTimeout(() => {
      clearFeedback()
    }, TOAST_DURATION_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [clearFeedback, message, version])

  return (
    <div className="pointer-events-none absolute bottom-28 left-1/2 z-40 -translate-x-1/2">
      {message ? (
        <div
          className={`min-w-[260px] rounded-2xl border px-4 py-3 text-sm shadow-soft backdrop-blur-xl transition ${
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
              {detail ? <div className="mt-1 text-xs text-slate-400">{detail}</div> : null}
            </div>
            {action ? (
              <button
                type="button"
                onClick={() => {
                  clearFeedback()
                  action.onAction()
                }}
                className="pointer-events-auto shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10"
              >
                {action.label}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

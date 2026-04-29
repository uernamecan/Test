import { create } from 'zustand'

type FeedbackTone = 'success' | 'muted' | 'error'

type FeedbackAction = {
  label: string
  onAction: () => void
}

type FeedbackOptions = {
  detail?: string | null
}

type FeedbackState = {
  message: string | null
  detail: string | null
  tone: FeedbackTone
  action: FeedbackAction | null
  version: number
  showFeedback: (
    message: string,
    tone?: FeedbackTone,
    action?: FeedbackAction | null,
    options?: FeedbackOptions
  ) => void
  clearFeedback: () => void
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  message: null,
  detail: null,
  tone: 'success',
  action: null,
  version: 0,
  showFeedback: (message, tone = 'success', action = null, options) => {
    set((state) => ({
      message,
      detail: options?.detail ?? null,
      tone,
      action,
      version: state.version + 1
    }))
  },
  clearFeedback: () => {
    set((state) => ({
      message: null,
      detail: null,
      action: null,
      version: state.version + 1
    }))
  }
}))

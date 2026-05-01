import { useFeedbackStore } from '../../store/feedbackStore'
import { useLibraryStore } from '../../store/libraryStore'
import {
  buildLibraryImportChangeSummary,
  buildLibraryImportNoChangeSummary,
  getLibraryImportWarningAction,
  hasLibraryImportChanges
} from '../../lib/libraryImportFeedback'

type MusicFileImportButtonProps = {
  className?: string
}

export default function MusicFileImportButton({ className }: MusicFileImportButtonProps) {
  const loading = useLibraryStore((state) => state.loading)
  const importAudioFiles = useLibraryStore((state) => state.importAudioFiles)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)

  const handleImportAudioFiles = async () => {
    const result = await importAudioFiles()

    if (result.status === 'cancelled') {
      showFeedback('File import cancelled.', 'muted')
      return
    }

    if (result.status === 'failed') {
      showFeedback('Could not import audio files right now.', 'error', null, {
        detail: result.error
      })
      return
    }

    const warningAction = getLibraryImportWarningAction(result.stats)

    showFeedback('Audio file import finished.', 'success', warningAction, {
      detail:
        hasLibraryImportChanges(result.stats)
          ? buildLibraryImportChangeSummary(result.stats)
          : buildLibraryImportNoChangeSummary(result.stats, result.selectedCount, 'file')
    })
  }

  return (
    <button
      type="button"
      onClick={() => void handleImportAudioFiles()}
      disabled={loading}
      className={`rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70 ${className ?? ''}`}
    >
      {loading ? 'Scanning...' : 'Import Files'}
    </button>
  )
}

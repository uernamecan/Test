import { useLibraryStore } from '../../store/libraryStore'
import { useFeedbackStore } from '../../store/feedbackStore'
import {
  buildLibraryImportChangeSummary,
  buildLibraryImportNoChangeSummary,
  getLibraryImportWarningAction,
  hasLibraryImportChanges
} from '../../lib/libraryImportFeedback'

type FolderImportButtonProps = {
  className?: string
}

export default function FolderImportButton({ className }: FolderImportButtonProps) {
  const loading = useLibraryStore((state) => state.loading)
  const importFolders = useLibraryStore((state) => state.importFolders)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)

  const handleImportFolders = async () => {
    const result = await importFolders()

    if (result.status === 'cancelled') {
      showFeedback('Folder import cancelled.', 'muted')
      return
    }

    if (result.status === 'failed') {
      showFeedback('Could not import library sources right now.', 'error', null, {
        detail: result.error
      })
      return
    }

    const warningAction = getLibraryImportWarningAction(result.stats)

    showFeedback('Library import finished.', 'success', warningAction, {
      detail:
        hasLibraryImportChanges(result.stats)
          ? buildLibraryImportChangeSummary(result.stats)
          : buildLibraryImportNoChangeSummary(result.stats, result.selectedCount, 'folder')
    })
  }

  return (
    <button
      type="button"
      onClick={() => void handleImportFolders()}
      disabled={loading}
      className={`rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 ${className ?? ''}`}
    >
      {loading ? 'Scanning...' : 'Import Folder'}
    </button>
  )
}

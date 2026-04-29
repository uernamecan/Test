import { useLibraryStore } from '../../store/libraryStore'
import { useFeedbackStore } from '../../store/feedbackStore'

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
      showFeedback('Could not import folders right now.', 'error', null, {
        detail: result.error
      })
      return
    }

    showFeedback('Library import finished.', 'success', null, {
      detail:
        result.stats.addedCount > 0 || result.stats.removedCount > 0 || result.stats.updatedCount > 0
          ? `${result.stats.addedCount} added, ${result.stats.removedCount} removed, ${result.stats.updatedCount} updated. ${result.stats.totalCount} total indexed.`
          : `${result.stats.totalCount} track${result.stats.totalCount === 1 ? '' : 's'} indexed. No changes found across ${result.selectedCount} selected folder${result.selectedCount === 1 ? '' : 's'}.`
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

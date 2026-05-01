import { navigateToLibrarySourceSettings } from './navigation'

type LibraryImportStats = {
  totalCount: number
  addedCount: number
  removedCount: number
  updatedCount: number
  warningCount?: number
}

export function getLibraryImportWarningText(stats: LibraryImportStats | null | undefined) {
  const warningCount = stats?.warningCount ?? 0

  return warningCount > 0
    ? ` ${warningCount} warning${warningCount === 1 ? '' : 's'} recorded.`
    : ''
}

export function getLibraryImportWarningAction(stats: LibraryImportStats | null | undefined) {
  return getLibraryImportWarningText(stats)
    ? {
        label: 'Settings',
        onAction: navigateToLibrarySourceSettings
      }
    : null
}

export function hasLibraryImportChanges(stats: LibraryImportStats) {
  return stats.addedCount > 0 || stats.removedCount > 0 || stats.updatedCount > 0
}

export function buildLibraryImportChangeSummary(stats: LibraryImportStats) {
  return `${stats.addedCount} added, ${stats.removedCount} removed, ${stats.updatedCount} updated. ${stats.totalCount} total indexed.${getLibraryImportWarningText(stats)}`
}

export function buildLibraryImportNoChangeSummary(
  stats: LibraryImportStats,
  selectedCount: number,
  sourceLabel: string
) {
  return `${stats.totalCount} track${stats.totalCount === 1 ? '' : 's'} indexed. No changes found across ${selectedCount} selected ${sourceLabel}${selectedCount === 1 ? '' : 's'}.${getLibraryImportWarningText(stats)}`
}

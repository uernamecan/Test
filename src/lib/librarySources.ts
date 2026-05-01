export function normalizeLibrarySourceKey(sourcePath: string) {
  return sourcePath.trim().replace(/\\/g, '/').replace(/\/+$/g, '').toLowerCase()
}

export function mergeLibrarySources(existingPaths: string[], selectedPaths: string[]) {
  const sourceMap = new Map<string, string>()

  ;[...existingPaths, ...selectedPaths]
    .map((sourcePath) => sourcePath.trim())
    .filter(Boolean)
    .forEach((sourcePath) => {
      const key = normalizeLibrarySourceKey(sourcePath)

      if (!sourceMap.has(key)) {
        sourceMap.set(key, sourcePath)
      }
    })

  return Array.from(sourceMap.values())
}

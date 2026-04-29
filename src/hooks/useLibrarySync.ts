import { useEffect } from 'react'
import { useLibraryStore } from '../store/libraryStore'

export function useLibrarySync() {
  const tracks = useLibraryStore((state) => state.tracks)
  const loadTracks = useLibraryStore((state) => state.loadTracks)

  useEffect(() => {
    if (tracks.length === 0) {
      void loadTracks()
    }
  }, [loadTracks, tracks.length])
}

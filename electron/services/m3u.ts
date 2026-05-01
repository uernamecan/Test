import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Playlist } from '../../src/types/playlist'
import type { Track } from '../../src/types/track'

function readPlaylistText(filePath: string) {
  const buffer = readFileSync(filePath)

  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le')
  }

  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return Buffer.from(buffer.subarray(2)).swap16().toString('utf16le')
  }

  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8')
  }

  return buffer.toString('utf8')
}

function escapeExtInfText(value: string) {
  return value.replace(/[\r\n]/g, ' ').trim()
}

function cleanPlaylistLine(line: string) {
  const trimmedLine = line.replace(/^\uFEFF/, '').trim()

  if (
    trimmedLine.length >= 2 &&
    ((trimmedLine.startsWith('"') && trimmedLine.endsWith('"')) ||
      (trimmedLine.startsWith("'") && trimmedLine.endsWith("'")))
  ) {
    return trimmedLine.slice(1, -1).trim()
  }

  return trimmedLine
}

function safeDecodePlaylistPath(value: string) {
  if (!value.includes('%')) {
    return value
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function normalizePlaylistPath(filePath: string) {
  return path.normalize(filePath)
}

function hasUnsupportedUrlScheme(value: string) {
  return /^[a-z][a-z\d+.-]*:/i.test(value) && !/^file:/i.test(value) && !/^[a-z]:[\\/]/i.test(value)
}

function resolvePlaylistEntry(entry: string, playlistFilePath: string) {
  const trimmedEntry = cleanPlaylistLine(entry)

  if (!trimmedEntry) {
    return null
  }

  if (hasUnsupportedUrlScheme(trimmedEntry)) {
    return null
  }

  if (/^file:/i.test(trimmedEntry)) {
    try {
      return normalizePlaylistPath(fileURLToPath(trimmedEntry))
    } catch {
      return null
    }
  }

  const decodedEntry = safeDecodePlaylistPath(trimmedEntry)

  if (hasUnsupportedUrlScheme(decodedEntry)) {
    return null
  }

  if (path.isAbsolute(decodedEntry)) {
    return normalizePlaylistPath(decodedEntry)
  }

  return normalizePlaylistPath(path.resolve(path.dirname(playlistFilePath), decodedEntry))
}

export function writeM3uPlaylist(filePath: string, playlist: Playlist, tracks: Track[]) {
  const lines = [
    '#EXTM3U',
    `#PLAYLIST:${escapeExtInfText(playlist.name)}`
  ]

  tracks.forEach((track) => {
    const duration = Math.max(0, Math.round(track.duration || 0))
    const label = escapeExtInfText(`${track.artist} - ${track.title}`)

    lines.push(`#EXTINF:${duration},${label}`)
    lines.push(track.path)
  })

  writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
}

export function readM3uPlaylistPaths(filePath: string) {
  const content = readPlaylistText(filePath)
  const seenPaths = new Set<string>()
  const resolvedPaths: string[] = []

  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .forEach((line) => {
      const resolvedPath = resolvePlaylistEntry(line, filePath)

      if (!resolvedPath) {
        return
      }

      const normalizedKey = resolvedPath.toLowerCase()

      if (seenPaths.has(normalizedKey)) {
        return
      }

      seenPaths.add(normalizedKey)
      resolvedPaths.push(resolvedPath)
    })

  return resolvedPaths
}

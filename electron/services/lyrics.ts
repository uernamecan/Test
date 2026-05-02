import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { LyricLine } from '../../src/types/lyrics'

const LYRIC_TIMESTAMP_PATTERN = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g
const OFFSET_PATTERN = /\[offset:([+-]?\d+)\]/i

function parseTimestamp(minutes: string, seconds: string, fraction?: string) {
  const baseSeconds = Number(minutes) * 60 + Number(seconds)

  if (!fraction) {
    return baseSeconds
  }

  const normalizedFraction = Number(fraction) / 10 ** fraction.length

  return baseSeconds + normalizedFraction
}

function normalizeLyricText(line: string) {
  return line.replace(LYRIC_TIMESTAMP_PATTERN, '').trim()
}

function decodeLyricContent(buffer: Buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le')
  }

  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swappedBuffer = Buffer.alloc(buffer.length - 2)

    for (let index = 2; index < buffer.length; index += 2) {
      swappedBuffer[index - 2] = buffer[index + 1] ?? 0
      swappedBuffer[index - 1] = buffer[index]
    }

    return swappedBuffer.toString('utf16le')
  }

  return buffer.toString('utf8').replace(/^\uFEFF/, '')
}

export async function findLyricPath(trackPath: string) {
  const parsedPath = path.parse(trackPath)
  const lyricCandidates = [
    `${parsedPath.name}.lrc`,
    `${parsedPath.base}.lrc`
  ]

  for (const lyricFileName of lyricCandidates) {
    const lyricPath = path.join(parsedPath.dir, lyricFileName)

    try {
      await access(lyricPath)
      return lyricPath
    } catch {
      // Try a case-insensitive directory lookup below.
    }
  }

  try {
    const lowerCaseCandidates = new Set(lyricCandidates.map((fileName) => fileName.toLowerCase()))
    const directoryEntries = await readdir(parsedPath.dir)
    const matchedEntry = directoryEntries.find((entry) => lowerCaseCandidates.has(entry.toLowerCase()))

    return matchedEntry ? path.join(parsedPath.dir, matchedEntry) : undefined
  } catch {
    return undefined
  }
}

export async function parseLyricsFile(lyricPath: string): Promise<LyricLine[]> {
  const rawLyricContent = decodeLyricContent(await readFile(lyricPath))
  const lines = rawLyricContent.split(/\r?\n/)
  const parsedLines: LyricLine[] = []
  const offsetMatch = rawLyricContent.match(OFFSET_PATTERN)
  const offsetSeconds = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0

  for (const line of lines) {
    const timestamps = Array.from(line.matchAll(LYRIC_TIMESTAMP_PATTERN))
    const text = normalizeLyricText(line)

    if (timestamps.length === 0 || !text) {
      continue
    }

    for (const timestamp of timestamps) {
      parsedLines.push({
        time: Math.max(0, parseTimestamp(timestamp[1], timestamp[2], timestamp[3]) + offsetSeconds),
        text
      })
    }
  }

  return parsedLines.sort((left, right) => left.time - right.time)
}

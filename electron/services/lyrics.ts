import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { LyricLine } from '../../src/types/lyrics'

const LYRIC_TIMESTAMP_PATTERN = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g
const OFFSET_PATTERN = /\[offset:([+-]?\d+)\]/i

function parseTimestamp(minutes: string, seconds: string, fraction?: string) {
  const baseSeconds = Number(minutes) * 60 + Number(seconds)

  if (!fraction) {
    return baseSeconds
  }

  const normalizedFraction =
    fraction.length === 3 ? Number(fraction) / 1000 : Number(fraction) / 100

  return baseSeconds + normalizedFraction
}

function normalizeLyricText(line: string) {
  return line.replace(LYRIC_TIMESTAMP_PATTERN, '').trim()
}

export async function findLyricPath(trackPath: string) {
  const parsedPath = path.parse(trackPath)
  const lyricPath = path.join(parsedPath.dir, `${parsedPath.name}.lrc`)

  try {
    await access(lyricPath)
    return lyricPath
  } catch {
    return undefined
  }
}

export async function parseLyricsFile(lyricPath: string): Promise<LyricLine[]> {
  const rawLyricContent = (await readFile(lyricPath, 'utf8')).replace(/^\uFEFF/, '')
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

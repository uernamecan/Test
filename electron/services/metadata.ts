import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { parseFile } from 'music-metadata'
import type { Track } from '../../src/types/track'
import { extractArtwork } from './artwork'
import { findLyricPath } from './lyrics'
import { logger } from '../utils/logger'

function normalizeText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : fallback
}

function createFallbackTrack(filePath: string, stats: Awaited<ReturnType<typeof fs.stat>>): Track {
  const fileName = path.parse(filePath).name

  return {
    id: createHash('sha1').update(filePath).digest('hex'),
    path: filePath,
    title: fileName,
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    duration: 0,
    format: path.extname(filePath).slice(1).toLowerCase(),
    createdAt: stats.birthtime.toISOString(),
    updatedAt: stats.mtime.toISOString()
  }
}

export async function parseTrackMetadata(filePath: string): Promise<Track> {
  const stats = await fs.stat(filePath)

  try {
    const parsedMetadata = await parseFile(filePath, {
      duration: true,
      skipCovers: false
    })

    const picture = parsedMetadata.common.picture?.[0]
    const coverPath = await extractArtwork(filePath, picture)
    const lyricPath = await findLyricPath(filePath)
    const artists = parsedMetadata.common.artists?.join(', ')

    return {
      id: createHash('sha1').update(filePath).digest('hex'),
      path: filePath,
      title: normalizeText(parsedMetadata.common.title, path.parse(filePath).name),
      artist: normalizeText(parsedMetadata.common.artist ?? artists, 'Unknown Artist'),
      album: normalizeText(parsedMetadata.common.album, 'Unknown Album'),
      duration: Number(parsedMetadata.format.duration?.toFixed(2) ?? 0),
      coverPath,
      lyricPath,
      format: path.extname(filePath).slice(1).toLowerCase(),
      bitrate: parsedMetadata.format.bitrate ?? undefined,
      sampleRate: parsedMetadata.format.sampleRate ?? undefined,
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString()
    }
  } catch (error) {
    logger.warn('Failed to parse metadata:', filePath, error)
    return createFallbackTrack(filePath, stats)
  }
}


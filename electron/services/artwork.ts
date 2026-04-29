import fs from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { getArtworkCacheDir } from '../utils/paths'

type ArtworkPicture = {
  data: Uint8Array
  format?: string
}

function resolveExtension(format?: string) {
  if (!format) {
    return 'jpg'
  }

  if (format.includes('png')) {
    return 'png'
  }

  if (format.includes('webp')) {
    return 'webp'
  }

  return 'jpg'
}

export async function extractArtwork(trackPath: string, picture?: ArtworkPicture) {
  if (!picture?.data) {
    return undefined
  }

  const hash = createHash('sha1').update(trackPath).update(picture.data).digest('hex')
  const fileName = `${hash}.${resolveExtension(picture.format)}`
  const targetPath = path.join(getArtworkCacheDir(), fileName)

  if (!fs.existsSync(targetPath)) {
    await writeFile(targetPath, Buffer.from(picture.data))
  }

  return targetPath
}


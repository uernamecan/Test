import { ipcMain } from 'electron'
import { z } from 'zod'
import { getAllSettings, setSetting } from '../db/repositories/settingsRepo'

const settingKeySchema = z.enum([
  'libraryPaths',
  'theme',
  'trayEnabled',
  'globalShortcutsEnabled',
  'minimizeToTray',
  'playerState',
  'shellState',
  'searchState',
  'libraryViewState',
  'playlistViewState',
  'libraryScanState'
])
const persistedTableDensitySchema = z.enum(['comfortable', 'compact'])
const libraryModeValueMap = {
  tracks: z.string().trim().min(1),
  albums: z.string().trim().min(1),
  favorites: z.string().trim().min(1)
}
const libraryDensityValueMap = {
  tracks: persistedTableDensitySchema,
  albums: persistedTableDensitySchema,
  favorites: persistedTableDensitySchema
}
const settingValueSchemas = {
  libraryPaths: z.array(z.string().trim().min(1)).max(1000),
  theme: z.enum(['light', 'dark']),
  trayEnabled: z.boolean(),
  globalShortcutsEnabled: z.boolean(),
  minimizeToTray: z.boolean(),
  playerState: z.object({
    queueTrackIds: z.array(z.string().trim().min(1)).max(10000),
    currentTrackId: z.string().trim().min(1).optional(),
    currentIndex: z.number().int().min(0),
    progress: z.number().min(0),
    volume: z.number().min(0).max(1),
    playMode: z.enum(['sequence', 'repeat-all', 'repeat-one', 'shuffle'])
  }),
  shellState: z.object({
    lastRoute: z.string().trim().startsWith('/').max(240),
    sidebarCollapsed: z.boolean(),
    lyricsPanelWidth: z.number().min(320).max(720),
    queueDrawerWidth: z.number().min(320).max(640)
  }),
  searchState: z.object({
    recentKeywords: z.array(z.string().trim().min(1)).max(8),
    recentEntries: z
      .array(
        z.object({
          keyword: z.string().trim().min(1),
          searchedAt: z.string().trim().min(1)
        })
      )
      .max(8)
      .optional()
  }),
  libraryViewState: z.object({
    sortByMode: z.object(libraryModeValueMap).partial(),
    densityByMode: z.object(libraryDensityValueMap).partial()
  }),
  playlistViewState: z.object({
    sortBy: z.string().trim().min(1),
    density: persistedTableDensitySchema
  }),
  libraryScanState: z.object({
    totalCount: z.number().int().min(0),
    addedCount: z.number().int().min(0),
    removedCount: z.number().int().min(0),
    updatedCount: z.number().int().min(0),
    discoveredFileCount: z.number().int().min(0).optional(),
    warningCount: z.number().int().min(0).optional(),
    warningDetailLimit: z.number().int().min(0).optional(),
    durationMs: z.number().int().min(0).optional(),
    warnings: z
      .array(
        z.object({
          path: z.string().trim().min(1),
          reason: z.string().trim().min(1)
        })
      )
      .max(100)
      .optional(),
    scannedAt: z.string().trim().min(1)
  })
} satisfies Record<z.infer<typeof settingKeySchema>, z.ZodType>

function parseSettingValue(key: z.infer<typeof settingKeySchema>, value: unknown) {
  return settingValueSchemas[key].parse(value)
}

export function registerSettingsIpcHandlers(
  onDidChangeSetting?: (key: string, value: unknown) => void
) {
  ipcMain.handle('settings:getAll', async () => {
    return getAllSettings()
  })

  ipcMain.handle('settings:set', async (_event, key, value) => {
    const parsedKey = settingKeySchema.parse(key)
    const parsedValue = parseSettingValue(parsedKey, value)
    setSetting(parsedKey, parsedValue)
    onDidChangeSetting?.(parsedKey, parsedValue)
  })
}

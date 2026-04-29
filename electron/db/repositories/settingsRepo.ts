import { getDatabase } from '../client'

type SettingRow = {
  key: string
  value: string
}

function parseValue(rawValue: string) {
  try {
    return JSON.parse(rawValue) as unknown
  } catch {
    return rawValue
  }
}

export function getSetting<T>(key: string) {
  const database = getDatabase()
  const row = database
    .prepare(
      `
      SELECT key, value
      FROM settings
      WHERE key = ?
    `
    )
    .get(key) as SettingRow | undefined

  if (!row) {
    return undefined as T | undefined
  }

  return parseValue(row.value) as T
}

export function getAllSettings() {
  const database = getDatabase()
  const rows = database
    .prepare(
      `
      SELECT key, value
      FROM settings
    `
    )
    .all() as SettingRow[]

  return rows.reduce<Record<string, unknown>>((result, row) => {
    result[row.key] = parseValue(row.value)
    return result
  }, {})
}

export function setSetting(key: string, value: unknown) {
  const database = getDatabase()
  const payload = JSON.stringify(value)
  const updatedAt = new Date().toISOString()

  database
    .prepare(
      `
      INSERT INTO settings (key, value, updated_at)
      VALUES (@key, @value, @updatedAt)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `
    )
    .run({
      key,
      value: payload,
      updatedAt
    })
}


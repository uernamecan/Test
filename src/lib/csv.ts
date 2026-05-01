export function escapeCsvCell(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  const normalizedText = text.replace(/\r?\n/g, ' ')

  if (/[",\n\r]/.test(normalizedText)) {
    return `"${normalizedText.replace(/"/g, '""')}"`
  }

  return normalizedText
}

export function buildCsv(rows: Array<Array<string | number | boolean | null | undefined>>) {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

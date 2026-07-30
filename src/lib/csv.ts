export function escapeCsvCell(value: string | number | null | undefined): string {
  const rawText = value === null || value === undefined ? '' : String(value)
  const text = typeof value === 'string' && /^[\t\r ]*[=+\-@]/.test(value) ? `'${rawText}` : rawText
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

export function buildCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}`
}

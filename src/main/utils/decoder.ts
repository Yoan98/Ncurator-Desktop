export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

export const toString = (value: unknown): string => String(value ?? '')

export const toOptionalString = (value: unknown): string | undefined => {
  if (value == null) return undefined
  const next = String(value).trim()
  return next.length > 0 ? next : undefined
}

export const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const toOptionalNumber = (value: unknown): number | undefined => {
  if (value == null) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export const toNumberArray = (value: unknown): number[] => {
  if (Array.isArray(value)) return value.map((item) => toNumber(item))
  if (value instanceof Float32Array) return Array.from(value)
  return []
}

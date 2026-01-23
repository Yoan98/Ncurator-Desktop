export function parseIpcResult<T extends { metadata?: any }>(item: T): T {
  const newItem = { ...item }

  if (newItem.metadata && typeof newItem.metadata === 'string') {
    try {
      newItem.metadata = JSON.parse(newItem.metadata)
    } catch (e) {
      console.error('Failed to parse metadata:', e)
    }
  }

  return newItem
}

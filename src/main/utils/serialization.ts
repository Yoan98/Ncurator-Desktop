export function normalizeForIpc<T extends { vector?: any; metadata?: any }>(item: T): T {
  const newItem = { ...item }

  // 删除 vector
  if ('vector' in newItem) {
    delete newItem.vector
  }

  // 序列化 metadata
  if (newItem.metadata && typeof newItem.metadata !== 'string') {
    newItem.metadata = JSON.stringify(newItem.metadata)
  }

  return newItem
}

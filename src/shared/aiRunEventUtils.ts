import type { AiRunEvent } from './types'

export type ArtifactRunEvent = Extract<AiRunEvent, { type: 'file_artifact' }>

export const groupArtifactEventsByTask = (events: AiRunEvent[]): Record<string, ArtifactRunEvent[]> => {
  const grouped: Record<string, ArtifactRunEvent[]> = {}
  for (const event of events) {
    if (event.type !== 'file_artifact') continue
    const key = String(event.taskId || '__no_task__')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(event)
  }
  return grouped
}

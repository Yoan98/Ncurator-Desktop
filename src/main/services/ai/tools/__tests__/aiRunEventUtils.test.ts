import test from 'node:test'
import assert from 'node:assert/strict'
import { groupArtifactEventsByTask } from '../../../../../shared/aiRunEventUtils'
import type { AiRunEvent } from '../../../../../shared/types'

test('groupArtifactEventsByTask keeps artifact events grouped by task id and ignores other events', () => {
  const events: AiRunEvent[] = [
    {
      type: 'run_started',
      runId: 'run-1',
      sessionId: 'session-1',
      createdAt: Date.now(),
      input: 'hello'
    },
    {
      type: 'file_artifact',
      runId: 'run-1',
      taskId: 'task-a',
      artifactId: 'artifact-1',
      capability: 'docx',
      path: '/tmp/a.docx',
      fileName: 'a.docx',
      operation: 'created',
      summary: 'saved',
      createdAt: Date.now()
    },
    {
      type: 'file_artifact',
      runId: 'run-1',
      taskId: 'task-a',
      artifactId: 'artifact-2',
      capability: 'terminal_exec',
      path: '/tmp/b.txt',
      fileName: 'b.txt',
      operation: 'updated',
      summary: 'updated',
      stepId: 'step-1',
      createdAt: Date.now()
    },
    {
      type: 'file_artifact',
      runId: 'run-1',
      taskId: 'task-b',
      artifactId: 'artifact-3',
      capability: 'docx',
      path: '/tmp/c.docx',
      fileName: 'c.docx',
      operation: 'created',
      summary: 'saved',
      createdAt: Date.now()
    }
  ]

  const grouped = groupArtifactEventsByTask(events)
  const taskA = grouped['task-a']
  const taskB = grouped['task-b']
  assert.ok(taskA)
  assert.ok(taskB)
  assert.equal(Object.keys(grouped).length, 2)
  assert.equal(taskA.length, 2)
  assert.equal(taskB.length, 1)
  assert.equal(taskA[0].artifactId, 'artifact-1')
})

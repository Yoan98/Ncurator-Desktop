import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTerminalCapabilityTools } from '../terminalCapabilityTools'
import { createMockAiContext } from './testContext'

test('terminal_run_command emits artifact event for workspace file writes', async () => {
  const workspaceRootPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'ncurator-terminal-tool-'))
  try {
    const { ctx, events } = createMockAiContext({ workspaceRootPath })
    const terminal = buildTerminalCapabilityTools({
      ctx,
      runId: 'run-test',
      taskId: 'task-1',
      workspaceRootPath,
      timeoutMs: 15000,
      maxOutputChars: 4000,
      safePreviewChars: 400,
      emitActivity: () => {}
    })

    const runTool = terminal.tools.find((tool) => tool.name === 'terminal_run_command')
    assert.ok(runTool)
    const output = (await (runTool as { invoke: (input: unknown) => Promise<unknown> }).invoke({
      command: "printf 'hello' > hello.txt",
      expectedArtifacts: [{ path: 'hello.txt' }]
    })) as {
      ok?: boolean
      code?: string
      artifacts?: Array<{ path: string; operation: string }>
    }

    assert.equal(output.ok, true)
    assert.equal(output.code, 'ok')
    assert.ok(Array.isArray(output.artifacts))
    assert.equal(output.artifacts?.length, 1)
    assert.equal(fs.existsSync(path.join(workspaceRootPath, 'hello.txt')), true)

    const artifactEvents = events.filter((event) => event.type === 'file_artifact')
    assert.equal(artifactEvents.length, 1)
    const artifactEvent = artifactEvents[0]
    if (artifactEvent.type !== 'file_artifact') throw new Error('expected file_artifact event')
    assert.equal(artifactEvent.operation, 'created')
    assert.equal(artifactEvent.capability, 'terminal_exec')
  } finally {
    await fsp.rm(workspaceRootPath, { recursive: true, force: true })
  }
})

test('terminal_run_command blocks boundary escapes before execution', async () => {
  const workspaceRootPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'ncurator-terminal-boundary-'))
  try {
    const { ctx } = createMockAiContext({ workspaceRootPath })
    const terminal = buildTerminalCapabilityTools({
      ctx,
      runId: 'run-test',
      taskId: 'task-1',
      workspaceRootPath,
      timeoutMs: 15000,
      maxOutputChars: 4000,
      safePreviewChars: 400,
      emitActivity: () => {}
    })

    const runTool = terminal.tools.find((tool) => tool.name === 'terminal_run_command')
    assert.ok(runTool)
    const output = (await (runTool as { invoke: (input: unknown) => Promise<unknown> }).invoke({
      command: 'cat /etc/hosts'
    })) as { ok?: boolean; code?: string }

    assert.equal(output.ok, false)
    assert.equal(output.code, 'workspace_required')
  } finally {
    await fsp.rm(workspaceRootPath, { recursive: true, force: true })
  }
})

test('terminal_run_command returns approval_denied for medium/high risk command when rejected', async () => {
  const workspaceRootPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'ncurator-terminal-approval-'))
  try {
    const { ctx } = createMockAiContext({
      workspaceRootPath,
      onApproval: () => ({ approved: false, reason: 'rejected in test' })
    })
    const terminal = buildTerminalCapabilityTools({
      ctx,
      runId: 'run-test',
      taskId: 'task-1',
      workspaceRootPath,
      timeoutMs: 15000,
      maxOutputChars: 4000,
      safePreviewChars: 400,
      emitActivity: () => {}
    })

    const runTool = terminal.tools.find((tool) => tool.name === 'terminal_run_command')
    assert.ok(runTool)
    const output = (await (runTool as { invoke: (input: unknown) => Promise<unknown> }).invoke({
      command: 'rm draft.txt'
    })) as { ok?: boolean; code?: string; error?: string }

    assert.equal(output.ok, false)
    assert.equal(output.code, 'approval_denied')
    assert.match(String(output.error || ''), /rejected/i)
  } finally {
    await fsp.rm(workspaceRootPath, { recursive: true, force: true })
  }
})

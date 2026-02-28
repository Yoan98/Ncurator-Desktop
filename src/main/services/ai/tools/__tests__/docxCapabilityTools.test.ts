import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDocxCapabilityTools } from '../docxCapabilityTools'
import { saveDocxFromText } from '../docxAdapters'
import { createMockAiContext } from './testContext'

test('docx capability tools inspect/apply/save flow emits artifact event', async () => {
  const workspaceRootPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'ncurator-docx-tool-'))
  try {
    const sourcePath = path.join(workspaceRootPath, 'source.docx')
    await saveDocxFromText({
      outputPath: sourcePath,
      text: 'Hello world.\n\nSecond paragraph.'
    })

    const { ctx, events } = createMockAiContext({ workspaceRootPath })
    const docx = buildDocxCapabilityTools({
      ctx,
      runId: 'run-test',
      taskId: 'task-docx',
      workspaceRootPath,
      safePreviewChars: 600,
      emitActivity: () => {}
    })

    const inspectTool = docx.tools.find((tool) => tool.name === 'docx_inspect')
    const applyTool = docx.tools.find((tool) => tool.name === 'docx_apply_edits')
    const saveTool = docx.tools.find((tool) => tool.name === 'docx_save_output')
    assert.ok(inspectTool)
    assert.ok(applyTool)
    assert.ok(saveTool)

    const inspectResult = (await (inspectTool as { invoke: (input: unknown) => Promise<unknown> }).invoke({
      sourcePath
    })) as { ok?: boolean; paragraphCount?: number }
    assert.equal(inspectResult.ok, true)
    assert.ok((inspectResult.paragraphCount || 0) > 0)

    const applyResult = (await (applyTool as { invoke: (input: unknown) => Promise<unknown> }).invoke({
      edits: [
        {
          type: 'replace_text',
          find: 'Hello',
          replace: 'Hi'
        }
      ]
    })) as { ok?: boolean; appliedCount?: number }
    assert.equal(applyResult.ok, true)
    assert.equal(applyResult.appliedCount, 1)

    const saveResult = (await (saveTool as { invoke: (input: unknown) => Promise<unknown> }).invoke({
      outputPath: 'edited.docx'
    })) as { ok?: boolean; outputPath?: string; operation?: string }
    assert.equal(saveResult.ok, true)
    assert.ok(saveResult.outputPath)
    assert.equal(fs.existsSync(String(saveResult.outputPath)), true)
    assert.equal(saveResult.operation, 'created')

    const artifactEvents = events.filter((event) => event.type === 'file_artifact')
    assert.equal(artifactEvents.length, 1)
    const artifactEvent = artifactEvents[0]
    if (artifactEvent.type !== 'file_artifact') throw new Error('expected file_artifact event')
    assert.equal(artifactEvent.capability, 'docx')
    assert.equal(artifactEvent.operation, 'created')
  } finally {
    await fsp.rm(workspaceRootPath, { recursive: true, force: true })
  }
})

test('docx_save_output requires approval for overwrite operations', async () => {
  const workspaceRootPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'ncurator-docx-overwrite-'))
  try {
    const sourcePath = path.join(workspaceRootPath, 'source.docx')
    await saveDocxFromText({
      outputPath: sourcePath,
      text: 'Original text.'
    })

    const { ctx } = createMockAiContext({
      workspaceRootPath,
      onApproval: () => ({ approved: false, reason: 'overwrite denied in test' })
    })
    const docx = buildDocxCapabilityTools({
      ctx,
      runId: 'run-test',
      taskId: 'task-docx',
      workspaceRootPath,
      safePreviewChars: 600,
      emitActivity: () => {}
    })

    const inspectTool = docx.tools.find((tool) => tool.name === 'docx_inspect')
    const saveTool = docx.tools.find((tool) => tool.name === 'docx_save_output')
    assert.ok(inspectTool)
    assert.ok(saveTool)

    await (inspectTool as { invoke: (input: unknown) => Promise<unknown> }).invoke({ sourcePath })
    const saveResult = (await (saveTool as { invoke: (input: unknown) => Promise<unknown> }).invoke({
      outputPath: sourcePath,
      overwrite: true
    })) as { ok?: boolean; code?: string }

    assert.equal(saveResult.ok, false)
    assert.equal(saveResult.code, 'approval_denied')
  } finally {
    await fsp.rm(workspaceRootPath, { recursive: true, force: true })
  }
})

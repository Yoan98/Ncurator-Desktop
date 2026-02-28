import test from 'node:test'
import assert from 'node:assert/strict'
import { runBoundedLoop } from '../boundedLoop'

test('runBoundedLoop stops after max steps and does not execute extra rounds', async () => {
  let roundsExecuted = 0
  const result = await runBoundedLoop({
    maxSteps: 3,
    timeoutMs: 10_000,
    onRound: async () => {
      roundsExecuted += 1
      return { done: false }
    }
  })

  assert.equal(result.ok, false)
  if (result.ok) throw new Error('expected max-step failure')
  assert.equal(result.reason, 'max_steps')
  assert.equal(result.rounds, 3)
  assert.equal(roundsExecuted, 3)
})

test('runBoundedLoop returns timeout before additional rounds after timeout reached', async () => {
  let roundsExecuted = 0
  const result = await runBoundedLoop({
    maxSteps: 6,
    timeoutMs: 5,
    onRound: async () => {
      roundsExecuted += 1
      await new Promise((resolve) => setTimeout(resolve, 8))
      return { done: false }
    }
  })

  assert.equal(result.ok, false)
  if (result.ok) throw new Error('expected timeout failure')
  assert.equal(result.reason, 'timeout')
  assert.equal(roundsExecuted, 1)
})

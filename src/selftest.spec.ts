import { describe, expect, it } from 'vitest'
import { featureCases } from './featureCases.js'
import { formatSelfTest, runSelfTest } from './selftest.js'

describe('selftest', () => {
  it('特性清单都通过', async () => {
    const results = await runSelfTest()
    const failed = results.filter((r) => !r.ok)
    expect(failed, formatSelfTest(results)).toEqual([])
    expect(results.map((r) => r.id)).toEqual(featureCases.map((c) => c.id))
  }, 120000)
})

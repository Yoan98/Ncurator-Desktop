import type { LLMConfig } from '../../../types/store'
import { LanceDbCore, LANCE_TABLES } from '../core/LanceDbCore'

export class LlmConfigStore {
  public constructor(private readonly core: LanceDbCore) {}

  public async save(config: LLMConfig): Promise<void> {
    const table = await this.core.openTable(LANCE_TABLES.LLM_CONFIG)
    await table.delete(`id = '${this.core.escapeSqlString(config.id)}'`)
    await table.add([{ ...config }])
  }

  public async list(): Promise<LLMConfig[]> {
    const table = await this.core.openTable(LANCE_TABLES.LLM_CONFIG)
    const results = await table.query().toArray()
    return results.map((r: any) => ({
      id: r.id as string,
      name: r.name as string,
      base_url: r.base_url as string,
      model_name: r.model_name as string,
      api_key: r.api_key as string,
      is_active: Boolean(r.is_active)
    }))
  }

  public async delete(id: string): Promise<void> {
    const table = await this.core.openTable(LANCE_TABLES.LLM_CONFIG)
    await table.delete(`id = '${this.core.escapeSqlString(id)}'`)
  }

  public async setActive(id: string): Promise<void> {
    const table = await this.core.openTable(LANCE_TABLES.LLM_CONFIG)
    await table.update({ where: 'is_active = true', values: { is_active: false } })
    await table.update({
      where: `id = '${this.core.escapeSqlString(id)}'`,
      values: { is_active: true }
    })
  }

  public async getActive(): Promise<LLMConfig | null> {
    const configs = await this.list()
    return configs.find((c) => c.is_active) || null
  }
}


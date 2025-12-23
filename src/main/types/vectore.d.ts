namespace VectorStoreTable {
  export type Chunk = Record<string, unknown> & {
    id: string
    vector: number[]
    text: string
  }
}

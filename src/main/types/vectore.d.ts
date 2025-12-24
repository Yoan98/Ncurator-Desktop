namespace VectorStoreTable {
  export type Chunk = Record<string, unknown> & {
    id: string
    vector: Float32Array
    text: string
  }
}

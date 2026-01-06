declare module '@node-rs/jieba' {
  export class Jieba {
    static withDict(dict: any): Jieba
    cut(text: string, hmm?: boolean): string[]
  }
}

declare module '@node-rs/jieba/dict' {
  export const dict: any
}


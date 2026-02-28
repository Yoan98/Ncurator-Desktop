export const SPLITTER_BIG_CHUNK_SETTING = {
  chunkSize: 1000,
  chunkOverlap: 200
}

export const SPLITTER_MINI_CHUNK_SIZE = {
  chunkSize: 150,
  chunkOverlap: 30
}

export const WEB_INGEST_TIMEOUT_MS = 20000
export const WEB_INGEST_MAX_CHARS = 400000
export const WEB_INGEST_CONCURRENCY = 2

export const ENABLE_LEGACY_WRITING_WORKFLOW =
  process.env.ENABLE_LEGACY_WRITING_WORKFLOW === '1'

export const SPLITTER_SEPARATORS = ['\n\n', '\n', '。', ';', ',', ' ', '']
export const ZH_STOP_WORDS =
  '的 一 不 在 人 有 是 为 為 以 于 於 上 他 而 后 後 之 来 來 及 了 因 下 可 到 由 这 這 与 與 也 此 但 并 並 个 個 其 已 无 無 小 我 们 們 起 最 再 今 去 好 只 又 或 很 亦 某 把 那 你 乃 它 吧 被 比 别 趁 当 當 从 從 得 打 凡 儿 兒 尔 爾 该 該 各 给 給 跟 和 何 还 還 即 几 幾 既 看 据 據 距 靠 啦 另 么 麽 每 嘛 拿 哪 您 凭 憑 且 却 卻 让 讓 仍 啥 如 若 使 谁 誰 虽 雖 随 隨 同 所 她 哇 嗡 往 些 向 沿 哟 喲 用 咱 则 則 怎 曾 至 致 着 著 诸 諸 自'.split(
    ' '
  )

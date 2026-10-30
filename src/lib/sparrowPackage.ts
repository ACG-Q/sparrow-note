/**
 * 备份包（.sparrow）的门面：实现拆在 lib/package/* 下，这里只做 re-export。
 *
 * 拆开的原因见 docs/review/03：原来 1200 行里混了类型、编解码、资产、块映射、
 * 校验、打包、解包、合并八件事；数据安全相关的东西挤在一起，改一处要读全文。
 */
export * from "./package/types";
export * from "./package/bytes";
export * from "./package/assets";
export * from "./package/inline";
export * from "./package/blocksFromNote";
export * from "./package/blocksToNote";
export * from "./package/validate";
export * from "./package/pack";
export * from "./package/merge";

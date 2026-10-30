/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  test: {
    // 纯函数测试在 node 下跑；组件测试在文件头用 `// @vitest-environment happy-dom` 单独指定
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // 分母固定成「全部源码」，避免「多 import 一个文件覆盖率就掉」的假象
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx", "src/dev/**", "src/**/*.d.ts"],
    },
  },
});

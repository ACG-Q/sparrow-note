# 麻雀记（Sparrow Diary）· 文档中心

跨平台、本地优先的日记 / 生活记录应用。Tauri 2 + React 19 + TypeScript，桌面（Windows / macOS / Linux）
与移动端（Android / iOS）共用一套前端，桌面落 SQLite、浏览器落 IndexedDB。

## 文档导航

| 目录 | 内容 |
|------|------|
| [dev/](dev/) | 开发文档：规划、UI 规范、打包、分享导出、表格体系 |
| [architecture/](architecture/) | 架构文档：笔记类型分层架构 |
| [contrib/](contrib/) | 贡献指南：环境搭建、规范、测试与提交流程 |

## dev/ 开发文档

- [01-项目规划](dev/01-项目规划.md) — 项目定位、技术栈、功能总览、数据库、迭代路线图
- [02-笔记类型UI规范](dev/02-笔记类型UI规范.md) — 新增/修改笔记类型的开发规范（Data / Editor / Card / Preview 四层）
- [03-Dashboard扩展指南](dev/03-Dashboard扩展指南.md) — 仪表盘新增组件的步骤与配置
- [04-打包指南](dev/04-打包指南.md) — Windows 桌面与 Android 打包、本机环境坑（火绒、NDK、Gradle 镜像）
- [05-表格重构方案](dev/05-表格重构方案.md) — 表格工具条、选区、行列操作的方案与自测
- [06-分享功能](dev/06-分享功能.md) — Markdown / PDF / 长图导出，移动端落盘路径与已知限制
- [07-表格自研方案](dev/07-表格自研方案.md) — 自研表格节点（单元格内图片、代码块、跨行跨列）
- [08-双链设计](dev/08-双链设计.md) — 双链的数据结构与渲染
- [09-状态管理重构](dev/09-状态管理重构.md) — store 工厂化与外壳拆分计划
- [10-权限页与申请](dev/10-权限页与申请.md) — 权限检测 / 申请的实现、各平台差异与两个限制
- [11-设置与存储](dev/11-设置与存储.md) — 设置页分区、换数据位置（VACUUM INTO + 重启）、自动备份
- [12-我的与子页面改版](dev/12-我的与子页面改版.md) — 「我的」扉页结构、子页面统一外壳、桌面页边标签版式
- [13-CI 与发版](dev/13-CI与发版.md) — 质量门禁 / 三平台发版工作流、「检查更新」指向远程仓库

## architecture/ 架构文档

- [01-笔记类型架构](architecture/01-笔记类型架构.md) — 笔记类型四层架构（data / editor / card / preview）的实现现状与数据流

## contrib/ 贡献指南

- [01-贡献指南](contrib/01-贡献指南.md) — 环境搭建、运行与打包、代码规范、测试、提交与 PR 流程

---

> 仓库用 GitHub Actions 跑质量门禁（tsc / lint / vitest / 覆盖率），详见
> [contrib/01-贡献指南](contrib/01-贡献指南.md) 与 `.github/workflows/gates.yml`。
> 验收用的截图与探针脚本不入库（见 `.gitignore` 的 `review/`、`evidence/`、`shots/`）。

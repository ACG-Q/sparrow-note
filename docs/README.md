# 麻雀记（Sparrow Diary）· 文档中心

跨平台、本地优先的日记/生活记录应用。Flutter + Dart 构建，支持 Android / iOS / Windows / Linux / macOS。

## 文档导航

| 目录 | 内容 | 适用人群 |
|------|------|---------|
| [dev/](dev/) | 开发文档：项目规划、笔记类型 UI 规范、Dashboard 扩展指南 | 开发本项目的成员 |
| [architecture/](architecture/) | 架构文档：笔记类型分层架构说明 | 想理解内部设计的开发者 |
| [contrib/](contrib/) | 贡献指南：环境搭建、规范、测试与提交流程 | 外部贡献者 |

## dev/ 开发文档

- [01-项目规划](dev/01-项目规划.md) — 项目定位、技术栈、功能总览、数据库、迭代路线图
- [02-笔记类型UI规范](dev/02-笔记类型UI规范.md) — 新增/修改笔记类型的开发规范（Data / Editor / Card / Preview 四层）
- [03-Dashboard扩展指南](dev/03-Dashboard扩展指南.md) — 仪表盘新增组件的步骤与配置

## architecture/ 架构文档

- [01-笔记类型架构](architecture/01-笔记类型架构.md) — 笔记类型四层架构（data / editor / card / preview）的实现现状与数据流

## contrib/ 贡献指南

- [01-贡献指南](contrib/01-贡献指南.md) — 环境搭建、运行与打包、代码规范、测试、提交与 PR 流程

---

> 项目仓库使用 GitHub Actions 自动打包，详见 [contrib/01-贡献指南](contrib/01-贡献指南.md) 与 `.github/workflows/`。

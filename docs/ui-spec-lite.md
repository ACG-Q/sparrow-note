# 麻雀记 · 日式极简 UI 规范 (Lite Design System)

> 侘寂（Wabi-Sabi）：不完美中的美。文字即界面。

---

## 1. 字号体系

| Token | Size | Weight | LineHeight | 用途 |
|-------|------|--------|------------|------|
| `display` | 18px | 600 | 24px | 页面大标题（极少使用） |
| `title` | 13px | 600 | 18px | 卡片标题、section标题 |
| `subtitle` | 11px | 500 | 16px | 副标题、列表项标题 |
| `body` | 11px | 400 | 16px | 正文内容 |
| `caption` | 9px | 400 | 12px | 辅助信息、时间戳、元数据 |
| `label` | 8px | 500 | 10px | 标签、badge、极小文字 |

**规则：**
- 正文最小 11px，低于此不可读
- caption 仅用于辅助信息，不可承载主内容
- label 仅用于标签和徽章

---

## 2. 间距体系

| Token | Value | 用途 |
|-------|-------|------|
| `xxs` | 1px | 超微间距（进度条内边距） |
| `xs` | 2px | 紧凑元素内间距 |
| `sm` | 4px | 元素间最小间距 |
| `md` | 6px | 卡片内元素间距 |
| `lg` | 8px | 卡片内边距、section间距 |
| `xl` | 12px | 页面边距 |

**规则：**
- 卡片内边距：6px（紧凑）或 8px（标准）
- 元素间距：4px（紧凑）或 6px（标准）
- 页面边距：8px（移动端）或 12px（桌面端）

---

## 3. 圆角体系

| Token | Value | 用途 |
|-------|-------|------|
| `xs` | 2px | 按钮、输入框、标签 |
| `sm` | 3px | 卡片、弹窗、容器 |
| `md` | 4px | 大卡片、面板 |
| `pill` | 999px | 标签、徽章（药丸形） |

**规则：**
- 所有容器圆角统一使用 tokens
- 不使用超过 8px 的圆角（除 pill）
- 对话框/弹窗顶部不使用圆角（使用边框区分）

---

## 4. 边框体系

| 类型 | Width | Color | Alpha | 用途 |
|------|-------|-------|-------|------|
| `subtle` | 0.5px | `outline` | 0.2 | 卡片边框、分割线 |
| `default` | 0.5px | `outline` | 0.3 | 输入框、按钮边框 |
| `emphasis` | 0.5px | `outline` | 0.4 | 激活状态、hover |
| `primary` | 0.5px | `primary` | 0.3 | 图标容器、强调元素 |

**规则：**
- 所有边框统一 0.5px
- 不使用 1px 以上边框
- 不使用 `BoxShadow`（无阴影）

---

## 5. 颜色体系

### 5.1 文字颜色

| 用途 | Color | Alpha | 示例 |
|------|-------|-------|------|
| 主文字 | `onSurface` | 0.9 | 标题、正文 |
| 次文字 | `onSurfaceVariant` | 0.6 | 副标题、日期 |
| 弱文字 | `onSurfaceVariant` | 0.4 | 时间戳、元数据 |
| 禁用文字 | `onSurfaceVariant` | 0.3 | 占位符 |

### 5.2 强调颜色

| 用途 | Color | Alpha | 示例 |
|------|-------|-------|------|
| 主色点缀 | `primary` | 0.7 | 图标、链接、按钮 |
| 主色背景 | `primary` | 0.08 | 图标容器背景 |
| 错误强调 | `error` | 0.7 | 删除、警告 |
| 成功强调 | `tertiary` | 0.7 | 完成状态 |

### 5.3 容器颜色

| 用途 | Color | Alpha | 示例 |
|------|-------|-------|------|
| 卡片边框 | `outline` | 0.3 | LiteCard 边框 |
| 进度条背景 | `surfaceContainerHighest` | 0.5 | LiteProgress 背景 |
| 进度条填充 | `primary` | 0.6 | LiteProgress 填充 |

---

## 6. 组件规格

### 6.1 LiteCard（卡片容器）

```
padding: 6px
border: 0.5px outline(0.3)
radius: 3px
shadow: none
background: transparent
hover: background onSurface(0.03)
```

### 6.2 LiteIcon（图标容器）

```
size: 22px
iconSize: 12px
border: 0.5px primary(0.3)
radius: 2px
background: none
```

### 6.3 LiteTag（标签）

```
padding: 2px 5px
border: 0.5px outline(0.4)
radius: 2px
background: none
fontSize: 8px
```

### 6.4 LiteDateBox（日期显示）

```
无背景，纯文字
month: 8px, primary(0.5)
day: 12px, bold, onSurface(0.9)
```

### 6.5 LiteButton（按钮）

```
padding: 4px 8px
border: 0.5px outline(0.4)
radius: 2px
fontSize: 10px
icon: 12px
```

### 6.6 LiteProgress（进度条）

```
height: 3px
radius: 1.5px
background: surfaceContainerHighest(0.5)
fill: primary(0.6)
```

### 6.7 LiteDivider（分割线）

```
height: 0.5px
color: outline(0.3)
margin: 0
```

---

## 7. 卡片规格

### 7.1 通用结构

```
LiteCard
├─ padding: 6px
├─ gap: 4px (垂直)
├─ 图标: LiteIcon (22px) 或无
├─ 标题: title (13px, w600)
├─ 内容: body (11px)
├─ 辅助: caption (9px)
└─ 标签: LiteTag
```

### 7.2 特殊卡片

| 卡片 | 特殊处理 |
|------|----------|
| **TextCard** | 图片网格 gap 2px，圆角 2px |
| **ChecklistCard** | 进度条 3px，复选框 12px |
| **MoodCard** | emoji 28px，无容器 |
| **CalendarCard** | 日期纯文字 |
| **VoiceCard** | 时钟 14px |
| **MetaCard** | 组件计数 9px |

---

## 8. 页面规格

### 8.1 列表页

```
padding: 8px (左右)
gap: 4px (卡片间)
header: title 13px + caption 9px
```

### 8.2 预览页

```
padding: 8px
section gap: 6px
icon: 22px
title: 13px
body: 11px
label: 8px
```

### 8.3 设置页

```
item height: 36px
icon: 14px
title: 11px
subtitle: 9px
```

### 8.4 仪表盘

```
stat card: padding 6px, value 16px, label 9px
heatmap cell: 10px, gap 1.5px
quick memo: padding 6px, input 11px
```

---

## 9. 动画规格

| 动画 | 时长 | 曲线 |
|------|------|------|
| 页面切换 | 200ms | easeOut |
| 按压反馈 | 100ms | linear |
| 列表项出现 | 150ms | easeOut |
| hover背景 | 150ms | easeOut |

**禁止：**
- elevation 变化
- scale 动画
- slide 动画（除页面切换）

---

## 10. 文件结构

```
lib/core/components/lite/
├── lite_card.dart
├── lite_icon.dart
├── lite_tag.dart
├── lite_date_box.dart
├── lite_button.dart
├── lite_progress.dart
├── lite_divider.dart
└── index.dart

lib/features/notes_list/widgets/cards/lite/
├── text_card_lite.dart
├── checklist_card_lite.dart
├── mood_card_lite.dart
├── meta_card_lite.dart
├── link_card_lite.dart
├── voice_card_lite.dart
├── calendar_card_lite.dart
├── anniversary_card_lite.dart
├── location_card_lite.dart
├── drawing_card_lite.dart
├── text_v2_card_lite.dart
├── contact_card_lite.dart
├── account_card_lite.dart
├── bank_card_lite.dart
└── index.dart

lib/features/notes/widgets/
├── editor_page_shell_lite.dart
├── editor_top_bar_lite.dart
└── component_editors/add_component_button_lite.dart

lib/features/notes_list/widgets/
└── search_bar_lite.dart
```

---

## 11. 检查清单

创建或修改组件时，逐项检查：

- [ ] 字号是否符合规范（11/9/8px）
- [ ] 间距是否使用 tokens（2/4/6/8px）
- [ ] 边框是否 0.5px
- [ ] 圆角是否使用 tokens（2/3/4px）
- [ ] 颜色是否使用 alpha（0.3-0.7）
- [ ] 无阴影（BoxShadow）
- [ ] 无渐变背景
- [ ] 图标尺寸是否 12-14px
- [ ] 动画是否符合规范

# Dashboard 组件扩展指南

## 架构概述

仪表盘由可配置的组件（Section）组成，每个组件由以下三层定义：

```
仪表盘页面 (dashboard_page.dart)
  └─ _buildConfigSections() — 根据配置渲染组件
       └─ 每个 sectionId 对应一个 case 分支
          ├─ quick_memo      → QuickMemoWidget
          ├─ stats           → _buildStatRow()
          ├─ heatmap         → HeatmapWidget
          ├─ type_distribution → _buildTypeDistribution()
          └─ recent_notes    → _buildRecentSection()

配置数据 (dashboard_configs 表)
  ├─ section_id  — 组件标识
  ├─ sort_order  — 排序
  ├─ visible     — 显示/隐藏
  └─ settings    — JSON 扩展配置 (Map<String, dynamic>)
```

## 添加新组件步骤

### 1. 注册组件标识

在 `lib/features/dashboard/views/dashboard_config_panel.dart` 中 `_sectionMeta` 添加条目：

```dart
static const _sectionMeta = {
  // ... 已有组件
  'my_new_component': _SectionMeta('我的新组件', Icons.widgets),
};
```

### 2. 添加默认配置

在 `lib/data/repositories/dashboard_config_repository.dart` 中 `_defaultSections` 列表添加：

```dart
static const _defaultSections = [
  // ... 已有组件
  ('my_new_component', 5),  // 序号 5
];
```

### 3. 实现渲染

在 `lib/features/dashboard/views/dashboard_page.dart` 中 `_buildConfigSections` 添加 case：

```dart
case 'my_new_component':
  widgets.addAll([
    MyNewWidget(),
    const SizedBox(height: Spacing.md),
  ]);
```

### 4. 实现配置面板（可选）

在 `dashboard_config_panel.dart` 的 `_SectionTile._settingsWidget()` 中添加 case：

```dart
case 'my_new_component':
  return _MyComponentSettings(
    settings: settings,
    onChanged: onSettingsChanged,
  );
```

创建对应的 settings widget：

```dart
class _MyComponentSettings extends StatelessWidget {
  final Map<String, dynamic> settings;
  final ValueChanged<Map<String, dynamic>> onChanged;
  // ...
}
```

### 5. 配置数据

settings JSON 示例：

```json
{
  "option1": true,
  "option2": "value",
  "maxCount": 10
}
```

在读取 settings 时始终提供合理的默认值：

```dart
final myOption = s.settings['option1'] as bool? ?? true;
final myCount = (s.settings['maxCount'] as int? ?? 10).clamp(1, 100);
```

## 注意事项

- settings 使用 `Map<String, dynamic>` 并序列化为 JSON 字符串存储在数据库
- 读取时总是提供默认值（`??`），避免数据库升级时异常
- 组件顺序由 `sort_order` 控制，配置面板通过拖拽更新
- 新组件在首次运行时自动初始化默认配置（`DEFAULT_ORDER`）
- 如需重置所有配置，点击配置面板右上角"重置"按钮

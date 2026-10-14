# 全局 Overlay 使用指南

## 快速开始

```dart
import 'package:note/core/overlay/index.dart';
```

## 1. 托盘菜单（右键菜单）

```dart
// 长按或右键触发
GestureDetector(
  onLongPressStart: (details) {
    appOverlay.showTray(
      context: context,
      position: details.globalPosition,
      items: [
        TrayMenuItem(
          icon: Icons.edit,
          label: '编辑',
          onTap: () => edit(),
        ),
        TrayMenuItem(
          icon: Icons.copy,
          label: '复制',
          onTap: () => copy(),
        ),
        TrayMenuItem(
          icon: Icons.delete,
          label: '删除',
          isDestructive: true,
          onTap: () => delete(),
        ),
      ],
    );
  },
  child: Text('长按我'),
)
```

## 2. Toast 提示

```dart
// 显示成功提示
appOverlay.showToast(
  context,
  message: '保存成功',
  icon: Icons.check_circle,
);

// 显示错误提示
appOverlay.showToast(
  context,
  message: '保存失败',
  icon: Icons.error,
  duration: Duration(seconds: 3),
);
```

## 3. 全局底部面板

```dart
appOverlay.showSheet(
  context: context,
  child: Container(
    padding: EdgeInsets.all(16),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('这是一个底部面板'),
        SizedBox(height: 16),
        // ... 内容
      ],
    ),
  ),
);
```

## 4. 关闭组件

```dart
appOverlay.hideTray();   // 关闭托盘菜单
appOverlay.hideToast();  // 关闭 Toast
appOverlay.hideSheet();  // 关闭底部面板
```

## 设计规范

- **位置**：组件挂载在最外层 Overlay，优先级最高
- **动画**：150-200ms 缓动动画
- **样式**：遵循 Lite 设计规范（0.5px 边框，圆角 3px）
- **层级**：托盘菜单 > Toast > 底部面板

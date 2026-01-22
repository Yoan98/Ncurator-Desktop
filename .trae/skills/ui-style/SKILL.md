---
name: UI-Style
description: 当涉及到页面的ui代码编写时，要参照这样的样式风格设计
---

# UI/UX 设计规范与准则 (Design System)

> **核心理念**: 本地知识库极简科技风格 (Modern Minimalist EdTech)。
> **氛围**: 专业、干净、轻盈且注重阅读体验（"Slate 岩板灰主题"）。

## 1. 调色板 (Color Palette - Tailwind CSS)

### 背景色 (Backgrounds)
*   **页面根背景**: `bg-slate-50` (严禁在 Body 背景使用纯白 #ffffff)。
*   **卡片/承载面**: `bg-white` (用于悬浮在岩板灰背景上的内容容器)。
*   **次级/输入框**: `bg-slate-50` 或 `bg-slate-100`。

### 文字颜色 (Typography Colors)
*   **标题/主要内容**: `text-slate-800` 或 `text-slate-900` (高对比度)。
*   **正文文本**: `text-slate-600` (视觉更柔和，减少视疲劳)。
*   **弱化/元数据**: `text-slate-400` 或 `text-slate-500`。

### 品牌与强调色 (Brand & Accents)
*   **主色调**: `Blue-600` (#2563eb)。
*   **主要操作**: `bg-blue-600` hover: `bg-blue-700`。
*   **渐变**: 用于强调重点 (例如 `bg-gradient-to-r from-blue-600 to-indigo-600`)。
*   **选中/激活状态**: `bg-blue-50` text `text-blue-600`。

### 状态指示 (Status Indicators)
*   **成功/完成**: `text-emerald-500` (图标) 或 `bg-green-100 text-green-700` (徽章/Badges)。
*   **错误/破坏性操作**: `text-red-600` 或 `bg-red-100`。

---

## 2. 形状与深度 (Shapes & Depth)

### 圆角 (Border Radius)
*   **容器/卡片**: `rounded-xl` (12px) 或 `rounded-2xl` (16px)。
*   **按钮/输入框**: `rounded-lg` (8px) 或 `rounded-full`。
*   **头像/图标背景**: `rounded-full`。

### 边框 (Borders)
*   **风格**: 纤细、微弱且清晰。
*   **颜色**: `border-slate-200` (严禁使用深色边框)。
*   **用法**: 用于区分白色卡片与灰色背景，或卡片内部的区域分割。

### 阴影 (Shadows / Elevation)
*   **默认卡片**: `shadow-sm`。
*   **悬停状态**: `shadow-md`。
*   **悬浮元素 (模态框/工具)**: `shadow-xl` 或 `shadow-2xl` (营造悬浮感)。

---

## 3. 排版与图标 (Typography & Icons)

*   **字体家族**: `Inter` (无衬线字体)。
*   **层级结构**: 通过 **字重 (Font Weight)** (`font-semibold`, `font-bold`) 和 **颜色** 来区分层级，而不仅仅是靠字号大小。
*   **行高**: 正文段落统一使用 `leading-relaxed` 以提升阅读体验。
*   **图标**: 使用 **Lucide React**。标准尺寸: 16 (sm), 18 (md), 20/24 (lg)。线条宽度 (Stroke width): 2。

---

## 4. 交互体验 (Interactions)

*   **过渡动画**: 所有交互元素 (按钮, 卡片, 输入框) 必须包含 `transition-all duration-300` (或 200)。
*   **悬停效果 (Hover)**:
    *   **卡片**: 轻微上浮 (`hover:-translate-y-0.5` 或 `hover:shadow-md`)。
    *   **按钮**: 背景色加深。
*   **点击反馈**: 按钮点击时使用 `active:scale-95` 或 `active:scale-[0.98]` 提供明确的触感反馈。

---

## 5. 布局模式 (Layout Patterns)

1.  **卡片式布局 (Card-Based)**: 所有内容均承载于灰色背景上的白色卡片中。
2.  **悬浮工具 (Floating Tools)**: 主要工具 (聊天助手, 侧边导航) 应作为高层级 (`z-index`) 元素覆盖在内容之上。
3.  **留白 (Whitespace)**: 主内容区使用宽敞的内边距 (`p-6` 或 `p-8`) 以保持界面的“轻盈感”和“空气感”。

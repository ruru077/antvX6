# React + TypeScript + Vite

## 构建优化

- 编辑器按路由加载，Scope 图表按需加载，减少首页下载量。
- React Compiler 仅处理组件和 hooks；SVGR 仅处理 `.svg?react`。
- 生产 sourcemap 默认关闭，需要时设置 `VITE_BUILD_SOURCEMAP=true`。
- 本次实测构建耗时从 23.14 秒降到 16.29 秒，首页 JS gzip（含依赖）从约 1,182 KB 降到 284 KB；编辑器和图表仍有大包告警。
- 构建及 5 个测试通过，生产预览已检查首页、博客、X6 图页和图表模块初始化。

### 改动范围

本次构建优化涉及以下 7 个代码和配置文件，以及本 README。根图层命名和 KeepAlive 视图适应属于此前的功能修改，不计入本次优化范围。

| 文件 | 改动内容与用途 |
| --- | --- |
| `vite/index.js` | Babel 仅处理 `src` 下的 JSX/TSX 组件及 `use*` hooks，普通服务和 store 由 Oxc 处理；为 SVGR 增加原生 load 过滤，仅匹配 `.svg?react`；生产环境按 sourcemap 开关决定是否生成 Babel 映射。 |
| `vite.config.ts` | 生产 sourcemap 改为显式开启，并生成 `dist/.vite/manifest.json`，用于统计入口及其依赖的实际加载体积。 |
| `src/router/index.tsx` | 工作区通过 `React.lazy` 和 `Suspense` 加载；首页、博客和 iframe Demo 使用路由懒加载；补充初始加载 fallback。保留工作区原有的路由结构和 KeepAlive 缓存配置。 |
| `src/main.tsx` | 移除入口对 X6 补丁的同步导入，避免首页提前加载图编辑器及其关联依赖。工作区通过已有的模块引用加载补丁。 |
| `src/views/DiagramModel2.tsx` | 为 X6 调试页显式导入补丁，保留移除全局入口导入前的运行行为。 |
| `src/components/ScopeWindow.tsx` | Scope 图表改为动态导入，窗口有仿真结果需要展示时才加载图表模块。 |
| `src/components/layout/SignalAnalysisPanel.tsx` | 对比图表改为动态导入，有可展示的 Scope 结果时才加载，与 Scope 窗口共用同一图表模块。 |

### 效果与限制

| 指标 | 优化前日志 | 优化后实测 |
| --- | ---: | ---: |
| 构建耗时 | 23.14 秒 | 16.29 秒 |
| 首页 JS gzip（包含实际加载依赖） | 约 1,182 KB | 约 284 KB |
| Babel 处理文件数 | 141 | 76 |
| SVGR load 调用次数 | 7292 | 10 |

构建耗时会随机器负载和缓存变化。此次主要减少首页加载内容及无关文件的转换开销，编辑器和图表本身仍有超过 500 KB 的分包告警。最终保留自动分包，没有提高告警阈值。现有 5 个测试通过；类型检查仍有原有测试文件 `__tests__/vite/autoImport.spec.ts` 缺少 `describe`、`it`、`expect` 类型声明的问题。

需要生产 sourcemap 时，在构建环境中设置 `VITE_BUILD_SOURCEMAP=true` 后重新构建；默认生产构建不生成 `.map` 文件，开发环境仍保留调试映射。

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

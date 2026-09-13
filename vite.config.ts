import { defineConfig, loadEnv } from 'vite-plus'
import { createVitePlugins } from './vite'
import { createDemoAgentPlugin } from './vite/demo-agent'
import type { UserConfig } from 'vite-plus'

const baseUrl = 'http://localhost:8080' // 后端接口

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname)
  const { DEEPSEEK_API_KEY } = loadEnv(mode, __dirname, 'DEEPSEEK_')
  const { VITE_APP_ENV } = env
  return {
    // 部署生产环境和开发环境下的URL。
    // 默认情况下，vite 会假设你的应用是被部署在一个域名的根路径上
    // 例如 https://www.ruoyi.vip/。如果应用被部署在一个子路径上，你就需要用这个选项指定这个子路径。例如，如果你的应用被部署在 https://www.ruoyi.vip/admin/，则设置 baseUrl 为 /admin/。
    base: VITE_APP_ENV === 'production' ? '/' : '/',
    // 插件配置
    plugins: [
      ...createVitePlugins(env, mode),
      createDemoAgentPlugin(DEEPSEEK_API_KEY),
    ],
    // 开发配置
    server: {
      port: 5173,
      host: true,
      // 手动刷新进行文件更新配置
      // hmr: false,
      // watch: { usePolling: true },
      proxy: {},
    },

    // 生产配置
    build: {
      // https://vite.dev/config/build-options.html
      sourcemap: true,
      outDir: 'dist',
      assetsDir: 'assets',
    },
    resolve: {
      tsconfigPaths: true,
    },
    // 工具链配置 无需修改
    run: {},
    pack: {},
    // 测试配置，使用 Vitest 进行单元测试
    test: {
      globals: true,
      environment: 'node',
      include: ['__tests__/**/*.{test,spec}.ts'],
    },
    // husky vite config
    staged: {
      '**/*.{js,jsx,ts,tsx}': ['vp lint --fix', 'vp fmt'],
      '**/*.{css,html}': ['vp fmt'],
    },
    // oxc lint 配置
    lint: {
      plugins: ['oxc', 'typescript', 'react'], // 规则集：oxc + TypeScript + React
      categories: {
        correctness: 'warn', // 可能出 bug 的代码警告
      },
      ignorePatterns: ['dist'], // 跳过构建产物
      overrides: [
        {
          files: ['**/*.{ts,tsx,js,jsx}'],
          rules: {
            'no-unused-vars': 'off', // 允许未使用变量
            'no-empty': 'off', // 允许空代码块
            'prefer-const': 'off', // 允许用 let 声明不重赋值的变量
            '@typescript-eslint/unbound-method': 'off', // 允许传递未绑定this的方法引用
          },
          env: {
            browser: true, // 代码运行在浏览器环境 window/document 可用
          },
        },
      ],
      // Vite+ 推荐默认配置
      options: {
        typeAware: true, // 类型感知检查
        typeCheck: true, // 同时跑 tsc 类型检查
      },
      jsPlugins: [
        {
          name: 'vite-plus',
          specifier: 'vite-plus/oxlint-plugin', // 加载 Vite+ 自定义 oxlint 插件
        },
      ],
      rules: {
        'vite-plus/prefer-vite-plus-imports': 'error', // 强制使用 vite-plus 导入路径
      },
    },
    // oxc fmt 配置
    fmt: {
      printWidth: 80, // 一行最多 80 字符，超了自动折行
      singleQuote: true, // 字符串用单引号 ' 而非双引号 "
      trailingComma: 'all', // 所有多行结构末尾强制加逗号（含函数参数）
      tabWidth: 2, // 每个缩进层级 = 2 个空格
      useTabs: false, // 用空格缩进，不用 Tab 字符
      semi: false, // 语句末尾不加分号 ;
      proseWrap: 'never', // Markdown 文本不自动折行（保持原样）
      arrowParens: 'always', // 箭头函数参数始终加括号：(x) => {} 而非 x => {}
      bracketSameLine: false, // JSX 的 `>` 另起一行，不跟标签同行
      sortImports: {
        newlinesBetween: false, // 分组之间不插入空行
        groups: [
          'builtin', // 第 1 组：Node 内置模块（fs, path 等）
          'external', // 第 2 组：npm 包（antd, react 等）
          'internal', // 第 3 组：项目内部模块（@/、~/ 开头）
          ['parent', 'sibling', 'index'], // 第 4 组：相对路径导入（../、./）
          'type', // 第 5 组：import type（单独成一组，放在最后）
          ['side_effect_style', 'side_effect'], // 第 6 组：'import "./x.scss"'
          'unknown', // 第 7 组：其他
        ],
      },
      sortPackageJson: true, // 自动按规范排序 package.json 字段
      ignorePatterns: ['*.md', '*.json'], // 跳过 Markdown 和 JSON
    },
  } as UserConfig
})

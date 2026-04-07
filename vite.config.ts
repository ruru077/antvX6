import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import { createVitePlugins } from './vite'

const baseUrl = 'http://localhost:8080' // 后端接口

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname)
  const { VITE_APP_ENV } = env
  return {
    // 部署生产环境和开发环境下的URL。
    // 默认情况下，vite 会假设你的应用是被部署在一个域名的根路径上
    // 例如 https://www.ruoyi.vip/。如果应用被部署在一个子路径上，你就需要用这个选项指定这个子路径。例如，如果你的应用被部署在 https://www.ruoyi.vip/admin/，则设置 baseUrl 为 /admin/。
    base: VITE_APP_ENV === 'production' ? '/' : '/',
    // 插件配置
    plugins: createVitePlugins(env, mode),
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
      // https://cn.vitejs.dev/config/#resolve-alias
      alias: {
        // '~' 代表项目根目录
        '~': path.resolve(__dirname, './'),
        // '@' 代表 src 目录
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['__tests__/**/*.{test,spec}.ts'],
    },
  }
})

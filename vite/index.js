import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import createAutoImport from './auto-import'

export function createVitePlugins(Env, mode) {
  if (mode !== 'test') {
    console.log('Env:', Env)
  }
  // 原插件在每个模块上调用 load，再检查文件名；使用原生过滤提前跳过。
  const svgPlugin = svgr()
  const svgLoad = svgPlugin.load
  svgPlugin.load = {
    filter: { id: /\.svg\?react$/ },
    handler: svgLoad,
  }
  return [
    svgPlugin,
    react(),
    babel({
      // 普通 service/store 文件交给 Oxc，React 组件和 hooks 保留 Compiler。
      include: [
        /[\\/]src[\\/].*\.[jt]sx(?:$|\?)/,
        /[\\/]src[\\/].*[\\/]use[^\\/]*\.[jt]s(?:$|\?)/,
      ],
      sourceMap: mode !== 'production' || Env.VITE_BUILD_SOURCEMAP === 'true',
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
    createAutoImport(),
  ]
}

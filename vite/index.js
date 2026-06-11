import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import createAutoImport from './auto-import'

export function createVitePlugins(Env, mode) {
  if (mode !== 'test') {
    console.log('Env:', Env)
  }
  return [
    svgr(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    createAutoImport(),
  ]
}

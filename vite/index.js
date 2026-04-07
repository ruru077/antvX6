import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import createAutoImport from './auto-import'

export function createVitePlugins(Env, mode) {
  if (mode !== 'test') {
    console.log('Env:', Env)
  }
  const vitePlugins = [react(), babel({ presets: [reactCompilerPreset()] })]
  vitePlugins.push(createAutoImport())
  return vitePlugins
}

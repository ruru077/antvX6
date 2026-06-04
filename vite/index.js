import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import createAutoImport from './auto-import'

export function createVitePlugins(Env, mode) {
  if (mode !== 'test') {
    console.log('Env:', Env)
  }
  return [svgr(), react({ reactCompiler: true }), createAutoImport()]
}

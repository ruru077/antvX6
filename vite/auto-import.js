import autoImport from 'unplugin-auto-import/vite'

export default function () {
  return autoImport({
    imports: [
      'react',
      'react-router',
      {
        'react-intl-universal': [['default', 'intl']],
      },
    ],
    dtsMode: 'overwrite',
    dts: 'src/types/auto-imports.d.ts',
    viteOptimizeDeps: true,
  })
}

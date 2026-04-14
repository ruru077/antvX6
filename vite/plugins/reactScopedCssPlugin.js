/* eslint-disable no-undef */
import { resolve } from 'path'
import { reactScopedCssPlugin } from 'rollup-plugin-react-scoped-css'

/**
 * 支持路径别名的 React Scoped CSS Vite 插件。
 * @param {Record<string, string>} aliases - 别名映射，例如 { '@/': 'src/' }
 */
export function createScopedCssPlugin(aliases = { '@/': 'src/' }) {
  const resolvedAliases = Object.fromEntries(
    Object.entries(aliases).map(([k, v]) => [k, resolve(process.cwd(), v)]),
  )

  const [pre, post] = reactScopedCssPlugin()
  const originalResolveId = pre.resolveId
  pre.resolveId = function (source, importer, options) {
    let resolved = source
    for (const [alias, target] of Object.entries(resolvedAliases)) {
      if (source.startsWith(alias)) {
        resolved = target + '/' + source.slice(alias.length)
        break
      }
    }
    return originalResolveId.call(this, resolved, importer, options)
  }

  return [pre, post]
}

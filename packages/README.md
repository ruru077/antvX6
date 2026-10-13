# 路由库依赖

这里仅保存独立 m2p-libavoid 仓库发布的版本化 npm 包，不存放算法源码或构建工具。
当前使用 `libavoid-js-0.5.0-beta.5-m2p.3.tgz`；包内只有浏览器/Node 运行产物、入口、类型和许可证等发布文件。

首次获取 Link 后执行 `pnpm install --frozen-lockfile` 即可，开发和打包不需要独立库仓库、Python 或 Emscripten。

更新版本：
1. 在独立库中运行 `npm pack --pack-destination releases`（先创建 releases 目录），自动执行库校验与算法测试。
2. 将生成的新版本 tgz 复制到本目录。
3. 在 Link 中执行 `pnpm add ./packages/<新版本包名>.tgz`。
4. 在独立库运行 `npm run test:all` 完成算法与 Link 集成验收；Link 本身只需 `pnpm run build`。
5. 一起提交新 tgz、package.json、pnpm-lock.yaml，并删除不再引用的旧包。

未来发布到包仓库后可以改用普通的固定版本依赖，业务代码无须修改。

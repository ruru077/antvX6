# M2PLab 同域嵌入部署

本分支将 X6 编辑器作为独立静态服务接入 M2PLab，展示名称为 M2PLink。首页 M2PLink 卡片进入 `/m2plab/m2plink`；原 `/m2plab/m2psim` 直接使用旧编辑器。默认构建路径仍为 `/m2plab/sim-editor/`，嵌入入口仍为 `/m2plab/sim-editor/embed`。父子页只接受相同 origin、预期 window 和 `m2psim-v1` channel 的消息，传递试验台上下文和未保存状态。登录后的返回地址为 `/m2plab/m2plink`，保留语言参数。

## 接口与数据

- 身份：`GET /m2plab/api/auth-context`，读取现有服务验证会话后返回的 `X-Authenticated-User-ID`。不信任 URL 中的用户 ID，也不复制平台用户资料解密逻辑。
- 模型：现有 `/m2plab/api/filesystem-link` 接口，将版本 1 的 `m2psim-x6` JSON 文件保存在当前用户工作区 `/M2PSim/`。模型包含全部图层、模型名称、求解器与编译配置。首次创建使用 UUID 后缀，后续保存更新相同文件。
- 仿真：同域 `/m2plab/matlab/websocketsimulatert`，使用平台现有网关鉴权和 Link 服务，接收 `final_results` 并显示 Scope。120 秒超时会明确报错。
- 模块库：`public/catalog` 保存 2026-09-12 获取的公开模块快照：151 个模块、14 个分组。来源 `https://www.stencil.top/antvblocks` 与 `/library`。页面运行时从本站读取；当前保留上游普通用户分组过滤规则。
- 连线：WASM 从本站 `vendor/libavoid.wasm` 加载。

旧 JointJS 模型没有写入或转换为 X6；数据库和平台后端没有改动。历史模型、编译、下载到设备继续使用 M2PSim。M2PLink 的 AI 面板尚未接入平台 AI 工作区。存储目录 `/M2PSim/`、文件格式 `m2psim-x6` 和同源通信 channel 保留原值，以便继续打开入口拆分前保存的模型。

## 构建与验证

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm test run
pnpm build
```

部署 `dist` 时排除源映射 `.map`。网关必须使用 `location ^~ /m2plab/sim-editor/`，避免 JS、JSON、WASM 请求被宿主的通用静态资源规则拦截；剥离此前缀后代理到独立服务。SPA 子路由应返回编辑器 `index.html`，缺失静态资源应返回 404。

首次上线记录位于 M2PLab 工作区 `deploy/releases/sim-20260912/`，M2PLink 入口拆分记录位于 `deploy/releases/m2plink-20260912/`。后续单独更新编辑器镜像即可，无须重建宿主或变更 Link。

## 验收范围

已在生产域名和真实登录账号中验证：模块库加载、示例 `Constant(2) → Gain(3) → Scope` 输出 6、参数编辑、首次保存、刷新重开、更新保存、未保存离开确认、旧版历史模型列表。自动化测试覆盖身份接口约定、无效身份、接口错误、HTML 回退页不能误判为保存成功。

尚未完成所有模块、复杂闭环及多层子系统的完整数值回归；这次发布是第一阶段试用接入。新版与旧版模型暂不互相导入。

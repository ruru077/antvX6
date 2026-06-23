# Zustand 实战指南

> 本指南基于本项目（antv-link）的真实代码编写，所有示例均来自项目中的实际用法。

---

## 一、先回答你的困惑

### 1. `create` vs `createStore`

官方文档开头用的是 `createStore`，因为它是**底层 API**，返回的是一个纯 store 对象（带 `getState`、`setState`、`subscribe` 方法），不绑定 React。

```ts
// 官方文档的写法 —— 底层 API
import { createStore } from 'zustand'

const store = createStore((set) => ({ count: 0 }))
store.getState()       // ✅ 读取
store.setState({ count: 1 })  // ✅ 写入
store.subscribe(...)   // ✅ 订阅
```

而 `create` 是在 `createStore` 之上封装的 **React 绑定**，返回的是一个 **Hook**，同时挂载了 `getState`、`setState`、`subscribe` 等方法：

```ts
// 本项目的写法 —— React 绑定 API
import { create } from 'zustand'

const useStore = create((set) => ({ count: 0 }))
useStore()             // ✅ 在组件中当 Hook 用
useStore.getState()    // ✅ 在任意位置读取
useStore.subscribe(...)  // ✅ 在任意位置订阅
```

**结论：本项目统一用 `create`，它包含了 `createStore` 的全部能力，同时还能当 React Hook 用。你不需要用 `createStore`。**

### 2. `.subscribe` 在哪？

`subscribe` 是 store 实例上的方法，`create` 返回的 Hook 本身就是 store 实例，所以直接 `useStore.subscribe(...)` 即可。本项目中有三处实际使用：

| 文件 | 用法 |
|------|------|
| [configStore.ts](src/store/configStore.ts#L84) | `useConfigStore.subscribe((state) => {...})` |
| [useThemeToggle.ts](src/utils/hooks/useThemeToggle.ts#L78) | `useThemeToggleStore.subscribe((s) => {...})` |
| [stencil-service.ts](src/services/stencil-service.ts#L277) | `useConfigStore.subscribe((state, prev) => {...})` |

---

## 二、创建 Store

### 基本模板

```ts
import { create } from 'zustand'

interface MyStore {
  // 状态
  count: number
  // action
  setCount: (n: number) => void
}

const useMyStore = create<MyStore>((set, get) => ({
  count: 0,
  setCount: (n) => set({ count: n }),
}))
```

`create` 的回调接收两个参数：

| 参数 | 作用 | 本项目示例 |
|------|------|-----------|
| `set` | 更新状态，触发组件重渲染 | `set({ zoom })` |
| `get` | 读取当前状态（不触发重渲染） | `get().setZoom(...)` |

### `set` 的两种写法

```ts
// 1. 对象写法 —— 最常用
set({ zoom: 100 })

// 2. 函数写法 —— 需要基于当前状态计算
set((state) => ({ count: state.count + 1 }))
```

本项目 [graphStore.ts](src/store/graphStore.ts#L68-L90) 的实际示例：

```ts
const useGraphStore = create<GraphStore>((set, get) => ({
  graph: null as unknown as GraphType,
  zoom: 100,

  initGraph: (container) => {
    const graph = createGraph(container)
    // 用 get() 在 action 内部读取其他状态
    graph.on('scale', ({ sx }) => {
      get().setZoom(Math.round(sx * 100))
    })
    // 用 set() 更新状态
    set({ graph })
  },

  setZoom: (zoom) => set({ zoom }),
}))
```

### `get` 什么时候用？

**在 action 内部需要读取当前状态时用 `get()`。** 不需要把它传到组件里——组件里直接用选择器（见下一节）。

---

## 三、在 React 组件中使用（选择器模式）

### 1. 单字段选择器（最常用）

传入一个函数，只订阅你关心的那个字段。**只有该字段变化时才重渲染。**

```tsx
// 本项目 CanvasToolbars.tsx 的实际写法
const graph = useGraphStore((s) => s.graph)
const zoom = useGraphStore((s) => s.zoom)
```

### 2. 多字段选择器 + `useShallow`

当需要同时订阅多个字段时，返回一个对象。但 Zustand 默认用 `Object.is` 比较，每次 `set` 都会返回新对象引用，导致**无关更新也触发重渲染**。用 `useShallow` 做浅比较解决：

```tsx
import { useShallow } from 'zustand/shallow'

// 本项目 useThemeToggle.ts 的实际写法
function useThemeToggle() {
  return useThemeToggleStore(
    useShallow((s) => ({
      theme: s.theme,
      setTheme: s.setTheme,
      toggle: s.toggle,
    })),
  )
}
```

> **规则**：返回对象/数组时，必须用 `useShallow`。返回原始值（string、number、boolean）时不需要。

### 3. 不传选择器（全量订阅）

```tsx
// 本项目 SettingDialog.tsx 的写法
const store = useConfigStore()
```

**这会订阅整个 store，任何字段变化都会触发重渲染。** 只有在 store 很小、或确实需要全部字段时才用（如设置面板）。

### 4. 直接选择 action

action 函数引用通常不变，所以不需要 `useShallow`：

```tsx
// 本项目 SubsystemNavBar.tsx 的写法
const currentPathIds = useSubGraphStore((s) => s.currentPathIds)
const changeGraphView = useSubGraphStore((s) => s.changeGraphView)
const rootId = useSubGraphStore((s) => s.rootId)
```

---

## 四、在非组件代码中使用（getState 模式）

这是本项目最核心的使用模式。**在 service、快捷键 handler、事件回调等非 React 代码中，用 `getState()` 读取状态和调用 action。**

### 基本用法

```ts
// 本项目 BlockDiagram.tsx 第 29 行 —— 你提到的这行代码
const { initGraph, destroyGraph } = useGraphStore.getState()
initGraph(paperContainerRef.current)
```

### 在快捷键 handler 中

本项目 [graphStore.ts](src/store/graphStore.ts#L404-L459) 大量使用：

```ts
function copyHandler() {
  const graph = useGraphStore.getState().graph
  const cells = graph.getSelectedCells()
  if (cells.length) graph.copy(cells)
}

function selectAllHandler() {
  const graph = useGraphStore.getState().graph
  const cells = graph.getCells()
  if (cells.length) graph.resetSelection(cells)
}
```

### 在 service 中

```ts
// 本项目 stencil-service.ts
const graph = useGraphStore.getState().graph
const { hiddenStencilGroups, stencilDefaultExpand } = useConfigStore.getState()
```

### 跨 store 调用

```ts
// 本项目 graphStore.ts —— 在 graphStore 中调用 subGraphStore
useSubGraphStore.getState().mergeToSubsystem(cells)
```

### `getState()` vs 选择器 Hook

| 场景 | 用什么 | 是否触发重渲染 |
|------|--------|--------------|
| React 组件内读取状态 | 选择器 `useStore((s) => s.x)` | ✅ 状态变化时自动重渲染 |
| React 组件的 useEffect 内 | `useStore.getState()` | ❌ 只读一次快照 |
| 非 React 代码（service、handler） | `useStore.getState()` | ❌ 只读一次快照 |

**为什么 `useEffect` 里用 `getState()` 而不是选择器？** 因为 `useEffect` 不需要响应式订阅——它只在挂载时执行一次，直接读快照即可。如果在 `useEffect` 里用了选择器，反而会导致每次状态变化都重新执行 effect。

---

## 五、subscribe：全局订阅与副作用

`subscribe` 用于**在 React 组件树之外监听状态变化**，执行副作用（操作 DOM、同步外部系统等）。

### 1. 基本订阅

```ts
// 本项目 configStore.ts —— 主题变化时同步 DOM
useConfigStore.subscribe((state) => {
  resolveThemeClass(state.theme)
})
```

每次 `set` 都会触发，回调接收最新的 `state`。

### 2. 选择性订阅：subscribeWithSelector（推荐）

默认的 `subscribe` 每次 `set` 都会触发回调。如果只想在**特定字段变化时**才执行，用 `subscribeWithSelector` 中间件——这就是 zustand 官方的选择性订阅方案。

#### 启用中间件

在创建 store 时包一层 `subscribeWithSelector`，可与 `persist` 组合：

```ts
import { create } from 'zustand'
import { subscribeWithSelector, persist } from 'zustand/middleware'

// 与 persist 组合（本项目 configStore 的推荐改法）
const useConfigStore = create<ConfigStore>()(
  subscribeWithSelector(
    persist(
      (set) => ({ ... }),
      { name: 'antv-link-config' },
    ),
  ),
)
```

启用后，`subscribe` 方法变为三参数签名：`(selector, listener, options?)`。

#### 单字段选择性订阅

```ts
// 只在 stencilDefaultExpand 变化时触发，其他 set 自动过滤
useConfigStore.subscribe(
  (state) => state.stencilDefaultExpand,  // selector：只关注这个字段
  () => syncStencilDefaultExpand(),        // listener：字段变化时执行
)
```

中间件自动做相等性比较（默认 `Object.is`），**不需要手动写 `state.x !== prev.x`**。

#### 多字段选择性订阅 + shallow

如果需要同时监听多个字段，选择器返回对象，配合 `shallow` 做浅比较：

```ts
import { shallow } from 'zustand/shallow'

// 只在 stencilDefaultExpand 或 hiddenStencilGroups 变化时触发
useConfigStore.subscribe(
  (state) => ({
    expand: state.stencilDefaultExpand,
    hidden: state.hiddenStencilGroups,
  }),
  (selected, prev) => {
    // selected = { expand, hidden }
    doSomething(selected)
  },
  { equalityFn: shallow },  // 浅比较，任一字段变化才触发
)
```

> **对应关系**：组件中用 `useShallow` 做多字段浅比较，subscribe 中用 `shallow`（去掉 `use` 前缀，因为不是 React Hook）。

#### listener 接收新旧值

`subscribeWithSelector` 的 listener 第二个参数是**选择器返回的旧值**（不是整个旧 state）：

```ts
useStore.subscribe(
  (state) => state.zoom,
  (zoom, prevZoom) => {
    console.log(`缩放从 ${prevZoom} 变为 ${zoom}`)
  },
)
```

### 3. 手动前值对比（本项目当前用法）

本项目 [stencil-service.ts](src/services/stencil-service.ts#L277) 当前使用的是**原生 `subscribe` + 手动前值对比**：

```ts
// 当前写法 —— 可工作，但可优化
const unsub = useConfigStore.subscribe((state, prev) => {
  if (state.stencilDefaultExpand !== prev.stencilDefaultExpand) {
    syncStencilDefaultExpand()
  }
  if (state.hiddenStencilGroups !== prev.hiddenStencilGroups) {
    syncHiddenGroups()
  }
})
```

缺点是每次 `set` 都会进入回调，靠 `if` 拦截内部逻辑。两种方式对照：

| | 手动前值对比 | subscribeWithSelector |
|---|---|---|
| 触发时机 | 每次 `set` 都触发回调，靠 `if` 拦截 | 只在选择器返回值变化时触发 |
| 多字段 | 一个回调里写多个 `if` | 配合 `shallow` 自动浅比较 |
| 获取旧值 | `prev` 是整个旧 state | listener 第二参数是选择器返回的旧值 |
| 代码量 | 较多，需手动写对比逻辑 | 较少，声明式 |

**推荐迁移到 `subscribeWithSelector`**，让中间件自动处理过滤。

### 4. 取消订阅

`subscribe` 返回一个取消函数，在组件卸载或 session 销毁时调用：

```ts
// 本项目 stencil-service.ts
const unsub = useConfigStore.subscribe((state, prev) => { ... })

session.dispose = () => {
  unsub()         // ← 取消订阅
  origDispose()
}
```

### 5. subscribe vs 选择器：什么时候用哪个？

| 场景 | 用选择器 | 用 subscribe |
|------|---------|-------------|
| 状态变化需要更新 UI | ✅ | ❌ |
| 状态变化需要操作 DOM / 外部系统 | ❌ | ✅ |
| 状态变化需要触发其他 store 的 action | ❌ | ✅ |
| 在 service / 非 React 模块中监听变化 | ❌ | ✅ |

---

## 六、persist 中间件：状态持久化

用 `persist` 中间件自动将 store 同步到 `localStorage`：

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 本项目 configStore.ts 的实际写法
const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      ...DEFAULT_VALUES,
      setTheme: (theme) => { set({ theme }) },
      // ...
    }),
    { name: 'antv-link-config' },  // localStorage key
  ),
)
```

注意 `create<ConfigStore>()(persist(...))` 的**双层括号**写法——这是 TypeScript 类型推断需要的，加 `()` 是为了让中间件的类型正确推导。

### 中间件组合

多个中间件可以嵌套组合，**外层包裹内层**。本项目 configStore 如果要同时用 `persist` + `subscribeWithSelector`：

```ts
import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'

const useConfigStore = create<ConfigStore>()(
  subscribeWithSelector(       // 外层：增强 subscribe
    persist(                   // 内层：持久化
      (set) => ({ ... }),
      { name: 'antv-link-config' },
    ),
  ),
)
```

> 中间件的包裹顺序：`subscribeWithSelector` 必须在最外层，这样它才能拦截到 `subscribe` 调用。`persist` 在内层处理状态读写。

页面刷新后，`persist` 会自动从 `localStorage` 恢复状态。如果需要在恢复后执行副作用，用 `subscribe` 监听：

```ts
// 本项目 configStore.ts —— persist 异步 hydration 后同步主题到 DOM
useConfigStore.subscribe((state) => {
  resolveThemeClass(state.theme)
})
```

---

## 七、TypeScript 类型定义

### 基本模式

把状态和 action 放在同一个 interface 里：

```ts
interface GraphStore {
  // 状态
  graph: GraphType
  zoom: number
  // action
  initGraph: (container: HTMLElement) => void
  setZoom: (zoom: number) => void
}

const useGraphStore = create<GraphStore>((set, get) => ({ ... }))
```

### `null` 初值的处理

当某个状态初始为 `null`，但类型不能为 `null` 时，用类型断言"越狱"：

```ts
// 本项目 graphStore.ts
graph: null as unknown as GraphType,
```

后续使用时需自行确保 `graph` 已被 `initGraph` 赋值。

---

## 八、最佳实践速查

### ✅ Do

1. **组件内用选择器**，只订阅需要的字段：
   ```ts
   const zoom = useGraphStore((s) => s.zoom)
   ```

2. **非组件代码用 `getState()`**，按需读取：
   ```ts
   const graph = useGraphStore.getState().graph
   ```

3. **返回对象/数组的选择器必须用 `useShallow`**：
   ```ts
   useStore(useShallow((s) => ({ a: s.a, b: s.b })))
   ```

4. **全局 `subscribe` 优先用 `subscribeWithSelector`**，让中间件自动过滤无关更新：
   ```ts
   useStore.subscribe(
     (state) => state.x,       // 只关注 x
     () => doSomething(),       // x 变化时才触发
   )
   ```
   多字段时配合 `shallow`：
   ```ts
   useStore.subscribe(
     (s) => ({ a: s.a, b: s.b }),
     (selected) => doSomething(selected),
     { equalityFn: shallow },
   )
   ```

5. **`subscribe` 返回的取消函数必须在适当时机调用**，防止内存泄漏。

6. **action 内部用 `get()` 读取当前状态**，而不是闭包捕获外部变量。

### ❌ Don't

1. **不要在 `useEffect` 里用选择器订阅 store**——用 `getState()` 读快照即可。

2. **不要在非 React 代码里调用 store Hook**——`useStore((s) => s.x)` 只能在组件或自定义 Hook 内使用，在 service / handler 中会报错。用 `useStore.getState()` 代替。

3. **不要把整个 store 拿到组件里**除非你真的需要全部字段：
   ```ts
   // ❌ 除非 store 很小，否则不要这样
   const store = useConfigStore()
   ```

4. **不要用手动 `if (state.x !== prev.x)` 代替 `subscribeWithSelector`**——手动对比容易遗漏字段，且每次 `set` 都会进入回调：
   ```ts
   // ❌ 冗余，每次 set 都触发回调
   useStore.subscribe((state, prev) => {
     if (state.x !== prev.x) doSomething()
   })
   // ✅ 用 subscribeWithSelector，中间件自动过滤
   useStore.subscribe(
     (s) => s.x,
     () => doSomething(),
   )
   ```

5. **不要忘记 `persist` 的双层括号**（TypeScript 类型需要）：
   ```ts
   // ❌ 类型推导不正确
   create<Store>(persist(...))
   // ✅
   create<Store>()(persist(...))
   ```

---

## 九、本项目 Store 架构一览

| Store | 文件 | 职责 | 中间件 |
|-------|------|------|--------|
| `useGraphStore` | [graphStore.ts](src/store/graphStore.ts) | X6 Graph 实例、缩放比 | 无 |
| `useSubGraphStore` | [subGraphStore.ts](src/store/subGraphStore.ts) | 子系统数据、视图切换 | 无 |
| `useConfigStore` | [configStore.ts](src/store/configStore.ts) | 主题、语言、Stencil 配置 | `persist` |
| `useThemeToggleStore` | [useThemeToggle.ts](src/utils/hooks/useThemeToggle.ts) | 三态主题切换 | 无 |
| `flags` | [flags.ts](src/store/flags.ts) | 运行时标志位（不驱动 UI） | 无（非 zustand，纯模块变量） |

> `flags.ts` 是一个特殊设计：用 `export let` + setter 函数管理不需要触发 React 重渲染的运行时标志位，比 zustand 更轻量。

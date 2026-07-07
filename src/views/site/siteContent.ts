export type SiteLocale = 'zh' | 'en'

type SiteHeroCard = {
  title: string
  desc: string
}

type DocsSection = {
  title: string
  points: string[]
}

type DocsChapter = {
  slug: string
  title: string
  subtitle: string
  sections: DocsSection[]
  tips: string[]
  next?: { label: string; to: string }
}

type SiteCopy = {
  langLabel: string
  nav: { text: string; path: string }[]
  brand: {
    badge: string
    subtitle: string
    subtitleEn: string
  }
  cta: {
    primary: string
    secondary: string
  }
  home: {
    heroTitle: string
    heroDesc: string
    heroPoints: SiteHeroCard[]
    metrics: string[]
  }
  features: {
    pageTitle: string
    pageDesc: string
    cards: SiteHeroCard[]
  }
  scenarios: {
    pageTitle: string
    pageDesc: string
    cards: (SiteHeroCard & { task: string; expect: string })[]
  }
  solutions: {
    pageTitle: string
    pageDesc: string
    cards: SiteHeroCard[]
    checklist: string[]
  }
  playground: {
    pageTitle: string
    pageDesc: string
    steps: string[]
    highlights: string[]
    actions: { label: string; to: string }[]
  }
  about: {
    pageTitle: string
    pageDesc: string
    bullets: string[]
    roadmap: string[]
  }
  contact: {
    pageTitle: string
    pageDesc: string
    email: string
    resources: string[]
  }
  docs: {
    pageTitle: string
    pageDesc: string
    index: {
      intro: string
      points: string[]
    }
    chapters: DocsChapter[]
    sideTips: string[]
  }
}

const zh: SiteCopy = {
  langLabel: '中文',
  nav: [
    { text: '首页', path: '/' },
    { text: '体验区', path: '/playground' },
    { text: '功能', path: '/features' },
    { text: '场景', path: '/scenarios' },
    { text: '解决方案', path: '/solutions' },
    { text: '文档', path: '/docs' },
    { text: '关于', path: '/about' },
    { text: '联系', path: '/contact' },
  ],
  brand: {
    badge: 'M2PLAB',
    subtitle:
      '一个把“实验设备逻辑”变成可视化组件链路的平台，面向学生实验课程的远程控制场景。',
    subtitleEn:
      'Build remote-control experiment workflows with visual components, quickly and clearly.',
  },
  cta: {
    primary: '开始实验搭建',
    secondary: '查看示例实验',
  },
  home: {
    heroTitle: '从想法到远程实验，只需几分钟',
    heroDesc:
      '把设备控制逻辑拆成可视化模块，搭建、演练、导出，一条链路打通教学到仿真。',
    heroPoints: [
      {
        title: '可视化搭建',
        desc: '拖拽模块、双击空白快速添加，端口连接即生成实验逻辑。',
      },
      {
        title: '自动避让',
        desc: '连线智能绕避布局，保留手动优化路径的控制权。',
      },
      {
        title: '一键导出',
        desc: 'JSON、PNG、JPG、SVG 与打印，直接交付给教学平台或仿真服务。',
      },
    ],
    metrics: [
      '5 分钟内完成一条完整实验拓扑',
      '端口错误率显著下降，流程可复用性更高',
      '可直接对接远程设备控制与课程考核场景',
    ],
  },
  features: {
    pageTitle: '为什么学生依然能在 15 分钟内做出可交互实验拓扑？',
    pageDesc: '核心能力清单：界面、规则、路由、层级都为教学场景做了收敛。',
    cards: [
      {
        title: 'Block Diagram 编辑器',
        desc: '左侧块库、分组切换、检索过滤；双击空白新增；内联文本编辑。',
      },
      {
        title: '可控连接规则',
        desc: 'in/out 方向约束、端口一线一用；支持反向连接预览与连接复原。',
      },
      {
        title: '智能路由系统',
        desc: 'libavoid 自动避让优先，异常退化为曼哈顿路由，始终保持清晰。',
      },
      {
        title: '子系统建模',
        desc: '创建/嵌套子系统，内部 I/O 自动同步，支持多标签浏览和历史快照。',
      },
      {
        title: '参数模型联动',
        desc: '模块与子系统参数设置统一弹窗，参数可追踪导出。',
      },
      {
        title: '导入导出与复用',
        desc: 'JSON、图片、打印、DTO 导出，适配课程作业和教学演示。',
      },
    ],
  },
  scenarios: {
    pageTitle: '把实验课从“讲解”变“可操作”',
    pageDesc: '以下场景支持课程中直接落地，适合学生边讲边改。',
    cards: [
      {
        title: '温湿度控制',
        desc: '完整传感器-控制器-执行器链路，支持报警阈值联动。',
        task: '学生搭建温湿度闭环控制模型。',
        expect: '理解控制信号、反馈、饱和与保护策略。',
      },
      {
        title: '电机启停与速率控制',
        desc: '离散控制流程、限幅和异常断开安全网关。',
        task: '构建启动、减速与保护联动实验。',
        expect: '掌握安全约束下的控制编排。',
      },
      {
        title: '远程实验队列',
        desc: '同一模型模板可给多组实验共享参数与日志。',
        task: '基于参数组建模实现多实例并发。',
        expect: '完成多人课程批量部署。',
      },
      {
        title: '课程作业自动批改',
        desc: '导出 DTO 统一采集，便于老师脚本化比对。',
        task: '使用同一教学脚本检查同学提交。',
        expect: '减少人工核验时间。',
      },
    ],
  },
  solutions: {
    pageTitle: '学校、实验室、课程都能直接接入',
    pageDesc: '为教学闭环定制的解决方案。',
    cards: [
      {
        title: '课程实验',
        desc: '模板化实验任务，支持同课时多班级复用。',
      },
      {
        title: '导师演示',
        desc: '课堂实时调整拓扑并保存版本，学生立即查看差异。',
      },
      {
        title: '科研前置验证',
        desc: '在仿真前先做端口规则和连线校验，减少重复错误。',
      },
      {
        title: '项目赛道',
        desc: '图模型直接下发项目后端，形成标准化实验工件。',
      },
    ],
    checklist: [
      '对准端口方向与一线约束',
      '建立模型模板和参数范围',
      '使用快照版本固定课程标准答案',
      '导出统一模型用于后台评测',
    ],
  },
  playground: {
    pageTitle: '在线试着拼一条实验链路',
    pageDesc: '这里是课程核心体验区，不是装饰页。',
    steps: [
      '1) 从左侧块库选模块或双击空白生成',
      '2) 用 in/out 端口完成连接，自动路由即时反馈',
      '3) 打开参数面板设置变量，导出 JSON 或图片',
    ],
    highlights: [
      '支持右键菜单、键盘快捷操作、缩放平移',
      '支持分支边和子系统导航',
      '支持快速导出用于课程演示',
    ],
    actions: [
      { label: '打开 BlockDiagram', to: '/playground' },
      { label: '查看文档', to: '/docs' },
      { label: '继续看文档', to: '/docs' },
    ],
  },
  about: {
    pageTitle: '为学生实验而生的可视化控制组件平台',
    pageDesc: '聚焦远程控制课程的教学体验，而不是复杂代码门槛。',
    bullets: [
      '前端可视化编排引擎（块库、连接规则、子系统）',
      '路由与参数模型层（布局优化、参数传递、I/O 同步）',
      '数据导出与交付层（JSON、图片、DTO）',
    ],
    roadmap: [
      '实验模板市场（课程模板一键发布）',
      '团队协作与版本对比（多人协作）',
      '面向真实设备云端下发能力（任务调度）',
    ],
  },
  contact: {
    pageTitle: '联系我们',
    pageDesc:
      '如果你在做教学平台、课程实验或实验室远控系统，来聊一聊你的场景。',
    email: 'support@m2plab.example',
    resources: [
      '课程集成咨询（建议先带上课程目标）',
      '实验场景评审（先给出端口与控制链路）',
      '远程演示需求（包含设备类型和调用频率）',
    ],
  },
  docs: {
    pageTitle: '从第一次拖拽到实验下发：一步一步学会',
    pageDesc: '一个文档界面，左侧章节，右侧操作建议，支持快速上手。',
    index: {
      intro:
        '先从“学生最常见场景”开始：先看入口和操作，再看连接规则和导出链路。',
      points: [
        '完成一次完整建模不需要读完全部页面，只需读对章节顺序',
        '每章都可直接跳到练习任务与导出动作',
        '文档与演示保持同一命名规范，方便课程共享',
      ],
    },
    chapters: [
      {
        slug: 'chapter-1-why',
        title: '1. 我们在解决什么问题',
        subtitle:
          '远程实验中，连接错乱、布线复用困难、演示难复现是最常见困境。',
        sections: [
          {
            title: '课堂难题',
            points: [
              '控制链路依赖记忆，缺少统一端口规范',
              '布线复杂时很难快速定位错误',
              '教学内容难复用，版本迁移成本高',
            ],
          },
          {
            title: '产品定位',
            points: [
              '可视化构图让学生更快理解系统结构',
              '连接规则减少低级错误',
              '导出模型让复用和评估更标准',
            ],
          },
        ],
        tips: [
          '先用“温湿度控制”场景验证所有规则。',
          '每次新增模块先确认端口命名。',
        ],
      },
      {
        slug: 'chapter-2-get-started',
        title: '2. 5 分钟搭建你的第一条实验链路',
        subtitle:
          '按同一套路复现：打开画布 -> 放模块 -> 连线 -> 配参数 -> 导出。',
        sections: [
          {
            title: '操作流程',
            points: [
              '打开画布：使用右侧按钮切换视图和适配',
              '放置模块：点击块库并拖入，或双击空白区',
              '连接端口：满足 in/out 方向与端口占用约束即通过',
              '配置参数：节点与子系统参数在参数面板填写',
            ],
          },
          {
            title: '三件事先别改',
            points: [
              '不要先改复杂布局，先完成连线与参数',
              '先保存历史版本，再优化美观',
              '遇到异常先检查端口占用，再查路由失败',
            ],
          },
        ],
        tips: [
          '第一次导出建议先选 JSON 格式。',
          'PNG 用于课堂演示，SVG 用于文档插图。',
        ],
        next: {
          label: '继续读：连接与路由规则',
          to: '/docs/chapter-3-link-and-routing',
        },
      },
      {
        slug: 'chapter-3-link-and-routing',
        title: '3. 连接规则与自动路由',
        subtitle: '端口方向和连接约束是实验链路安全的第一道防线。',
        sections: [
          {
            title: '核心规则',
            points: [
              'in 只能接入输入方向，out 只能输出方向',
              '同一端口只允许一条边，避免逻辑歧义',
              '反向预览模式用于快速回看结构，不改变规则本体',
            ],
          },
          {
            title: '路由策略',
            points: [
              '优先尝试自动避让，尽量保持通路清晰',
              '若自动路由失败，回退曼哈顿规则保证连通',
              '分支边可通过 ctrl/drag 构建分叉关系',
            ],
          },
        ],
        tips: [
          '先别手工拖边，先检查端口名是否唯一。',
          '复杂交叉可放置中间模块缓解。',
        ],
        next: {
          label: '下一章：子系统建模',
          to: '/docs/chapter-4-subsystem',
        },
      },
      {
        slug: 'chapter-4-subsystem',
        title: '4. 子系统建模与层级导航',
        subtitle: '把复杂系统拆成子系统，保留接口边界和可复用性。',
        sections: [
          {
            title: '建模优势',
            points: [
              '子系统面包屑快速定位当前编辑上下文',
              'I/O 在进出子系统时同步，减少重复接线',
              '多标签便于跨场景切换和版本留存',
            ],
          },
          {
            title: '实践建议',
            points: [
              '先画出输入输出，再布置内部模块',
              '每次进入子系统先确认当前标签页',
              '快照用于课程发布和复盘回放',
            ],
          },
        ],
        tips: [
          '课程任务建议按“系统-子系统-模块”三级命名。',
          '导出前做一次页面适配与快照。',
        ],
        next: {
          label: '下一章：从图到模型下发',
          to: '/docs/chapter-5-export-and-deploy',
        },
      },
      {
        slug: 'chapter-5-export-and-deploy',
        title: '5. 从图到可执行模型',
        subtitle: '链路导出后，可直接被课程系统、教学平台或仿真服务使用。',
        sections: [
          {
            title: '导出入口',
            points: [
              'JSON：保存完整节点与连接描述',
              'DTO：对接下游服务的执行模型',
              '图片/打印：用于教学展示与作业归档',
            ],
          },
          {
            title: '教学流程',
            points: [
              '先验证规则，再导出；先导出标准，再截图说明',
              '同一任务保留不同版本快照，便于复盘',
              '导出文件命名加入课程、班级与日期',
            ],
          },
        ],
        tips: [
          '导出前用适配视图确认全画面是否完整。',
          '课程大作业建议同步输出图片和 JSON。',
        ],
      },
    ],
    sideTips: [
      '点击右侧“导出建议”对应动作，直接进入下一步。',
      '遇到问题先看章节顺序：问题定位 -> 规则修复 -> 再导出。',
      '你可以把“场景模板+参数模板”打包成课程包。',
    ],
  },
}

const en: SiteCopy = {
  langLabel: 'EN',
  nav: [
    { text: 'Home', path: '/' },
    { text: 'Playground', path: '/playground' },
    { text: 'Features', path: '/features' },
    { text: 'Scenarios', path: '/scenarios' },
    { text: 'Solutions', path: '/solutions' },
    { text: 'Docs', path: '/docs' },
    { text: 'About', path: '/about' },
    { text: 'Contact', path: '/contact' },
  ],
  brand: {
    badge: 'M2PLAB',
    subtitle:
      'A visual component workflow platform for remote-control experiments in student labs.',
    subtitleEn:
      'Build remote-control experiment workflows with visual components, quickly and clearly.',
  },
  cta: {
    primary: 'Start Build',
    secondary: 'View Demo',
  },
  home: {
    heroTitle: 'From idea to remote experiment in minutes',
    heroDesc:
      'Break experiment logic into visual components, build, simulate-ready flow, and export in one pass.',
    heroPoints: [
      {
        title: 'Drag-and-drop Build',
        desc: 'Add modules from stencil or double click canvas to start wiring quickly.',
      },
      {
        title: 'Auto Routing',
        desc: 'Smart avoidance keeps links clear while preserving manual layout control.',
      },
      {
        title: 'One-click Export',
        desc: 'JSON, PNG, JPG, SVG and print outputs for course delivery.',
      },
    ],
    metrics: [
      'A usable topology in under 15 minutes for student projects',
      'Fewer port mistakes with direction constraints',
      'Reproducible workflows for remote equipment labs',
    ],
  },
  features: {
    pageTitle: 'Can students finish an interactive topology in 15 minutes?',
    pageDesc:
      'Core capabilities are streamlined for teaching: editing, routing, hierarchy and deployment.',
    cards: [
      {
        title: 'Diagram Editor',
        desc: 'Left stencil, quick search, groups, and inline node title editing.',
      },
      {
        title: 'Connection Rules',
        desc: 'Port direction and occupancy constraints with reversible drag previews.',
      },
      {
        title: 'Smart Router',
        desc: 'libavoid-first routing with Manhattan fallback.',
      },
      {
        title: 'Subsystem Modeling',
        desc: 'Create/nest subsystems with synchronized internal I/O and quick tabs.',
      },
      {
        title: 'Parameter Binding',
        desc: 'Block and subsystem settings in one workflow, ready for export.',
      },
      {
        title: 'Reuse & Export',
        desc: 'JSON and media outputs with snapshot-based versioning.',
      },
    ],
  },
  scenarios: {
    pageTitle: 'Turn theory lessons into executable experiments',
    pageDesc: 'Designed for teaching scenes that need fast iteration.',
    cards: [
      {
        title: 'Temperature & Humidity Control',
        desc: 'Sensor-controller-actuator chain with alarm thresholding.',
        task: 'Build a closed-loop humidity control graph.',
        expect: 'Understand feedback and saturation behavior.',
      },
      {
        title: 'Motor Start/Stop & Speed Control',
        desc: 'Discrete logic with limit and protection edges.',
        task: 'Create an interlocked motor flow.',
        expect: 'Learn safe control sequencing.',
      },
      {
        title: 'Remote Experiment Queue',
        desc: 'Use one model template across multiple student groups.',
        task: 'Batch-run student instances with different parameters.',
        expect: 'Enable large-class practical sessions.',
      },
      {
        title: 'Auto-grading Practice',
        desc: 'Export DTO models for scripted grading.',
        task: 'Normalize grading with structured model artifacts.',
        expect: 'Lower manual review cost.',
      },
    ],
  },
  solutions: {
    pageTitle: 'Designed for schools, labs, and instructors',
    pageDesc: 'A practical solution template for remote experiment ecosystems.',
    cards: [
      {
        title: 'Course Workflows',
        desc: 'Template tasks, reusable to many classes.',
      },
      {
        title: 'Instructor Demo',
        desc: 'Live topology edit and saveable versions.',
      },
      {
        title: 'Research Pre-check',
        desc: 'Validate interface, routing and sequence before simulation.',
      },
      {
        title: 'Competition Pack',
        desc: 'Export workflow models for external systems.',
      },
    ],
    checklist: [
      'Validate port direction and occupancy',
      'Define parameter ranges as course standards',
      'Keep snapshots before each edit phase',
      'Export DTO for backend verification',
    ],
  },
  playground: {
    pageTitle: 'Build one working chain online',
    pageDesc: 'Hands-on zone. This is where course ideas become interactive.',
    steps: [
      '1) Pick modules from stencil or double-click canvas',
      '2) Connect ports and review route results',
      '3) Tune parameters and export JSON or media',
    ],
    highlights: [
      'Context menu, keyboard shortcuts, zoom and pan supported',
      'Branch edges and subsystem navigation',
      'Quick preview for teaching demos',
    ],
    actions: [
      { label: 'Open BlockDiagram', to: '/playground' },
      { label: 'Read docs', to: '/docs' },
      { label: 'Open docs', to: '/docs' },
    ],
  },
  about: {
    pageTitle: 'Built for remote-control lab learning',
    pageDesc: 'Focus on student learning, not framework complexity.',
    bullets: [
      'Visual editing engine: stencil, interactions and graph view',
      'Routing and parameter model: constraint-first workflow',
      'Export plane: JSON, media, and DTO delivery',
    ],
    roadmap: [
      'Template marketplace for course packs',
      'Team collaboration and version compare',
      'Cloud device dispatch pipeline',
    ],
  },
  contact: {
    pageTitle: 'Contact',
    pageDesc:
      'Tell us about your course, lab scene, or remote-control backend.',
    email: 'support@m2plab.example',
    resources: [
      'Course integration consulting',
      'Scenario design review',
      'Remote lab deployment planning',
    ],
  },
  docs: {
    pageTitle: 'From first drag to deployment',
    pageDesc:
      'One-reading layout: chapters on the left, content in center, actions on the right.',
    index: {
      intro:
        'Read in this order: overview -> routing -> subsystem -> export. Learn faster with small milestones.',
      points: [
        'You can finish a practical topology without reading everything',
        'Each chapter links to the next action',
        'Use shared naming to scale course operations',
      ],
    },
    chapters: [
      {
        slug: 'chapter-1-why',
        title: '1. What problem are we solving',
        subtitle:
          'In remote labs, broken wiring, hard reuse, and unrepeatable demos are common problems.',
        sections: [
          {
            title: 'Classroom pain points',
            points: [
              'Control chains rely on memory, with no fixed port semantics',
              'Debugging is slow when wiring is dense',
              'Course artifacts are hard to reuse across cohorts',
            ],
          },
          {
            title: 'Product focus',
            points: [
              'Visual models help students understand system structure',
              'Connection rules reduce avoidable mistakes',
              'Standardized artifacts make sharing and grading easy',
            ],
          },
        ],
        tips: [
          'Validate with humidity-temperature scene first.',
          'Confirm port naming before adding modules.',
        ],
      },
      {
        slug: 'chapter-2-get-started',
        title: '2. Build your first topology in 5 minutes',
        subtitle:
          'Use the flow: open canvas -> add modules -> connect ports -> configure -> export.',
        sections: [
          {
            title: 'Workflow',
            points: [
              'Open canvas and add modules from stencil or double-click white space',
              'Connect ports and keep direction and occupancy constraints',
              'Open parameters on node/subsystem and configure values',
            ],
          },
          {
            title: 'Do these first',
            points: [
              'Complete logic before fine-tuning layout',
              'Save version before visual optimization',
              'If errors appear, check ports and routing first',
            ],
          },
        ],
        tips: [
          'Export JSON first for first-time validation.',
          'Use PNG for class demo, SVG for documents.',
        ],
        next: {
          label: 'Continue: Links and routing',
          to: '/docs/chapter-3-link-and-routing',
        },
      },
      {
        slug: 'chapter-3-link-and-routing',
        title: '3. Connection rules and auto routing',
        subtitle:
          'Port direction and one-wire rules are the first safety line in any control chain.',
        sections: [
          {
            title: 'Core rules',
            points: [
              'in inputs accept only input edges',
              'out outputs emit only output edges',
              'only one edge can occupy one port',
            ],
          },
          {
            title: 'Routing strategy',
            points: [
              'Try avoid routing first and keep paths readable',
              'If it fails, Manhattan fallback ensures connectivity',
              'Use ctrl + drag for branch edges',
            ],
          },
        ],
        tips: [
          'Confirm unique port names before manual edge dragging.',
          'Add bridge modules when wiring overlaps.',
        ],
        next: {
          label: 'Next: Subsystem modeling',
          to: '/docs/chapter-4-subsystem',
        },
      },
      {
        slug: 'chapter-4-subsystem',
        title: '4. Subsystem modeling and hierarchy navigation',
        subtitle:
          'Split complex systems into reusable subsystems and keep interface boundaries.',
        sections: [
          {
            title: 'Why it works',
            points: [
              'Breadcrumbs help you locate current editing context quickly',
              'I/O sync reduces repeated rewiring',
              'Tabs help multi-context operations',
            ],
          },
          {
            title: 'Best practice',
            points: [
              'Draw I/O first, then place internal modules',
              'Check active tab before editing inside subsystem',
              'Snapshot before course milestone changes',
            ],
          },
        ],
        tips: [
          'Name by system-subsystem-module levels.',
          'Validate layout after every snapshot.',
        ],
        next: {
          label: 'Next: Export and deployment',
          to: '/docs/chapter-5-export-and-deploy',
        },
      },
      {
        slug: 'chapter-5-export-and-deploy',
        title: '5. From graph to executable model',
        subtitle:
          'Exported artifacts can be consumed by course systems and simulation backends.',
        sections: [
          {
            title: 'Export options',
            points: [
              'JSON keeps complete node/edge model',
              'DTO passes executable data to backend',
              'Image/Print for course evidence and review',
            ],
          },
          {
            title: 'Course process',
            points: [
              'Validate rules before export; standardize artifact first',
              'Keep per-assignment snapshots for review',
              'Name files with course and class tags',
            ],
          },
        ],
        tips: [
          'Verify full canvas with fit-view before export.',
          'For large assignments, output both JSON and image.',
        ],
      },
    ],
    sideTips: [
      'Use the action list to jump to the next required step',
      'If a link fails, check rule violations before route optimization',
      'Keep one template + one parameter profile per course',
    ],
  },
}

export const siteContent = { zh, en } as const

<p align="center">
  <img src="public/brand/logo.svg" width="88" height="88" alt="ReplenOps logo">
</p>

<h1 align="center">ReplenOps</h1>

<p align="center">面向门店、仓库与运营团队的订货和库存协同平台</p>

<p align="center">
  <a href="https://github.com/iiwish/ReplenOps/actions/workflows/ci.yml"><img src="https://github.com/iiwish/ReplenOps/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-1677ff" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20-43853d" alt="Node.js 20 or newer">
</p>

ReplenOps 将门店订货、审批、库存锁定、仓库履约和审计记录组织在同一套工作流中。项目同时提供桌面管理端和移动订货端，适合连锁门店、内部领用及小型供应网络自行部署和二次开发。

## 核心能力

- **主数据管理**：商品、分类、仓库、门店、用户与包装物档案
- **订货履约**：门店下单、审批、撤回、库存锁定及订单状态跟踪
- **库存作业**：入库、出库、库存调整、低库存查询与成本变动记录
- **权限与审计**：基于角色的访问控制、关键操作授权与追加式审计历史
- **双端体验**：桌面管理端与移动订货端，可按域名拆分访问入口
- **安全部署**：版本化数据库迁移、容器最小权限、敏感信息扫描与依赖审计

项目聚焦订货和库存协同。财务总账、人力资源、客户关系、采购合同和外部系统持续同步不在当前范围内。外部系统集成应由独立服务和专用映射表承担；本仓库不保存外部数据库凭据、内部部署拓扑或真实业务数据。

## 业务流程

```text
门店提交订单 -> 审批与库存锁定 -> 仓库出库 -> 门店确认履约
                     |
                     +-> 库存、成本、包装物与审计记录
```

软删除用于保留可审计的主数据生命周期；历史单据通过快照保持可读。库存、订单和成本相关的多表写入由 Service 层通过 Prisma transaction 保证一致性。

## 技术架构

| 层级 | 技术与职责                                       |
| ---- | ------------------------------------------------ |
| Web  | Next.js 16、React 19、TypeScript strict          |
| UI   | Ant Design、Radix UI、Tailwind CSS、Lucide Icons |
| 应用 | Server Components、Server Actions、Zod、RBAC     |
| 数据 | PostgreSQL 17、Prisma、版本化 migrations         |
| 缓存 | Redis（可选）；单实例可使用进程内缓存            |
| 测试 | Vitest、Playwright                               |
| 交付 | Docker、GitHub Actions、CodeQL、Gitleaks、Trivy  |

核心目录：

```text
src/app/          页面、路由与 Server Actions 入口
src/actions/      输入校验和授权业务操作
src/services/     业务逻辑与数据库访问
src/components/   管理端、移动端与通用组件
src/lib/          认证、权限、策略与共享工具
prisma/           Schema、migrations、seed 与管理员初始化
tests/            单元测试和端到端测试
deploy/           Dockerfile 与 Compose 部署定义
public/           可替换品牌资源和站内静态图片
```

## 快速开始

### 环境要求

- Node.js 20 或更高版本
- npm 9 或更高版本
- PostgreSQL 17

### 本地开发

```bash
git clone https://github.com/iiwish/ReplenOps.git
cd ReplenOps
npm ci
cp .env.example .env
npm run db:prepare
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。`db:prepare` 会部署 migration、写入幂等基础数据，并在管理员账号不存在时创建初始账号。请在运行前替换 `.env` 中的示例密码和 JWT 密钥。

### Docker Compose

```bash
cp .env.example .env
docker compose -f deploy/compose.yml up --build
```

应用默认只绑定 `127.0.0.1:3000`。生产环境应通过具备 TLS 的反向代理对外提供服务，并使用独立的密钥管理与数据库备份方案。

## 配置

| 变量                     | 必填 | 用途                           |
| ------------------------ | ---- | ------------------------------ |
| `DATABASE_URL`           | 是   | PostgreSQL 连接地址            |
| `JWT_SECRET`             | 是   | 至少 32 个字符的随机 JWT 密钥  |
| `ADMIN_INITIAL_PASSWORD` | 是   | 初始管理员密码，至少 12 个字符 |
| `ADMIN_USERNAME`         | 否   | 初始管理员用户名，默认 `admin` |
| `REDIS_URL`              | 否   | Redis 地址；多实例部署建议配置 |
| `APP_ENV`                | 否   | 运行环境标识                   |
| `ADMIN_HOSTS`            | 否   | 管理端允许的域名列表           |
| `MOBILE_HOSTS`           | 否   | 移动端允许的域名列表           |
| `CANONICAL_ADMIN_HOST`   | 否   | 管理端规范域名                 |
| `CANONICAL_MOBILE_HOST`  | 否   | 移动端规范域名                 |
| `COOKIE_DOMAIN`          | 否   | 跨子域会话 Cookie 域           |

不要提交 `.env`、真实账号、生产数据、日志、测试报告或本地 Agent 状态。数据库结构以 `prisma/schema.prisma` 和 `prisma/migrations` 为准，部署环境使用 `npm run db:deploy`，不要用 `prisma db push` 替代 migration。

## 品牌与图片

品牌配置集中在 `src/config/brand.ts`。Fork 后可以直接替换以下资源：

| 文件                                    | 用途                               |
| --------------------------------------- | ---------------------------------- |
| `public/brand/logo.svg`                 | 登录页、管理端侧栏和浏览器图标     |
| `public/icons/icon-192x192.png`         | Apple Touch Icon 与小尺寸 PWA 图标 |
| `public/icons/icon-512x512.png`         | 大尺寸 PWA 图标                    |
| `public/images/product-placeholder.svg` | 商品无图片或加载失败时的占位图     |

商品图片支持两种来源：将文件放入 `public/images/products/` 并填写 `/images/products/example.jpg`，或填写完整的 HTTP(S) 图片 URL。外部图片由浏览器直接加载，不需要在 `next.config.js` 中绑定特定对象存储域名；建议生产部署使用可信的 HTTPS 图片源。

## 常用命令

```bash
npm run db:migrate          # 开发环境创建 Prisma migration
npm run db:deploy           # 部署已有 migration
npm run db:seed             # 写入幂等基础数据
npm run db:bootstrap-admin  # 创建不存在的初始管理员
npm run db:studio           # 打开 Prisma Studio

npm test                    # 单元测试
npm run test:coverage       # 覆盖率检查
npm run type-check          # TypeScript 检查
npm run lint                # ESLint
npm run build               # 生产构建
npm run test:e2e            # Playwright 端到端测试
npm run audit               # 依赖漏洞审计
```

GitHub Actions 会执行单元测试、覆盖率、类型检查、Lint、生产构建、E2E、依赖审计、敏感信息扫描、运行镜像漏洞扫描和 CodeQL。

## 参与贡献

请先阅读[贡献指南](.github/CONTRIBUTING.md)和[行为准则](.github/CODE_OF_CONDUCT.md)。行为变更需要测试；数据库变更必须包含 Prisma migration；受保护页面和操作必须执行 RBAC 检查。

安全问题请通过 GitHub Private Vulnerability Reporting 私下报告，具体要求见[安全策略](.github/SECURITY.md)。不要在公开 Issue 或 Pull Request 中披露漏洞细节、凭据或个人数据。

## 许可证

ReplenOps 由 **iiwish** 持有版权，并根据 [MIT License](LICENSE) 开源。项目包含的第三方源代码及其许可见 [Third-Party Notices](THIRD_PARTY_NOTICES.md)。

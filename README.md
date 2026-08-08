# ReplenOps

**门店订货与库存协同平台**

ReplenOps 面向门店、仓库和运营团队，提供从门店订货、审批、库存锁定到入库、出库和审计的协同工作流。项目包含桌面管理端与移动端，适合小型连锁门店或内部供应场景按需部署。

## 功能范围

- 商品、分类、仓库、门店与包装物档案
- 门店订货、订单审批、库存锁定与履约
- 入库、出库、库存调整、库存与成本变动记录
- 门店管理员、角色权限与账号管理
- 报货时间配置、操作审计与基础库存报表
- 管理端与移动端入口，可选双域名路由

ReplenOps 聚焦订货和库存协同。财务总账、薪资、人力资源、客户关系、采购合同等完整企业管理能力不在当前范围内。外部系统迁移与持续同步由独立集成服务承担，不在本仓库中保存源系统凭据、同步脚本或源系统标识字段。

## 技术栈

- Next.js 16、React 19、TypeScript
- PostgreSQL、Prisma
- Ant Design、Radix UI、Tailwind CSS
- Vitest、Playwright、GitHub Actions

## 本地运行

要求 Node.js 20 或更高版本，以及 PostgreSQL 17。

```bash
npm install
cp .env.example .env
npm run db:prepare
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。首次执行 `db:prepare` 会创建数据表、报货时间配置和超级管理员账号。管理员 bootstrap 只在账号不存在时创建账号；后续执行不会重置密码、恢复状态或覆盖角色。请在 `.env` 中设置自己的 `ADMIN_INITIAL_PASSWORD`，不要沿用示例值。

使用 Docker Compose 时：

```bash
cp .env.example .env
docker compose -f deploy/compose.yml up --build
```

## 项目结构

- `src/`：应用页面、组件、Actions、Services 与共享代码
- `prisma/`：数据库 schema、migration 与基础 seed
- `tests/`：单元测试和端到端测试
- `config/`：测试工具配置
- `deploy/`：通用容器构建和本地 Compose 定义

## 配置

必填配置：

| 变量                     | 用途                             |
| ------------------------ | -------------------------------- |
| `DATABASE_URL`           | PostgreSQL 连接地址              |
| `JWT_SECRET`             | 至少 32 个字符的随机 JWT 密钥    |
| `ADMIN_INITIAL_PASSWORD` | 初始化管理员密码，至少 12 个字符 |

可选配置包括 `ADMIN_USERNAME`、`REDIS_URL`、`APP_ENV`、`ADMIN_HOSTS`、`MOBILE_HOSTS`、`CANONICAL_ADMIN_HOST`、`CANONICAL_MOBILE_HOST` 和 `COOKIE_DOMAIN`。未配置 Redis 时，单实例部署会使用进程内缓存。

## 数据库

```bash
npm run db:migrate   # 开发环境创建迁移
npm run db:deploy    # 部署已有迁移
npm run db:seed      # 写入幂等基础数据
npm run db:bootstrap-admin # 仅在账号不存在时创建初始管理员
npm run db:studio    # 打开 Prisma Studio
```

数据库结构以 `prisma/schema.prisma` 和 `prisma/migrations` 为准。部署环境必须通过 Prisma migration 管理结构，避免使用 `prisma db push` 代替版本化迁移。

### 数据完整性

- 商品、分类、仓库、门店、包装物和用户采用可审计软删除；恢复时复用原记录与原 ID，编码不重新分配。
- 库存、活动订单和活动出入库单会阻止相关主数据归档，历史单据通过商品与门店快照保持可读。
- 库存、订单明细、出入库明细和成本历史通过外键禁止物理删除已被引用的商品。
- 审批、库存、成本和包装物变动日志属于追加式历史，不通过软删除隐藏或改写。
- 外部同步完成后必须执行聚合核对和逻辑孤儿检查，任何差异都会使无人值守同步失败。

## 质量检查

```bash
npm test
npm run test:coverage
npm run type-check
npm run lint
npm run build
npm run test:e2e
npm run audit
```

GitHub Actions 会执行测试与覆盖率、类型检查、Lint、构建、E2E、依赖审计、敏感信息扫描、运行镜像漏洞扫描，并在公开仓库中执行 CodeQL。

## 贡献与安全

贡献方式见 [贡献指南](.github/CONTRIBUTING.md)。安全问题请按照 [安全策略](.github/SECURITY.md) 私下报告，不要在公开 Issue 中提交密码、Token、个人信息或部署拓扑。

## 许可证

[MIT License](LICENSE) © 2026 iiwish

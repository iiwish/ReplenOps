# 参与贡献

感谢你参与 ReplenOps。提交代码前，请先通过 Issue 描述问题或目标，避免在未对齐范围时投入大规模重构。

## 开发流程

1. Fork 仓库并从 `main` 创建功能分支。
2. 安装依赖，复制 `.env.example`，并准备独立的本地数据库。
3. 遵循现有的 Actions、Services 和数据访问边界。
4. 为行为变更补充测试，不提交真实账号、个人数据或部署配置。
5. 提交 Pull Request，并说明问题、实现、验证方式和数据结构影响。

提交前运行：

```bash
npm test
npm run type-check
npm run lint
npm run build
npm run test:e2e
```

数据库结构变更必须提交 Prisma migration。一个业务操作涉及多表写入时，应使用事务保证一致性。

## 代码约定

- TypeScript 使用 strict 模式，不使用 `any`、`@ts-ignore` 或 `@ts-expect-error`。
- 路由与 Server Actions 保持轻量，业务逻辑放在 Service 层。
- 用户输入使用 Zod 校验，受保护页面和操作执行权限检查。
- 保持变更范围清晰，不在功能提交中夹带无关重构。

## 依赖维护

- npm 依赖保留 Dependabot 安全告警和安全更新，常规版本更新 PR 处于暂停状态。
- 普通升级按月由维护者人工选择有明确收益和范围的批次，不以清空 PR 或追齐最新版本为目标。该流程不自动创建任务或执行升级。
- GitHub Actions 和 Docker 保留每月更新检查；Node 大版本迁移需单独评估。
- Prisma、Vitest 和 TypeScript ESLint 等配套依赖必须一起核对。大版本升级、框架兼容问题和运行时要求变更单独评估。
- 依赖变更执行完整 CI 和 `npm run audit`。不得使用 `--force`、`--legacy-peer-deps`、放宽测试或关闭安全检查来绕过失败。
- 批次完成后停止处理新出现的普通更新；安全修复按风险优先处理。关闭或延后的升级保留处理理由，不能将其描述为已实现。

提交即表示你同意以本项目的 MIT License 发布贡献。

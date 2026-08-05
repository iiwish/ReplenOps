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

提交即表示你同意以本项目的 MIT License 发布贡献。

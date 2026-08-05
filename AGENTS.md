# ReplenOps 开发指南

## 产品边界

ReplenOps 是门店订货与库存协同平台。核心范围包括商品与门店档案、订货审批、库存锁定、入出库、库存调整、包装物台账、权限与审计。完整财务、人力、客户关系和外部系统同步不在本仓库范围内。

外部系统集成使用独立服务和专用映射表。业务表不保存外部系统编码，仓库不包含外部数据库凭据、同步实现、内部部署拓扑或真实业务数据。

## 工程约束

- TypeScript 保持 strict，不使用 `any`、`@ts-ignore` 或 `@ts-expect-error`。
- 数据库操作通过 Service 层；多表写入使用 Prisma transaction。
- 输入使用 Zod 校验；受保护页面和操作执行 RBAC 检查。
- 默认使用 Server Components，仅在需要浏览器交互时使用 Client Components。
- 数据库变更必须创建并提交 Prisma migration，不使用 `prisma db push` 替代迁移。
- 不提交 `.env`、凭据、个人信息、生产数据、测试报告或本地 Agent 状态。

## 验证

按变更风险执行相关测试，提交前至少运行：

```bash
npm test
npm run type-check
npm run lint
npm run build
```

关键用户流程或页面变更同时运行 `npm run test:e2e`。依赖变更运行 `npm run audit`。

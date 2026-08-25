import { z } from 'zod'

export const USER_ROLE_VALUES = [
  'SUPER_ADMIN',
  'WAREHOUSE_MANAGER',
  'STORE_ADMIN',
  'FINANCE',
  'APPROVER',
] as const

export const ROLE_OPTIONS: ReadonlyArray<{
  value: (typeof USER_ROLE_VALUES)[number]
  label: string
}> = [
  { value: 'SUPER_ADMIN', label: '超级管理员' },
  { value: 'WAREHOUSE_MANAGER', label: '仓库管理员' },
  { value: 'STORE_ADMIN', label: '门店管理员' },
  { value: 'FINANCE', label: '财务' },
  { value: 'APPROVER', label: '审批人' },
]

export type UserRole = (typeof USER_ROLE_VALUES)[number]

const USER_ROLE_SET = new Set<string>(USER_ROLE_VALUES)
const userRolesSchema = z.array(
  z.string().refine((role) => USER_ROLE_SET.has(role), '包含无效的用户角色')
)

export const userListSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  search: z.string().optional(),
})

export const userCreateSchema = z.object({
  username: z.string().min(3, '登录名至少3个字符').max(50, '登录名最多50个字符'),
  password: z.string().min(6, '密码至少6个字符').max(100, '密码最多100个字符'),
  name: z.string().min(1, '姓名不能为空').max(100, '姓名最多100个字符'),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional()
    .or(z.literal('')),
  roles: userRolesSchema.min(1, '请至少选择一个角色'),
})

export const userUpdateSchema = z.object({
  username: z.string().min(3, '登录名至少3个字符').max(50, '登录名最多50个字符').optional(),
  password: z
    .string()
    .min(6, '密码至少6个字符')
    .max(100, '密码最多100个字符')
    .optional()
    .or(z.literal('')),
  name: z.string().min(1, '姓名不能为空').max(100, '姓名最多100个字符'),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional()
    .or(z.literal('')),
  isActive: z.boolean().optional(),
  roles: userRolesSchema.min(1, '请至少选择一个角色'),
})

export type UserListInput = z.infer<typeof userListSchema>
export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>

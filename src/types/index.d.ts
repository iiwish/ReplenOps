// Global type definitions for ReplenOps

// User roles
export type UserRole =
  | 'super_admin'
  | 'warehouse_manager'
  | 'store_admin'
  | 'finance'
  | 'approver'

// Order status
export type OrderStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'completed'
  | 'cancelled'

// Stock status
export type StockStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'completed'
  | 'cancelled'

// Goods measure type
export type GoodsMeasureType = 'int' | 'decimal'

// Inventory change type
export type InventoryChangeType =
  | 'in'
  | 'out'
  | 'return'
  | 'adjustment'

// Container operation type
export type ContainerOpType =
  | 'borrow'
  | 'return'
  | 'adjustment'

// User session
export interface UserSession {
  id: string
  username: string
  email: string
  role: UserRole
  storeIds?: string[]
  warehouseIds?: string[]
}

// API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Pagination
export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

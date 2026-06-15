import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.vercel/**',
      'out/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    files: ['*.js', 'scripts/**/*.js', 'tests/**/*.js', '__tests__/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['scripts/private-tools/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: [
      'src/app/mobile/home/page.tsx',
      'src/components/PlatformSwitch.tsx',
      'src/components/admin/ScheduleEditor.tsx',
      'src/components/mobile/ContainerReturnForm.tsx',
      'src/components/mobile/order/QuantityInput.tsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  {
    files: [
      'src/app/admin/audit-logs/[id]/page.tsx',
      'src/app/admin/order-approval/ApprovalListClient.tsx',
      'src/app/admin/order-approval/[id]/ApprovalDetailClient.tsx',
      'src/app/admin/orders/OrderListClient.tsx',
      'src/app/admin/orders/[id]/OrderDetailClient.tsx',
      'src/app/admin/reports/profit/page.tsx',
      'src/app/admin/reports/sales/page.tsx',
      'src/app/admin/stores/[id]/admins/StoreAdminsClient.tsx',
      'src/app/mobile/container-tracking/page.tsx',
      'src/app/mobile/orders/OrdersClientPage.tsx',
      'src/components/admin/containers/ContainerReturnList.tsx',
      'src/components/admin/containers/TrackingSummary.tsx',
      'src/components/admin/containers/TrackingTable.tsx',
      'src/components/admin/orders/RevokeOrderModal.tsx',
      'src/components/mobile/order/QRScanner.tsx',
    ],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    files: ['src/app/mobile/inventory/scan/InventoryScanClient.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
]

export default config

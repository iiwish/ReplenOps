'use client'

import { Table } from 'antd'
import type { TableProps } from 'antd'

/**
 * Shared table primitive for admin list pages.
 * The `y` scroll value makes Ant Design render a separate, fixed header;
 * the list-page styles give the body the available height to scroll in.
 */
export default function AdminListTable<RecordType extends object>(props: TableProps<RecordType>) {
  const rootClassName = [props.rootClassName, 'admin-list-table'].filter(Boolean).join(' ')

  return (
    <Table<RecordType>
      {...props}
      rootClassName={rootClassName}
      scroll={{ ...props.scroll, y: '100%' }}
    />
  )
}

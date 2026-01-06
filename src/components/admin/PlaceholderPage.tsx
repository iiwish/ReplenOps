import { Empty } from 'antd'

interface PlaceholderPageProps {
  title: string
  description?: string
}

export default function PlaceholderPage({
  title,
  description = '该功能正在开发中，敬请期待...',
}: PlaceholderPageProps) {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        {title}
      </h1>
      <Empty
        description={description}
        style={{
          marginTop: 100,
        }}
      />
    </div>
  )
}

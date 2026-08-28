import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('container return navigation', () => {
  it('keeps the return request action out of the warehouse acceptance list', () => {
    const returnList = readSource('src/components/admin/containers/ContainerReturnList.tsx')

    expect(returnList).not.toContain('/admin/container-return/new')
    expect(returnList).not.toContain('登记归还')
    expect(returnList).not.toContain('代门店提交')
    expect(returnList).toContain('确认验收')
  })

  it('consolidates packaging operations into one workspace and preserves legacy links', () => {
    const workspace = readSource('src/app/admin/containers/ContainerWorkspaceClient.tsx')
    const trackingRoute = readSource('src/app/admin/container-tracking/page.tsx')
    const returnRoute = readSource('src/app/admin/container-return/page.tsx')

    expect(workspace).toContain("label: '在外包装物'")
    expect(workspace).toContain("label: '归还验收'")
    expect(workspace).toContain("label: '全部台账'")
    expect(workspace).toContain("label: '包装物设置'")
    expect(trackingRoute).toContain("'/admin/containers?view=outstanding'")
    expect(returnRoute).toContain("redirect('/admin/containers?view=returns')")
  })

  it('supports multi-item mobile returns with real packaging units and one page title', () => {
    const mobileForm = readSource('src/components/mobile/ContainerReturnForm.tsx')
    const mobileLayout = readSource('src/components/mobile/MobileLayoutClient.tsx')
    const mobileTracking = readSource('src/app/mobile/container-tracking/page.tsx')

    expect(mobileForm).toContain('items: selectedItems.map')
    expect(mobileForm).toContain('container.containerUnit')
    expect(mobileForm).not.toContain('selectedContainer')
    expect(mobileForm).not.toContain('ArrowLeftOutlined')
    expect(mobileLayout).toContain("'/mobile/container-return': '包装物归还'")
    expect(mobileTracking).not.toContain('<h1')
    expect(mobileTracking).toContain('tracking.containerUnit')
  })

  it('keeps packaging navigation and mobile data aligned with the latest selection', () => {
    const workspace = readSource('src/app/admin/containers/ContainerWorkspaceClient.tsx')
    const mobileForm = readSource('src/components/mobile/ContainerReturnForm.tsx')

    expect(workspace).toContain('activeKey={initialView}')
    expect(mobileForm).toContain('const loadRequestId = useRef(0)')
    expect(mobileForm).toContain('requestId !== loadRequestId.current')
    expect(mobileForm).toContain('setShowConfirm(false)')
  })

  it('mounts the packaging form only while the modal is open', () => {
    const containers = readSource('src/app/admin/containers/ContainersListClient.tsx')

    expect(containers).not.toContain('forceRender')
    expect(containers).toContain('destroyOnHidden')
    expect(containers).toContain('formState &&')
  })
})

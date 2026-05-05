import { Card, Typography } from 'antd'

const { Paragraph, Title } = Typography

export default function ProfitReportPage() {
  return (
    <div className="p-6">
      <Card>
        <Title level={2}>利润分析已不适用于当前业务</Title>
        <Card className="mb-4" type="inner" title="当前项目是企业内部自营门店的存货管理系统">
          <Paragraph>
            门店报货/下单用于内部库存流转，不需要门店实付结算，因此不存在面向门店交易的利润分析口径。
          </Paragraph>
        </Card>
        <Paragraph>
          后续报表请以库存报表、出入库记录、门店领用统计等内部存货管理指标为准；如果需要财务口径分析，应先明确独立的成本分摊与结算规则后再新增专门报表。
        </Paragraph>
      </Card>
    </div>
  )
}

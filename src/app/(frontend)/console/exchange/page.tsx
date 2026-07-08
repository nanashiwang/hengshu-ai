import { Section } from '@/components/console/ConsoleUI'
import { ExchangePanel } from '@/components/console/ExchangePanel'

export const dynamic = 'force-dynamic'

// 控制台·贡献值兑换 credit（鉴权由 console/layout 统一处理）
export default function ExchangePage() {
  return (
    <Section title="贡献值兑换 credit">
      <ExchangePanel />
    </Section>
  )
}

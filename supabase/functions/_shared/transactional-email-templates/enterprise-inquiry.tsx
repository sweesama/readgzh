import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ReadGZH'

interface EnterpriseInquiryProps {
  companyName?: string
  contactName?: string
  email?: string
  phone?: string
  taxId?: string
  plan?: string
  billingCycle?: string
  invoiceType?: string
  note?: string
}

const Row = ({ label, value }: { label: string; value?: string }) => (
  <Text style={row}>
    <strong style={rowLabel}>{label}：</strong>
    {value || '—'}
  </Text>
)

const EnterpriseInquiryEmail = ({
  companyName, contactName, email, phone, taxId, plan, billingCycle, invoiceType, note,
}: EnterpriseInquiryProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head>
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta charSet="utf-8" />
    </Head>
    <Preview>企业采购需求：{companyName || '未填写公司'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🏢 新的企业采购需求</Heading>
        <Container style={box}>
          <Row label="公司全称" value={companyName} />
          <Row label="联系人" value={contactName} />
          <Row label="邮箱" value={email} />
          <Row label="电话 / 微信" value={phone} />
          <Row label="纳税人识别号" value={taxId} />
          <Row label="意向方案" value={plan} />
          <Row label="计费方式" value={billingCycle} />
          <Row label="发票需求" value={invoiceType} />
        </Container>
        <Text style={text}><strong>备注：</strong></Text>
        <Container style={quoteBox}>
          <Text style={quoteText}>{note || '（无）'}</Text>
        </Container>
        <Hr style={hr} />
        <Text style={footer}>此邮件来自 {SITE_NAME} 企业采购表单</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EnterpriseInquiryEmail,
  subject: (data: Record<string, any>) => `[ReadGZH] 企业采购需求 - ${data.companyName || '未填写公司'}`,
  displayName: '企业采购需求通知',
  previewData: {
    companyName: '示例科技有限公司',
    contactName: '张三',
    email: 'zhangsan@example.com',
    phone: '13800000000',
    taxId: '91310000MA1XXXXXXX',
    plan: '企业版（12,000 积分/月）',
    billingCycle: '年付',
    invoiceType: '电子增值税普通发票',
    note: '预计每月读取 3000 篇文章，需要订单确认书。',
  },
  to: 'sweeyeah@gmail.com',
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#1a2b3c', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 8px' }
const box = { backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px', margin: '0 0 20px' }
const row = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 6px' }
const rowLabel = { color: '#1a2b3c' }
const quoteBox = { backgroundColor: '#f0faf6', borderLeft: '3px solid hsl(165, 60%, 40%)', padding: '12px 16px', margin: '0 0 20px', borderRadius: '0 6px 6px 0' }
const quoteText = { fontSize: '14px', color: '#333', lineHeight: '1.5', margin: '0', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999', margin: '0' }

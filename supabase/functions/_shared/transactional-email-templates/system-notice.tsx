import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ReadGZH'

interface SystemNoticeProps {
  title?: string
  content?: string
  greeting?: string
}

const SystemNoticeEmail = ({ title, content, greeting }: SystemNoticeProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head>
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta charSet="utf-8" />
    </Head>
    <Preview>{title || '来自 ReadGZH 的通知'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{title || '系统通知'}</Heading>
        {greeting && <Text style={text}>{greeting}</Text>}
        <Container style={contentBox}>
          <Text style={contentText}>{content || '（无内容）'}</Text>
        </Container>
        <Hr style={hr} />
        <Text style={footer}>此邮件来自 {SITE_NAME}，如有疑问请回复此邮件。</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SystemNoticeEmail,
  subject: (data: Record<string, any>) => data.title || `[ReadGZH] 系统通知`,
  displayName: '系统通知',
  previewData: {
    title: '关于您账户积分的一点补偿',
    greeting: 'Lex 您好，',
    content: '感谢您使用 ReadGZH！我们近期在系统升级过程中发现您的账户积分出现了异常，对此深表歉意。目前问题已修复，并额外赠送了 100 积分作为补偿。',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#1a2b3c', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 16px' }
const contentBox = { backgroundColor: '#f9fafb', borderLeft: '3px solid hsl(165, 60%, 40%)', padding: '12px 16px', margin: '0 0 20px', borderRadius: '0 6px 6px 0' }
const contentText = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0', whiteSpace: 'pre-line' as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999', margin: '0' }

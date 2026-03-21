import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ReadGZH'

interface NewCommentProps {
  userName?: string
  commentContent?: string
  commentUrl?: string
}

const NewCommentEmail = ({ userName, commentContent, commentUrl }: NewCommentProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head />
    <Preview>有新留言：{commentContent?.slice(0, 40) || '查看详情'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>📝 新留言通知</Heading>
        <Text style={text}>
          <strong>{userName || '匿名用户'}</strong> 在 {SITE_NAME} 留言板发布了新留言：
        </Text>
        <Container style={quoteBox}>
          <Text style={quoteText}>{commentContent || '（无内容）'}</Text>
        </Container>
        {commentUrl && (
          <Button style={button} href={commentUrl}>查看留言</Button>
        )}
        <Hr style={hr} />
        <Text style={footer}>此邮件来自 {SITE_NAME} 管理通知</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewCommentEmail,
  subject: (data: Record<string, any>) => `[ReadGZH] 新留言 - ${data.userName || '匿名用户'}`,
  displayName: '新留言通知',
  previewData: {
    userName: '测试用户',
    commentContent: '这个工具太好用了！',
    commentUrl: 'https://readgzh.site/comments',
  },
  to: 'sweeyeah@hotmail.com',
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#1a2b3c', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 16px' }
const quoteBox = { backgroundColor: '#f0faf6', borderLeft: '3px solid hsl(165, 60%, 40%)', padding: '12px 16px', margin: '0 0 20px', borderRadius: '0 6px 6px 0' }
const quoteText = { fontSize: '14px', color: '#333', lineHeight: '1.5', margin: '0' }
const button = { backgroundColor: 'hsl(165, 60%, 40%)', color: '#ffffff', padding: '10px 20px', borderRadius: '6px', fontSize: '14px', textDecoration: 'none' as const, display: 'inline-block' as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999', margin: '0' }

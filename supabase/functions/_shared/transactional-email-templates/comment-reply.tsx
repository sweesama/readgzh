import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ReadGZH'

interface CommentReplyProps {
  replierName?: string
  replyContent?: string
  originalContent?: string
  commentUrl?: string
}

const CommentReplyEmail = ({ replierName, replyContent, originalContent, commentUrl }: CommentReplyProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head />
    <Preview>{replierName || '有人'} 回复了你的留言</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>💬 你的留言收到了回复</Heading>
        <Text style={text}>你在 {SITE_NAME} 留言板的留言收到了新回复：</Text>
        {originalContent && (
          <>
            <Text style={labelText}>你的留言：</Text>
            <Container style={originalBox}>
              <Text style={quoteText}>{originalContent}</Text>
            </Container>
          </>
        )}
        <Text style={labelText}><strong>{replierName || '匿名用户'}</strong> 的回复：</Text>
        <Container style={replyBox}>
          <Text style={quoteText}>{replyContent || '（无内容）'}</Text>
        </Container>
        {commentUrl && (
          <Button style={button} href={commentUrl}>查看回复</Button>
        )}
        <Hr style={hr} />
        <Text style={footer}>此邮件来自 {SITE_NAME} 留言通知</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CommentReplyEmail,
  subject: (data: Record<string, any>) => `[ReadGZH] ${data.replierName || '有人'}回复了你的留言`,
  displayName: '留言回复通知',
  previewData: {
    replierName: '管理员',
    replyContent: '感谢你的反馈，我们会考虑的！',
    originalContent: '这个工具太好用了！',
    commentUrl: 'https://readgzh.site/comments',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#1a2b3c', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 16px' }
const labelText = { fontSize: '13px', color: '#888', margin: '0 0 6px' }
const originalBox = { backgroundColor: '#f5f5f5', borderLeft: '3px solid #ccc', padding: '10px 14px', margin: '0 0 16px', borderRadius: '0 6px 6px 0' }
const replyBox = { backgroundColor: '#f0faf6', borderLeft: '3px solid hsl(165, 60%, 40%)', padding: '10px 14px', margin: '0 0 20px', borderRadius: '0 6px 6px 0' }
const quoteText = { fontSize: '14px', color: '#333', lineHeight: '1.5', margin: '0' }
const button = { backgroundColor: 'hsl(165, 60%, 40%)', color: '#ffffff', padding: '10px 20px', borderRadius: '6px', fontSize: '14px', textDecoration: 'none' as const, display: 'inline-block' as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999', margin: '0' }

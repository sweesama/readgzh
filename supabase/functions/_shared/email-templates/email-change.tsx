/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="zh" dir="ltr">
    <Head />
    <Preview>确认你的 ReadGZH 邮箱变更</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://jhnnmmwgdrquwjytvvwu.supabase.co/storage/v1/object/public/email-assets/logo.png"
          width="48"
          height="48"
          alt="ReadGZH"
          style={{ marginBottom: '24px' }}
        />
        <Heading style={h1}>确认邮箱变更</Heading>
        <Text style={text}>
          你请求将 ReadGZH 的邮箱从{' '}
          <Link href={`mailto:${email}`} style={link}>
            {email}
          </Link>{' '}
          更改为{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          。
        </Text>
        <Text style={text}>
          点击下方按钮确认此变更：
        </Text>
        <Button style={button} href={confirmationUrl}>
          确认变更
        </Button>
        <Text style={footer}>
          如果你没有请求此变更，请立即检查你的账户安全。
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif' }
const container = { padding: '32px 28px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#172533',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#62697a',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: '#299e7a', textDecoration: 'underline' }
const button = {
  backgroundColor: '#299e7a',
  color: '#ffffff',
  fontSize: '15px',
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }

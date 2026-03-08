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
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="zh" dir="ltr">
    <Head />
    <Preview>你的 ReadGZH 登录验证码</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://jhnnmmwgdrquwjytvvwu.supabase.co/storage/v1/object/public/email-assets/logo.png"
          width="48"
          height="48"
          alt="ReadGZH"
          style={{ marginBottom: '24px' }}
        />
        <Heading style={h1}>登录 ReadGZH</Heading>
        {token ? (
          <>
            <Text style={text}>
              你的登录验证码是：
            </Text>
            <Text style={codeStyle}>{token}</Text>
            <Text style={text}>
              验证码将在几分钟后过期，请尽快使用。
            </Text>
          </>
        ) : (
          <>
            <Text style={text}>
              点击下方按钮登录 ReadGZH，链接将在短时间内过期。
            </Text>
            <Button style={button} href={confirmationUrl}>
              登录
            </Button>
          </>
        )}
        <Text style={footer}>
          如果你没有请求此登录，请忽略此邮件。
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: '#172533',
  letterSpacing: '6px',
  margin: '0 0 24px',
  padding: '16px 24px',
  backgroundColor: '#f5f7f9',
  borderRadius: '12px',
  textAlign: 'center' as const,
  display: 'block',
}
const button = {
  backgroundColor: '#299e7a',
  color: '#ffffff',
  fontSize: '15px',
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }

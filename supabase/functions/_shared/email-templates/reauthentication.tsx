/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="zh" dir="ltr">
    <Head>
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta charSet="utf-8" />
    </Head>
    <Preview>你的 ReadGZH 验证码</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://jhnnmmwgdrquwjytvvwu.supabase.co/storage/v1/object/public/email-assets/logo.png"
          width="48"
          height="48"
          alt="ReadGZH"
          style={{ marginBottom: '24px' }}
        />
        <Heading style={h1}>身份验证</Heading>
        <Text style={text}>请使用以下验证码确认你的身份：</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          验证码将在短时间内过期。如果你没有请求此验证，请忽略此邮件。
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }

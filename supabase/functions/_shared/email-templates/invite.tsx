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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="zh" dir="ltr">
    <Head />
    <Preview>你被邀请加入 ReadGZH</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://jhnnmmwgdrquwjytvvwu.supabase.co/storage/v1/object/public/email-assets/logo.png"
          width="48"
          height="48"
          alt="ReadGZH"
          style={{ marginBottom: '24px' }}
        />
        <Heading style={h1}>你收到了邀请</Heading>
        <Text style={text}>
          你被邀请加入{' '}
          <Link href={siteUrl} style={link}>
            <strong>ReadGZH</strong>
          </Link>
          。点击下方按钮接受邀请并创建账户。
        </Text>
        <Button style={button} href={confirmationUrl}>
          接受邀请
        </Button>
        <Text style={footer}>
          如果你没有收到过邀请，请忽略此邮件。
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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

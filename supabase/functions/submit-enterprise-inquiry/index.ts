import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const BodySchema = z.object({
  company_name: z.string().trim().min(2).max(200),
  contact_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  tax_id: z.string().trim().max(50).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  plan: z.enum(['team', 'enterprise', 'flagship', 'custom']),
  billing_cycle: z.enum(['annual', 'monthly']),
  invoice_type: z.enum(['plain', 'special', 'none']),
})

const PLAN_LABELS: Record<string, string> = {
  team: '团队版（3,000 积分/月）',
  enterprise: '企业版（12,000 积分/月）',
  flagship: '旗舰版（40,000 积分/月）',
  custom: '还不确定 / 需要定制',
}
const BILLING_LABELS: Record<string, string> = { annual: '年付', monthly: '月付' }
const INVOICE_LABELS: Record<string, string> = {
  plain: '电子增值税普通发票',
  special: '增值税专用发票（个案沟通）',
  none: '暂不需要发票',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const supabaseUrlA = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authClient = createClient(supabaseUrlA, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: claims } = token ? await authClient.auth.getClaims(token) : { data: null }
    const userId = claims?.claims?.sub as string | undefined
    const userEmail = (claims?.claims?.email as string | undefined) ?? ''
    if (!userId || !userEmail) return json({ error: 'login_required' }, 401)

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    const d = parsed.data

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server configuration error' }, 500)
    const supabase = createClient(supabaseUrl, serviceKey)

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { data: recent, error: recentErr } = await supabase
      .from('enterprise_inquiries')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
    if (recentErr) return json({ error: 'Failed to check history' }, 503)
    if ((recent?.length ?? 0) >= 2) {
      return json({ duplicate: true, first_at: recent![0].created_at })
    }
    const clientIp = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || '').trim() || null
    const contactEmail = d.email || userEmail

    const { data: inserted, error } = await supabase
      .from('enterprise_inquiries')
      .insert({
        company_name: d.company_name,
        contact_name: d.contact_name,
        email: contactEmail,
        user_id: userId,
        client_ip: clientIp,
        phone: d.phone || null,
        tax_id: d.tax_id || null,
        note: d.note || null,
        plan: d.plan,
        billing_cycle: d.billing_cycle,
        invoice_type: d.invoice_type,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[submit-enterprise-inquiry] insert failed', error)
      return json({ error: 'Failed to save inquiry' }, 500)
    }

    try {
      const result = await sendTemplateEmail('enterprise-inquiry', '', {
        templateData: {
          companyName: d.company_name,
          contactName: d.contact_name,
          email: contactEmail === userEmail ? contactEmail : `${contactEmail}（登录账号：${userEmail}）`,
          phone: d.phone ?? '',
          taxId: d.tax_id ?? '',
          plan: PLAN_LABELS[d.plan],
          billingCycle: BILLING_LABELS[d.billing_cycle],
          invoiceType: INVOICE_LABELS[d.invoice_type],
          note: d.note ?? '',
        },
        idempotencyKey: `enterprise-inquiry-${inserted.id}`,
        replyTo: contactEmail,
      })
      if (!result.sent) {
        console.warn('[submit-enterprise-inquiry] notification skipped: recipient_suppressed')
      }
    } catch (mailError) {
      console.error('[submit-enterprise-inquiry] notification failed', mailError)
    }

    return json({ success: true, id: inserted.id })
  } catch (e) {
    console.error('[submit-enterprise-inquiry] unexpected error', e)
    return json({ error: 'Unexpected error' }, 500)
  }
})

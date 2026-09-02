import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const BodySchema = z.object({
  company_name: z.string().trim().min(2).max(200),
  contact_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
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
    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    const d = parsed.data

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server configuration error' }, 500)
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: inserted, error } = await supabase
      .from('enterprise_inquiries')
      .insert({
        company_name: d.company_name,
        contact_name: d.contact_name,
        email: d.email,
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
          email: d.email,
          phone: d.phone ?? '',
          taxId: d.tax_id ?? '',
          plan: PLAN_LABELS[d.plan],
          billingCycle: BILLING_LABELS[d.billing_cycle],
          invoiceType: INVOICE_LABELS[d.invoice_type],
          note: d.note ?? '',
        },
        idempotencyKey: `enterprise-inquiry-${inserted.id}`,
        replyTo: d.email,
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

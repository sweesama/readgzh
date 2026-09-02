import { createClient } from 'npm:@supabase/supabase-js@2'
import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'

type EmailEvent = {
  event_id: string
  data: {
    recipient?: string
    message_id?: string
  }
}

type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe'
type SendLogStatus = 'bounced' | 'complained' | 'suppressed'

function getSupabase() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Server configuration error')
  }
  return createClient(supabaseUrl, serviceKey)
}

async function recordEmailEvent(
  event: EmailEvent,
  reason: SuppressionReason,
  status: SendLogStatus,
  message: string,
): Promise<void> {
  const recipient = event.data.recipient?.trim().toLowerCase()
  if (!recipient) {
    throw new Error('Email event is missing a recipient')
  }

  const supabase = getSupabase()
  const { data: existingEvent, error: duplicateCheckError } = await supabase
    .from('email_send_log')
    .select('id')
    .eq('metadata->>event_id', event.event_id)
    .maybeSingle()

  if (duplicateCheckError) {
    throw duplicateCheckError
  }
  if (existingEvent) {
    return
  }

  const metadata = {
    event_id: event.event_id,
    message_id: event.data.message_id ?? null,
  }

  const { error: suppressionError } = await supabase
    .from('suppressed_emails')
    .upsert(
      { email: recipient, reason, metadata },
      { onConflict: 'email' },
    )

  if (suppressionError) {
    throw suppressionError
  }

  const { error: logError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: event.data.message_id ?? null,
      template_name: 'system',
      recipient_email: recipient,
      status,
      error_message: message,
      metadata,
    })

  if (logError) {
    throw logError
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY') ?? '',
  on: {
    'email.bounced': async (event) => {
      await recordEmailEvent(
        event as EmailEvent,
        'bounce',
        'bounced',
        'Permanent bounce — email address is invalid or rejected',
      )
      console.log('Email event processed', { event_id: event.event_id })
    },
    'email.complaint': async (event) => {
      await recordEmailEvent(
        event as EmailEvent,
        'complaint',
        'complained',
        'Spam complaint — recipient marked email as spam',
      )
      console.log('Email event processed', { event_id: event.event_id })
    },
    'email.unsubscribed': async (event) => {
      await recordEmailEvent(
        event as EmailEvent,
        'unsubscribe',
        'suppressed',
        'Recipient unsubscribed',
      )
      console.log('Email event processed', { event_id: event.event_id })
    },
  },
})

Deno.serve((req) => handler(req))

import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    // Placeholder handlers — replace each log with the feature's reaction.
    // Throw on failure so the delivery is retried.
    'email.bounced': async (event) => {
      console.log('Email bounced', { event_id: event.event_id })
    },
    'email.complaint': async (event) => {
      console.log('Email complaint', { event_id: event.event_id })
    },
    'email.unsubscribed': async (event) => {
      console.log('Email unsubscribed', { event_id: event.event_id })
    },
  },
})

Deno.serve((req) => handler(req))

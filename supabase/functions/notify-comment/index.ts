import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (token !== serviceKey) {
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    const body = await req.json()
    const commentId = typeof body.commentId === 'string' ? body.commentId : ''
    if (!commentId) {
      return new Response(JSON.stringify({ error: 'commentId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, content, user_id, parent_id')
      .eq('id', commentId)
      .maybeSingle()

    if (commentError || !comment) {
      console.error('Comment not found', { commentId, commentError })
      return new Response(JSON.stringify({ error: 'Comment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', comment.user_id)
      .maybeSingle()
    const userName = profile?.display_name?.trim() || '匿名用户'

    const sendEmail = async (
      label: string,
      recipient: string,
      templateName: 'new-comment' | 'comment-reply',
      templateData: Record<string, unknown>,
    ) => {
      try {
        const result = await sendTemplateEmail(templateName, recipient, {
          templateData,
          idempotencyKey: `${templateName}-${comment.id}`,
        })
        if (!result.sent) {
          console.log('Comment email suppressed', { label })
        } else {
          console.log('Comment email sent', { label })
        }
      } catch (error) {
        console.error(`[notify-comment] ${label} failed`, error)
      }
    }

    await sendEmail('admin', '', 'new-comment', {
      userName,
      commentContent: comment.content.substring(0, 500),
      commentUrl: 'https://readgzh.site/comments',
    })

    if (comment.parent_id) {
      const { data: parentComment } = await supabase
        .from('comments')
        .select('user_id, content')
        .eq('id', comment.parent_id)
        .maybeSingle()

      if (parentComment && parentComment.user_id !== comment.user_id) {
        const { data: parentProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', parentComment.user_id)
          .maybeSingle()

        if (parentProfile?.email) {
          await sendEmail('reply', parentProfile.email, 'comment-reply', {
            replierName: userName,
            replyContent: comment.content.substring(0, 500),
            originalContent: parentComment.content.substring(0, 200),
            commentUrl: 'https://readgzh.site/comments',
          })
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('notify-comment error', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

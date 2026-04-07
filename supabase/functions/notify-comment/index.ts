import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const { commentId } = await req.json()
    if (!commentId) {
      return new Response(JSON.stringify({ error: 'commentId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch the comment
    const { data: comment, error: commentErr } = await supabase
      .from('comments')
      .select('id, content, user_id, parent_id')
      .eq('id', commentId)
      .maybeSingle()

    if (commentErr || !comment) {
      console.error('Comment not found', { commentId, commentErr })
      return new Response(JSON.stringify({ error: 'Comment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get commenter's display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', comment.user_id)
      .maybeSingle()
    const userName = profile?.display_name?.trim() || '匿名用户'

    // Always notify admin about new comments
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'new-comment',
        templateData: {
          userName,
          commentContent: comment.content.substring(0, 500),
          commentUrl: 'https://readgzh.site/comments',
        },
      },
    })

    // If it's a reply, notify the parent comment author
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
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'comment-reply',
              recipientEmail: parentProfile.email,
              templateData: {
                replierName: userName,
                replyContent: comment.content.substring(0, 500),
                originalContent: parentComment.content.substring(0, 200),
                commentUrl: 'https://readgzh.site/comments',
              },
            },
          })
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-comment error', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

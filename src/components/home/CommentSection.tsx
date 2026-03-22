import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquare, ThumbsUp, ThumbsDown, Trash2, Clock, TrendingUp, Send, Shield, Reply, ChevronDown, ChevronUp, EyeOff } from "lucide-react";
import { toast } from "sonner";

const ADMIN_EMAIL = "sweeyeah@gmail.com";

type Comment = {
  id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  likes_count: number;
  dislikes_count: number;
  is_anonymous: boolean;
  created_at: string;
  profile?: { display_name: string | null; email: string | null; avatar_url: string | null };
  replies?: Comment[];
};

function getVoterId(userId: string | null): string {
  if (userId) return userId;
  let anon = localStorage.getItem("readgzh_voter_id");
  if (!anon) {
    anon = "anon_" + crypto.randomUUID();
    localStorage.setItem("readgzh_voter_id", anon);
  }
  return anon;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

const CommentSection = () => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [votes, setVotes] = useState<Record<string, "like" | "dislike">>({});
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sort, setSort] = useState<"newest" | "popular">("newest");
  const [loading, setLoading] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const isAdmin = user?.email === ADMIN_EMAIL;
  const voterId = getVoterId(user?.id ?? null);

  const fetchComments = useCallback(async () => {
    // Fetch all comments
    const { data: commentsData } = await supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: false });

    if (!commentsData) return;

    // Fetch profiles for all unique user_ids
    const userIds = [...new Set(commentsData.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

    // Build tree
    const withProfiles = commentsData.map((c) => ({
      ...c,
      profile: profileMap.get(c.user_id) || undefined,
      replies: [] as Comment[],
    }));

    const topLevel: Comment[] = [];
    const byId = new Map<string, Comment>();
    withProfiles.forEach((c) => byId.set(c.id, c));
    withProfiles.forEach((c) => {
      if (c.parent_id && byId.has(c.parent_id)) {
        byId.get(c.parent_id)!.replies!.push(c);
      } else {
        topLevel.push(c);
      }
    });

    // Sort replies by time ascending
    topLevel.forEach((c) => c.replies?.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

    setComments(topLevel);
  }, []);

  const fetchVotes = useCallback(async () => {
    const { data } = await supabase
      .from("comment_votes")
      .select("comment_id, vote_type")
      .eq("voter_id", voterId);
    if (data) {
      const map: Record<string, "like" | "dislike"> = {};
      data.forEach((v) => (map[v.comment_id] = v.vote_type as "like" | "dislike"));
      setVotes(map);
    }
  }, [voterId]);

  useEffect(() => {
    fetchComments();
    fetchVotes();
  }, [fetchComments, fetchVotes]);

  const sorted = [...comments].sort((a, b) => {
    if (sort === "popular") return b.likes_count - a.likes_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleSubmit = async (parentId: string | null = null) => {
    if (!user) {
      toast.error("请先登录后再留言");
      return;
    }
    const text = parentId ? replyContent.trim() : content.trim();
    if (!text) return;

    setLoading(true);
    const commentId = crypto.randomUUID();
    const { error } = await supabase.from("comments").insert({
      id: commentId,
      user_id: user.id,
      content: text,
      parent_id: parentId,
    });
    setLoading(false);

    if (error) {
      toast.error("发送失败");
      return;
    }

    // Notify admin about new comment (fire-and-forget)
    const userProfile = user.user_metadata;
    const userName = userProfile?.full_name || userProfile?.name || user.email?.split("@")[0] || "匿名用户";
    supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "new-comment",
        recipientEmail: "sweeyeah@hotmail.com",
        idempotencyKey: `new-comment-${commentId}`,
        templateData: {
          userName,
          commentContent: text.slice(0, 200),
          commentUrl: "https://readgzh.site/comments",
        },
      },
    }).catch(() => {}); // don't block UI on email failure

    if (parentId) {
      setReplyContent("");
      setReplyTo(null);
      setExpandedReplies((prev) => new Set(prev).add(parentId));
    } else {
      setContent("");
    }
    fetchComments();
    fetchVotes();
  };

  const handleVote = async (commentId: string, type: "like" | "dislike") => {
    const existing = votes[commentId];

    if (existing === type) {
      // Remove vote
      await supabase.from("comment_votes").delete().eq("comment_id", commentId).eq("voter_id", voterId);
      setVotes((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
    } else {
      if (existing) {
        // Remove old vote first
        await supabase.from("comment_votes").delete().eq("comment_id", commentId).eq("voter_id", voterId);
      }
      // Insert new vote
      await supabase.from("comment_votes").insert({ comment_id: commentId, voter_id: voterId, vote_type: type });
      setVotes((prev) => ({ ...prev, [commentId]: type }));
    }

    fetchComments();
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from("comments").delete().eq("id", commentId);
    fetchComments();
    toast.success("已删除");
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const isCommentAdmin = comment.profile?.email === ADMIN_EMAIL;
    const hasReplies = comment.replies && comment.replies.length > 0;
    const showReplies = expandedReplies.has(comment.id);

    return (
      <div key={comment.id} className={`${isReply ? "ml-8 border-l-2 border-border pl-4" : ""}`}>
        <div className="group py-3">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
              {comment.profile?.avatar_url ? (
                <img src={comment.profile.avatar_url} className="h-6 w-6 rounded-full object-cover" alt="" />
              ) : (
                (comment.profile?.display_name?.[0] || "?").toUpperCase()
              )}
            </div>
            <span className="text-sm font-medium text-foreground">
              {comment.profile?.display_name || "匿名用户"}
            </span>
            {isCommentAdmin && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                <Shield className="h-2.5 w-2.5" />
                开发者
              </span>
            )}
            <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>

          {/* Content */}
          <p className="text-sm text-foreground/90 ml-8 whitespace-pre-wrap break-words">{comment.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-3 ml-8 mt-2">
            <button
              onClick={() => handleVote(comment.id, "like")}
              className={`flex items-center gap-1 text-xs transition-colors ${votes[comment.id] === "like" ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              {comment.likes_count > 0 && comment.likes_count}
            </button>
            <button
              onClick={() => handleVote(comment.id, "dislike")}
              className={`flex items-center gap-1 text-xs transition-colors ${votes[comment.id] === "dislike" ? "text-destructive font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              {comment.dislikes_count > 0 && comment.dislikes_count}
            </button>
            {!isReply && user && (
              <button
                onClick={() => { setReplyTo(replyTo === comment.id ? null : comment.id); setReplyContent(""); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Reply className="h-3.5 w-3.5" />
                回复
              </button>
            )}
            {(isAdmin || user?.id === comment.user_id) && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Reply input */}
          {replyTo === comment.id && (
            <div className="ml-8 mt-2 flex gap-2">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="写下你的回复..."
                className="min-h-[60px] text-sm resize-none"
                rows={2}
              />
              <Button size="sm" onClick={() => handleSubmit(comment.id)} disabled={loading || !replyContent.trim()} className="shrink-0 self-end">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Replies toggle */}
          {hasReplies && !isReply && (
            <button
              onClick={() => toggleReplies(comment.id)}
              className="flex items-center gap-1 ml-8 mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {showReplies ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {comment.replies!.length} 条回复
            </button>
          )}

          {/* Nested replies */}
          {showReplies && comment.replies?.map((r) => renderComment(r, true))}
        </div>
      </div>
    );
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header with sort tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">留言板</h2>
            <span className="text-xs text-muted-foreground">({comments.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0)})</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={sort === "newest" ? "default" : "ghost"}
              onClick={() => setSort("newest")}
              className="gap-1 rounded-full text-xs h-7 px-2.5"
            >
              <Clock className="h-3 w-3" />
              最新
            </Button>
            <Button
              size="sm"
              variant={sort === "popular" ? "default" : "ghost"}
              onClick={() => setSort("popular")}
              className="gap-1 rounded-full text-xs h-7 px-2.5"
            >
              <TrendingUp className="h-3 w-3" />
              最热
            </Button>
          </div>
        </div>

        {/* Input */}
        <div className="mb-6">
          <div className="flex gap-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={user ? "说点什么..." : "登录后即可留言"}
              disabled={!user}
              className="min-h-[72px] text-sm resize-none bg-card"
              rows={2}
            />
            <Button
              size="sm"
              onClick={() => handleSubmit()}
              disabled={loading || !content.trim() || !user}
              className="shrink-0 self-end gap-1"
            >
              <Send className="h-3.5 w-3.5" />
              发送
            </Button>
          </div>
        </div>

        {/* Comments list */}
        <div className="divide-y divide-border">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">还没有留言，来说点什么吧 ✨</p>
          ) : (
            sorted.map((c) => renderComment(c))
          )}
        </div>
      </div>
    </section>
  );
};

export default CommentSection;

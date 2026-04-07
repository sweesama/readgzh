/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as newComment } from './new-comment.tsx'
import { template as commentReply } from './comment-reply.tsx'
import { template as systemNotice } from './system-notice.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-comment': newComment,
  'comment-reply': commentReply,
  'system-notice': systemNotice,
}

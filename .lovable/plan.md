# 邀请好友送积分 · 实施计划

## 一、产品规则（已确认）

| 项 | 规则 |
|---|---|
| 邀请上限 | 每账号最多 20 人 |
| 阶梯奖励 | 1–3 人 × 30 / 4–8 人 × 60 / 9–15 人 × 90 / 16–20 人 × 120，满额 1620 |
| 触发条件 | 被邀请人完成邮箱验证 + 首次成功阅读一篇文章 |
| 积分过期 | 自发放日起 60 天 |
| 充值额外奖励 | 不做 |
| 被邀请人福利 | 待你确认（见"待确认问题 Q1"） |
| 活动时长 | 待你确认（见 Q2） |

## 二、技术方案

### 2.1 数据库（新增 3 张表）

```text
referral_codes               每用户一个唯一邀请码
├─ user_id (PK, FK profiles)
├─ code (unique, 8 位大写字母数字)
└─ created_at

referrals                    每条邀请关系
├─ id
├─ inviter_id (FK profiles)
├─ invitee_id (FK profiles, unique)   ← 防一人被多次邀请
├─ status: pending|qualified|rewarded|invalid
├─ signup_ip / signup_user_agent      ← 风控审计
├─ qualified_at  (首次阅读时间)
├─ rewarded_at   (积分发放时间)
├─ reward_amount (30/60/90/120)
└─ created_at

bonus_grants                 积分发放台账（替代当前单字段 bonus_expires_at）
├─ id
├─ user_id
├─ amount
├─ source: 'referral' | 'credit_pack' | 'admin'
├─ source_ref (referral_id / stripe_session_id)
├─ granted_at
├─ expires_at  (granted_at + 60d)
└─ consumed_amount (默认 0)
```

**关键决策**：当前 `api_keys.bonus_credits` 是单字段，多笔奖励叠加时会丢失各自过期时间。引入 `bonus_grants` 台账后，`get_user_balance` 和 `validate_api_key` 改为 `SUM(amount - consumed) WHERE expires_at > now()`。历史的 `credit_pack` 数据需要一次性回填到台账（用 `credit_pack_claims` 反推）。

### 2.2 边缘函数（新增 2 个）

- **`referral-claim`**（注册流程调用）
  - 入参：`code`, `invitee_id`
  - 校验：code 存在、未自邀（IP/email 不同）、invitee 未被邀请过、邀请人未满 20
  - 写入 `referrals` 行 `status=pending`
  
- **`referral-trigger`**（首次阅读时调用，从 `wechat-reader` / `rd` 内部 RPC）
  - 输入：`user_id`
  - 若该用户存在 `pending` 邀请：标记 `qualified` → 计算邀请人当前已 `rewarded` 数对应的阶梯 → 写入 `bonus_grants` → 标 `rewarded`
  - 幂等：同一 invitee 只触发一次（status 机），用事务 + 唯一约束

### 2.3 注册流程改造

- 注册页（`/auth` 或现有入口）读取 URL `?ref=XXXXXXXX`，存入 sessionStorage
- 注册成功后立即调用 `referral-claim`
- `handle_new_user` 触发器**不改**，因为风控逻辑放在边缘函数更灵活

### 2.4 前端

新增页面 `/dashboard/invite`（或控制台内 Tab）：
- 个人邀请链接：`https://readgzh.site/?ref=XXXXXXXX` + 一键复制
- 进度卡片：已邀请 N/20、已发放积分总额、下一档单人奖励金额
- 已邀请列表：脱敏 email（`abc***@gmail.com`）、状态（待激活/已激活）、奖励
- 阶梯说明表

控制台首页加入口卡片 + 新鲜事/活动页 CTA 跳转到此页。

### 2.5 小圆点 → 图标呼吸（你刚提的优化）

- 删除 `<Sparkles>` 外侧的小圆点 span 和 ring
- 未读时：`Sparkles` 加 `text-primary animate-breath-soft`（仅 opacity 0.55↔1，不缩放）
- 已读后：恢复默认色（继承 ghost 按钮的 `text-foreground`）
- 配套：`tailwind.config.ts` 新增 `breath-soft` keyframes

## 三、防滥用（重要）

| 风险 | 防范 |
|---|---|
| 自邀（注册小号） | 邀请人 IP ≠ 被邀请人注册 IP；email 域名不同；同一 device fingerprint 不允许 |
| 一次性邮箱 | 维护一份 disposable email 黑名单（开源列表，CI 周更）|
| 刷阅读触发奖励 | 复用现有 IP 限流 + 要求被邀请人是真实登录态 + 阅读的文章必须 `view_count > 0` 已存在或新抓取成功 |
| 同一被邀请人被多人"认领" | `referrals.invitee_id` UNIQUE 约束 |
| 邀请人退款/封号 | 增加 admin 接口可撤销未消费的 `bonus_grants` |

## 四、文件变动清单

```text
新增
  supabase/functions/referral-claim/index.ts
  supabase/functions/referral-trigger/index.ts
  src/pages/InvitePage.tsx              (或 dashboard 内嵌)
  src/lib/referral.ts                   (URL 参数 + sessionStorage helpers)

修改
  supabase/functions/wechat-reader/index.ts   首次阅读成功后调 referral-trigger
  supabase/functions/rd/index.ts              同上
  src/pages/DashboardPage.tsx                 加邀请入口
  src/pages/ChangelogPage.tsx                 "活动" 状态改为 active + CTA
  src/data/events.ts                          状态 upcoming → active
  src/pages/Index.tsx                         小圆点 → 图标呼吸
  tailwind.config.ts                          新增 breath-soft keyframes
  src/data/changelog.ts                       上线日志

数据库迁移（1 次）
  3 张新表 + RLS + 回填 bonus_grants + 调整 get_user_balance / validate_api_key
```

## 五、上线步骤

1. 数据库迁移 + 回填台账（**有风险**，需要先在测试环境验证 balance 数值与现有一致）
2. 部署 2 个边缘函数 + 改造 reader 函数
3. 前端发布
4. `events.ts` 状态切 `active`，写更新日志
5. 监控前 48 小时：发放量、被邀请人转化率、风控拦截率

## 六、待确认问题（请你回复后再实施）

**Q1 · 被邀请人是否也送欢迎积分？**
- 选项 A：不送，保持简单
- 选项 B：送 30 积分（与首档持平，鼓励首次阅读）
- 选项 C：送 90 积分但过期 7 天（强冷启动）
- 建议 B：转化率提升明显且成本极低

**Q2 · 活动持续时长？**
- 短期（1 个月）：制造紧迫感，便于复盘
- 中期（3 个月）：覆盖夏季流量
- 长期（默认开启）：作为常驻增长功能
- 建议 3 个月，到期评估再决定是否常驻

**Q3 · 邀请码格式？**
- A：8 位随机大写字母数字（如 `K7P2M9XQ`）—— 默认推荐，碰撞概率极低
- B：用户可自定义（如 `david-2026`）—— 工作量加大，需校验脏词

**Q4 · 触发"首次阅读"的精确定义？**
- A：被邀请人登录后访问任意 `/s/:slug`（最宽松）
- B：被邀请人触发一次成功的文章抓取（更高门槛，但能挡刷量）
- 建议 B，复用 `wechat-reader` 已有的 user_id 上下文

**Q5 · 已注册老用户能否补领邀请码？**
- 全员自动生成，所有活跃用户都能邀请 ✅（推荐）
- 仅新用户能邀请 ❌

## 七、可能被忽略的边界问题

1. **现有 `bonus_credits` 数据迁移**：必须无损迁到台账，否则会有用户余额突然变化的投诉
2. **`validate_api_key` 性能**：每次 API 调用都要 SUM 台账，需要 `(user_id, expires_at)` 索引
3. **被邀请人删除账号**：referral 应保留为审计记录，但不撤销已发的奖励
4. **邀请人删号**：未消费的 bonus_grants 自然失效
5. **撤销机制**：admin 后台需要"作废邀请关系"按钮（防刷量爆发时止损）
6. **统计指标**：activity 仪表盘应在 admin 面板加一个简易卡片，看 DAU 转化和发放总额
7. **邮件通知**：被邀请人完成激活时，是否给邀请人发邮件？（建议复用 transactional template，单日聚合发送避免轰炸）
8. **SEO/分享卡**：`?ref=` 链接被分享到微信时，OG image 是否要做差异化？（首期可不做）
9. **隐私合规**：邀请列表展示 email 必须脱敏；不能让用户看到被邀请人的真实邮箱
10. **退款联动**：若邀请人订阅退款，已发奖励不撤销（合理且简单）；但若被邀请人在 7 天内退款且无消费，是否撤销？建议不撤销（成本已沉没，复杂度高）

---

请回复 Q1–Q5 的选择，我就开工。

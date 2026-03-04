

## Stripe 一次性支付集成方案

### 背景
- Stripe 已启用，密钥已自动配置
- 已创建 Stripe 产品 `ReadGZH Pro`（prod_U5RkD78UQRIlZD）和价格 price_1T7GqgB04cx1cwwsUCydmZHv（¥39 CNY）
- 项目已有 Google OAuth 登录和 Dashboard 页面
- 采用一次性支付模式（先上线，后续再加订阅）

### 实施步骤

**1. 创建 `create-payment` Edge Function**
- 验证用户身份（从 Authorization header 获取）
- 查找或创建 Stripe Customer
- 创建 `mode: "payment"` 的 Checkout Session
- 返回 Stripe Checkout URL 给前端跳转
- 在 `supabase/config.toml` 中添加 `[functions.create-payment]` 配置

**2. 创建支付成功页面 `/payment-success`**
- 简洁的支付成功确认页面
- 引导用户回到 Dashboard
- 在 `App.tsx` 中注册路由

**3. 更新 PricingPage**
- Pro 套餐按钮从"即将推出"（disabled）改为"立即购买"
- 点击后调用 `create-payment` Edge Function
- 获取 Checkout URL 后在新标签页打开 Stripe 结账
- 未登录用户先跳转 Dashboard 登录

**4. 在 Dashboard 添加升级入口**
- 在控制台顶部或积分卡片区域添加"升级到 Pro"按钮
- 同样调用 `create-payment` 发起支付

### 技术细节
- Price ID: `price_1T7GqgB04cx1cwwsUCydmZHv`
- Stripe API version: `2025-08-27.basil`
- 成功回调 URL: `{origin}/payment-success`
- 取消回调 URL: `{origin}/pricing`
- STRIPE_SECRET_KEY 已在环境变量中，无需额外配置


// Changelog entries. Newest first.
// Add a new entry at the top each time a notable change ships.

export type ChangelogEntry = {
  date: string; // YYYY-MM-DD
  version?: string;
  title: string;
  tags?: ("新增" | "改进" | "修复" | "安全" | "计费")[];
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-05-18",
    title: "更新日志上线、留言聚合、支付方式说明完善",
    tags: ["新增", "改进"],
    items: [
      "新增「更新日志」页面，每次产品更新会同步在此公布",
      "留言板：同一用户的多条留言现在会自动聚合，作者头像与名字只显示一次，更清爽",
      "定价页：补充全部支付方式说明（信用卡 / Link / 支付宝 / 微信 / 银联），并明确订阅仅支持卡支付，支付宝与微信仅支持加量包",
      "Stripe Webhook：新增 charge.refunded 事件兜底，后台手动退款后会自动降级并清理加量包积分",
    ],
  },
  {
    date: "2026-05-14",
    title: "自助退款 + 14 天退款窗口",
    tags: ["新增", "计费"],
    items: [
      "控制台 → 账单与订阅 新增「申请退款」自助入口",
      "退款金额按已用比例自动计算（月付 / 年付分别采用不同公式），剩余金额原路退回",
      "退款成功后自动取消订阅、降级为免费版，并清空未使用的加量包积分",
    ],
  },
  {
    date: "2026-05-05",
    title: "加量包有效期 + 月度配额",
    tags: ["改进", "计费"],
    items: [
      "新购买的加量包自购买日起 30 天内有效，过期自动清零",
      "订阅用户（Lite / Pro）配额改为月度结算，无需每天领取",
      "免费用户保留每日 30 积分领取机制",
    ],
  },
  {
    date: "2026-04-22",
    title: "AI 摘要 + MCP 协议支持",
    tags: ["新增"],
    items: [
      "Pro 用户可使用 ?mode=summary 获取 AI 智能摘要（基于 Gemini Flash）",
      "新增 readgzh.* MCP 命名空间，支持 Claude、Cursor 等 AI 客户端直接调用",
      "WebMCP 协议支持，在浏览器中即可被 AI 助手发现并使用",
    ],
  },
];

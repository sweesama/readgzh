// Activity/Campaign entries. Newest first.
export type EventStatus = "active" | "upcoming" | "ended";

export type EventEntry = {
  date: string;
  endDate?: string;
  status: EventStatus;
  title: string;
  highlight?: string;
  items: string[];
  cta?: { label: string; href: string };
};

export const EVENTS: EventEntry[] = [
  {
    date: "2026-08-12",
    status: "active",
    title: "企业采购通道上线：对公转账 + 电子发票",
    highlight: "团队共享积分池，不按人头收费；可开具增值税电子普通发票",
    items: [
      "三档方案：团队版 ¥1,380/年（每月 3,000 积分）、企业版 ¥3,980/年（每月 12,000 积分）、旗舰版 ¥9,800/年（每月 40,000 积分）",
      "支持银行对公转账、支付宝、微信付款，到账后 1 个工作日内人工开通",
      "可开具增值税电子普通发票，类目「信息技术服务*技术服务费」，到账后 3 个工作日内发送邮箱",
      "积分为团队共享，不限成员数量；提供简版订单确认书，邮件确认即可生效",
      "也提供月付（团队版 ¥149/月、企业版 ¥429/月、旗舰版 ¥1,080/月，仅开普票）",
    ],
    cta: { label: "提交采购需求", href: "/enterprise" },
  },
  {
    date: "2026-05-19",
    endDate: "2026-11-19",
    status: "active",
    title: "邀请好友，最高可得 1620 积分",
    highlight: "邀请 20 位好友，阶梯式获得最高 1620 积分；被邀请人首读再送 30 积分",
    items: [
      "每个账号最多可邀请 20 位新用户",
      "阶梯奖励：前 3 人每人 30 积分；第 4–8 人每人 60 积分；第 9–15 人每人 90 积分；第 16–20 人每人 120 积分",
      "被邀请人完成邮箱验证 + 首次阅读后，双方奖励同时发放（被邀请人首次额外获得 30 积分）",
      "奖励积分自发放日起 60 天内有效",
      "请勿用小号自邀，系统会通过 IP / 邮箱 / 设备信息识别并作废奖励",
    ],
    cta: { label: "去邀请好友", href: "/dashboard/invite" },
  },
];

// 最高奖励数：3×30 + 5×60 + 7×90 + 5×120 = 90 + 300 + 630 + 600 = 1620

// Activity/Campaign entries. Newest first.
// Each entry represents a promotional event or campaign.

export type EventStatus = "active" | "upcoming" | "ended";

export type EventEntry = {
  date: string; // YYYY-MM-DD (start date)
  endDate?: string; // optional end date
  status: EventStatus;
  title: string;
  highlight?: string; // short hook line, e.g. "最高得 1620 积分"
  items: string[];
  cta?: { label: string; href: string };
};

export const EVENTS: EventEntry[] = [
  {
    date: "2026-05-19",
    status: "upcoming",
    title: "邀请好友，最高可得 1620 积分",
    highlight: "邀请 20 位好友，阶梯式获得最高 1620 积分",
    items: [
      "每个账号最多可邀请 20 位新用户",
      "阶梯奖励：前 3 人每人 30 积分；第 4–8 人每人 60 积分；第 9–15 人每人 90 积分；第 16–20 人每人 120 积分",
      "被邀请用户需完成邮箱验证 + 首次阅读后方可发放奖励",
      "奖励积分自发放日起 60 天内有效",
      "活动正在开发中，上线后将在此通知，敬请期待",
    ],
  },
];

// 最高奖励数：3×30 + 5×60 + 7×90 + 5×120 = 90 + 300 + 630 + 600 = 1620

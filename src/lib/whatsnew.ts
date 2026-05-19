import { CHANGELOG } from "@/data/changelog";
import { EVENTS } from "@/data/events";

export const WHATSNEW_SEEN_KEY = "lastSeenWhatsnew";

/** Latest date across changelog + events (YYYY-MM-DD). */
export function getLatestWhatsnewDate(): string {
  const dates = [
    ...CHANGELOG.map((e) => e.date),
    ...EVENTS.map((e) => e.date),
  ];
  return dates.sort().pop() ?? "";
}

/** Whether the user has unseen entries in "新鲜事". */
export function hasUnseenWhatsnew(): boolean {
  try {
    const seen = localStorage.getItem(WHATSNEW_SEEN_KEY) ?? "";
    return getLatestWhatsnewDate() > seen;
  } catch {
    return false;
  }
}

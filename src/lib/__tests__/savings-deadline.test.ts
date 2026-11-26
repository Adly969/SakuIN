import test from "node:test";
import assert from "node:assert/strict";
import { calculateTargetDeadlineCountdown } from "../finance";

test("1. Tenggat tabungan H- berapa hari di masa depan, Hari-H, dan lewat tenggat (WIB)", () => {
  // 27 Nov 2026 01:15 WIB = 26 Nov 2026 18:15 UTC
  const todayWib = new Date("2026-11-26T18:15:00.000Z");

  const futureSoon = calculateTargetDeadlineCountdown("2026-11-30", todayWib);
  assert.equal(futureSoon.hasDeadline, true);
  assert.equal(futureSoon.diffDays, 3);
  assert.equal(futureSoon.shortLabel, "H-3");
  assert.equal(futureSoon.displayText, "H-3 (3 hari lagi)");
  assert.equal(futureSoon.formattedDate, "30 Nov 2026");
  assert.equal(futureSoon.urgency, "soon");

  const futureSafe = calculateTargetDeadlineCountdown("2026-12-17", todayWib);
  assert.equal(futureSafe.diffDays, 20);
  assert.equal(futureSafe.shortLabel, "H-20");
  assert.equal(futureSafe.urgency, "safe");

  const todayDue = calculateTargetDeadlineCountdown("2026-11-27", todayWib);
  assert.equal(todayDue.diffDays, 0);
  assert.equal(todayDue.shortLabel, "H-0");
  assert.equal(todayDue.displayText, "Hari ini (H-0)");
  assert.equal(todayDue.urgency, "today");

  const overdue = calculateTargetDeadlineCountdown("2026-11-24", todayWib);
  assert.equal(overdue.diffDays, -3);
  assert.equal(overdue.shortLabel, "H+3");
  assert.equal(overdue.displayText, "Terlewat 3 hari (H+3)");
  assert.equal(overdue.urgency, "overdue");
});

test("2. Tenggat tabungan tanpa tanggal kembali Fleksibel", () => {
  const flex = calculateTargetDeadlineCountdown(null);
  assert.equal(flex.hasDeadline, false);
  assert.equal(flex.diffDays, null);
  assert.equal(flex.shortLabel, null);
  assert.equal(flex.formattedDate, "Fleksibel");
  assert.equal(flex.urgency, "none");
});

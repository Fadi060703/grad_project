import cron from "node-cron";
import { generateWeeklyLectures } from "./generateWeeklyLectures";

export function initCron() {
  // Use TEST_CRON=true in .env to run every minute instead of every Friday
  const expression =
    process.env.TEST_CRON === "true"
      ? "* * * * *" // every minute
      : "0 0 * * 5"; // every Friday at midnight

  console.log(
    `⏰ Cron scheduled: ${process.env.TEST_CRON === "true" ? "every minute (TEST)" : "every Friday at midnight"}`,
  );

  cron.schedule(expression, async () => {
    try {
      await generateWeeklyLectures();
    } catch (err) {
      console.error("❌ Cron job failed:", err);
    }
  });
}

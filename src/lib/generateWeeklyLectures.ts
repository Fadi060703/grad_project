import { PrismaClient } from "../generated/prisma/client";
import { prisma } from "./prisma";

// Returns the date of the next occurrence of a given weekday
// from a reference date (inclusive — if reference is that day, returns reference)
function getNextWeekday(from: Date, targetDay: number): Date {
  const result = new Date(from);
  const current = result.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const diff = (targetDay - current + 7) % 7;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

const WEEKDAY_MAP: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
};

export async function generateWeeklyLectures(): Promise<number> {
  console.log("🔄 Running weekly lectures generation...");

  // Find the upcoming Sunday (start of academic week)
  const now = new Date();
  const sunday = getNextWeekday(now, 0); // 0 = Sunday

  // Academic week: Sunday to Thursday (5 days)
  const weekDates: Record<string, Date> = {
    SUNDAY: new Date(sunday),
    MONDAY: new Date(new Date(sunday).setDate(sunday.getDate() + 1)),
    TUESDAY: new Date(new Date(sunday).setDate(sunday.getDate() + 2)),
    WEDNESDAY: new Date(new Date(sunday).setDate(sunday.getDate() + 3)),
    THURSDAY: new Date(new Date(sunday).setDate(sunday.getDate() + 4)),
  };

  // Fetch all lectures
  const lectures = await prisma.lecture.findMany();

  let created = 0;

  for (const lecture of lectures) {
    const lectureDate = weekDates[lecture.day];

    if (!lectureDate) continue;

    // Idempotent — skip if already exists
    const existing = await prisma.weeklyLecture.findUnique({
      where: {
        lecture_id_lecture_date: {
          lecture_id: lecture.id,
          lecture_date: lectureDate,
        },
      },
    });

    if (existing) continue;

    await prisma.weeklyLecture.create({
      data: {
        lecture_id: lecture.id,
        lecture_date: lectureDate,
        status: "DRAFT",
      },
    });

    created++;
  }

  console.log(`   ✔ ${created} weekly lectures generated.`);
  return created;
}

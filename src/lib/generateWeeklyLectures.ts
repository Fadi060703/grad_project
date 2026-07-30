import { prisma } from "./prisma";

export type GenerateWeeklyLecturesResult = {
  week_start: string;
  week_end: string;
  created: number;
  skipped_existing: number;
};

function toDateOnlyString(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Returns the date of the next occurrence of a given weekday
// from a reference date (inclusive — if reference is that day, returns reference)
function getNextWeekday(from: Date, targetDay: number): Date {
  const result = new Date(from);
  const current = result.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const diff = (targetDay - current + 7) % 7;
  result.setDate(result.getDate() + diff);
  // Use local noon for PostgreSQL @db.Date values to avoid timezone conversion
  // shifting the saved date to the previous day.
  result.setHours(12, 0, 0, 0);
  return result;
}

export async function generateWeeklyLectures(): Promise<GenerateWeeklyLecturesResult> {
  console.log("🔄 Running weekly lectures generation...");

  const now = new Date();
  const sunday = getNextWeekday(now, 0);

  const weekDates: Record<string, Date> = {
    SUNDAY: new Date(sunday),
    MONDAY: new Date(new Date(sunday).setDate(sunday.getDate() + 1)),
    TUESDAY: new Date(new Date(sunday).setDate(sunday.getDate() + 2)),
    WEDNESDAY: new Date(new Date(sunday).setDate(sunday.getDate() + 3)),
    THURSDAY: new Date(new Date(sunday).setDate(sunday.getDate() + 4)),
  };

  const lectures = await prisma.lecture.findMany();

  let created = 0;
  let skippedExisting = 0;

  for (const lecture of lectures) {
    const lectureDate = weekDates[lecture.day];

    if (!lectureDate) continue;

    const existing = await prisma.weeklyLecture.findUnique({
      where: {
        lecture_id_lecture_date: {
          lecture_id: lecture.id,
          lecture_date: lectureDate,
        },
      },
    });

    if (existing) {
      skippedExisting++;
      continue;
    }

    await prisma.weeklyLecture.create({
      data: {
        lecture_id: lecture.id,
        lecture_date: lectureDate,
        status: "DRAFT",
      },
    });

    created++;
  }

  const result = {
    week_start: toDateOnlyString(weekDates.SUNDAY),
    week_end: toDateOnlyString(weekDates.THURSDAY),
    created,
    skipped_existing: skippedExisting,
  };

  console.log(
    `   ✔ ${result.created} weekly lectures generated. ${result.skipped_existing} already existed.`,
  );

  return result;
}

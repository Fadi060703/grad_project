import { PrismaClient } from "../../generated/prisma/client";

export async function seedMarksCourses(prisma: PrismaClient) {
  console.log("🧾 Seeding marks courses...");

  const courseNames = await prisma.course.findMany({
    distinct: ["name"],
    select: { name: true },
    orderBy: { name: "asc" },
  });

  const selected = courseNames.slice(0, 10);

  for (const course of selected) {
    const marksCourse = await prisma.marksCourse.upsert({
      where: { name: course.name },
      update: {},
      create: { name: course.name },
    });

    await prisma.course.updateMany({
      where: { name: course.name },
      data: { marks_course_id: marksCourse.id },
    });
  }

  console.log(`   ✔ ${selected.length} marks courses seeded.`);
}

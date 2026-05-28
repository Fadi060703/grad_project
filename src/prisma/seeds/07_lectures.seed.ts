// seeds/07_lectures.seed.ts

import {
  PrismaClient,
  User,
  UniversityLocation,
  WeekDay,
  LectureType,
} from "../../generated/prisma/client";
import { SeedStructure } from "./03_structure.seed";

export interface SeedLocations {
  halls: UniversityLocation[];
  labs: UniversityLocation[];
}

async function seedLocations(prisma: PrismaClient): Promise<SeedLocations> {
  const halls: UniversityLocation[] = [];
  const labs: UniversityLocation[] = [];

  for (let i = 1; i <= 4; i++) {
    const hall = await prisma.universityLocation.upsert({
      where: { name: `قاعة ${i}` },
      update: {},
      create: { name: `قاعة ${i}`, reaching_description: `الطابق الأول، القاعة رقم ${i}` },
    });
    halls.push(hall);
  }

  for (let i = 1; i <= 4; i++) {
    const lab = await prisma.universityLocation.upsert({
      where: { name: `مختبر ${i}` },
      update: {},
      create: { name: `مختبر ${i}`, reaching_description: `الطابق الثاني، المختبر رقم ${i}` },
    });
    labs.push(lab);
  }

  return { halls, labs };
}

// Covered: Year 1 — Section 1 (الشعبة الأولى) only
// 5 courses:
//   - مقدمة في علوم الحاسوب     → THEORETICAL_ONLY  → 1 theoretical lecture
//   - رياضيات للحاسوب           → THEORETICAL_ONLY  → 1 theoretical lecture
//   - أساسيات البرمجة           → THEORETICAL_AND_PRACTICAL → 1 theoretical + 8 practical (one per group)
//   - مهارات الحاسوب والإنترنت  → THEORETICAL_AND_PRACTICAL → 1 theoretical + 8 practical
//   - منطق رقمي                 → THEORETICAL_ONLY  → 1 theoretical lecture

export async function seedLectures(
  prisma: PrismaClient,
  structure: SeedStructure,
  doctors: User[],
  teachers: User[],
): Promise<void> {
  console.log("📅 Seeding university locations and lectures schedule...");

  const { halls, labs } = await seedLocations(prisma);

  const { years, sectionsByYear, groupsBySection } = structure;

  // Year 1, Section 1
  const year1 = years[0];
  const sections = sectionsByYear.get(year1.id) ?? [];
  const section1 = sections[0];

  if (!section1) {
    console.warn("   ⚠ Section 1 of Year 1 not found, skipping lectures seed.");
    return;
  }

  const groups = groupsBySection.get(section1.id) ?? [];

  // Fetch year 1 courses linked to section 1
  const courses = await prisma.course.findMany({
    where: { sectionCourses: { some: { section_id: section1.id } } },
    orderBy: { id: "asc" },
  });

  if (courses.length === 0) {
    console.warn("   ⚠ No courses found for Section 1 of Year 1, skipping lectures seed.");
    return;
  }

  // Schedule layout:
  // Each course gets one theoretical slot on a distinct day + time_box_order
  // Practical courses also get one practical lecture per group, spread across days
  const theoreticalSlots: { day: WeekDay; time_box_order: number }[] = [
    { day: "SUNDAY",    time_box_order: 1 },
    { day: "SUNDAY",    time_box_order: 2 },
    { day: "MONDAY",    time_box_order: 1 },
    { day: "TUESDAY",   time_box_order: 1 },
    { day: "WEDNESDAY", time_box_order: 1 },
  ];

  // Practical slots: spread groups across days/timeslots
  // Each (day, time_box_order) cell can hold multiple practicals (one per group)
  const practicalSlots: { day: WeekDay; time_box_order: number }[] = [
    { day: "MONDAY",    time_box_order: 2 },
    { day: "MONDAY",    time_box_order: 3 },
    { day: "TUESDAY",   time_box_order: 2 },
    { day: "WEDNESDAY", time_box_order: 2 },
  ];

  let doctorIdx = 0;
  let teacherIdx = 0;
  let hallIdx = 0;
  let labIdx = 0;
  let lectureCount = 0;

  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const slot = theoreticalSlots[ci];
    const doctor = doctors[doctorIdx % doctors.length];
    doctorIdx++;

    // Check if theoretical lecture already exists for this slot + section
    const existingTheoretical = await prisma.lecture.findFirst({
      where: {
        day: slot.day,
        time_box_order: slot.time_box_order,
        section_id: section1.id,
        lecture_type: "THEORETICAL",
      },
    });

    if (!existingTheoretical) {
      await prisma.lecture.create({
        data: {
          day: slot.day,
          time_box_order: slot.time_box_order,
          lecture_type: "THEORETICAL",
          course_id: course.id,
          location_id: halls[hallIdx % halls.length].id,
          instructor_id: doctor.id,
          section_id: section1.id,
          major_id: null,
          group_id: null,
        },
      });
      hallIdx++;
      lectureCount++;
    }

    // Practical lectures — one per group
    if (course.course_type === "THEORITICAL_AND_PRACTICAL") {
      const practicalSlot = practicalSlots[ci % practicalSlots.length];

      for (const group of groups) {
        const teacher = teachers[teacherIdx % teachers.length];
        teacherIdx++;

        const existingPractical = await prisma.lecture.findFirst({
          where: {
            day: practicalSlot.day,
            time_box_order: practicalSlot.time_box_order,
            section_id: section1.id,
            group_id: group.id,
            lecture_type: "PRACTICAL",
          },
        });

        if (!existingPractical) {
          await prisma.lecture.create({
            data: {
              day: practicalSlot.day,
              time_box_order: practicalSlot.time_box_order,
              lecture_type: "PRACTICAL",
              course_id: course.id,
              location_id: labs[labIdx % labs.length].id,
              instructor_id: teacher.id,
              section_id: section1.id,
              major_id: null,
              group_id: group.id,
            },
          });
          labIdx++;
          lectureCount++;
        }
      }
    }
  }

  console.log(`   ✔ 8 locations (4 halls, 4 labs) and ${lectureCount} lectures created.`);
}
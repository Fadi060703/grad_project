import { PrismaClient } from "../../generated/prisma/client";
import { SeedStructure } from "./03_structure.seed";
import bcrypt from "bcrypt";

// Arabic first names and last names pool
const firstNames = [
  "أحمد", "محمد", "علي", "عمر", "خالد", "يوسف", "إبراهيم", "سعد", "فيصل", "طارق",
  "فاطمة", "مريم", "سارة", "نورة", "هدى", "ريم", "لمى", "دينا", "غادة", "أميرة",
  "عبدالله", "عبدالرحمن", "ناصر", "منصور", "بندر", "زياد", "وليد", "راشد", "سلطان", "تركي",
];

const lastNames = [
  "العلي", "الزهراني", "النجار", "الغامدي", "الشمري", "المطيري", "القحطاني", "الحربي", "العمري", "الدوسري",
  "العتيبي", "البقمي", "الرشيدي", "الجهني", "العصيمي", "السبيعي", "الصاعدي", "العجمي", "العنزي", "الأسمري",
];

function studentName(index: number): string {
  return `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length) % lastNames.length]}`;
}

export async function seedStudents(prisma: PrismaClient, structure: SeedStructure) {
  console.log("🎓 Seeding students and enrollments...");

  const hashedPassword = await bcrypt.hash("Password@123", 10);
  const { years, sectionsByYear, majorsByYear, groupsBySection, groupsByMajor } = structure;

  let studentCount = 0;
  let globalStudentIndex = 0;

  for (let yi = 0; yi < years.length; yi++) {
    const year = years[yi];
    const isSection = yi < 3;

    const containers = isSection
      ? (sectionsByYear.get(year.id) ?? [])
      : (majorsByYear.get(year.id) ?? []);

    for (const container of containers) {
      // Get groups for this container
      const groups = isSection
        ? (groupsBySection.get(container.id) ?? [])
        : (groupsByMajor.get(container.id) ?? []);

      // Get courses for this container
      const courses = await prisma.course.findMany({
        where: isSection
          ? { section_id: container.id }
          : { major_id: container.id },
      });

      for (const group of groups) {
        for (let si = 0; si < 10; si++) {
          const nameStr = studentName(globalStudentIndex);
          const username = `student_${String(globalStudentIndex + 1).padStart(4, "0")}`;
          globalStudentIndex++;

          // Create user
          const user = await prisma.user.upsert({
            where: { username },
            update: {},
            create: {
              username,
              full_name: nameStr,
              email: `${username}@student.university.edu`,
              phone_number: `05${String(10000000 + globalStudentIndex).slice(1)}`,
              role: "STUDENT",
              password: hashedPassword,
              is_active: true,
            },
          });

          // Create student record
          const studentData = isSection
            ? {
                userId: user.id,
                mother_name: `أم ${nameStr.split(" ")[0]}`,
                year_id: year.id,
                section_id: container.id,
                major_id: null,
                group_id: group.id,
              }
            : {
                userId: user.id,
                mother_name: `أم ${nameStr.split(" ")[0]}`,
                year_id: year.id,
                section_id: null,
                major_id: container.id,
                group_id: group.id,
              };

          const student = await prisma.student.upsert({
            where: { userId: user.id },
            update: {},
            create: studentData,
          });

          // Enroll student in all courses of their section/major
          for (const course of courses) {
            await prisma.studentCourse.upsert({
              where: {
                student_id_course_id: {
                  student_id: student.student_id,
                  course_id: course.id,
                },
              },
              update: {},
              create: {
                student_id: student.student_id,
                course_id: course.id,
                status: "ENROLLED",
              },
            });
          }

          studentCount++;
        }
      }
    }
  }

  console.log(`   ✔ ${studentCount} students created and enrolled in their courses.`);
}
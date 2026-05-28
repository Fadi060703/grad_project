import { PrismaClient, User } from "../../generated/prisma/client";
import { SeedStructure } from "./03_structure.seed";

// 5 courses per year, gradually increasing in complexity
// Each course is created once per year and linked to all sections/majors
// in that year.

const coursesByYear: {
  name: string;
  course_type: "THEORITICAL_ONLY" | "THEORITICAL_AND_PRACTICAL";
  exam_type: "MSQ" | "WRITTEN";
  theoretical_grade: number;
  practical_grade: number;
}[][] = [
  // Year 1 — foundational
  [
    {
      name: "مقدمة في علوم الحاسوب",
      course_type: "THEORITICAL_ONLY",
      exam_type: "MSQ",
      theoretical_grade: 60,
      practical_grade: 0,
    },
    {
      name: "رياضيات للحاسوب",
      course_type: "THEORITICAL_ONLY",
      exam_type: "WRITTEN",
      theoretical_grade: 60,
      practical_grade: 0,
    },
    {
      name: "أساسيات البرمجة",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "مهارات الحاسوب والإنترنت",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "MSQ",
      theoretical_grade: 30,
      practical_grade: 30,
    },
    {
      name: "منطق رقمي",
      course_type: "THEORITICAL_ONLY",
      exam_type: "MSQ",
      theoretical_grade: 60,
      practical_grade: 0,
    },
  ],
  // Year 2 — intermediate
  [
    {
      name: "هياكل البيانات والخوارزميات",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "أنظمة التشغيل",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "قواعد البيانات",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "برمجة كائنية التوجه",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "الجبر الخطي وتطبيقاته",
      course_type: "THEORITICAL_ONLY",
      exam_type: "WRITTEN",
      theoretical_grade: 60,
      practical_grade: 0,
    },
  ],
  // Year 3 — advanced core
  [
    {
      name: "هندسة البرمجيات",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "شبكات الحاسوب",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "أمن المعلومات",
      course_type: "THEORITICAL_ONLY",
      exam_type: "MSQ",
      theoretical_grade: 60,
      practical_grade: 0,
    },
    {
      name: "تحليل وتصميم الأنظمة",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "احتمالات وإحصاء",
      course_type: "THEORITICAL_ONLY",
      exam_type: "WRITTEN",
      theoretical_grade: 60,
      practical_grade: 0,
    },
  ],
  // Year 4 — specialization (برمجيات)
  [
    {
      name: "تطوير تطبيقات الويب",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "تطوير تطبيقات الجوال",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "الذكاء الاصطناعي",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "إدارة مشاريع البرمجيات",
      course_type: "THEORITICAL_ONLY",
      exam_type: "WRITTEN",
      theoretical_grade: 60,
      practical_grade: 0,
    },
    {
      name: "اختبار وجودة البرمجيات",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "MSQ",
      theoretical_grade: 40,
      practical_grade: 20,
    },
  ],
  // Year 5 — advanced specialization
  [
    {
      name: "الحوسبة السحابية",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "تعلم الآلة",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 40,
      practical_grade: 20,
    },
    {
      name: "أنظمة موزعة",
      course_type: "THEORITICAL_ONLY",
      exam_type: "WRITTEN",
      theoretical_grade: 60,
      practical_grade: 0,
    },
    {
      name: "مشروع التخرج",
      course_type: "THEORITICAL_AND_PRACTICAL",
      exam_type: "WRITTEN",
      theoretical_grade: 30,
      practical_grade: 30,
    },
    {
      name: "أخلاقيات تقنية المعلومات",
      course_type: "THEORITICAL_ONLY",
      exam_type: "MSQ",
      theoretical_grade: 60,
      practical_grade: 0,
    },
  ],
];

// Helper: pick N items cyclically from array
function pickCyclic<T>(arr: T[], count: number, offset: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    result.push(arr[(offset + i) % arr.length]);
  }
  return result;
}

export async function seedCourses(
  prisma: PrismaClient,
  structure: SeedStructure,
  doctors: User[],
  teachers: User[],
) {
  console.log("📚 Seeding courses and assigning staff...");

  const { years, sectionsByYear, majorsByYear } = structure;
  let courseCount = 0;
  let doctorOffset = 0;
  let teacherOffset = 0;

  for (let yi = 0; yi < years.length; yi++) {
    const year = years[yi];
    const templates = coursesByYear[yi];
    const hasMajors = year.has_majors;
    const sections = sectionsByYear.get(year.id) ?? [];
    const majors = majorsByYear.get(year.id) ?? [];
    const sectionIds = hasMajors ? [] : sections.map((section) => section.id);
    const majorIds = hasMajors ? majors.map((major) => major.id) : [];

    for (const template of templates) {
      // Assign 1-2 doctors, 2-3 teachers per course (cyclic distribution)
      const assignedDoctors = pickCyclic(
        doctors,
        doctorOffset % 2 === 0 ? 1 : 2,
        doctorOffset,
      );
      const assignedTeachers = pickCyclic(
        teachers,
        teacherOffset % 3 === 0 ? 2 : 3,
        teacherOffset,
      );
      doctorOffset++;
      teacherOffset++;

      const course = await prisma.course.findUnique({
        where: {
          name: template.name,
        },
      });

      if (!course) {
        await prisma.course.create({
          data: {
            ...template,
            year_id: year.id,
            sectionCourses: sectionIds.length
              ? { create: sectionIds.map((section_id) => ({ section_id })) }
              : undefined,
            majorCourses: majorIds.length
              ? { create: majorIds.map((major_id) => ({ major_id })) }
              : undefined,
            doctors: { connect: assignedDoctors.map((d) => ({ id: d.id })) },
            teachers: {
              connect: assignedTeachers.map((t) => ({ id: t.id })),
            },
          },
        });
        courseCount++;
      }
    }
  }

  console.log(`   ✔ ${courseCount} courses created and staff assigned.`);
}

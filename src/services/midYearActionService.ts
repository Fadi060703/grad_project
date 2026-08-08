import { prisma } from "../lib/prisma";
import { BadRequestError } from "../errors";
import { MidYearActionInput } from "../validators/actions";

interface StudentRecord {
  student_id: number;
  year_id: number;
  section_id: number | null;
  major_id: number | null;
  is_failed: boolean;
  courses: Array<{
    course_id: number;
    course: {
      id: number;
      name: string;
    };
  }>;
  marks: Array<{
    course_id: number;
    practical_grade: number;
    theoretical_grade: number;
  }>;
}

interface SectionCourseRecord {
  course_id: number;
  section_id: number;
  course: { id: number };
}

interface MajorCourseRecord {
  course_id: number;
  major_id: number;
  course: { id: number };
}

interface DirectCourseRecord {
  id: number;
  year_id: number;
}

export async function executeMidYearAction(_input: MidYearActionInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const db = tx as any;

    const settings = await db.systemSettings.findFirst({
      orderBy: { id: "desc" },
      select: {
        id: true,
        current_academic_key: true,
        passing_grade: true,
        aided_pass_courses_number: true,
      },
    });

    if (!settings) {
      throw new BadRequestError("إعدادات النظام غير موجودة");
    }

    const currentAcademicKey = settings.current_academic_key ?? "";
    const nextAcademicKey = calculateSecondAcademicKey(settings.current_academic_key);
    const passingGrade = settings.passing_grade ?? 60;
    const aidedPassCoursesNumber = settings.aided_pass_courses_number ?? 0;

    const [students, sectionCourses, majorCourses, directCourses] = await Promise.all([
      db.student.findMany({
        select: {
          student_id: true,
          year_id: true,
          section_id: true,
          major_id: true,
          is_failed: true,
          courses: {
            select: {
              course_id: true,
              course: {
                select: { id: true, name: true },
              },
            },
          },
          marks: {
            where: { academic_key: currentAcademicKey },
            select: {
              course_id: true,
              practical_grade: true,
              theoretical_grade: true,
            },
          },
        },
      }),
      db.sectionCourse.findMany({
        where: { course: { semester: "SECOND" } },
        select: { course_id: true, section_id: true, course: { select: { id: true } } },
      }),
      db.majorCourse.findMany({
        where: { course: { semester: "SECOND" } },
        select: { course_id: true, major_id: true, course: { select: { id: true } } },
      }),
      db.course.findMany({
        where: {
          semester: "SECOND",
          sectionCourses: { none: {} },
          majorCourses: { none: {} },
        },
        select: { id: true, year_id: true },
      }),
    ]);

    const detachPlans = buildDetachPlans(students, passingGrade);

    for (const plan of detachPlans) {
      if (plan.passedCourseIds.length > 0) {
        await db.studentCourse.deleteMany({
          where: {
            student_id: plan.student_id,
            course_id: { in: plan.passedCourseIds },
          },
        });
      }
    }

    const attachments = buildSecondSemesterAttachments(
      students,
      detachPlans,
      sectionCourses,
      majorCourses,
      directCourses,
      aidedPassCoursesNumber,
    );

    for (const chunk of chunkArray(attachments, 1000)) {
      await db.studentCourse.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }

    await db.weeklyLecture.deleteMany();

    await db.systemSettings.update({
      where: { id: settings.id },
      data: { current_academic_key: nextAcademicKey },
    });
  });
}

function calculateSecondAcademicKey(previousKey: string | null): string {
  const normalizedKey = previousKey?.trim() ?? "";

  if (!normalizedKey || normalizedKey.startsWith("SECOND")) {
    return `SECOND_${new Date().getFullYear()}`;
  }

  const match = /^FIRST_(\d{4})$/.exec(normalizedKey);

  if (match) {
    return `SECOND_${match[1]}`;
  }

  return `SECOND_${new Date().getFullYear()}`;
}

function buildDetachPlans(students: StudentRecord[], passingGrade: number) {
  return students.map((student) => {
    const marksLookup = new Map<number, number>();

    for (const mark of student.marks) {
      marksLookup.set(mark.course_id, mark.practical_grade + mark.theoretical_grade);
    }

    const passedCourseIds: number[] = [];
    const remainingFailedCourseIds: number[] = [];

    for (const studentCourse of student.courses) {
      const totalGrade = marksLookup.get(studentCourse.course_id) ?? 0;

      if (totalGrade >= passingGrade) {
        passedCourseIds.push(studentCourse.course_id);
      } else {
        remainingFailedCourseIds.push(studentCourse.course_id);
      }
    }

    return {
      student_id: student.student_id,
      passedCourseIds,
      remainingFailedCourseIds,
    };
  });
}

function buildSecondSemesterAttachments(
  students: StudentRecord[],
  detachPlans: ReturnType<typeof buildDetachPlans>,
  sectionCourses: SectionCourseRecord[],
  majorCourses: MajorCourseRecord[],
  directCourses: DirectCourseRecord[],
  aidedPassCoursesNumber: number,
): Array<{ student_id: number; course_id: number }> {
  const detachPlanMap = new Map(detachPlans.map((plan) => [plan.student_id, plan]));
  const sectionCourseMap = mapCourseIdsByScope(sectionCourses, "section_id", "course_id");
  const majorCourseMap = mapCourseIdsByScope(majorCourses, "major_id", "course_id");
  const directCourseMap = mapCourseIdsByScope(directCourses, "year_id", "id");
  const attachments: Array<{ student_id: number; course_id: number }> = [];

  for (const student of students) {
    const courseIds = new Set<number>(directCourseMap.get(student.year_id) ?? []);

    if (student.section_id !== null) {
      for (const courseId of sectionCourseMap.get(student.section_id) ?? []) {
        courseIds.add(courseId);
      }
    }

    if (student.major_id !== null) {
      for (const courseId of majorCourseMap.get(student.major_id) ?? []) {
        courseIds.add(courseId);
      }
    }

    const sortedCourseIds = [...courseIds].sort((a, b) => a - b);
    const plan = detachPlanMap.get(student.student_id);
    const remainingFailedCount = plan?.remainingFailedCourseIds.length ?? 0;
    const allowedCount = student.is_failed
      ? Math.min(2, Math.max(0, aidedPassCoursesNumber - remainingFailedCount))
      : sortedCourseIds.length;

    for (const courseId of sortedCourseIds.slice(0, allowedCount)) {
      attachments.push({ student_id: student.student_id, course_id: courseId });
    }
  }

  return attachments;
}

function mapCourseIdsByScope<T extends Record<string, any>>(
  records: T[],
  scopeKey: keyof T,
  courseKey: keyof T,
): Map<number, number[]> {
  const map = new Map<number, number[]>();

  for (const record of records) {
    const scopeId = record[scopeKey] as number;
    const courseId = record[courseKey] as number;
    const courseIds = map.get(scopeId) ?? [];
    courseIds.push(courseId);
    map.set(scopeId, courseIds);
  }

  for (const [scopeId, courseIds] of map.entries()) {
    map.set(scopeId, courseIds.sort((a, b) => a - b));
  }

  return map;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

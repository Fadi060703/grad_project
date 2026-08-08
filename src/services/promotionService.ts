import { prisma } from "../lib/prisma";
import {
  EndYearActionResult,
  StudentPromotionResult,
  CourseResult,
  PromotionState,
} from "../types/promotion";

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function executeEndYearAction(): Promise<EndYearActionResult> {
  return prisma.$transaction(async (tx) => {
    const result = await buildEndYearActionResult(tx);
    await applyEndYearAction(tx, result.students);
    await tx.weeklyLecture.deleteMany();
    return result;
  });
}

// ─── Build action plan ────────────────────────────────────────────────────────

async function buildEndYearActionResult(db: any): Promise<EndYearActionResult> {
  const settings = await db.systemSettings.findFirst({
    orderBy: { id: "desc" },
  });

  if (!settings) {
    throw new Error("System settings not found");
  }

  const passingGrade = settings.passing_grade ?? 60;
  const aidedMarksNumber = settings.aided_marks_number ?? 0;
  const aidedPassCoursesNumber = settings.aided_pass_courses_number ?? 0;
  const academicKey = settings.current_academic_key ?? "";

  const allYears: Array<{ id: number; name: string; order: number }> = await db.year.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true, order: true },
  });

  const yearOrderMap = new Map<number, { id: number; name: string; order: number }>(
    allYears.map((year) => [year.id, year]),
  );
  const nextYearMap = new Map<number, { id: number; name: string } | null>();

  for (let i = 0; i < allYears.length; i++) {
    const current = allYears[i];
    const next = allYears[i + 1] ?? null;
    nextYearMap.set(current.id, next ? { id: next.id, name: next.name } : null);
  }

  const students = await db.student.findMany({
    select: {
      student_id: true,
      year_id: true,
      user: {
        select: {
          id: true,
          full_name: true,
          username: true,
        },
      },
      courses: {
        select: {
          course_id: true,
          course: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      marks: {
        where: {
          academic_key: academicKey,
        },
        select: {
          course_id: true,
          practical_grade: true,
          theoretical_grade: true,
        },
      },
    },
  });

  const results: StudentPromotionResult[] = students.map((student: any) => {
    return evaluateStudent({
      student,
      passingGrade,
      aidedMarksNumber,
      aidedPassCoursesNumber,
      nextYearMap,
      yearOrderMap,
    });
  });

  const summary = {
    total_students: results.length,
    fully_passed: results.filter((result) => result.state === "FULLY_PASSED").length,
    graduated: results.filter((result) => result.state === "GRADUATED").length,
    moved: results.filter((result) => result.state === "MOVED").length,
    failed: results.filter((result) => result.state === "FAILED").length,
  };

  return {
    executed_at: new Date().toISOString(),
    academic_key: academicKey,
    settings: {
      passing_grade: passingGrade,
      aided_marks_number: aidedMarksNumber,
      aided_pass_courses_number: aidedPassCoursesNumber,
    },
    summary,
    students: results,
  };
}

// ─── Per-student evaluation ───────────────────────────────────────────────────

function evaluateStudent({
  student,
  passingGrade,
  aidedMarksNumber,
  aidedPassCoursesNumber,
  nextYearMap,
  yearOrderMap,
}: {
  student: any;
  passingGrade: number;
  aidedMarksNumber: number;
  aidedPassCoursesNumber: number;
  nextYearMap: Map<number, { id: number; name: string } | null>;
  yearOrderMap: Map<number, { id: number; name: string; order: number }>;
}): StudentPromotionResult {
  const currentYear = yearOrderMap.get(student.year_id);

  if (!currentYear) {
    throw new Error(`Year not found for student ${student.student_id}`);
  }

  const nextYear = nextYearMap.get(student.year_id) ?? null;
  const isLastYear = nextYear === null;

  const marksLookup = new Map<number, number>();
  for (const mark of student.marks) {
    const total = mark.practical_grade + mark.theoretical_grade;
    marksLookup.set(mark.course_id, total);
  }

  const courseResults: CourseResult[] = student.courses.map((studentCourse: any) => {
    const course = studentCourse.course;
    const totalGrade = marksLookup.get(studentCourse.course_id) ?? 0;
    const deficit = Math.max(0, passingGrade - totalGrade);
    const passed = deficit === 0;

    return {
      course_id: course.id,
      course_name: course.name,
      total_grade: totalGrade,
      passing_grade: passingGrade,
      deficit,
      passed,
      aided: false,
    };
  });

  const failedCourses = courseResults.filter((course) => !course.passed);
  const totalDeficit = failedCourses.reduce((sum, course) => sum + course.deficit, 0);

  let aidedMarksUsed = 0;
  let effectivelyFailedCount = failedCourses.length;

  if (failedCourses.length > 0 && totalDeficit <= aidedMarksNumber) {
    for (const course of failedCourses) {
      course.aided = true;
      course.passed = true;
    }

    aidedMarksUsed = totalDeficit;
    effectivelyFailedCount = 0;
  }

  let state: PromotionState;

  if (effectivelyFailedCount === 0) {
    state = isLastYear ? "GRADUATED" : "FULLY_PASSED";
  } else if (effectivelyFailedCount <= aidedPassCoursesNumber) {
    state = "MOVED";
  } else {
    state = "FAILED";
  }

  const coursesToKeep: number[] = [];
  const coursesToDetach: number[] = [];

  if (state === "FULLY_PASSED" || state === "GRADUATED") {
    courseResults.forEach((course) => coursesToDetach.push(course.course_id));
  } else {
    courseResults.forEach((course) => {
      if (course.passed) {
        coursesToDetach.push(course.course_id);
      } else {
        coursesToKeep.push(course.course_id);
      }
    });
  }

  const movesToNextYear = state === "FULLY_PASSED" || state === "MOVED";

  return {
    student_id: student.student_id,
    user_id: student.user.id,
    full_name: student.user.full_name,
    username: student.user.username,
    current_year_id: student.year_id,
    current_year_name: currentYear.name,
    next_year_id: movesToNextYear ? (nextYear?.id ?? null) : null,
    next_year_name: movesToNextYear ? (nextYear?.name ?? null) : null,
    state,
    total_courses: courseResults.length,
    passed_courses: courseResults.filter((course) => course.passed).length,
    failed_courses: effectivelyFailedCount,
    aided_marks_used: aidedMarksUsed,
    courses: courseResults,
    courses_to_keep: coursesToKeep,
    courses_to_detach: coursesToDetach,
  };
}

// ─── Apply DB mutations ───────────────────────────────────────────────────────

async function applyEndYearAction(
  db: any,
  students: StudentPromotionResult[],
): Promise<void> {
  for (const result of students) {
    if (result.state === "GRADUATED") {
      await deleteGraduatedStudent(db, result);
      continue;
    }

    if (result.courses_to_detach.length > 0) {
      await db.studentCourse.deleteMany({
        where: {
          student_id: result.student_id,
          course_id: { in: result.courses_to_detach },
        },
      });
    }

    if (result.state === "FAILED") {
      await db.student.update({
        where: { student_id: result.student_id },
        data: { is_failed: true },
      });
      continue;
    }

    if (
      (result.state === "FULLY_PASSED" || result.state === "MOVED") &&
      result.next_year_id !== null
    ) {
      await db.student.update({
        where: { student_id: result.student_id },
        data: {
          year_id: result.next_year_id,
          section_id: null,
          major_id: null,
          is_failed: false,
        },
      });
    }
  }
}

async function deleteGraduatedStudent(
  db: any,
  result: StudentPromotionResult,
): Promise<void> {
  await db.mark.deleteMany({
    where: { student_id: result.student_id },
  });

  await db.studentCourse.deleteMany({
    where: { student_id: result.student_id },
  });

  await db.student.delete({
    where: { student_id: result.student_id },
  });

  await db.user.delete({
    where: { id: result.user_id },
  });
}

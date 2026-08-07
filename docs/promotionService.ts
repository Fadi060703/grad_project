import { prisma } from "../lib/prisma";
import {
  PromotionPreviewResult,
  StudentPromotionResult,
  CourseResult,
  PromotionState,
} from "../types/promotion";

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generatePromotionPreview(): Promise<PromotionPreviewResult> {
  // 1. Load system settings
  const settings = await prisma.systemSettings.findFirst({
    orderBy: { id: "desc" },
  });

  if (!settings) {
    throw new Error("System settings not found");
  }

  const passingGrade = settings.passing_grade ?? 60;
  const aidedMarksNumber = settings.aided_marks_number ?? 0;
  const aidedPassCoursesNumber = settings.aided_pass_courses_number ?? 0;

  // 2. Load all years ordered by `order` field (to find next year)
  const allYears = await prisma.year.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true, order: true },
  });

  const yearOrderMap = new Map(allYears.map((y) => [y.id, y]));

  // Build next-year lookup: yearId → nextYear
  const nextYearMap = new Map<number, { id: number; name: string } | null>();
  for (let i = 0; i < allYears.length; i++) {
    const current = allYears[i];
    const next = allYears[i + 1] ?? null;
    nextYearMap.set(current.id, next ? { id: next.id, name: next.name } : null);
  }

  // 3. Load all students with their courses and marks
  const students = await prisma.student.findMany({
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
          status: true,
          course: {
            select: {
              id: true,
              name: true,
              course_type: true,
              marks_course_id: true,
            },
          },
        },
      },
      marks: {
        select: {
          marks_course_id: true,
          practical_grade: true,
          theoretical_grade: true,
          marks_course: {
            select: {
              courses: {
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  // 4. Process each student
  const results: StudentPromotionResult[] = students.map((student) => {
    return evaluateStudent({
      student,
      passingGrade,
      aidedMarksNumber,
      aidedPassCoursesNumber,
      nextYearMap,
      yearOrderMap,
    });
  });

  // 5. Build summary
  const summary = {
    total_students: results.length,
    fully_passed: results.filter((r) => r.state === "FULLY_PASSED").length,
    graduated: results.filter((r) => r.state === "GRADUATED").length,
    moved: results.filter((r) => r.state === "MOVED").length,
    failed: results.filter((r) => r.state === "FAILED").length,
  };

  return {
    generated_at: new Date().toISOString(),
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
  const currentYear = yearOrderMap.get(student.year_id)!;
  const nextYear = nextYearMap.get(student.year_id) ?? null;
  const isLastYear = nextYear === null;

  // ── Build course results ──────────────────────────────────────────────────

  // Build a marks lookup: marks_course_id → total grade
  const marksLookup = new Map<number, number>();
  for (const mark of student.marks) {
    const total = mark.practical_grade + mark.theoretical_grade;
    // A marks_course may map to multiple courses; store by marks_course_id
    marksLookup.set(mark.marks_course_id, total);
  }

  const courseResults: CourseResult[] = student.courses.map((sc: any) => {
    const course = sc.course;

    // Find total grade via marks_course_id link
    let totalGrade = 0;
    if (course.marks_course_id !== null) {
      totalGrade = marksLookup.get(course.marks_course_id) ?? 0;
    }

    const deficit = Math.max(0, passingGrade - totalGrade);
    const passed = deficit === 0;

    return {
      course_id: course.id,
      course_name: course.name,
      total_grade: totalGrade,
      passing_grade: passingGrade,
      deficit,
      passed,
      aided: false, // will be updated below if aided
    };
  });

  // ── Separate passed / failed ──────────────────────────────────────────────

  const failedCourses = courseResults.filter((c) => !c.passed);
  const passedCourses = courseResults.filter((c) => c.passed);

  const totalDeficit = failedCourses.reduce((sum, c) => sum + c.deficit, 0);

  // ── Apply aided marks logic ───────────────────────────────────────────────
  // Aid is only applied if ALL failed courses can be rescued within the pool.
  // Rule: total deficit across ALL failed courses <= aided_marks_number

  let aidedMarksUsed = 0;
  let effectivelyFailedCount = failedCourses.length;

  if (failedCourses.length > 0 && totalDeficit <= aidedMarksNumber) {
    // All failed courses can be rescued — mark them as aided
    for (const course of failedCourses) {
      course.aided = true;
      course.passed = true; // aided = effectively passed
    }
    aidedMarksUsed = totalDeficit;
    effectivelyFailedCount = 0;
  }

  // ── Determine promotion state ─────────────────────────────────────────────

  let state: PromotionState;

  if (effectivelyFailedCount === 0) {
    // Passed all (either genuinely or with aid)
    state = isLastYear ? "GRADUATED" : "FULLY_PASSED";
  } else if (effectivelyFailedCount <= aidedPassCoursesNumber) {
    // Failed some but within the allowable moved threshold
    state = "MOVED";
  } else {
    state = "FAILED";
  }

  // ── Determine course attachment changes ──────────────────────────────────
  // FULLY_PASSED / GRADUATED → detach all courses (clean slate / graduated)
  // MOVED → keep failed courses, detach passed courses
  // FAILED → no changes (stays in same year with all courses)

  const coursesToKeep: number[] = [];
  const coursesToDetach: number[] = [];

  if (state === "FULLY_PASSED" || state === "GRADUATED") {
    courseResults.forEach((c) => coursesToDetach.push(c.course_id));
  } else if (state === "MOVED") {
    courseResults.forEach((c) => {
      if (!c.passed || c.aided) {
        // Keep actually failed courses (aided ones are effectively passed, detach them)
        coursesToKeep.push(c.course_id);
      } else {
        coursesToDetach.push(c.course_id);
      }
    });
  }
  // FAILED: both arrays stay empty — no changes

  // ── Next year assignment ──────────────────────────────────────────────────

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
    passed_courses: courseResults.filter((c) => c.passed).length,
    failed_courses: effectivelyFailedCount,
    aided_marks_used: aidedMarksUsed,
    courses: courseResults,
    courses_to_keep: coursesToKeep,
    courses_to_detach: coursesToDetach,
  };
}

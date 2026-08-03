import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors";

const SEMESTER_WEEKS = 12;
const RECENT_DAYS = 30;
const DEFAULT_SMALL_LIMIT = 5;
const DEFAULT_MARKS_COVERAGE_LIMIT = 10;
const ANNOUNCEMENT_TYPES = ["REGULAR", "IMPORTANT", "EMERGENCY"] as const;
const WEEK_DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"] as const;

type AuthUser = { id: number | string; role: string };
type LectureTypeFilter = "THEORETICAL" | "PRACTICAL";
type DashboardFilters = {
  year_id?: number;
  section_id?: number;
  major_id?: number;
  group_id?: number;
  course_id?: number;
  from_date?: Date;
  to_date?: Date;
  type?: LectureTypeFilter;
};
type DateRange = { start: Date; end_exclusive: Date };
type AttendanceLecture = {
  id: number;
  lecture_date: Date;
  attendances: { has_attended: boolean }[];
  lecture: {
    id: number;
    course_id: number;
    group_id: number | null;
    course: { id: number; name: string };
    group: { id: number; name: string } | null;
    instructor?: { id: number; full_name: string };
  };
};

type AttendanceSummary = {
  attendance_rate: number;
  attended_count: number;
  expected_count: number;
  absence_count: number;
  given_lectures_count: number;
};

function getAuthUser(req: Request) {
  const { id, role } = req.user as AuthUser;
  const user_id = Number(id);

  if (!Number.isInteger(user_id) || user_id <= 0) {
    throw new ForbiddenError("Invalid authenticated user");
  }

  return { user_id, role };
}

function getSingleQueryValue(value: unknown) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseOptionalPositiveInt(req: Request, key: keyof DashboardFilters) {
  const value = getSingleQueryValue(req.query[key as string]);
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`Invalid ${String(key)}`);
  }

  return parsed;
}

function parseOptionalDate(req: Request, key: "from_date" | "to_date") {
  const value = getSingleQueryValue(req.query[key]);
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value !== "string") {
    throw new BadRequestError(`Invalid ${key}`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`Invalid ${key}`);
  }

  return parsed;
}

function parseOptionalType(req: Request) {
  const value = getSingleQueryValue(req.query.type);
  if (value === undefined || value === null || value === "") return undefined;

  if (value !== "THEORETICAL" && value !== "PRACTICAL") {
    throw new BadRequestError("type must be THEORETICAL or PRACTICAL");
  }

  return value;
}

function parseFilters(req: Request): DashboardFilters {
  const filters: DashboardFilters = {
    year_id: parseOptionalPositiveInt(req, "year_id"),
    section_id: parseOptionalPositiveInt(req, "section_id"),
    major_id: parseOptionalPositiveInt(req, "major_id"),
    group_id: parseOptionalPositiveInt(req, "group_id"),
    course_id: parseOptionalPositiveInt(req, "course_id"),
    from_date: parseOptionalDate(req, "from_date"),
    to_date: parseOptionalDate(req, "to_date"),
    type: parseOptionalType(req),
  };

  if (filters.section_id && filters.major_id) {
    throw new BadRequestError("Cannot filter by both section_id and major_id");
  }

  if (filters.from_date && filters.to_date && filters.from_date > filters.to_date) {
    throw new BadRequestError("from_date must be before to_date");
  }

  return filters;
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getToday() {
  return startOfLocalDay(new Date());
}

function getCurrentAcademicWeekRange(): DateRange {
  const today = getToday();
  const day = today.getDay();
  const start = addDays(today, -day);
  const end_exclusive = addDays(start, 5);

  return { start, end_exclusive };
}

function getRecentDate() {
  const date = new Date();
  date.setDate(date.getDate() - RECENT_DAYS);
  return date;
}

function getSelectedDateRange(filters: DashboardFilters, fallback: DateRange): DateRange {
  const start = filters.from_date ? startOfLocalDay(filters.from_date) : fallback.start;
  const end_exclusive = filters.to_date
    ? addDays(startOfLocalDay(filters.to_date), 1)
    : fallback.end_exclusive;

  return { start, end_exclusive };
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return roundNumber((numerator / denominator) * 100);
}

function response(res: Response, data: unknown) {
  return res.status(200).json({ success: true, data });
}

async function getCurrentAcademicKeyOrThrow() {
  const settings = await prisma.systemSettings.findFirst({
    select: { current_academic_key: true },
  });

  if (!settings?.current_academic_key) {
    throw new BadRequestError("Current academic key is not configured");
  }

  return settings.current_academic_key;
}

function dateWhere(range?: DateRange) {
  if (!range) return {};
  return {
    gte: range.start,
    lt: range.end_exclusive,
  };
}

function applyLectureFilters(filters: DashboardFilters, base: any = {}) {
  const where: any = { ...base };

  if (filters.course_id) where.course_id = filters.course_id;
  if (filters.type) where.lecture_type = filters.type;
  if (filters.group_id) where.group_id = filters.group_id;
  if (filters.section_id) where.section_id = filters.section_id;
  if (filters.major_id) where.major_id = filters.major_id;
  if (filters.year_id) where.course = { ...(where.course ?? {}), year_id: filters.year_id };

  return where;
}

function applyCourseFilters(filters: DashboardFilters, base: any = {}) {
  const where: any = { ...base };

  if (filters.course_id) where.id = filters.course_id;
  if (filters.year_id) where.year_id = filters.year_id;
  if (filters.section_id) {
    where.sectionCourses = { some: { section_id: filters.section_id } };
  }
  if (filters.major_id) {
    where.majorCourses = { some: { major_id: filters.major_id } };
  }

  return where;
}

function applyStudentFilters(filters: DashboardFilters, base: any = {}) {
  const where: any = { ...base };

  if (filters.year_id) where.year_id = filters.year_id;
  if (filters.section_id) where.section_id = filters.section_id;
  if (filters.major_id) where.major_id = filters.major_id;
  if (filters.group_id) where.group_id = filters.group_id;
  if (filters.course_id) where.courses = { some: { course_id: filters.course_id } };

  return where;
}

function buildGivenPracticalWeeklyWhere(lectureWhere: any, range?: DateRange): any {
  return {
    status: "PUBLISHED",
    lecture_date: { lte: getToday(), ...dateWhere(range) },
    lecture: { ...lectureWhere, lecture_type: "PRACTICAL" },
  };
}

function buildGivenTheoreticalWeeklyWhere(lectureWhere: any, range?: DateRange): any {
  return {
    status: { not: "CANCELLED" },
    lecture_date: { lte: getToday(), ...dateWhere(range) },
    lecture: { ...lectureWhere, lecture_type: "THEORETICAL" },
  };
}

function buildUpcomingDraftWeeklyWhere(lectureWhere: any, lectureType: LectureTypeFilter): any {
  return {
    status: "DRAFT",
    lecture_date: { gt: getToday() },
    lecture: { ...lectureWhere, lecture_type: lectureType },
  };
}

async function getGroupStudentCounts(groupIds: number[]) {
  const ids = Array.from(new Set(groupIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (ids.length === 0) return new Map<number, number>();

  const grouped = await (prisma.student as any).groupBy({
    by: ["group_id"],
    where: { group_id: { in: ids } },
    _count: { _all: true },
  });

  return new Map<number, number>(
    grouped.map((item: any) => [item.group_id, item._count._all]),
  );
}

function summarizeAttendance(
  lectures: AttendanceLecture[],
  groupStudentCounts: Map<number, number>,
): AttendanceSummary {
  let attended_count = 0;
  let expected_count = 0;

  for (const weeklyLecture of lectures) {
    const groupId = weeklyLecture.lecture.group_id;
    const expectedForLecture = groupId ? groupStudentCounts.get(groupId) ?? 0 : 0;
    expected_count += expectedForLecture;
    attended_count += weeklyLecture.attendances.filter((attendance) => attendance.has_attended).length;
  }

  const absence_count = Math.max(expected_count - attended_count, 0);

  return {
    attendance_rate: percent(attended_count, expected_count),
    attended_count,
    expected_count,
    absence_count,
    given_lectures_count: lectures.length,
  };
}

async function getAttendanceBreakdown(lectureWhere: any, includeInstructor = false) {
  const academicWeek = getCurrentAcademicWeekRange();
  const include = {
    attendances: { select: { has_attended: true } },
    lecture: {
      select: {
        id: true,
        course_id: true,
        group_id: true,
        course: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        ...(includeInstructor
          ? { instructor: { select: { id: true, full_name: true } } }
          : {}),
      },
    },
  } as any;

  const [weekLectures, semesterLectures] = await Promise.all([
    (prisma.weeklyLecture as any).findMany({
      where: buildGivenPracticalWeeklyWhere(lectureWhere, academicWeek),
      include,
    }),
    (prisma.weeklyLecture as any).findMany({
      where: buildGivenPracticalWeeklyWhere(lectureWhere),
      include,
    }),
  ]);

  const typedSemesterLectures = semesterLectures as AttendanceLecture[];
  const typedWeekLectures = weekLectures as AttendanceLecture[];

  const groupIds = typedSemesterLectures
    .map((weeklyLecture) => weeklyLecture.lecture.group_id)
    .filter((id): id is number => typeof id === "number");
  const groupStudentCounts = await getGroupStudentCounts(groupIds);

  const lowest_attendance_lectures = typedSemesterLectures
    .map((weeklyLecture) => {
      const groupId = weeklyLecture.lecture.group_id;
      const expected_count = groupId ? groupStudentCounts.get(groupId) ?? 0 : 0;
      const attended_count = weeklyLecture.attendances.filter((attendance) => attendance.has_attended).length;

      return {
        weekly_lecture_id: weeklyLecture.id,
        course_id: weeklyLecture.lecture.course.id,
        course_name: weeklyLecture.lecture.course.name,
        group_id: weeklyLecture.lecture.group?.id ?? null,
        group_name: weeklyLecture.lecture.group?.name ?? null,
        lecture_date: weeklyLecture.lecture_date.toISOString(),
        ...(includeInstructor
          ? {
              instructor_id: weeklyLecture.lecture.instructor?.id ?? null,
              instructor_name: weeklyLecture.lecture.instructor?.full_name ?? null,
            }
          : {}),
        attendance_rate: percent(attended_count, expected_count),
        attended_count,
        expected_count,
      };
    })
    .sort((a, b) => a.attendance_rate - b.attendance_rate)
    .slice(0, DEFAULT_SMALL_LIMIT);

  return {
    this_academic_week: summarizeAttendance(typedWeekLectures, groupStudentCounts),
    current_semester: summarizeAttendance(typedSemesterLectures, groupStudentCounts),
    lowest_attendance_lectures,
  };
}

async function getMarksSummaryForCourses(courseIds: number[], academicKey: string) {
  if (courseIds.length === 0) return [];

  const [courses, marks] = await Promise.all([
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: {
        id: true,
        name: true,
        is_practical_marks_published: true,
        is_marks_published: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.mark.findMany({
      where: { course_id: { in: courseIds }, academic_key: academicKey },
      select: {
        course_id: true,
        practical_grade: true,
        theoretical_grade: true,
      },
    }),
  ]);

  const marksByCourse = new Map<number, typeof marks>();
  for (const mark of marks) {
    const courseMarks = marksByCourse.get(mark.course_id) ?? [];
    courseMarks.push(mark);
    marksByCourse.set(mark.course_id, courseMarks);
  }

  return courses.map((course) => {
    const courseMarks = marksByCourse.get(course.id) ?? [];
    const totals = courseMarks.map((mark) => mark.practical_grade + mark.theoretical_grade);
    const practicalTotal = courseMarks.reduce((sum, mark) => sum + mark.practical_grade, 0);
    const theoreticalTotal = courseMarks.reduce((sum, mark) => sum + mark.theoretical_grade, 0);
    const total = totals.reduce((sum, value) => sum + value, 0);

    return {
      course_id: course.id,
      course_name: course.name,
      average_practical_mark: courseMarks.length ? roundNumber(practicalTotal / courseMarks.length) : null,
      average_theoretical_mark: courseMarks.length ? roundNumber(theoreticalTotal / courseMarks.length) : null,
      average_total_mark: courseMarks.length ? roundNumber(total / courseMarks.length) : null,
      highest_total_mark: totals.length ? Math.max(...totals) : null,
      lowest_total_mark: totals.length ? Math.min(...totals) : null,
      is_practical_marks_published: course.is_practical_marks_published,
      is_full_marks_published: course.is_marks_published,
    };
  });
}

async function getNearestExamsForCourses(
  courseIds: number[],
  options: { type?: "THEORETICAL" | "PRACTICAL"; limit?: number } = {},
) {
  if (courseIds.length === 0) return [];

  const now = new Date();
  const exams = await prisma.exam.findMany({
    where: {
      course_id: { in: courseIds },
      ...(options.type ? { type: options.type } : {}),
      settings: { some: { date: { gte: now } } },
    },
    select: {
      id: true,
      type: true,
      course_id: true,
      course: { select: { name: true } },
      settings: {
        where: { date: { gte: now } },
        select: { date: true },
        orderBy: { date: "asc" },
        take: 1,
      },
    },
  });

  return exams
    .map((exam) => ({
      course_id: exam.course_id,
      course_name: exam.course.name,
      exam_id: exam.id,
      type: exam.type,
      nearest_date: exam.settings[0]?.date.toISOString() ?? null,
    }))
    .filter((exam) => exam.nearest_date)
    .sort((a, b) => String(a.nearest_date).localeCompare(String(b.nearest_date)))
    .slice(0, options.limit ?? DEFAULT_SMALL_LIMIT);
}

async function getAnnouncementsSummary(createdBy?: number) {
  const recentDate = getRecentDate();
  const where = createdBy ? { created_by: createdBy } : {};

  const [recent_count, grouped] = await Promise.all([
    prisma.announcement.count({
      where: { ...where, created_at: { gte: recentDate } },
    }),
    (prisma.announcement as any).groupBy({
      by: ["type"],
      where,
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<string, number>(
    grouped.map((item: any) => [item.type, item._count._all]),
  );

  return {
    recent_count,
    by_type: ANNOUNCEMENT_TYPES.map((type) => ({
      type,
      count: counts.get(type) ?? 0,
    })),
  };
}

async function getRecentAnnouncements(createdBy?: number) {
  const announcements = await prisma.announcement.findMany({
    where: createdBy ? { created_by: createdBy } : {},
    select: {
      id: true,
      title: true,
      type: true,
      created_at: true,
      creator: { select: { id: true, full_name: true } },
    },
    orderBy: { created_at: "desc" },
    take: DEFAULT_SMALL_LIMIT,
  });

  return announcements.map((announcement) => ({
    announcement_id: announcement.id,
    title: announcement.title,
    type: announcement.type,
    created_at: announcement.created_at.toISOString(),
    creator_id: announcement.creator?.id ?? null,
    creator_name: announcement.creator?.full_name ?? null,
  }));
}

async function getMarksPublicationSummary(courseWhere: any = {}) {
  const [practical_published_courses, full_published_courses, unpublished_courses] = await Promise.all([
    prisma.course.count({ where: { ...courseWhere, is_practical_marks_published: true } }),
    prisma.course.count({ where: { ...courseWhere, is_marks_published: true } }),
    prisma.course.count({
      where: {
        ...courseWhere,
        is_practical_marks_published: false,
        is_marks_published: false,
      },
    }),
  ]);

  return {
    practical_published_courses,
    full_published_courses,
    unpublished_courses,
  };
}

async function getMarksCoverage(courseWhere: any, academicKey: string, limit = DEFAULT_MARKS_COVERAGE_LIMIT) {
  const courses = await prisma.course.findMany({
    where: { ...courseWhere, students: { some: {} } },
    select: { id: true, name: true },
  });

  if (courses.length === 0) return [];

  const courseIds = courses.map((course) => course.id);
  const [studentCounts, marksCounts] = await Promise.all([
    (prisma.studentCourse as any).groupBy({
      by: ["course_id"],
      where: { course_id: { in: courseIds } },
      _count: { _all: true },
    }),
    (prisma.mark as any).groupBy({
      by: ["course_id"],
      where: { course_id: { in: courseIds }, academic_key: academicKey },
      _count: { _all: true },
    }),
  ]);

  const studentsByCourse = new Map<number, number>(
    studentCounts.map((item: any) => [item.course_id, item._count._all]),
  );
  const marksByCourse = new Map<number, number>(
    marksCounts.map((item: any) => [item.course_id, item._count._all]),
  );

  return courses
    .map((course) => {
      const total_course_students = studentsByCourse.get(course.id) ?? 0;
      const students_with_marks = marksByCourse.get(course.id) ?? 0;
      const missing_marks = Math.max(total_course_students - students_with_marks, 0);

      return {
        course_id: course.id,
        course_name: course.name,
        total_course_students,
        students_with_marks,
        missing_marks,
        coverage_percent: percent(students_with_marks, total_course_students),
      };
    })
    .sort((a, b) => a.coverage_percent - b.coverage_percent || b.missing_marks - a.missing_marks)
    .slice(0, limit);
}

async function assertCourseExists(courseId: number) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true },
  });

  if (!course) throw new NotFoundError("Course");
  return course;
}

async function getCourseCompleteness(filters: DashboardFilters, scope: any = {}) {
  if (!filters.type || !filters.course_id) return null;

  const course = await assertCourseExists(filters.course_id);

  if (filters.type === "PRACTICAL") {
    if (!filters.group_id) return null;

    const group = await prisma.group.findUnique({
      where: { id: filters.group_id },
      select: { id: true, name: true },
    });
    if (!group) throw new NotFoundError("Group");

    const lectureWhere = {
      ...scope,
      course_id: filters.course_id,
      group_id: filters.group_id,
      lecture_type: "PRACTICAL",
    };

    const given_lectures_count = await prisma.weeklyLecture.count({
      where: buildGivenPracticalWeeklyWhere(lectureWhere),
    });

    return {
      course_id: course.id,
      course_name: course.name,
      type: "PRACTICAL",
      group_id: group.id,
      group_name: group.name,
      given_lectures_count,
      expected_lectures_count: SEMESTER_WEEKS,
      completion_percent: percent(given_lectures_count, SEMESTER_WEEKS),
    };
  }

  if (!filters.section_id && !filters.major_id) return null;

  const target = filters.section_id
    ? await prisma.section.findUnique({
        where: { id: filters.section_id },
        select: { id: true, name: true },
      })
    : await prisma.major.findUnique({
        where: { id: filters.major_id! },
        select: { id: true, name: true },
      });

  if (!target) throw new NotFoundError(filters.section_id ? "Section" : "Major");

  const lectureWhere = {
    ...scope,
    course_id: filters.course_id,
    lecture_type: "THEORETICAL",
    ...(filters.section_id ? { section_id: filters.section_id } : { major_id: filters.major_id }),
  };

  const [baseLectureCount, given_lectures_count] = await Promise.all([
    prisma.lecture.count({ where: lectureWhere }),
    prisma.weeklyLecture.count({ where: buildGivenTheoreticalWeeklyWhere(lectureWhere) }),
  ]);
  const expected_lectures_count = SEMESTER_WEEKS * baseLectureCount;

  return {
    course_id: course.id,
    course_name: course.name,
    type: "THEORETICAL",
    ...(filters.section_id
      ? { section_id: target.id, section_name: target.name }
      : { major_id: target.id, major_name: target.name }),
    given_lectures_count,
    expected_lectures_count,
    completion_percent: percent(given_lectures_count, expected_lectures_count),
  };
}

async function getTeacherCourseCompleteness(filters: DashboardFilters, teacherId: number) {
  if (!filters.course_id || !filters.group_id) return null;
  return getCourseCompleteness(
    { ...filters, type: "PRACTICAL" },
    { instructor_id: teacherId },
  );
}

async function getTeacherCourseIds(teacherId: number, filters: DashboardFilters = {}) {
  const courses = await prisma.course.findMany({
    where: applyCourseFilters(filters, { teachers: { some: { id: teacherId } } }),
    select: { id: true },
  });

  return courses.map((course) => course.id);
}

async function getDoctorCourseIds(doctorId: number, filters: DashboardFilters = {}) {
  const courses = await prisma.course.findMany({
    where: applyCourseFilters(filters, { doctors: { some: { id: doctorId } } }),
    select: { id: true },
  });

  return courses.map((course) => course.id);
}

async function assertCourseInIds(courseId: number, courseIds: number[]) {
  if (!courseIds.includes(courseId)) {
    throw new ForbiddenError("You are not allowed to access this course dashboard data");
  }
}

async function getTeacherWeeklyLectureStats(teacherId: number, filters: DashboardFilters) {
  const lectureWhere = applyLectureFilters(filters, {
    instructor_id: teacherId,
    lecture_type: "PRACTICAL",
  });

  const [upcomingPractical, givenPractical, cancelledPractical] = await Promise.all([
    prisma.weeklyLecture.count({
      where: buildUpcomingDraftWeeklyWhere(lectureWhere, "PRACTICAL"),
    }),
    prisma.weeklyLecture.count({
      where: buildGivenPracticalWeeklyWhere(lectureWhere),
    }),
    prisma.weeklyLecture.count({
      where: { status: "CANCELLED", lecture: lectureWhere },
    }),
  ]);

  return {
    upcoming_practical: upcomingPractical,
    given_practical: givenPractical,
    cancelled_practical: cancelledPractical,
  };
}

async function getDoctorWeeklyLectureStats(doctorId: number, filters: DashboardFilters) {
  if (filters.type === "PRACTICAL") {
    return {
      upcoming_theoretical: 0,
      given_theoretical: 0,
      cancelled_theoretical: 0,
    };
  }

  const lectureWhere = applyLectureFilters(
    {
      course_id: filters.course_id,
      section_id: filters.section_id,
      major_id: filters.major_id,
      year_id: filters.year_id,
    },
    {
      instructor_id: doctorId,
      lecture_type: "THEORETICAL",
    },
  );

  const [upcomingTheoretical, givenTheoretical, cancelledTheoretical] = await Promise.all([
    prisma.weeklyLecture.count({
      where: buildUpcomingDraftWeeklyWhere(lectureWhere, "THEORETICAL"),
    }),
    prisma.weeklyLecture.count({
      where: buildGivenTheoreticalWeeklyWhere(lectureWhere),
    }),
    prisma.weeklyLecture.count({
      where: { status: "CANCELLED", lecture: lectureWhere },
    }),
  ]);

  return {
    upcoming_theoretical: upcomingTheoretical,
    given_theoretical: givenTheoretical,
    cancelled_theoretical: cancelledTheoretical,
  };
}

async function getExamPublicationSummary(courseWhere: any = {}) {
  const [published, not_published] = await Promise.all([
    prisma.exam.count({ where: { status: "PUBLISHED", course: courseWhere } }),
    prisma.exam.count({ where: { status: { not: "PUBLISHED" }, course: courseWhere } }),
  ]);

  return { published, not_published };
}

async function getUpcomingExams(courseWhere: any = {}, limit = DEFAULT_SMALL_LIMIT) {
  const now = new Date();
  const exams = await prisma.exam.findMany({
    where: { course: courseWhere, settings: { some: { date: { gte: now } } } },
    select: {
      id: true,
      type: true,
      course_id: true,
      course: { select: { name: true } },
      settings: {
        where: { date: { gte: now } },
        select: { date: true },
        orderBy: { date: "asc" },
        take: 1,
      },
    },
  });

  return exams
    .map((exam) => ({
      exam_id: exam.id,
      course_id: exam.course_id,
      course_name: exam.course.name,
      type: exam.type,
      nearest_date: exam.settings[0]?.date.toISOString() ?? null,
    }))
    .filter((exam) => exam.nearest_date)
    .sort((a, b) => String(a.nearest_date).localeCompare(String(b.nearest_date)))
    .slice(0, limit);
}

async function getExamsWithoutSettings(courseWhere: any = {}, limit?: number) {
  const exams = await prisma.exam.findMany({
    where: { course: courseWhere, settings: { none: {} } },
    select: {
      id: true,
      type: true,
      status: true,
      course_id: true,
      course: { select: { name: true } },
    },
    orderBy: { id: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  return exams.map((exam) => ({
    exam_id: exam.id,
    course_id: exam.course_id,
    course_name: exam.course.name,
    type: exam.type,
    status: exam.status,
  }));
}

async function getAdminWeeklyLecturesBreakdown(filters: DashboardFilters) {
  const academicWeek = getSelectedDateRange(filters, getCurrentAcademicWeekRange());
  const baseLectureWhere = applyLectureFilters(filters);

  async function statsForType(type: LectureTypeFilter) {
    const lectureWhere = { ...baseLectureWhere, lecture_type: type };
    const [upcoming, given, cancelled] = await Promise.all([
      prisma.weeklyLecture.count({
        where: {
          status: "DRAFT",
          lecture_date: { gt: getToday(), ...dateWhere(academicWeek) },
          lecture: lectureWhere,
        },
      }),
      prisma.weeklyLecture.count({
        where:
          type === "PRACTICAL"
            ? buildGivenPracticalWeeklyWhere(lectureWhere, academicWeek)
            : buildGivenTheoreticalWeeklyWhere(lectureWhere, academicWeek),
      }),
      prisma.weeklyLecture.count({
        where: {
          status: "CANCELLED",
          lecture_date: dateWhere(academicWeek),
          lecture: lectureWhere,
        },
      }),
    ]);

    return { type, upcoming, given, cancelled };
  }

  const by_type = await Promise.all([statsForType("THEORETICAL"), statsForType("PRACTICAL")]);

  return {
    this_academic_week: {
      upcoming: by_type.reduce((sum, item) => sum + item.upcoming, 0),
      given: by_type.reduce((sum, item) => sum + item.given, 0),
      cancelled: by_type.reduce((sum, item) => sum + item.cancelled, 0),
    },
    by_type,
  };
}

async function getStudentsBreakdownByYear(filters: DashboardFilters) {
  const years = await prisma.year.findMany({
    select: {
      id: true,
      name: true,
      students: { where: applyStudentFilters(filters), select: { student_id: true } },
    },
    orderBy: { order: "asc" },
  });

  return {
    by_year: years.map((year) => ({
      year_id: year.id,
      year_name: year.name,
      student_count: year.students.length,
    })),
  };
}

async function getTopCoursesByStudents(filters: DashboardFilters) {
  const courseWhere = applyCourseFilters(filters);
  const courses = await prisma.course.findMany({
    where: courseWhere,
    select: { id: true, name: true },
  });

  if (courses.length === 0) return { top_courses_by_students: [] };

  const counts = await (prisma.studentCourse as any).groupBy({
    by: ["course_id"],
    where: { course_id: { in: courses.map((course) => course.id) } },
    _count: { _all: true },
  });
  const countMap = new Map<number, number>(
    counts.map((item: any) => [item.course_id, item._count._all]),
  );

  return {
    top_courses_by_students: courses
      .map((course) => ({
        course_id: course.id,
        course_name: course.name,
        student_count: countMap.get(course.id) ?? 0,
      }))
      .sort((a, b) => b.student_count - a.student_count)
      .slice(0, DEFAULT_SMALL_LIMIT),
  };
}

async function getLecturesScheduleDashboard(filters: DashboardFilters) {
  if (filters.section_id && filters.major_id) {
    throw new BadRequestError("Cannot filter by both section_id and major_id");
  }

  const lectureWhere = applyLectureFilters(filters);

  const [totalLectures, theoreticalLectures, practicalLectures, byDay, invalidLectures, locations] = await Promise.all([
    prisma.lecture.count({ where: lectureWhere }),
    prisma.lecture.count({ where: { ...lectureWhere, lecture_type: "THEORETICAL" } }),
    prisma.lecture.count({ where: { ...lectureWhere, lecture_type: "PRACTICAL" } }),
    (prisma.lecture as any).groupBy({
      by: ["day"],
      where: lectureWhere,
      _count: { _all: true },
    }),
    prisma.lecture.findMany({
      where: {
        ...lectureWhere,
        OR: [
          { lecture_type: "PRACTICAL", group_id: null },
          { lecture_type: "THEORETICAL", section_id: null, major_id: null },
          { AND: [{ section_id: { not: null } }, { major_id: { not: null } }] },
        ],
      },
      select: {
        id: true,
        lecture_type: true,
        day: true,
        time_box_order: true,
        group_id: true,
        section_id: true,
        major_id: true,
        course_id: true,
        course: { select: { name: true } },
      },
      take: DEFAULT_SMALL_LIMIT,
      orderBy: [{ day: "asc" }, { time_box_order: "asc" }],
    }),
    prisma.universityLocation.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { lectures: { where: lectureWhere } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const dayCounts = new Map<string, number>(byDay.map((item: any) => [item.day, item._count._all]));

  return {
    timetable_summary: {
      total_lectures: totalLectures,
      theoretical_lectures: theoreticalLectures,
      practical_lectures: practicalLectures,
    },
    lectures_by_day: WEEK_DAYS.map((day) => ({ day, count: dayCounts.get(day) ?? 0 })),
    invalid_scope_lectures: invalidLectures.map((lecture) => ({
      lecture_id: lecture.id,
      course_id: lecture.course_id,
      course_name: lecture.course.name,
      lecture_type: lecture.lecture_type,
      day: lecture.day,
      time_box_order: lecture.time_box_order,
      reason:
        lecture.lecture_type === "PRACTICAL" && !lecture.group_id
          ? "Practical lecture is missing group_id"
          : !lecture.section_id && !lecture.major_id
            ? "Theoretical lecture is missing section_id or major_id"
            : "Lecture has both section_id and major_id",
    })),
    location_usage: locations
      .map((location) => ({
        location_id: location.id,
        location_name: location.name,
        lecture_count: location._count.lectures,
      }))
      .sort((a, b) => b.lecture_count - a.lecture_count)
      .slice(0, DEFAULT_SMALL_LIMIT),
  };
}

export const getLecturesScheduleDeDashboard = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseFilters(req);
  return response(res, await getLecturesScheduleDashboard(filters));
});

export const getContentDeDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const [total_faqs, total_blogs, total_exam_guidelines, announcements_summary, recent_announcements] =
    await Promise.all([
      prisma.fAQ.count(),
      prisma.blog.count(),
      prisma.examGuideline.count(),
      getAnnouncementsSummary(),
      getRecentAnnouncements(),
    ]);

  return response(res, {
    content_summary: {
      total_faqs,
      total_blogs,
      total_exam_guidelines,
    },
    announcements_summary,
    recent_announcements,
  });
});

export const getExamsDeDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const academicKey = await getCurrentAcademicKeyOrThrow();
  const [exam_publication_summary, exams_without_settings, upcoming_exams, marks_coverage, marks_publication_summary] =
    await Promise.all([
      getExamPublicationSummary(),
      getExamsWithoutSettings(),
      getUpcomingExams(),
      getMarksCoverage({}, academicKey),
      getMarksPublicationSummary(),
    ]);

  return response(res, {
    exam_publication_summary,
    exams_without_settings,
    upcoming_exams,
    marks_coverage,
    marks_publication_summary,
  });
});

async function getAdminSummaryCards(filters: DashboardFilters, academicKey: string) {
  const courseWhere = applyCourseFilters(filters);
  const studentWhere = applyStudentFilters(filters, { user: { is_active: true } });
  const weeklyLecturesBreakdown = await getAdminWeeklyLecturesBreakdown(filters);
  const attendanceLectureWhere = applyLectureFilters(filters, { lecture_type: "PRACTICAL" });
  const attendanceBreakdown = await getAttendanceBreakdown(attendanceLectureWhere, true);
  const [total_active_students, total_courses, staffByRole, exam_publication_summary, marks_publication_summary, recent_announcements_count] =
    await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.course.count({ where: courseWhere }),
      (prisma.user as any).groupBy({
        by: ["role"],
        where: { is_active: true, role: { not: "STUDENT" } },
        _count: { _all: true },
      }),
      getExamPublicationSummary(courseWhere),
      getMarksPublicationSummary(courseWhere),
      prisma.announcement.count({ where: { created_at: { gte: getRecentDate() } } }),
    ]);

  const total_active_staff_by_role = Object.fromEntries(
    staffByRole.map((item: any) => [item.role, item._count._all]),
  );

  return {
    total_active_students,
    total_active_staff_by_role,
    total_courses,
    current_academic_week_lecture_summary: weeklyLecturesBreakdown.this_academic_week,
    current_academic_week_attendance_rate: attendanceBreakdown.this_academic_week.attendance_rate,
    exam_publication_summary,
    marks_publication_summary,
    recent_announcements_count,
    current_academic_key: academicKey,
  };
}

export const getAdminDashboard = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseFilters(req);
  const academicKey = await getCurrentAcademicKeyOrThrow();
  const courseWhere = applyCourseFilters(filters);
  const practicalAttendanceLectureWhere = applyLectureFilters(filters, { lecture_type: "PRACTICAL" });

  const [
    summary_cards,
    students_breakdown,
    course_enrollment_breakdown,
    weekly_lectures_breakdown,
    attendance_breakdown,
    exams_breakdown,
    marks_breakdown,
    announcements_breakdown,
    recent_announcements,
    course_completeness,
  ] = await Promise.all([
    getAdminSummaryCards(filters, academicKey),
    getStudentsBreakdownByYear(filters),
    getTopCoursesByStudents(filters),
    getAdminWeeklyLecturesBreakdown(filters),
    getAttendanceBreakdown(practicalAttendanceLectureWhere, true),
    Promise.all([
      getExamPublicationSummary(courseWhere),
      getUpcomingExams(courseWhere),
      getExamsWithoutSettings(courseWhere),
    ]).then(([byPublicationStatus, upcomingExams, examsWithoutSettings]) => ({
      by_publication_status: byPublicationStatus,
      upcoming_exams: upcomingExams,
      exams_without_settings: examsWithoutSettings,
    })),
    Promise.all([
      getMarksPublicationSummary(courseWhere),
      getMarksCoverage(courseWhere, academicKey),
    ]).then(([publicationStatus, coursesMissingMarks]) => ({
      publication_status: publicationStatus,
      courses_missing_marks: coursesMissingMarks,
    })),
    getAnnouncementsSummary(),
    getRecentAnnouncements(),
    getCourseCompleteness(filters),
  ]);

  return response(res, {
    summary_cards,
    students_breakdown,
    course_enrollment_breakdown,
    weekly_lectures_breakdown,
    attendance_breakdown,
    exams_breakdown,
    marks_breakdown,
    announcements_breakdown: {
      ...announcements_breakdown,
      recent_announcements,
    },
    course_completeness,
  });
});

export const getTeacherDashboard = asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = getAuthUser(req);
  const filters = parseFilters(req);

  if (filters.type) {
    throw new BadRequestError("Teacher dashboard does not support type filter");
  }

  const academicKey = await getCurrentAcademicKeyOrThrow();
  const teacherCourseIds = await getTeacherCourseIds(user_id, filters);
  if (filters.course_id) await assertCourseInIds(filters.course_id, teacherCourseIds);

  const lectureWhere = applyLectureFilters(filters, {
    instructor_id: user_id,
    lecture_type: "PRACTICAL",
  });

  const [weekly_lecture_stats, attendance_breakdown, course_completeness, marks_summary, nearest_exams, announcements_summary] =
    await Promise.all([
      getTeacherWeeklyLectureStats(user_id, filters),
      getAttendanceBreakdown(lectureWhere),
      getTeacherCourseCompleteness(filters, user_id),
      getMarksSummaryForCourses(teacherCourseIds, academicKey),
      getNearestExamsForCourses(teacherCourseIds, { type: "PRACTICAL" }),
      getAnnouncementsSummary(user_id),
    ]);

  return response(res, {
    weekly_lecture_stats,
    attendance_breakdown,
    course_completeness,
    marks_summary,
    nearest_exams,
    announcements_summary,
  });
});

export const getDoctorDashboard = asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = getAuthUser(req);
  const filters = parseFilters(req);
  const academicKey = await getCurrentAcademicKeyOrThrow();
  const doctorCourseIds = await getDoctorCourseIds(user_id, filters);

  if (filters.course_id) await assertCourseInIds(filters.course_id, doctorCourseIds);

  const practicalAttendanceLectureWhere = applyLectureFilters(
    {
      course_id: filters.course_id,
      group_id: filters.group_id,
      year_id: filters.year_id,
    },
    { course_id: { in: doctorCourseIds }, lecture_type: "PRACTICAL" },
  );

  const completenessScope =
    filters.type === "THEORETICAL"
      ? { instructor_id: user_id }
      : filters.type === "PRACTICAL"
        ? {}
        : {};

  const [weekly_lecture_stats, attendance_breakdown, course_completeness, marks_summary, nearest_exams, announcements_summary] =
    await Promise.all([
      getDoctorWeeklyLectureStats(user_id, filters),
      getAttendanceBreakdown(practicalAttendanceLectureWhere, true),
      getCourseCompleteness(filters, completenessScope),
      getMarksSummaryForCourses(doctorCourseIds, academicKey),
      getNearestExamsForCourses(doctorCourseIds),
      getAnnouncementsSummary(user_id),
    ]);

  return response(res, {
    weekly_lecture_stats,
    attendance_breakdown,
    course_completeness,
    marks_summary,
    nearest_exams,
    announcements_summary,
  });
});

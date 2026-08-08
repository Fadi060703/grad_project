import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { prisma } from "../lib/prisma";
import { BadRequestError, ConflictError } from "../errors";
import { StartYearActionInput } from "../validators/actions";

interface CreatedFirstYearStudent {
  student_id: number;
  username: string;
  full_name: string;
  password: string;
}

interface StartYearActionResult {
  created_students: CreatedFirstYearStudent[];
}

interface YearRecord {
  id: number;
  name: string;
  order: number;
  has_majors: boolean;
}

interface StudentRecord {
  student_id: number;
  year_id: number;
}

interface SectionRecord {
  id: number;
  year_id: number;
}

interface MajorRecord {
  id: number;
  year_id: number;
}

interface GroupRecord {
  id: number;
  section_id: number | null;
  major_id: number | null;
}

interface Placement {
  student_id: number;
  year_id: number;
  section_id: number | null;
  major_id: number | null;
  group_id: number;
}

interface ScopePlacement extends Omit<Placement, "group_id"> {}

export async function executeStartYearAction(
  input: StartYearActionInput,
): Promise<StartYearActionResult> {
  const preparedStudents = await Promise.all(
    input.first_year_students.map(async (student) => {
      const password = generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);

      return {
        ...student,
        password,
        hashedPassword,
      };
    }),
  );

  return prisma.$transaction(async (tx) => {
    const settings = await tx.systemSettings.findFirst({
      orderBy: { id: "desc" },
      select: { id: true, current_academic_key: true },
    });

    if (!settings) {
      throw new BadRequestError("إعدادات النظام غير موجودة");
    }

    const nextAcademicKey = calculateNextAcademicKey(settings.current_academic_key);

    const years: YearRecord[] = await tx.year.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true, has_majors: true },
    });

    if (years.length === 0) {
      throw new BadRequestError("لا توجد سنوات دراسية في النظام");
    }

    const firstYear = years[0];
    const temporaryGroup = await findTemporaryFirstYearGroup(tx, firstYear.id);

    await validateFirstYearStudents(tx, input.first_year_students);

    const createdStudents: CreatedFirstYearStudent[] = [];

    for (const student of preparedStudents) {
      await tx.user.create({
        data: {
          username: student.username,
          full_name: student.full_name,
          role: "STUDENT",
          is_active: true,
          password: student.hashedPassword,
          student: {
            create: {
              student_id: student.student_id,
              mother_name: student.mother_name,
              year_id: firstYear.id,
              section_id: null,
              major_id: null,
              group_id: temporaryGroup.id,
            },
          },
        },
      });

      createdStudents.push({
        student_id: student.student_id,
        username: student.username,
        full_name: student.full_name,
        password: student.password,
      });
    }

    const [students, sections, majors, groups, sectionCourses, majorCourses, directCourses] = await Promise.all([
      tx.student.findMany({
        select: { student_id: true, year_id: true },
      }),
      tx.section.findMany({
        select: { id: true, year_id: true },
      }),
      tx.major.findMany({
        select: { id: true, year_id: true },
      }),
      tx.group.findMany({
        select: { id: true, section_id: true, major_id: true },
      }),
      tx.sectionCourse.findMany({
        select: { course_id: true, section_id: true },
      }),
      tx.majorCourse.findMany({
        select: { course_id: true, major_id: true },
      }),
      tx.course.findMany({
        where: {
          sectionCourses: { none: {} },
          majorCourses: { none: {} },
        },
        select: { id: true, year_id: true },
      }),
    ]);

    validateMajorAssignments(input.major_assignments, students, years, majors);

    const scopePlacements = assignSectionsAndMajors(
      students,
      years,
      sections,
      majors,
      input.major_assignments,
    );
    const placements = assignGroups(scopePlacements, groups);
    const examSeatNumbers = generateExamSeatNumbers(placements.length);

    for (let i = 0; i < placements.length; i++) {
      const placement = placements[i];

      await tx.student.update({
        where: { student_id: placement.student_id },
        data: {
          section_id: placement.section_id,
          major_id: placement.major_id,
          group_id: placement.group_id,
          exam_seat_number: examSeatNumbers[i],
        },
      });
    }

    await attachStudentCourses(tx, placements, sectionCourses, majorCourses, directCourses);

    await tx.systemSettings.update({
      where: { id: settings.id },
      data: { current_academic_key: nextAcademicKey },
    });

    return { created_students: createdStudents };
  });
}

function calculateNextAcademicKey(previousKey: string | null): string {
  const normalizedKey = previousKey?.trim() ?? "";

  if (!normalizedKey) {
    return `FIRST_${new Date().getFullYear() + 1}`;
  }

  if (!normalizedKey.startsWith("SECOND")) {
    throw new BadRequestError("لا يمكن تنفيذ إجراء بداية السنة إلا إذا كان المفتاح الأكاديمي السابق فارغاً أو يبدأ بـ SECOND");
  }

  const match = /^SECOND_(\d{4})$/.exec(normalizedKey);

  if (!match) {
    throw new BadRequestError("صيغة المفتاح الأكاديمي السابق غير صحيحة. الصيغة المتوقعة هي SECOND_YYYY");
  }

  return `FIRST_${Number(match[1]) + 1}`;
}

async function findTemporaryFirstYearGroup(db: any, firstYearId: number): Promise<{ id: number }> {
  const group = await db.group.findFirst({
    where: {
      OR: [
        { section: { year_id: firstYearId } },
        { major: { year_id: firstYearId } },
      ],
    },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (!group) {
    throw new BadRequestError("لا توجد أي مجموعة في السنة الأولى لاستخدامها مؤقتاً عند إنشاء الطلاب");
  }

  return group;
}

async function validateFirstYearStudents(
  db: any,
  students: StartYearActionInput["first_year_students"],
): Promise<void> {
  const duplicateStudentIds = findDuplicates(students.map((student) => student.student_id));
  const duplicateUsernames = findDuplicates(students.map((student) => student.username));

  if (duplicateStudentIds.length > 0 || duplicateUsernames.length > 0) {
    throw new ConflictError(
      `يوجد تكرار في بيانات طلاب السنة الأولى. أرقام الطلاب المكررة: [${duplicateStudentIds.join(", ") || "لا يوجد"}]، أسماء المستخدمين المكررة: [${duplicateUsernames.join(", ") || "لا يوجد"}]`,
    );
  }

  if (students.length === 0) return;

  const studentIds = students.map((student) => student.student_id);
  const usernames = students.map((student) => student.username);

  const [existingStudents, existingUsers] = await Promise.all([
    db.student.findMany({
      where: { student_id: { in: studentIds } },
      select: { student_id: true },
    }),
    db.user.findMany({
      where: { username: { in: usernames } },
      select: { username: true },
    }),
  ]);

  if (existingStudents.length > 0 || existingUsers.length > 0) {
    throw new ConflictError(
      `يوجد طلاب مضافون مسبقاً. أرقام الطلاب الموجودة: [${existingStudents.map((student: any) => student.student_id).join(", ") || "لا يوجد"}]، أسماء المستخدمين الموجودة: [${existingUsers.map((user: any) => user.username).join(", ") || "لا يوجد"}]`,
    );
  }
}

function validateMajorAssignments(
  majorAssignments: StartYearActionInput["major_assignments"],
  students: StudentRecord[],
  years: YearRecord[],
  majors: MajorRecord[],
): void {
  const studentMap = new Map(students.map((student) => [student.student_id, student]));
  const yearMap = new Map(years.map((year) => [year.id, year]));
  const majorMap = new Map(majors.map((major) => [major.id, major]));
  const assignmentStudentIds = majorAssignments.map((assignment) => assignment.student_id);
  const duplicateAssignments = findDuplicates(assignmentStudentIds);

  if (duplicateAssignments.length > 0) {
    throw new BadRequestError(`يوجد أكثر من اختيار اختصاص لنفس الطالب: [${duplicateAssignments.join(", ")}]`);
  }

  const assignmentMap = new Map(majorAssignments.map((assignment) => [assignment.student_id, assignment.major_id]));

  for (const assignment of majorAssignments) {
    const student = studentMap.get(assignment.student_id);

    if (!student) {
      throw new BadRequestError(`الطالب رقم ${assignment.student_id} غير موجود`);
    }

    const year = yearMap.get(student.year_id);

    if (!year?.has_majors) {
      continue;
    }

    const major = majorMap.get(assignment.major_id);

    if (!major) {
      throw new BadRequestError(`الاختصاص رقم ${assignment.major_id} غير موجود`);
    }

    if (major.year_id !== student.year_id) {
      throw new BadRequestError(`الاختصاص رقم ${assignment.major_id} لا ينتمي إلى سنة الطالب رقم ${assignment.student_id}`);
    }
  }

  for (const student of students) {
    const year = yearMap.get(student.year_id);

    if (year?.has_majors && !assignmentMap.has(student.student_id)) {
      throw new BadRequestError(`يجب تحديد اختصاص للطالب رقم ${student.student_id}`);
    }
  }
}

function assignSectionsAndMajors(
  students: StudentRecord[],
  years: YearRecord[],
  sections: SectionRecord[],
  majors: MajorRecord[],
  majorAssignments: StartYearActionInput["major_assignments"],
): ScopePlacement[] {
  const sectionsByYear = groupBy(sections, (section) => section.year_id);
  const studentsByYear = groupBy(students, (student) => student.year_id);
  const majorMap = new Map(majors.map((major) => [major.id, major]));
  const assignmentMap = new Map(majorAssignments.map((assignment) => [assignment.student_id, assignment.major_id]));
  const placements: ScopePlacement[] = [];

  for (const year of years) {
    const yearStudents = studentsByYear.get(year.id) ?? [];

    if (yearStudents.length === 0) continue;

    if (year.has_majors) {
      for (const student of yearStudents) {
        const majorId = assignmentMap.get(student.student_id);
        const major = majorId ? majorMap.get(majorId) : null;

        if (!major) {
          throw new BadRequestError(`يجب تحديد اختصاص صحيح للطالب رقم ${student.student_id}`);
        }

        placements.push({
          student_id: student.student_id,
          year_id: student.year_id,
          section_id: null,
          major_id: major.id,
        });
      }

      continue;
    }

    const yearSections = sectionsByYear.get(year.id) ?? [];

    if (yearSections.length === 0) {
      throw new BadRequestError(`لا توجد شعب للسنة ${year.name}`);
    }

    shuffle(yearStudents).forEach((student, index) => {
      const section = yearSections[index % yearSections.length];

      placements.push({
        student_id: student.student_id,
        year_id: student.year_id,
        section_id: section.id,
        major_id: null,
      });
    });
  }

  return placements;
}

function assignGroups(scopePlacements: ScopePlacement[], groups: GroupRecord[]): Placement[] {
  const groupsBySection = groupBy(
    groups.filter((group) => group.section_id !== null),
    (group) => group.section_id as number,
  );
  const groupsByMajor = groupBy(
    groups.filter((group) => group.major_id !== null),
    (group) => group.major_id as number,
  );
  const placementsByScope = new Map<string, ScopePlacement[]>();

  for (const placement of scopePlacements) {
    const scopeKey = placement.section_id !== null
      ? `section:${placement.section_id}`
      : `major:${placement.major_id}`;
    const existing = placementsByScope.get(scopeKey) ?? [];
    existing.push(placement);
    placementsByScope.set(scopeKey, existing);
  }

  const placements: Placement[] = [];

  for (const scopeStudents of placementsByScope.values()) {
    const first = scopeStudents[0];
    const scopeGroups = first.section_id !== null
      ? (groupsBySection.get(first.section_id) ?? [])
      : (groupsByMajor.get(first.major_id as number) ?? []);

    if (scopeGroups.length === 0) {
      const scopeName = first.section_id !== null ? `الشعبة رقم ${first.section_id}` : `الاختصاص رقم ${first.major_id}`;
      throw new BadRequestError(`لا توجد مجموعات ضمن ${scopeName}`);
    }

    shuffle(scopeStudents).forEach((student, index) => {
      placements.push({
        ...student,
        group_id: scopeGroups[index % scopeGroups.length].id,
      });
    });
  }

  return placements;
}

async function attachStudentCourses(
  db: any,
  placements: Placement[],
  sectionCourses: Array<{ course_id: number; section_id: number }>,
  majorCourses: Array<{ course_id: number; major_id: number }>,
  directCourses: Array<{ id: number; year_id: number }>,
): Promise<void> {
  const sectionCourseMap = mapCourseIdsByScope(sectionCourses, "section_id", "course_id");
  const majorCourseMap = mapCourseIdsByScope(majorCourses, "major_id", "course_id");
  const directCourseMap = mapCourseIdsByScope(directCourses, "year_id", "id");
  const data: Array<{ student_id: number; course_id: number }> = [];

  for (const placement of placements) {
    const courseIds = new Set<number>(directCourseMap.get(placement.year_id) ?? []);

    if (placement.section_id !== null) {
      for (const courseId of sectionCourseMap.get(placement.section_id) ?? []) {
        courseIds.add(courseId);
      }
    }

    if (placement.major_id !== null) {
      for (const courseId of majorCourseMap.get(placement.major_id) ?? []) {
        courseIds.add(courseId);
      }
    }

    for (const courseId of courseIds) {
      data.push({ student_id: placement.student_id, course_id: courseId });
    }
  }

  for (const chunk of chunkArray(data, 1000)) {
    await db.studentCourse.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }
}

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = `${upper}${lower}${digits}`;
  const chars = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
  ];

  while (chars.length < 10) {
    chars.push(all[randomInt(all.length)]);
  }

  return shuffle(chars).join("");
}

function generateExamSeatNumbers(count: number): number[] {
  if (count > 9000) {
    throw new BadRequestError("لا يمكن توليد أرقام امتحانية رباعية فريدة لأكثر من 9000 طالب");
  }

  const numbers = new Set<number>();

  while (numbers.size < count) {
    numbers.add(randomInt(1000, 10000));
  }

  return [...numbers];
}

function findDuplicates<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const duplicates = new Set<T>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates];
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }

  return map;
}

function mapCourseIdsByScope<T extends Record<string, number>>(
  records: T[],
  scopeKey: keyof T,
  courseKey: keyof T,
): Map<number, number[]> {
  const map = new Map<number, number[]>();

  for (const record of records) {
    const scopeId = record[scopeKey];
    const courseId = record[courseKey];
    const courseIds = map.get(scopeId) ?? [];
    courseIds.push(courseId);
    map.set(scopeId, courseIds);
  }

  return map;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

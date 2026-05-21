import {
  PrismaClient,
  Year,
  Section,
  Major,
  Group,
} from "../../generated/prisma/client";

export interface SeedStructure {
  years: Year[];
  // sections years (1,2,3) → sections per year
  sectionsByYear: Map<number, Section[]>;
  // majors years (4,5) → majors per year
  majorsByYear: Map<number, Major[]>;
  // groups per section
  groupsBySection: Map<number, Group[]>;
  // groups per major
  groupsByMajor: Map<number, Group[]>;
}

export async function seedStructure(
  prisma: PrismaClient,
): Promise<SeedStructure> {
  console.log("🏛️  Seeding years, sections, majors, groups...");

  // ── Years ──────────────────────────────────────────────────────────────────
  const yearDefs = [
    { name: "السنة الأولى", order: 1, has_majors: false },
    { name: "السنة الثانية", order: 2, has_majors: false },
    { name: "السنة الثالثة", order: 3, has_majors: false },
    { name: "السنة الرابعة", order: 4, has_majors: true },
    { name: "السنة الخامسة", order: 5, has_majors: true },
  ];

  const years: Year[] = [];
  for (const y of yearDefs) {
    const year = await prisma.year.upsert({
      where: { name: y.name },
      update: {},
      create: y,
    });
    years.push(year);
  }

  // ── Sections (years 1-3) ───────────────────────────────────────────────────
  const sectionNames = ["الشعبة الأولى", "الشعبة الثانية"];
  const sectionsByYear = new Map<number, Section[]>();

  // group names per section index (0-based)
  // section 0 → الفئة الأولى .. الفئة الثامنة
  // section 1 → الفئة التاسعة .. الفئة السادسة عشرة
  const groupNamesSection1 = [
    "الفئة الأولى",
    "الفئة الثانية",
    "الفئة الثالثة",
    "الفئة الرابعة",
    "الفئة الخامسة",
    "الفئة السادسة",
    "الفئة السابعة",
    "الفئة الثامنة",
  ];
  const groupNamesSection2 = [
    "الفئة التاسعة",
    "الفئة العاشرة",
    "الفئة الحادية عشرة",
    "الفئة الثانية عشرة",
    "الفئة الثالثة عشرة",
    "الفئة الرابعة عشرة",
    "الفئة الخامسة عشرة",
    "الفئة السادسة عشرة",
  ];
  const sectionGroupNames = [groupNamesSection1, groupNamesSection2];

  const groupsBySection = new Map<number, Group[]>();

  for (const year of years.slice(0, 3)) {
    const sections: Section[] = [];

    for (let si = 0; si < sectionNames.length; si++) {
      const section = await prisma.section.upsert({
        where: { name_year_id: { name: sectionNames[si], year_id: year.id } },
        update: {},
        create: { name: sectionNames[si], year_id: year.id },
      });
      sections.push(section);

      // Groups for this section
      const groups: Group[] = [];
      for (const groupName of sectionGroupNames[si]) {
        let group = await prisma.group.findFirst({
          where: { name: groupName, section_id: section.id, major_id: null },
        });
        if (!group) {
          group = await prisma.group.create({
            data: { name: groupName, section_id: section.id, major_id: null },
          });
        }
        groups.push(group);
      }
      groupsBySection.set(section.id, groups);
    }

    sectionsByYear.set(year.id, sections);
  }

  // ── Majors (years 4-5) ────────────────────────────────────────────────────
  const majorNames = ["برمجيات", "شبكات"];
  const majorsByYear = new Map<number, Major[]>();
  const groupsByMajor = new Map<number, Group[]>();

  const majorGroupNames = [
    "الفئة الأولى",
    "الفئة الثانية",
    "الفئة الثالثة",
    "الفئة الرابعة",
  ];

  for (const year of years.slice(3)) {
    const majors: Major[] = [];

    for (const majorName of majorNames) {
      const major = await prisma.major.upsert({
        where: { name_year_id: { name: majorName, year_id: year.id } },
        update: {},
        create: { name: majorName, year_id: year.id },
      });
      majors.push(major);

      const groups: Group[] = [];
      for (const groupName of majorGroupNames) {
        let group = await prisma.group.findFirst({
          where: { name: groupName, section_id: null, major_id: major.id },
        });
        if (!group) {
          group = await prisma.group.create({
            data: { name: groupName, section_id: null, major_id: major.id },
          });
        }
        groups.push(group);
      }
      groupsByMajor.set(major.id, groups);
    }

    majorsByYear.set(year.id, majors);
  }

  const totalSections = [...sectionsByYear.values()].flat().length;
  const totalMajors = [...majorsByYear.values()].flat().length;
  const totalGroups = [
    ...groupsBySection.values(),
    ...groupsByMajor.values(),
  ].flat().length;

  console.log(
    `   ✔ ${years.length} years, ${totalSections} sections, ${totalMajors} majors, ${totalGroups} groups created.`,
  );

  return {
    years,
    sectionsByYear,
    majorsByYear,
    groupsBySection,
    groupsByMajor,
  };
}

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

import { seedSystem } from "./01_system.seed";
import { seedUsers } from "./02_users.seed";
import { seedStructure } from "./03_structure.seed";
import { seedCourses } from "./04_courses.seed";
import { seedStudents } from "./05_students.seed";

// TODO: remember to fix this seed (it is affecting the courses seed)
// import { seedMarksCourses } from "./06_marks_courses.seed";


const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seed...\n");

  await seedSystem(prisma);
  const { doctors, teachers } = await seedUsers(prisma);
  const structure = await seedStructure(prisma);
  await seedCourses(prisma, structure, doctors, teachers);
  await seedStudents(prisma, structure);

  console.log("\n✅ Seed completed successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
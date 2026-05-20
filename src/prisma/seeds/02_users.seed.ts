import { PrismaClient, User } from "../../generated/prisma/client";
import bcrypt from "bcrypt";

export async function seedUsers(
  prisma: PrismaClient
): Promise<{ doctors: User[]; teachers: User[] }> {
  console.log("👤 Seeding users (admin, doctors, teachers)...");

  const hashedPassword = await bcrypt.hash("Password@123", 10);

  // Admin
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      full_name: "مدير النظام",
      email: "admin@university.edu",
      phone_number: "0501234567",
      role: "ADMIN",
      password: hashedPassword,
      is_active: true,
    },
  });

  // Doctors
  const doctorData = [
    { username: "dr_ahmed",    full_name: "د. أحمد محمد العلي",     email: "ahmed@university.edu",    phone_number: "0502000001" },
    { username: "dr_fatima",   full_name: "د. فاطمة يوسف الزهراني", email: "fatima@university.edu",   phone_number: "0502000002" },
    { username: "dr_khalid",   full_name: "د. خالد إبراهيم النجار",  email: "khalid@university.edu",   phone_number: "0502000003" },
    { username: "dr_mona",     full_name: "د. منى سعد الغامدي",     email: "mona@university.edu",     phone_number: "0502000004" },
    { username: "dr_omar",     full_name: "د. عمر عبدالله الشمري",  email: "omar@university.edu",     phone_number: "0502000005" },
    { username: "dr_layla",    full_name: "د. ليلى حسن العمري",     email: "layla@university.edu",    phone_number: "0502000006" },
    { username: "dr_hassan",   full_name: "د. حسن علي المطيري",     email: "hassan@university.edu",   phone_number: "0502000007" },
    { username: "dr_sara",     full_name: "د. سارة محمد القحطاني",  email: "sara@university.edu",     phone_number: "0502000008" },
    { username: "dr_youssef",  full_name: "د. يوسف عبدالرحمن",      email: "youssef@university.edu",  phone_number: "0502000009" },
    { username: "dr_nadia",    full_name: "د. نادية سليم الحربي",   email: "nadia@university.edu",    phone_number: "0502000010" },
  ];

  const doctors: User[] = [];
  for (const d of doctorData) {
    const doctor = await prisma.user.upsert({
      where: { username: d.username },
      update: {},
      create: { ...d, role: "DOCTOR", password: hashedPassword, is_active: true },
    });
    doctors.push(doctor);
  }

  // Teachers
  const teacherData = [
    { username: "t_ali",       full_name: "م. علي محمد الدوسري",    email: "t_ali@university.edu",      phone_number: "0503000001" },
    { username: "t_reem",      full_name: "م. ريم أحمد السالم",     email: "t_reem@university.edu",     phone_number: "0503000002" },
    { username: "t_nasser",    full_name: "م. ناصر خالد العتيبي",   email: "t_nasser@university.edu",   phone_number: "0503000003" },
    { username: "t_huda",      full_name: "م. هدى سعد الزهراني",    email: "t_huda@university.edu",     phone_number: "0503000004" },
    { username: "t_waleed",    full_name: "م. وليد عمر المالكي",    email: "t_waleed@university.edu",   phone_number: "0503000005" },
    { username: "t_dina",      full_name: "م. دينا يوسف الغامدي",   email: "t_dina@university.edu",     phone_number: "0503000006" },
    { username: "t_faisal",    full_name: "م. فيصل حسن العمري",     email: "t_faisal@university.edu",   phone_number: "0503000007" },
    { username: "t_abeer",     full_name: "م. عبير علي المطيري",    email: "t_abeer@university.edu",    phone_number: "0503000008" },
    { username: "t_tariq",     full_name: "م. طارق محمد الحربي",    email: "t_tariq@university.edu",    phone_number: "0503000009" },
    { username: "t_lama",      full_name: "م. لمى عبدالله القحطاني",email: "t_lama@university.edu",     phone_number: "0503000010" },
    { username: "t_saad",      full_name: "م. سعد إبراهيم الشمري",  email: "t_saad@university.edu",     phone_number: "0503000011" },
    { username: "t_noura",     full_name: "م. نورة سليم العنزي",    email: "t_noura@university.edu",    phone_number: "0503000012" },
    { username: "t_mansour",   full_name: "م. منصور أحمد البقمي",   email: "t_mansour@university.edu",  phone_number: "0503000013" },
    { username: "t_amira",     full_name: "م. أميرة خالد الرشيدي",  email: "t_amira@university.edu",    phone_number: "0503000014" },
    { username: "t_ibrahim",   full_name: "م. إبراهيم عمر الجهني",  email: "t_ibrahim@university.edu",  phone_number: "0503000015" },
    { username: "t_ghada",     full_name: "م. غادة محمد العصيمي",   email: "t_ghada@university.edu",    phone_number: "0503000016" },
    { username: "t_bandar",    full_name: "م. بندر يوسف السبيعي",   email: "t_bandar@university.edu",   phone_number: "0503000017" },
    { username: "t_maha",      full_name: "م. مها سعد الدوسري",     email: "t_maha@university.edu",     phone_number: "0503000018" },
    { username: "t_ziad",      full_name: "م. زياد علي العجمي",     email: "t_ziad@university.edu",     phone_number: "0503000019" },
    { username: "t_rand",      full_name: "م. رند عبدالرحمن الصاعدي",email: "t_rand@university.edu",   phone_number: "0503000020" },
  ];

  const teachers: User[] = [];
  for (const t of teacherData) {
    const teacher = await prisma.user.upsert({
      where: { username: t.username },
      update: {},
      create: { ...t, role: "TEACHER", password: hashedPassword, is_active: true },
    });
    teachers.push(teacher);
  }

  console.log(`   ✔ 1 admin, ${doctors.length} doctors, ${teachers.length} teachers created.`);
  return { doctors, teachers };
}
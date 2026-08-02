

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from '../errors';
import { prisma } from '../lib/prisma';
import { createListHandler } from '../lib/express-prisma-query';
import { 
  createAnnouncementSchema, 
  updateAnnouncementSchema, 
  getAnnouncementSchema,
  getAnnouncementsQuerySchema 
} from '../validators/announcements';
import { z } from 'zod';
import { emitNewAnnouncement, emitAnnouncementUpdate, emitAnnouncementDelete } from '../websocket/event';
import { notifyStudentsSafely } from '../services';

const DEFAULT_NOTIFICATION_ICON = '/logo_light_mode.svg';
const ANNOUNCEMENT_TARGET_FIELDS = [
  'year_id',
  'section_id',
  'major_id',
  'group_id',
  'course_id',
  'student_id',
] as const;

type AnnouncementTarget = {
  year_id: number | null;
  section_id: number | null;
  major_id: number | null;
  group_id: number | null;
  course_id: number | null;
  student_id: number | null;
};

const pickAnnouncementTarget = (announcement: AnnouncementTarget): AnnouncementTarget => ({
  year_id: announcement.year_id,
  section_id: announcement.section_id,
  major_id: announcement.major_id,
  group_id: announcement.group_id,
  course_id: announcement.course_id,
  student_id: announcement.student_id,
});

const getAnnouncementRecipientStudentIds = async (target: AnnouncementTarget) => {
  const where: any = {};

  if (target.year_id !== null) where.year_id = target.year_id;
  if (target.section_id !== null) where.section_id = target.section_id;
  if (target.major_id !== null) where.major_id = target.major_id;
  if (target.group_id !== null) where.group_id = target.group_id;
  if (target.student_id !== null) where.userId = target.student_id;
  if (target.course_id !== null) {
    where.courses = { some: { course_id: target.course_id } };
  }

  const students = await prisma.student.findMany({
    where,
    select: { student_id: true },
  });

  return students.map((student) => student.student_id);
};

const notifyAnnouncementRecipients = async (
  studentIds: number[],
  announcement: { id: number; title: string },
) => {
  await notifyStudentsSafely(
    studentIds,
    {
      title: 'إعلان جديد',
      body: `إعلان جديد: ${announcement.title}`,
      route: `/website/announcements/${announcement.id}`,
      icon: DEFAULT_NOTIFICATION_ICON,
    },
    `announcement ${announcement.id}`,
  );
};

// Create announcement
export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const data = createAnnouncementSchema.parse(req.body);
  const { id: user_id } = req.user as { id: number; role: string };

  
  // Validate relationships exist if provided
  if (data.year_id) {
    const year = await prisma.year.findUnique({ where: { id: data.year_id } });
    if (!year) throw new NotFoundError('Year');
  }
  
  if (data.section_id) {
    const section = await prisma.section.findUnique({ where: { id: data.section_id } });
    if (!section) throw new NotFoundError('Section');
  }
  
  if (data.major_id) {
    const major = await prisma.major.findUnique({ where: { id: data.major_id } });
    if (!major) throw new NotFoundError('Major');
  }
  
  if (data.group_id) {
    const group = await prisma.group.findUnique({ where: { id: data.group_id } });
    if (!group) throw new NotFoundError('Group');
  }
  
  if (data.course_id) {
    const course = await prisma.course.findUnique({ where: { id: data.course_id } });
    if (!course) throw new NotFoundError('Course');
  }
  
  if (data.student_id) {
    const student = await prisma.user.findUnique({ 
      where: { id: data.student_id, role: 'STUDENT' } 
    });
    if (!student) throw new NotFoundError('Student');
  }
  
  const announcement = await prisma.announcement.create({
    data: {
      title: data.title,
      content: data.content,
      type: data.type,
      attachments: data.attachments,
      year_id: data.year_id || null,
      section_id: data.section_id || null,
      major_id: data.major_id || null,
      group_id: data.group_id || null,
      course_id: data.course_id || null,
      student_id: data.student_id || null,
      created_by: user_id,
    },
    include: {
      year: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      major: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      student: { select: { id: true, full_name: true } },
    }
  });
  
  // 🔹 EMIT WEBSOCKET EVENT
  emitNewAnnouncement(announcement);

  const recipientStudentIds = await getAnnouncementRecipientStudentIds(
    pickAnnouncementTarget(announcement),
  );
  await notifyAnnouncementRecipients(recipientStudentIds, announcement);
  
  return res.status(201).json({
    success: true,
    message: 'Announcement created successfully',
    data: announcement
  });
});

// Get all announcements with filters
export const getAllAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  const query = getAnnouncementsQuerySchema.parse(req.query);
  const { page, pageSize, type, year_id, section_id, major_id, group_id, course_id, student_id, search, startDate, endDate } = query;
  
  // Build where clause
  const where: any = {};
  
  if (type) where.type = type;
  if (year_id) where.year_id = year_id;
  if (section_id) where.section_id = section_id;
  if (major_id) where.major_id = major_id;
  if (group_id) where.group_id = group_id;
  if (course_id) where.course_id = course_id;
  if (student_id) where.student_id = student_id;
  
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at.gte = new Date(startDate);
    if (endDate) where.created_at.lte = new Date(endDate);
  }
  
  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { created_at: 'desc' },
      include: {
        year: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        major: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
        student: { select: { id: true, full_name: true } },
      }
    }),
    prisma.announcement.count({ where })
  ]);
  
  return res.status(200).json({
    success: true,
    data: announcements,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

// Get announcement by ID
export const getAnnouncementById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid announcement ID');
  }
  
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      year: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      major: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      student: { select: { id: true, full_name: true } },
    }
  });
  
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  return res.status(200).json({
    success: true,
    data: announcement
  });
});

// Update announcement
export const updateAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid announcement ID');
  }
  
  const data = updateAnnouncementSchema.parse(req.body);
  
  // Check if announcement exists
  const existingAnnouncement = await prisma.announcement.findUnique({
    where: { id }
  });
  
  if (!existingAnnouncement) {
    throw new NotFoundError('Announcement');
  }
  
  // Validate relationships if provided
  if (data.year_id !== undefined && data.year_id !== null) {
    const year = await prisma.year.findUnique({ where: { id: data.year_id } });
    if (!year) throw new NotFoundError('Year');
  }
  
  if (data.section_id !== undefined && data.section_id !== null) {
    const section = await prisma.section.findUnique({ where: { id: data.section_id } });
    if (!section) throw new NotFoundError('Section');
  }
  
  if (data.major_id !== undefined && data.major_id !== null) {
    const major = await prisma.major.findUnique({ where: { id: data.major_id } });
    if (!major) throw new NotFoundError('Major');
  }
  
  if (data.group_id !== undefined && data.group_id !== null) {
    const group = await prisma.group.findUnique({ where: { id: data.group_id } });
    if (!group) throw new NotFoundError('Group');
  }
  
  if (data.course_id !== undefined && data.course_id !== null) {
    const course = await prisma.course.findUnique({ where: { id: data.course_id } });
    if (!course) throw new NotFoundError('Course');
  }
  
  if (data.student_id !== undefined && data.student_id !== null) {
    const student = await prisma.user.findUnique({ 
      where: { id: data.student_id, role: 'STUDENT' } 
    });
    if (!student) throw new NotFoundError('Student');
  }
  
  const targetFieldsChanged = ANNOUNCEMENT_TARGET_FIELDS.some(
    (field) => (data as any)[field] !== undefined && (data as any)[field] !== (existingAnnouncement as any)[field],
  );
  const oldRecipientStudentIds = targetFieldsChanged
    ? await getAnnouncementRecipientStudentIds(pickAnnouncementTarget(existingAnnouncement))
    : [];
  
  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.attachments !== undefined) updateData.attachments = data.attachments;
  if (data.year_id !== undefined) updateData.year_id = data.year_id;
  if (data.section_id !== undefined) updateData.section_id = data.section_id;
  if (data.major_id !== undefined) updateData.major_id = data.major_id;
  if (data.group_id !== undefined) updateData.group_id = data.group_id;
  if (data.course_id !== undefined) updateData.course_id = data.course_id;
  if (data.student_id !== undefined) updateData.student_id = data.student_id;
  
  const updated = await prisma.announcement.update({
    where: { id },
    data: updateData,
    include: {
      year: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      major: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      student: { select: { id: true, full_name: true } },
    }
  });
  
  // 🔹 EMIT WEBSOCKET EVENT
  emitAnnouncementUpdate(id, updated);

  if (targetFieldsChanged) {
    const newRecipientStudentIds = await getAnnouncementRecipientStudentIds(
      pickAnnouncementTarget(updated),
    );
    const oldRecipientStudentIdSet = new Set(oldRecipientStudentIds);
    const newlyAddedStudentIds = newRecipientStudentIds.filter(
      (studentId) => !oldRecipientStudentIdSet.has(studentId),
    );

    await notifyAnnouncementRecipients(newlyAddedStudentIds, updated);
  }
  
  return res.status(200).json({
    success: true,
    message: 'Announcement updated successfully',
    data: updated
  });
});

// Delete announcement
export const deleteAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid announcement ID');
  }
  
  // Get announcement before deleting (for WebSocket targets)
  const existingAnnouncement = await prisma.announcement.findUnique({
    where: { id }
  });
  
  if (!existingAnnouncement) {
    throw new NotFoundError('Announcement');
  }
  
  await prisma.announcement.delete({
    where: { id }
  });
  
  // 🔹 EMIT WEBSOCKET EVENT
  emitAnnouncementDelete(id, existingAnnouncement);
  
  return res.status(200).json({
    success: true,
    message: 'Announcement deleted successfully'
  });
});

// Get announcements for a specific user (student/teacher)
export const getUserAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as string, 10);
  const query = getAnnouncementsQuerySchema.parse(req.query);
  const { page, pageSize, type, search, startDate, endDate } = query;
  
  if (isNaN(userId)) {
    throw new BadRequestError('Invalid user ID');
  }
  
  // Get user details to determine what announcements to show
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      student: true, // If student, get their group/section/year
    }
  });
  
  if (!user) {
    throw new NotFoundError('User');
  }
  
  // Build where clause for user-specific announcements
  const where: any = {};
  
  if (type) where.type = type;
  
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at.gte = new Date(startDate);
    if (endDate) where.created_at.lte = new Date(endDate);
  }
  
  // Show announcements targeted to:
  // - Everyone (no target = global)
  // - Student's specific targets (if student)
  where.OR = [
    { year_id: null, section_id: null, major_id: null, group_id: null, course_id: null, student_id: null }, // Global
  ];
  
  if (user.role === 'STUDENT' && user.student) {
    // Add student-specific targeting logic based on your student model
    // This depends on how students are associated with years/sections/groups
    where.OR.push(
      { student_id: userId },
      // Add other targeting logic based on your student's relationships
    );
  } else if (user.role === 'TEACHER' || user.role === 'DOCTOR') {
    // Add teacher/doctor specific targeting
    where.OR.push(
      // Add logic for courses they teach
    );
  }
  
  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { 
        created_at: 'desc' 
      },
      include: {
        year: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        major: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
        student: { select: { id: true, full_name: true } },
      }
    }),
    prisma.announcement.count({ where })
  ]);
  
  return res.status(200).json({
    success: true,
    data: announcements,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

// Get announcements by type
export const getAnnouncementsByType = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as string;
  const query = getAnnouncementsQuerySchema.parse(req.query);
  const { page, pageSize } = query;
  
  if (!['REGULAR', 'IMPORTANT', 'EMERGENCY'].includes(type)) {
    throw new BadRequestError('Invalid announcement type');
  }
  
  const where = { type: type as any };
  
  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { created_at: 'desc' },
      include: {
        year: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        major: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
        student: { select: { id: true, full_name: true } },
      }
    }),
    prisma.announcement.count({ where })
  ]);
  
  return res.status(200).json({
    success: true,
    data: announcements,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});



//doctor + teacher: get my own announcements
export const getMyAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  const { id: user_id } = req.user as { id: number; role: string };

  const query = getAnnouncementsQuerySchema.parse(req.query);
  const { page, pageSize, type, course_id, search, startDate, endDate } = query;

  const where: any = { created_by: user_id };

  if (type) where.type = type;
  if (course_id) where.course_id = course_id;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at.gte = new Date(startDate);
    if (endDate) where.created_at.lte = new Date(endDate);
  }

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { created_at: 'desc' },
      include: {
        year: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        major: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
        student: { select: { id: true, full_name: true } },
      }
    }),
    prisma.announcement.count({ where })
  ]);

  return res.status(200).json({
    success: true,
    data: announcements,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

// student: get announcements targeted to me
export const getMyStudentAnnouncements = createListHandler({
  prisma: prisma.announcement,

  allowedSortFields: [
    'id',
    'title',
    'type',
    'year_id',
    'section_id',
    'major_id',
    'group_id',
    'course_id',
    'student_id',
    'created_at',
    'updated_at',
  ],

  fieldTypes: {
    id: 'number',
    title: 'text',
    content: 'text',
    type: 'text',
    year_id: 'number',
    section_id: 'number',
    major_id: 'number',
    group_id: 'number',
    course_id: 'number',
    student_id: 'number',
    created_at: 'date',
    updated_at: 'date',
  },

  searchableFields: ['title', 'content'],

  findManyArgs: {
    include: {
      year: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      major: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      student: { select: { id: true, full_name: true } },
    },
  } as any,

  handleFindArgs: async ({ req, findManyArgs }) => {
    const { id: user_id, role } = req.user as { id: number; role: string };

    if (role !== 'STUDENT') {
      throw new ForbiddenError('Only students can access student announcements');
    }

    const student = await prisma.student.findUnique({
      where: { userId: user_id },
      select: {
        year_id: true,
        section_id: true,
        major_id: true,
        group_id: true,
        courses: {
          where: { status: 'ENROLLED' },
          select: { course_id: true },
        },
      },
    });

    if (!student) {
      throw new ForbiddenError('Student profile not found');
    }

    const enrolledCourseIds = student.courses.map((course) => course.course_id);
    const targetFilters: any[] = [
      {
        year_id: null,
        section_id: null,
        major_id: null,
        group_id: null,
        course_id: null,
        student_id: null,
      },
      { student_id: user_id },
      { year_id: student.year_id },
      { group_id: student.group_id },
    ];

    if (student.section_id !== null) {
      targetFilters.push({ section_id: student.section_id });
    }

    if (student.major_id !== null) {
      targetFilters.push({ major_id: student.major_id });
    }

    if (enrolledCourseIds.length > 0) {
      targetFilters.push({ course_id: { in: enrolledCourseIds } });
    }

    return {
      ...findManyArgs,
      where: {
        AND: [
          findManyArgs.where,
          { OR: targetFilters },
        ],
      },
      orderBy: findManyArgs.orderBy ?? { created_at: 'desc' },
    };
  },
});
import { wsServer } from './server';
import { prisma } from '../lib/prisma';

export const emitNewAnnouncement = async (announcement: any) => {
  // Send to specific targets based on announcement audience
  if (announcement.student_id) {
    // Send to specific student
    wsServer.emitToUser(announcement.student_id, 'new-announcement', announcement);
  } else if (announcement.group_id) {
    // Send to all students in group
    wsServer.emitToRoom(`group:${announcement.group_id}`, 'new-announcement', announcement);
  } else if (announcement.section_id) {
    // Send to all students in section
    wsServer.emitToRoom(`section:${announcement.section_id}`, 'new-announcement', announcement);
  } else if (announcement.major_id) {
    // Send to all students in major
    wsServer.emitToRoom(`major:${announcement.major_id}`, 'new-announcement', announcement);
  } else if (announcement.year_id) {
    // Send to all students in year
    wsServer.emitToRoom(`year:${announcement.year_id}`, 'new-announcement', announcement);
  } else if (announcement.course_id) {
    // Send to all students enrolled in course
    wsServer.emitToRoom(`course:${announcement.course_id}`, 'new-announcement', announcement);
  } else {
    // Global announcement - send to everyone
    wsServer.broadcast('new-announcement', announcement);
  }
};

export const emitAnnouncementUpdate = (announcementId: number, updatedData: any) => {
  wsServer.broadcast('announcement-updated', { id: announcementId, ...updatedData });
};

export const emitAnnouncementDelete = (announcementId: number) => {
  wsServer.broadcast('announcement-deleted', { id: announcementId });
};
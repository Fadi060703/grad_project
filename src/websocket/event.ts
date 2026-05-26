
import { wsServer } from './server';

export const emitNewAnnouncement = (announcement: any) => {
  if (!wsServer) return;
  
  // Send to specific targets based on announcement audience
  if (announcement.student_id) {
    // Send to specific student
    wsServer.emitToUser(announcement.student_id, 'new-announcement', announcement);
  } 
  
  if (announcement.group_id) {
    // Send to all students in group
    wsServer.emitToRoom(`group:${announcement.group_id}`, 'new-announcement', announcement);
  }
  
  if (announcement.section_id) {
    // Send to all students in section
    wsServer.emitToRoom(`section:${announcement.section_id}`, 'new-announcement', announcement);
  }
  
  if (announcement.major_id) {
    // Send to all students in major
    wsServer.emitToRoom(`major:${announcement.major_id}`, 'new-announcement', announcement);
  }
  
  if (announcement.year_id) {
    // Send to all students in year
    wsServer.emitToRoom(`year:${announcement.year_id}`, 'new-announcement', announcement);
  }
  
  if (announcement.course_id) {
    // Send to all students enrolled in course
    wsServer.emitToRoom(`course:${announcement.course_id}`, 'new-announcement', announcement);
  }
  
  // If no specific target (global announcement) or combination of targets
  if (!announcement.student_id && !announcement.group_id && !announcement.section_id && 
      !announcement.major_id && !announcement.year_id && !announcement.course_id) {
    wsServer.broadcast('new-announcement', announcement);
  }
};

export const emitAnnouncementUpdate = (announcementId: number, updatedData: any) => {
  if (!wsServer) return;
  
  // Get the announcement with its targets
  // You can pass the updated announcement object directly
  wsServer.broadcast('announcement-updated', { 
    id: announcementId, 
    ...updatedData 
  });
};

export const emitAnnouncementDelete = (announcementId: number, announcement: any) => {
  if (!wsServer) return;
  
  // Send to same targets as when created
  if (announcement?.student_id) {
    wsServer.emitToUser(announcement.student_id, 'announcement-deleted', { id: announcementId });
  } else if (announcement?.group_id) {
    wsServer.emitToRoom(`group:${announcement.group_id}`, 'announcement-deleted', { id: announcementId });
  } else if (announcement?.section_id) {
    wsServer.emitToRoom(`section:${announcement.section_id}`, 'announcement-deleted', { id: announcementId });
  } else if (announcement?.major_id) {
    wsServer.emitToRoom(`major:${announcement.major_id}`, 'announcement-deleted', { id: announcementId });
  } else if (announcement?.year_id) {
    wsServer.emitToRoom(`year:${announcement.year_id}`, 'announcement-deleted', { id: announcementId });
  } else if (announcement?.course_id) {
    wsServer.emitToRoom(`course:${announcement.course_id}`, 'announcement-deleted', { id: announcementId });
  } else {
    wsServer.broadcast('announcement-deleted', { id: announcementId });
  }
};
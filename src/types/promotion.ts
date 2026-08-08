// ─── Student Promotion States ─────────────────────────────────────────────────

export type PromotionState =
  | "FULLY_PASSED"   // passed all courses (possibly aided)
  | "MOVED"          // failed <= aided_pass_courses_number courses
  | "FAILED"         // failed too many courses, stays in same year
  | "GRADUATED";     // fully passed in the last year and will be deleted

// ─── Per-course result ────────────────────────────────────────────────────────

export interface CourseResult {
  course_id: number;
  course_name: string;
  total_grade: number;         // practical_grade + theoretical_grade from Mark
  passing_grade: number;       // from system_settings
  deficit: number;             // how many marks below passing (0 if passed)
  passed: boolean;             // true if total_grade >= passing_grade or aided
  aided: boolean;              // true if rescued by aided marks pool
}

// ─── Per-student result ───────────────────────────────────────────────────────

export interface StudentPromotionResult {
  student_id: number;
  user_id: number;
  full_name: string;
  username: string;
  current_year_id: number;
  current_year_name: string;
  next_year_id: number | null;     // null if GRADUATED or FAILED
  next_year_name: string | null;
  state: PromotionState;
  total_courses: number;
  passed_courses: number;
  failed_courses: number;
  aided_marks_used: number;        // total marks added from the pool
  courses: CourseResult[];
  // courses to KEEP attached (failed courses)
  courses_to_keep: number[];       // course_ids
  // courses to DETACH (passed courses, or all courses for FULLY_PASSED/GRADUATED)
  courses_to_detach: number[];     // course_ids
}

// ─── Full end-year action response ────────────────────────────────────────────

export interface EndYearActionResult {
  executed_at: string;             // ISO timestamp
  academic_key: string;            // system_settings.current_academic_key ?? ""
  settings: {
    passing_grade: number;
    aided_marks_number: number;
    aided_pass_courses_number: number;
  };
  summary: {
    total_students: number;
    fully_passed: number;
    graduated: number;
    moved: number;
    failed: number;
  };
  students: StudentPromotionResult[];
}

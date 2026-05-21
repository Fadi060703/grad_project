### Points related to website
1. api that returns the first 2 website sections based on the time during the year
2. api that gets all the student's prev grades ever
3. add website info model (createUpdate + get) { lecture_schedule, theoritical_exam_schedule, practical_exam_schedule, telegram_url, facebook_url, linkedin_url, instagram_url, support_email, website_url, university_name, faculity_name, faculity_picture_url }
4. add the externals (+ filtering based on course type) { public/[course_id] : theoritical_lectures, practical_lectures, public/website_info }
5. we need to think about the notification system (marks, announcements{group distripution, group change, ....}, next_exam_place)
6. we need to think about how the logic will be to determine stuff related to that specific student (lecture, exam, marks, courses)

### General Points
## Critical (do first)
1. **(Hani)** link student with academic structure + course
2. **(Hani)** create the seed files and test them
3. **(Fadi)** proper error handling (class) (used like: throw new UnauthError(message)) **Done**
4. **(Fadi)** announecements from backend (all logic handled)                           **Done**
5. **(Fadi)** notification service ( single | announcement )                            **In Progress**
3. **(Both)** go to الامتحانات in the uni and ask about ترفع فصلي


## **(Hani)** Lectures and qr attendance
1. lecture schedule: all in same table, api filters on either section_id or major_id
2. weekly_lecture table: (lecture_id, start_time, attendance[], is_cancelled) , (question: think about how does the student know if there is no generation from the instructor)
2. lecture_attendance: (student_id, weekly_lecture_id, status, mac_address), 
3. qr: the qr contains (weekly_lecture_id)


## **(Fadi)** exams 
1. exam settings table: (location,start_time, end_time, date, exam_id)
2. exam table:  (exam_type, course_id, course, settings[])
3. for each exam&setting pair: there should be a way to add a list of studends (student_id, seat_number)
4. so: third table: exam_hall: (exam_id, exam_setting_id, student_id, seat_number (all of them are unique))
5. so there should be a bulk api (front sends the exam_id and exam_setting_id, and student_arr) (adding not replacing)

## **(Hani)** marks
1. seperate logic for marks
2. marks_courses table : (course_ids, name)
3. marks table (marks_course_id, student_id, practical_grade, theoretical_grade)
4. bulk add api, (append not replace) + update single + bulk delete
5. notifications (think about later)

## (end_first_semester_start_second_semester) action
1. TBC

## **(fadi)** (end_second_semester_start_first_semester) action
1. the admin clicks a button
2. check all students in the faculity
3. check the courses related to each student
4. depending on aided_marks_number in system_setting, decide if that student is fully passed to the next year or not
5. depending on the pass_courses_number in system settings, and his failed coures, decide if he is moved or failed
6. for each student, if he is moved,  loop over his failed courses, keep them attached to him , and unattach the passed courses
7. for each student either move him/her to the next year (changing year_id) or do not


- we need to divide the remaining work into sections, that do not depend on each other (قدر الامكان)

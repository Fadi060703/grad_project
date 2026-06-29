import { Router } from "express";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAllAnnouncements,
  getMyAnnouncements,
  updateAnnouncement,
} from "../controllers/announcementController";
import {
  createBlog,
  deleteBlog,
  getAllBlogs,
  updateBlog,
} from "../controllers/blogController";
import {
  createFaq,
  deleteFaq,
  getAllFaqs,
  updateFaq,
} from "../controllers/faqController";
import {
  createOrUpdateFaculityInfo,
  getFaculityInfo,
} from "../controllers/faculityInfoController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.get(
  "/announcements",
  authMiddleware,
  check("announcements:read"),
  getAllAnnouncements,
);
router.get(
  "/my-announcements",
  authMiddleware,
  check("my-announcements:read"),
  getMyAnnouncements,
);
router.post(
  "/announcements",
  authMiddleware,
  check("announcements:add"),
  createAnnouncement,
);
router.put(
  "/announcements/:id",
  authMiddleware,
  check("announcements:update"),
  updateAnnouncement,
);
router.delete(
  "/announcements/:id",
  authMiddleware,
  check("announcements:delete"),
  deleteAnnouncement,
);

router.get("/blogs", authMiddleware, check("blogs:read"), getAllBlogs);
router.post("/blogs", authMiddleware, check("blogs:add"), createBlog);
router.put("/blogs/:id", authMiddleware, check("blogs:update"), updateBlog);
router.delete("/blogs/:id", authMiddleware, check("blogs:delete"), deleteBlog);

router.get("/faqs", authMiddleware, check("faqs:read"), getAllFaqs);
router.post("/faqs", authMiddleware, check("faqs:add"), createFaq);
router.put("/faqs/:id", authMiddleware, check("faqs:update"), updateFaq);
router.delete("/faqs/:id", authMiddleware, check("faqs:delete"), deleteFaq);

router.get(
  "/faculity-info",
  authMiddleware,
  check("faculity-info:read"),
  getFaculityInfo,
);
router.put(
  "/faculity-info",
  authMiddleware,
  check("faculity-info:update"),
  createOrUpdateFaculityInfo,
);

export default router;

import { Router } from "express";
import {
  createStudent,
  createUser,
  deleteUser,
  getAllnonStudentUsers,
  getAllStudentUsers,
  getUserById,
  toggleUserActivity,
  updateStudent,
  updateUser,
} from "../controllers/userController";
import { authMiddleware } from "../middlewares/auth";
import { check } from "../middlewares/check-permission";

const router = Router();

router.get(
  "/users",
  authMiddleware,
  check("users:read"),
  getAllnonStudentUsers,
);
router.put(
  "/users/toggle-active/:id",
  authMiddleware,
  check("users:toggle-activity"),
  toggleUserActivity,
);
router.get("/users/:id", authMiddleware, check("users:read"), getUserById);
router.post("/users", authMiddleware, check("users:add"), createUser);
router.put("/users/:id", authMiddleware, check("users:update"), updateUser);
router.delete("/users/:id", authMiddleware, check("users:delete"), deleteUser);

router.get(
  "/students",
  authMiddleware,
  check("users:read"),
  getAllStudentUsers,
);
router.post("/students", authMiddleware, check("users:add"), createStudent);
router.put(
  "/students/:id",
  authMiddleware,
  check("users:update"),
  updateStudent,
);

export default router;

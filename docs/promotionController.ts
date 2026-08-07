import { Request, Response } from "express";
import path from "path";
import fs from "fs/promises";
import { asyncHandler } from "../utils/asyncHandler";
import { generatePromotionPreview } from "../services/promotionService";
import { prisma } from "../lib/prisma";
import { PromotionPreviewResult } from "../types/promotion";

// ─── Path where preview JSON is stored ───────────────────────────────────────

const PREVIEW_FILE_PATH = path.join(process.cwd(), "data", "promotion-preview.json");

// ─── GET /promotion/preview ───────────────────────────────────────────────────
// Runs the full calculation and saves result to JSON. No DB mutations.

export const previewPromotion = asyncHandler(async (req: Request, res: Response) => {
  const preview = await generatePromotionPreview();

  // Ensure the data directory exists
  await fs.mkdir(path.dirname(PREVIEW_FILE_PATH), { recursive: true });

  // Write preview to JSON file (overwrite on re-run)
  await fs.writeFile(PREVIEW_FILE_PATH, JSON.stringify(preview, null, 2), "utf-8");

  return res.status(200).json({
    success: true,
    message: "Promotion preview generated. Review the results before committing.",
    data: preview,
  });
});

// ─── GET /promotion/preview/file ─────────────────────────────────────────────
// Returns the last saved preview JSON file

export const getLastPreview = asyncHandler(async (req: Request, res: Response) => {
  try {
    const raw = await fs.readFile(PREVIEW_FILE_PATH, "utf-8");
    const preview: PromotionPreviewResult = JSON.parse(raw);

    return res.status(200).json({
      success: true,
      data: preview,
    });
  } catch {
    return res.status(404).json({
      success: false,
      message: "No promotion preview found. Run /promotion/preview first.",
    });
  }
});

// ─── POST /promotion/commit ───────────────────────────────────────────────────
// Reads the last saved preview and commits the DB changes.

export const commitPromotion = asyncHandler(async (req: Request, res: Response) => {
  // Load last preview
  let preview: PromotionPreviewResult;
  try {
    const raw = await fs.readFile(PREVIEW_FILE_PATH, "utf-8");
    preview = JSON.parse(raw);
  } catch {
    return res.status(400).json({
      success: false,
      message: "No promotion preview found. Run /promotion/preview first.",
    });
  }

  const { students } = preview;

  // Run all mutations in a single transaction
  await prisma.$transaction(async (tx) => {
    for (const result of students) {
      if (result.state === "FAILED") {
        // No changes for failed students
        continue;
      }

      // 1. Detach passed courses from the student
      if (result.courses_to_detach.length > 0) {
        await tx.studentCourse.deleteMany({
          where: {
            student_id: result.student_id,
            course_id: { in: result.courses_to_detach },
          },
        });
      }

      // 2. Update status of kept (failed) courses to FAILED
      if (result.courses_to_keep.length > 0) {
        await tx.studentCourse.updateMany({
          where: {
            student_id: result.student_id,
            course_id: { in: result.courses_to_keep },
          },
          data: { status: "FAILED" },
        });
      }

      // 3. Move student to next year (FULLY_PASSED or MOVED)
      if (
        (result.state === "FULLY_PASSED" || result.state === "MOVED") &&
        result.next_year_id !== null
      ) {
        await tx.student.update({
          where: { student_id: result.student_id },
          data: {
            year_id: result.next_year_id,
            // Clear section/major/group — admin reassigns manually
            section_id: null,
            major_id: null,
          },
        });
      }

      // 4. GRADUATED — just detach all courses, no year change
      // (already handled by courses_to_detach above, no year update needed)
    }
  });

  // Delete the preview file after successful commit so it can't be committed twice
  await fs.unlink(PREVIEW_FILE_PATH).catch(() => null);

  return res.status(200).json({
    success: true,
    message: "Promotion committed successfully.",
    summary: preview.summary,
  });
});

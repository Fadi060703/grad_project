import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { executeEndYearAction } from "../services/promotionService";

export const runEndYearAction = asyncHandler(async (_req: Request, res: Response) => {
  const result = await executeEndYearAction();

  return res.status(200).json({
    success: true,
    message: "End year action executed successfully.",
    data: result,
  });
});

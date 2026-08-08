import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { executeEndYearAction } from "../services/promotionService";
import { executeStartYearAction } from "../services/startYearActionService";
import { parseStartYearActionInput } from "../validators/actions";

export const runEndYearAction = asyncHandler(async (_req: Request, res: Response) => {
  const result = await executeEndYearAction();

  return res.status(200).json({
    success: true,
    message: "End year action executed successfully.",
    data: result,
  });
});

export const runStartYearAction = asyncHandler(async (req: Request, res: Response) => {
  const input = parseStartYearActionInput(req.body);
  const result = await executeStartYearAction(input);

  return res.status(200).json({
    success: true,
    message: "تم تنفيذ إجراء بداية السنة بنجاح.",
    data: result,
  });
});

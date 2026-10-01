import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { ConflictError, NotFoundError } from "../store/store";

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: "NotFound", message: `No route for ${req.method} ${req.path}` });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "ValidationError",
      message: "Request body is invalid",
      issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: "NotFound", message: error.message });
    return;
  }
  if (error instanceof ConflictError) {
    res.status(409).json({ error: "Conflict", message: error.message });
    return;
  }
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "BadRequest", message: "Malformed JSON body" });
    return;
  }
  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "PayloadTooLarge", message: "Request body is too large" });
    return;
  }
  console.error("[api] unhandled error", error);
  res.status(500).json({ error: "InternalError", message: "Something went wrong" });
};

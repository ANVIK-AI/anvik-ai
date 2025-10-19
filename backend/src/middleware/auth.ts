import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js"; 

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ error: "No token" });

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).send({ error: "Invalid auth header" });
  }

  try {
    const payload = jwt.verify(token, ENV.JWT_ACCESS_SECRET);
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).send({ error: "Invalid token" });
  }
}

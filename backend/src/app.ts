// src/app.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
// import logger from "./utils/logger";
import { requestLogger } from "./middleware/requestLogger.js";
// import authRoutes from "./api/auth/auth.routes.js";
// import usersRoutes from "./api/users/users.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import documentRoutes from "./routes/document.routes";

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

const app = express();

app.use(requestLogger);
app.use(express.json());
app.use(helmet());
app.use(cors(corsOptions));
app.use(
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100
  })
);

app.get("/health", (_req, res) => res.send({ status: "ok" }));
app.use("/", documentRoutes);
// app.use("/api/auth", authRoutes);
// app.use("/api/users", usersRoutes);

app.use(errorHandler);

export default app;

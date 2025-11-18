// src/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// import logger from "./utils/logger";
// import { requestLogger } from "./middleware/requestLogger.js";
// import authRoutes from "./api/auth/auth.routes.js";
// import usersRoutes from "./api/users/users.routes.js";
import { errorHandler } from './middleware/errorHandler.js';
import documentRoutes from './routes/document.routes';
import chatRoutes from './routes/chat.routes';

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
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

const app = express();

// Local file storage for demo purposes. Replace with S3/GCS in prod.
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  },
});

app.use(express.json());
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
// app.use(requestLogger);
app.use(cors(corsOptions));
app.use(
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
  }),
);

// Add multer middleware for file uploads
app.use('/v3/documents/file', upload.single('file'), (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.get('/health', (_req, res) => res.send({ status: 'ok' }));
app.use('/', documentRoutes);
app.use('/', chatRoutes);
// app.use("/api/auth", authRoutes);
// app.use("/api/users", usersRoutes);

app.use(errorHandler);

export default app;

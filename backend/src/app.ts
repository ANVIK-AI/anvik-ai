// src/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { isAuthenticated } from "./middleware/auth.middleware";
// const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
import {getProfile} from "./controller/user.controller.js"
import passport from "passport"
import { AuthService } from './services/auth.service.js';
import session from "express-session"
import connectPgSimple from "connect-pg-simple" 
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import PassportGoogle from 'passport-google-oauth20';
// const GoogleStrategy = PassportGoogle.Strategy;
import prisma from './db/prismaClient.js';
import pg from "pg"
// const pg = require('pg');
// import logger from "./utils/logger";
// import { requestLogger } from "./middleware/requestLogger.js";
// import authRoutes from "./api/auth/auth.routes.js";
// import usersRoutes from "./api/users/users.routes.js";
import { errorHandler } from './middleware/errorHandler.js';
import documentRoutes from './routes/document.routes';
import chatRoutes from './routes/chat.routes';
// import { Session } from 'inspector/promises';
import authRoutes from "./routes/auth.routes.js"
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];


const PgSession= connectPgSimple(session);
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    // Allow all origins in development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, only allow specific origins
    if (origin && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'user-agent'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposedHeaders: ['set-cookie']
};
const pgPool = new pg.Pool({
    user: process.env.DB_USER || 'your_db_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'your_db_name',
    password: process.env.DB_PASSWORD || 'your_db_password',
    port: Number(process.env.DB_PORT) || 5432,
});
const app = express();




//TODO: Local file storage for demo purposes. Replace with S3/GCS in prod.
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
      cb(null, false);
    }
  },
});

app.use(express.json());
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
// app.use(requestLogger);
app.use(cors(corsOptions));
// app.use(cors({
//   origin: '*', // or your frontend URL
//   credentials: true, // if you're using cookies/sessions
//   allowedHeaders: ['Content-Type', 'Authorization', 'user-agent'], // Add any other headers you need
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] // Add the HTTP methods you need
// }));
app.use(
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
  }),
);
app.use(session({
    store: new PgSession({
        pool: pgPool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: process.env.NODE_ENV === 'production',
        // httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: process.env.NODE_ENV === 'production' ? 'yourdomain.com' : 'localhost'
    },
    name: 'connect.sid' // Default session ID cookie name
}));


app.use(passport.initialize());
app.use(passport.session());

// Debug middleware for sessions
// app.use((req, res, next) => {
//   console.log('Session:', req.session);
//   console.log('User:', req.user);
//   console.log('Cookies:', req.cookies);
//   next();
// });

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID as string,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
  passReqToCallback: true 
},
async (req: any, accessToken: string, refreshToken: string, profile:any, done: any) => {
  try {
    console.log('Google profile received:', profile);
    const user = await AuthService.findOrCreateUser(profile, {
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    console.log('User from AuthService:', user);
    return done(null, user);
  } catch (error) {
    console.error('Error in GoogleStrategy:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user: any, done) => {
  // console.log('Serializing user:', user);
  // Make sure user.id exists and is a number
  if (user && user.id) {
    done(null, user.id);
  } else {
    console.error('No user or user.id found during serialization:', user);
    done(new Error('User serialization failed: No user ID'), null);
  }
});

passport.deserializeUser(async (id: number, done) => {
  try {
    console.log('Deserializing user with ID:', id);
    const user = await prisma.user.findUnique({ 
      where: { id } 
    });
    
    if (!user) {
      console.error('No user found with ID:', id);
      return done(new Error('User not found'), null);
    }
    
    // console.log('Found user:', user);
    done(null, user);
  } catch (error) {
    console.error('Error in deserializeUser:', error);
    done(error, null);
  }
});

// Add multer middleware for file uploads
app.use('/v3/documents/file', upload.single('file'), (err:any, req:any, res:any, next:any) => {
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

app.use("/auth", authRoutes);
app.use("/user/profile", isAuthenticated,getProfile);
// app.use("/api/auth", authRoutes);
// app.use("/api/users", usersRoutes);
// Add this before your error handler
app.get('/api/session', (req, res) => {
  console.log('Session route hit. Session:', req.session);
  console.log('User:', req.user);
  res.json({
    session: req.session,
    user: req.user,
    isAuthenticated: req.isAuthenticated()
  });
});
app.use(errorHandler);

export default app;

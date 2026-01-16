// const express = require('express');
// const router = express.Router();
import { Router } from "express";
import passport from "passport";
import { googleCallback, logout } from "../controller/auth.controller.js";
const router=Router()
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email','https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/tasks.readonly','https://www.googleapis.com/auth/tasks'],
    accessType: 'offline',
    prompt: 'consent'
  })
);

router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/login' 
  }),
  googleCallback
);

router.get('/logout', logout);

// export {router}

export default router;
// module.exports = router;

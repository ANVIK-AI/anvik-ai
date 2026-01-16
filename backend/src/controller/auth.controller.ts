// const AuthService = require('../services/auth.service');
// import { AuthService } from "../services/auth.service";
export const googleAuth = (req:any, res:any, next:any) => {
  // This will be handled by passport
};

export const googleCallback = (req:any, res:any) => {
  res.redirect('http://localhost:5173/profile');
};

export const logout = (req:any, res:any) => {
  req.logout(() => {
    res.redirect('http://localhost:5173/');
  });
};
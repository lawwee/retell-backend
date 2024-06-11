import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer")) {
     return res.status(400).json({message:"Authentication token required"});
    }
    const token = authHeader.split(" ")[1];
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      if (!decodedToken) {
       return res.status(400).json({message:"Invalid Authentication token"});
      }
      next();
    } catch (error) {
      console.log(error);
      return res.status(401).json({message:"You are not Authenticated , Please login"})
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({message:"Error while authenticating"})
  }
};

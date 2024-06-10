import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export const isAsmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer")) {
      res.send("Authentication token required");
      throw new Error(" requires a token ");
    }
    const token = authHeader.split(" ")[1];
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      if (!decodedToken) {
        res.send("Invalid token");
      }
      next();
    } catch (error) {
      console.log(error);
      throw new Error("Authentication error");
    }
  } catch (error) {
    console.log(error);
    res.send("Failed to authenticate token");
  }
};

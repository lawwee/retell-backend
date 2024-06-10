import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { userModel } from "../users/userModel";

interface AuthRequest extends Request {
  user?: any;
}

const authmiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer")) {
      res.send("Authentication token required");
      throw new Error(" requires a token ");
    }
    const token = authHeader.split(" ")[1];
    console.log(token)
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload
      if (!decodedToken) {
        res.send("Invalid token");
      }
      req.user = await userModel.findById(decodedToken.userId).select("-password");
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

export default authmiddleware;

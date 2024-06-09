"use strict";
// import * as dotenv from "dotenv";
// dotenv.config();
// if (process.env.NODE_ENV === "production") {
//   require("module-alias/register");
// }
// ///////////////////////////////////////////////////////////////////////
// import "@/common/interfaces/request";
// import compression from "compression";
// import cookieParser from "cookie-parser";
// import cors from "cors";
// import express, { Express, NextFunction, Request, Response } from "express";
// import helmet, { HelmetOptions } from "helmet";
// import helmetCsp from "helmet-csp";
// import http from "http";
// import { connectDb } from "../src/contacts/contact_model";
// import mongoSanitize from "express-mongo-sanitize";
// import hpp from "hpp";
// dotenv.config();
// process.on("uncaughtException", async (error: Error) => {
//   console.log("UNCAUGHT EXCEPTION! 💥 Server Shutting down...");
//   console.log(error.name, error.message);
//   process.exit(1);
// });
// const app: Express = express();
// app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]); // Enable trust proxy
// app.use(cookieParser());
// app.use(express.json({ limit: "10kb" }));
// app.use(express.urlencoded({ limit: "50mb", extended: true }));
// app.use(compression());
// // Rate limiter middleware
// // const limiter = rateLimit({
// // 	windowMs: 15 * 60 * 1000, // 15 minutes
// // 	max: 100, // Limit each IP to 100 requests per windowMs
// // 	message: 'Too many requests from this IP, please try again later.',
// // });
// // app.use(limiter);
// //Middleware to allow CORS from frontend
// app.use(
//   cors({
//     origin: "*",
//   }),
// );
// //Configure Content Security Policy (CSP)
// const contentSecurityPolicy = {
//   directives: {
//     defaultSrc: ["'self'"],
//     scriptSrc: ["'self'", "https://ajax.googleapis.com"], // TODO: change this to your frontend url, scripts and other trusted sources
//     styleSrc: ["'self'", "trusted-cdn.com", "'unsafe-inline'"], // TODO: change this to your frontend url, styles and other trusted sources
//     imgSrc: ["'self'", "s3-bucket-url", "data:"], // TODO: change this to your frontend url, images and other trusted sources
//     frameAncestors: ["'none'"],
//     objectSrc: ["'none'"],
//     upgradeInsecureRequests: "'self'",
//   },
// };
// // Use Helmet middleware for security headers
// app.use(
//   helmet({
//     contentSecurityPolicy: false, // Disable the default CSP middleware
//   }),
// );
// // Use helmet-csp middleware for Content Security Policy
// app.use(helmetCsp(contentSecurityPolicy));
// const helmetConfig: HelmetOptions = {
//   // X-Frame-Options header to prevent clickjacking
//   frameguard: { action: "deny" },
//   // X-XSS-Protection header to enable browser's built-in XSS protection
//   xssFilter: true,
//   // Referrer-Policy header
//   referrerPolicy: { policy: "same-origin" },
//   // Strict-Transport-Security (HSTS) header for HTTPS enforcement
//   hsts: { maxAge: 15552000, includeSubDomains: true, preload: true },
// };
// app.use(helmet(helmetConfig));
// //Secure cookies and other helmet-related configurations
// app.use(helmet.hidePoweredBy());
// app.use(helmet.noSniff());
// app.use(helmet.ieNoOpen());
// app.use(helmet.dnsPrefetchControl());
// app.use(helmet.permittedCrossDomainPolicies());
// // Prevent browser from caching sensitive information
// app.use((req, res, next) => {
//   res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
//   res.set("Pragma", "no-cache");
//   res.set("Expires", "0");
//   next();
// });
// // Data sanitization against NoSQL query injection
// app.use(mongoSanitize());
// // Data sanitization against XSS
// // Prevent parameter pollution
// app.use(
//   hpp({
//     whitelist: ["date", "createdAt"], // whitelist some parameters
//   }),
// );
// app.use("/api/v1/alive", (req, res) =>
//   res
//     .status(200)
//     .json({ status: "success", message: "Server is up and running" }),
// );
// // app.use('/api/v1/queue', serverAdapter.getRouter());
// // app.use('/api/v1/auth', authRouter);
// // app.use('/api/v1/user', userRouter);
// // app.use('/api/v1/campaign', campaignRouter);
// app.all("/*", async (req, res) => {
//   // logger.error('route not found ' + new Date(Date.now()) + ' ' + req.originalUrl);
//   res.status(404).json({
//     status: "error",
//     message: `OOPs!! No handler defined for ${req.method.toUpperCase()}: ${
//       req.url
//     } route. Check the API documentation for more details.`,
//   });
// });
// /**
//  * Bootstrap server
//  */
// // to ensure all the express middlewares are set up before starting the socket server
// // including security headers and other middlewares
// const server = http.createServer(app);
// const appServer = server.listen(8080, async () => {
//   await connectDb();
//   console.log("=> " + +" app listening on port " + +"!");
// });
// // app.use(timeoutMiddleware);
// // app.use(errorHandler);
// process.on("unhandledRejection", async (error: Error) => {
//   console.log("UNHANDLED REJECTION! 💥 Server Shutting down...");
//   console.log(error.name, error.message);
//   appServer.close(() => {
//     process.exit(1);
//   });
// });

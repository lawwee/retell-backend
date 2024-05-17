import { createClient } from "redis";

export const redisClient = createClient({
    password: process.env.REDIS_PASSOWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: 12658
    }
});

export const redisConnection = async () => {
    redisClient.on('error', (err: any) => {
      console.log('Redis Client Error', err);
    });
    redisClient.on('ready', () => {
      console.log('=> Redis Ready');
    });
    await redisClient.connect();
  };
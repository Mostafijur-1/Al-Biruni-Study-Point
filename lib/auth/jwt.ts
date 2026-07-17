import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

import type { UserRole } from "@/types";

export interface TokenPayload extends JwtPayload {
  userId: string;
  role: UserRole;
  phone?: string;
  email?: string;
}

function getSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET") {
  const secret = process.env[name];

  if (!secret || secret.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }

  return secret;
}

export function generateAccessToken(payload: TokenPayload) {
  const options: SignOptions = {

    expiresIn: (process.env.JWT_ACCESS_EXPIRES || "15m") as SignOptions["expiresIn"],


    algorithm: "HS256",
  };

  return jwt.sign(payload, getSecret("JWT_ACCESS_SECRET"), options);
}

export function generateRefreshToken(payload: TokenPayload) {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES || "30d") as SignOptions["expiresIn"],
    algorithm: "HS256",
  };

  return jwt.sign(payload, getSecret("JWT_REFRESH_SECRET"), options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, getSecret("JWT_ACCESS_SECRET")) as TokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, getSecret("JWT_REFRESH_SECRET")) as TokenPayload;
}

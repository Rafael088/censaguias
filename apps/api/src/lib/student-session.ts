import { SignJWT, jwtVerify } from "jose";
import { env } from "../env.js";

export const STUDENT_COOKIE = "cg_student";
export const STUDENT_SESSION_DAYS = 30;

export type StudentSession = { groupId: string; codeVersion: number };

const key = () => new TextEncoder().encode(env().STUDENT_SESSION_SECRET);

/** La sesión lleva la versión del código: si el admin lo regenera, las sesiones viejas caen (ADR 0004). */
export async function signStudentSession(s: StudentSession): Promise<string> {
  return new SignJWT({ v: s.codeVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.groupId)
    .setIssuedAt()
    .setExpirationTime(`${STUDENT_SESSION_DAYS}d`)
    .sign(key());
}

export async function verifyStudentSession(token: string): Promise<StudentSession | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.v !== "number") return null;
    return { groupId: payload.sub, codeVersion: payload.v };
  } catch {
    return null;
  }
}

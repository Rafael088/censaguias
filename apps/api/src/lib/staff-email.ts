import { env } from "../env.js";

/** Supabase Auth necesita un correo; el staff solo conoce su usuario institucional (ADR 0006). */
export const staffEmail = (username: string) => `${username}@${env().STAFF_EMAIL_DOMAIN}`;

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { loginInput } from "@censaguias/shared";
import { anonClient } from "../lib/supabase.js";
import { staffEmail } from "../lib/staff-email.js";
import { takeTurnOr429 } from "../lib/rate-limit.js";

// Login del staff con usuario institucional. Devuelve la sesión de Supabase y el front la guarda
// con supabase.auth.setSession(); desde ahí manda el access_token como Bearer.
export const authRoutes = new Hono().post(
  "/login",
  zValidator("json", loginInput, (result, c) => {
    if (!result.success) return c.json({ error: "Usuario o contraseña incorrectos" }, 400);
  }),
  async (c) => {
    const { username, password } = c.req.valid("json");
    // 10 intentos por minuto y usuario: una contraseña no se prueba a martillazos.
    // Se cuenta por usuario y no por IP a propósito: así una IP sola no puede tumbar el acceso
    // de todo un plantel, aunque sí se le pone freno al que prueba contraseñas a destajo.
    takeTurnOr429(`login:${username}`);
    // El cliente anon es por request: no comparte sesión entre usuarios.
    const { data, error } = await anonClient().auth.signInWithPassword({ email: staffEmail(username), password });
    if (error || !data.session) return c.json({ error: "Usuario o contraseña incorrectos" }, 401);
    return c.json({
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    });
  },
);

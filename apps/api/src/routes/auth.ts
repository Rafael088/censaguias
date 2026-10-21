import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createClient } from "@supabase/supabase-js";
import { loginInput } from "@censaguias/shared";
import { env } from "../env.js";
import { staffEmail } from "../lib/staff-email.js";

// Login del staff con usuario institucional. Devuelve la sesión de Supabase y el front la guarda
// con supabase.auth.setSession(); desde ahí manda el access_token como Bearer.
// TODO(v0.1.0 · API-03): limitar intentos por IP y por usuario.
export const authRoutes = new Hono().post(
  "/login",
  zValidator("json", loginInput, (result, c) => {
    if (!result.success) return c.json({ error: "Usuario o contraseña incorrectos" }, 400);
  }),
  async (c) => {
    const { username, password } = c.req.valid("json");
    // Cliente anon nuevo por request: no comparte sesión entre usuarios.
    const anon = createClient(env().SUPABASE_URL, env().SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email: staffEmail(username), password });
    if (error || !data.session) return c.json({ error: "Usuario o contraseña incorrectos" }, 401);
    return c.json({
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    });
  },
);

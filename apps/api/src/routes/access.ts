import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { accessCodeInput, groupLabel, SHIFT_LABEL, type Shift } from "@censaguias/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { STUDENT_COOKIE, STUDENT_SESSION_DAYS, signStudentSession } from "../lib/student-session.js";

// TODO(v0.1.0 · API-03): limitar intentos por IP antes de salir a producción.
export const accessRoutes = new Hono()
  .post(
    "/",
    zValidator("json", accessCodeInput, (result, c) => {
      if (!result.success) return c.json({ error: "Código no válido" }, 400);
    }),
    async (c) => {
    const { code } = c.req.valid("json");
    const { data: group } = await supabaseAdmin()
      .from("groups")
      .select("id, clei, identifier, shift, school_year, code_version")
      .eq("access_code", code)
      .maybeSingle();
    if (!group) return c.json({ error: "Código no válido" }, 404);

    const token = await signStudentSession({ groupId: group.id, codeVersion: group.code_version });
    setCookie(c, STUDENT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax", // el front llega por el rewrite /api/* de Next: mismo origen (ADR 0002)
      path: "/",
      maxAge: STUDENT_SESSION_DAYS * 24 * 60 * 60,
    });
    return c.json({
      group: {
        id: group.id as string,
        label: groupLabel(group),
        shift: SHIFT_LABEL[group.shift as Shift],
        schoolYear: group.school_year as number,
      },
    });
    },
  )
  .delete("/", (c) => {
    deleteCookie(c, STUDENT_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

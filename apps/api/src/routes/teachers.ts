import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { createTeacherInput, groupLabel, SHIFT_LABEL, teacherListQuery, teacherPasswordInput, updateTeacherInput } from "@censaguias/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireStaff, type AppVars } from "../middleware/auth.js";
import { throwSupabase } from "../lib/groups.js";
import { staffEmail } from "../lib/staff-email.js";
import {
  PROFILE_COLUMNS,
  assignmentsOfTeacher,
  findTeacher,
  mapProfile,
  requireTeacherId,
  teacherSearchExpression,
  type ProfileRow,
} from "../lib/teachers.js";

/**
 * Profesores (API-08): lista, registro, detalle, edición, contraseña y borrado — las
 * pantallas admin-08 a admin-10. Solo el administrador entra aquí.
 *
 * El alta sigue el ADR 0006: primero el usuario de Auth con el correo sintético
 * (<usuario>@<STAFF_EMAIL_DOMAIN>), después el perfil; si el insert falla, se borra el
 * usuario de Auth para no dejar cuentas sin perfil. La contraseña nunca sale de Auth.
 */
export const teacherAdminRoutes = new Hono<{ Variables: AppVars }>()
  .use(requireStaff("admin"))
  .get(
    "/",
    zValidator("query", teacherListQuery, (result, c) => {
      if (!result.success) return c.json({ error: "Filtros no válidos" }, 400);
    }),
    async (c) => {
      const { q, page, pageSize } = c.req.valid("query");
      const db = supabaseAdmin();

      let query = db.from("profiles").select(PROFILE_COLUMNS, { count: "exact" }).eq("role", "teacher");
      const search = q ? teacherSearchExpression(q) : null;
      if (search) query = query.or(search);

      const { data, count, error } = await query
        .order("full_name")
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throwSupabase(error);
      const rows = (data ?? []) as ProfileRow[];

      // «3 docentes activos» es de todos los docentes, no de la página (admin-08).
      const activeResult = await db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "teacher")
        .eq("active", true);
      if (activeResult.error) throwSupabase(activeResult.error);

      // Materias y grupos de esta página, en dos consultas para toda la página (sin N+1).
      const teacherIds = rows.map((row) => row.id);
      const { data: subjectRows, error: subjectsError } = teacherIds.length
        ? await db.from("subjects").select("name, group_id, teacher_id").in("teacher_id", teacherIds).order("name")
        : { data: [], error: null };
      if (subjectsError) throwSupabase(subjectsError);
      const subjects = (subjectRows ?? []) as { name: string; group_id: string; teacher_id: string }[];

      const groupIds = [...new Set(subjects.map((subject) => subject.group_id))];
      const { data: groupRows, error: groupsError } = groupIds.length
        ? await db.from("groups").select("id, clei, identifier, shift").in("id", groupIds)
        : { data: [], error: null };
      if (groupsError) throwSupabase(groupsError);
      const groupsById = new Map(
        ((groupRows ?? []) as { id: string; clei: number; identifier: string; shift: "morning" | "night" | "saturday" }[]).map(
          (group) => [group.id, group],
        ),
      );

      const subjectsByTeacher = new Map<string, string[]>();
      const groupsByTeacher = new Map<string, Set<string>>();
      for (const subject of subjects) {
        const names = subjectsByTeacher.get(subject.teacher_id) ?? [];
        names.push(subject.name);
        subjectsByTeacher.set(subject.teacher_id, names);

        const group = groupsById.get(subject.group_id);
        if (!group) continue;
        const labels = groupsByTeacher.get(subject.teacher_id) ?? new Set<string>();
        // El Figma lo pinta junto: «CLEI IV · A / Mañana».
        labels.add(`${groupLabel(group)} / ${SHIFT_LABEL[group.shift]}`);
        groupsByTeacher.set(subject.teacher_id, labels);
      }

      return c.json({
        items: rows.map((row) => ({
          ...mapProfile(row),
          subjects: [...(subjectsByTeacher.get(row.id) ?? [])].sort((a, b) => a.localeCompare(b, "es")),
          groups: [...(groupsByTeacher.get(row.id) ?? [])].sort((a, b) => a.localeCompare(b, "es")),
        })),
        total: count ?? rows.length,
        activeCount: activeResult.count ?? 0,
        page,
        pageSize,
      });
    },
  )
  .post(
    "/",
    zValidator("json", createTeacherInput, (result, c) => {
      if (!result.success) return c.json({ error: "Datos del profesor no válidos" }, 400);
    }),
    async (c) => {
      const { fullName, username, temporaryPassword } = c.req.valid("json");
      const db = supabaseAdmin();
      const email = staffEmail(username);

      // 1) El usuario de Auth primero: sin él el perfil no puede existir (la FK lo ata a auth.users).
      const { data: created, error: authError } = await db.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
      });
      if (authError || !created.user) {
        // El correo es <usuario>@dominio: un correo ya dado de alta es un usuario ya usado.
        if (authError?.code === "email_exists") return c.json({ error: "Ya existe un usuario con ese nombre" }, 409);
        throwSupabase(authError ?? new Error("Auth no devolvió el usuario"));
      }

      // 2) El perfil. Si falla, se deshace el usuario de Auth: no queda cuenta sin perfil.
      const { data, error } = await db
        .from("profiles")
        .insert({ id: created.user.id, username, full_name: fullName, email, role: "teacher", active: true })
        .select(PROFILE_COLUMNS)
        .single();
      if (error) {
        const { error: undoError } = await db.auth.admin.deleteUser(created.user.id);
        if (undoError) console.error(`No se pudo deshacer el usuario ${created.user.id}:`, undoError);
        if (error.code === "23505") return c.json({ error: "Ya existe un usuario con ese nombre" }, 409);
        throwSupabase(error);
      }
      return c.json(mapProfile(data as ProfileRow), 201);
    },
  )
  .get("/:id", async (c) => {
    const db = supabaseAdmin();
    const teacher = await findTeacher(db, c.req.param("id"));
    return c.json({ ...mapProfile(teacher), assignments: await assignmentsOfTeacher(db, teacher.id) });
  })
  .patch(
    "/:id",
    zValidator("json", updateTeacherInput, (result, c) => {
      if (!result.success) return c.json({ error: "Datos del profesor no válidos" }, 400);
    }),
    async (c) => {
      const input = c.req.valid("json");
      const db = supabaseAdmin();
      const teacher = await findTeacher(db, c.req.param("id"));
      // Lo que era antes de tocar nada: el update cambia la fila y hay que poder comparar
      // y revertir contra el valor original (los tests devuelven la fila viva por select).
      const previous = { username: teacher.username, email: teacher.email };

      const changes: Record<string, unknown> = {};
      if (input.fullName !== undefined) changes.full_name = input.fullName;
      if (input.username !== undefined) {
        changes.username = input.username;
        // El correo con el que entra el profesor deriva del usuario (ADR 0006): si cambia
        // uno, hay que cambiar el otro o el login deja de encontrar la cuenta.
        changes.email = staffEmail(input.username);
      }
      if (Object.keys(changes).length === 0) return c.json({ error: "No se envió ningún cambio" }, 400);

      // El perfil primero (username es único en la tabla) y Auth después. Si Auth no puede
      // tomar el correo nuevo, se revierte el perfil: la tabla no puede decir un usuario
      // que Auth no conoce.
      const { data, error } = await db.from("profiles").update(changes).eq("id", teacher.id).select(PROFILE_COLUMNS);
      if (error?.code === "23505") return c.json({ error: "Ya existe un usuario con ese nombre" }, 409);
      if (error) throwSupabase(error);
      const row = ((data ?? []) as ProfileRow[])[0];
      if (!row) throw new HTTPException(404, { message: "Profesor no encontrado" });

      if (changes.email !== undefined && changes.email !== previous.email) {
        const { error: authError } = await db.auth.admin.updateUserById(teacher.id, { email: changes.email as string });
        if (authError) {
          await db.from("profiles").update({ username: previous.username, email: previous.email }).eq("id", teacher.id);
          if (authError.code === "email_exists") return c.json({ error: "Ya existe un usuario con ese nombre" }, 409);
          throwSupabase(authError);
        }
      }
      return c.json(mapProfile(row));
    },
  )
  .delete("/:id", async (c) => {
    // Borrarse a sí mismo dejaría la institución sin administrador, y no hay registro
    // público que lo reponga (ADR 0006).
    if (requireTeacherId(c.req.param("id")) === c.get("staff").id) {
      return c.json({ error: "No puedes eliminarte a ti mismo" }, 403);
    }

    const db = supabaseAdmin();
    const teacher = await findTeacher(db, c.req.param("id"));

    // Borrar el usuario de Auth cascada a profiles (FK) y deja las materias sin docente
    // (teacher_id on delete set null): las guías se conservan, que es lo que dice admin-10.
    const { error } = await db.auth.admin.deleteUser(teacher.id);
    if (error) throwSupabase(error);
    return c.body(null, 204);
  })
  .post(
    "/:id/password",
    zValidator("json", teacherPasswordInput, (result, c) => {
      if (!result.success) return c.json({ error: "Contraseña no válida" }, 400);
    }),
    async (c) => {
      const { password } = c.req.valid("json");
      const db = supabaseAdmin();
      const teacher = await findTeacher(db, c.req.param("id"));

      const { error } = await db.auth.admin.updateUserById(teacher.id, { password });
      if (error) throwSupabase(error);
      // 204: la nueva contraseña no viaja en la respuesta, ni en esta ni en ninguna otra.
      return c.body(null, 204);
    },
  );

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import type { PostgrestError } from "@supabase/supabase-js";
import { createGroupInput, groupListQuery, updateGroupInput } from "@censaguias/shared";
import { supabaseAdmin, GUIDES_BUCKET } from "../lib/supabase.js";
import { generateAccessCode } from "../lib/access-code.js";
import { requireStaff, type AppVars } from "../middleware/auth.js";
import {
  GROUP_COLUMNS,
  findGroup,
  groupSearchExpression,
  mapGroup,
  pdfPathsOfGroup,
  requireGroupId,
  subjectsCountByGroup,
  subjectsOfGroup,
  throwSupabase,
  type GroupRow,
} from "../lib/groups.js";

// El código son 3 caracteres sobre ~30 000 combinaciones con el mismo prefijo: chocar es
// raro, pero la base lo guarda único, así que se inventa otro en lugar de fallar (API-02).
const CODE_ATTEMPTS = 5;

/** 23505 sobre `access_code` = ya hay otro grupo con ese código; el resto de 23505 es otro choque. */
const isCodeConflict = (error: PostgrestError): boolean =>
  error.code === "23505" && (error.details ?? "").includes("access_code");

// Grupos CLEI: lista, detalle, crear, editar, eliminar (con sus PDF) y regenerar el código.
// Son las pantallas admin-02 a admin-05: solo el administrador entra aquí.
export const groupRoutes = new Hono<{ Variables: AppVars }>()
  .use(requireStaff("admin"))
  .get(
    "/",
    zValidator("query", groupListQuery, (result, c) => {
      if (!result.success) return c.json({ error: "Filtros no válidos" }, 400);
    }),
    async (c) => {
      const { q, shift, page, pageSize } = c.req.valid("query");
      const db = supabaseAdmin();

      let query = db.from("groups").select(GROUP_COLUMNS, { count: "exact" });
      if (shift) query = query.eq("shift", shift);
      const search = q ? groupSearchExpression(q) : null;
      if (search) query = query.or(search);

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throwSupabase(error);

      const rows = (data ?? []) as GroupRow[];
      const subjects = await subjectsCountByGroup(db, rows.map((row) => row.id));
      return c.json({
        items: rows.map((row) => mapGroup(row, subjects[row.id] ?? 0)),
        total: count ?? rows.length,
        page,
        pageSize,
      });
    },
  )
  .post(
    "/",
    zValidator("json", createGroupInput, (result, c) => {
      if (!result.success) return c.json({ error: "Datos del grupo no válidos" }, 400);
    }),
    async (c) => {
      const input = c.req.valid("json");
      const { id: createdBy } = c.get("staff");
      const db = supabaseAdmin();
      const group = {
        clei: input.clei,
        identifier: input.identifier,
        shift: input.shift,
        school_year: input.schoolYear,
      };

      let conflict: PostgrestError | null = null;
      for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
        const { data, error } = await db
          .from("groups")
          .insert({ ...group, access_code: generateAccessCode(group), code_version: 1, created_by: createdBy })
          .select(GROUP_COLUMNS)
          .single();
        if (!error) return c.json(mapGroup(data as GroupRow), 201);

        if (!isCodeConflict(error)) {
          // El otro 23505 es el grupo repetido ((clei, identificador, jornada, año)): no hay nada que reintentar.
          if (error.code === "23505") return c.json({ error: "Ya existe un grupo con estos datos" }, 409);
          throwSupabase(error);
        }
        conflict = error;
      }
      // Inverosímil (cinco códigos seguidos ocupados): que se vea el error real en el log.
      throw new Error(`No se pudo asignar un código al grupo: ${conflict?.message ?? ""}`);
    },
  )
  .get("/:id", async (c) => {
    const db = supabaseAdmin();
    const group = await findGroup(db, c.req.param("id"));
    const subjects = await subjectsOfGroup(db, group.id);
    return c.json(mapGroup(group, subjects));
  })
  .patch(
    "/:id",
    zValidator("json", updateGroupInput, (result, c) => {
      if (!result.success) return c.json({ error: "Datos del grupo no válidos" }, 400);
    }),
    async (c) => {
      const input = c.req.valid("json");
      // Cambiar CLEI, identificador o jornada NO regenera el código: el Figma lo dice
      // literalmente en admin-04 («Cambiar el nombre o la jornada no cambia el código»).
      const changes: Record<string, unknown> = {};
      if (input.clei !== undefined) changes.clei = input.clei;
      if (input.identifier !== undefined) changes.identifier = input.identifier;
      if (input.shift !== undefined) changes.shift = input.shift;
      if (input.schoolYear !== undefined) changes.school_year = input.schoolYear;
      if (Object.keys(changes).length === 0) return c.json({ error: "No se envió ningún cambio" }, 400);

      const db = supabaseAdmin();
      const id = requireGroupId(c.req.param("id"));
      const { data, error } = await db.from("groups").update(changes).eq("id", id).select(GROUP_COLUMNS);
      if (error?.code === "23505") return c.json({ error: "Ya existe un grupo con estos datos" }, 409);
      if (error) throwSupabase(error);

      const row = ((data ?? []) as GroupRow[])[0];
      if (!row) throw new HTTPException(404, { message: "Grupo no encontrado" });
      const subjects = await subjectsCountByGroup(db, [row.id]);
      return c.json(mapGroup(row, subjects[row.id] ?? 0));
    },
  )
  .delete("/:id", async (c) => {
    const db = supabaseAdmin();
    const group = await findGroup(db, c.req.param("id"));

    // Las rutas de los PDF se piden antes de tocar nada: si Storage no contesta, se lanza
    // el error y no se borra nada, que sigue entero.
    const paths = await pdfPathsOfGroup(db, group.id);

    // La fila manda: al borrarla, Postgres cascada a materias y guías. Los PDF se quitan
    // después, y si Storage falla quedan archivos huérfanos invisibles en el bucket (anotados
    // en el log): es mejor eso que un grupo ya borrado con sus archivos a medias.
    const { data, error } = await db.from("groups").delete().eq("id", group.id).select("id");
    if (error) throwSupabase(error);
    if (!data || (data as unknown[]).length === 0) throw new HTTPException(404, { message: "Grupo no encontrado" });

    if (paths.length > 0) {
      const { error: storageError } = await db.storage.from(GUIDES_BUCKET).remove(paths);
      if (storageError) console.error(`No se pudieron borrar los PDF de ${group.id}:`, storageError);
    }
    return c.body(null, 204);
  })
  .post("/:id/code", async (c) => {
    const db = supabaseAdmin();
    const group = await findGroup(db, c.req.param("id"));
    // La versión sube siempre: es lo que invalida las cookies de estudiante anteriores.
    const nextVersion = group.code_version + 1;

    let conflict: PostgrestError | null = null;
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const { data, error } = await db
        .from("groups")
        .update({ access_code: generateAccessCode(group), code_version: nextVersion })
        .eq("id", group.id)
        .select(GROUP_COLUMNS);
      if (error) {
        if (error.code !== "23505") throwSupabase(error);
        conflict = error; // Ese código ya lo tiene otro grupo: se inventa otro y se vuelve a intentar.
        continue;
      }

      const row = ((data ?? []) as GroupRow[])[0];
      if (!row) throw new HTTPException(404, { message: "Grupo no encontrado" });
      return c.json({ accessCode: row.access_code, codeVersion: row.code_version });
    }
    // Mismo caso inverosímil que al crear: cinco códigos seguidos ocupados.
    throw new Error(`No se pudo regenerar el código del grupo: ${conflict?.message ?? ""}`);
  });

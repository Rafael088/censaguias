-- CensaGuias · esquema inicial (v0.1.0)
-- Modelo: grupo → asignaturas → guías (PDF). Profesores asignados a asignaturas.
-- Toda la lectura/escritura pasa por la API (service_role). RLS activo y SIN políticas
-- para anon/authenticated: el navegador no puede tocar tablas ni Storage directamente (ADR 0003).

create extension if not exists pgcrypto;

-- Staff (admin y profesores). Los estudiantes NO tienen cuenta: entran con el código del grupo.
create type public.staff_role as enum ('admin', 'teacher');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  role        public.staff_role not null default 'teacher',
  created_at  timestamptz not null default now()
);

create table public.groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 80),
  description   text,
  access_code   text not null unique check (access_code ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$'),
  -- Sube cada vez que el admin regenera el código: invalida las sesiones de estudiante anteriores.
  code_version  integer not null default 1,
  created_by    uuid not null references public.profiles (id),
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table public.subjects (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  name         text not null check (char_length(name) between 2 and 80),
  description  text,
  created_at   timestamptz not null default now(),
  unique (group_id, name)
);
create index subjects_group_id_idx on public.subjects (group_id);

create table public.subject_teachers (
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (subject_id, teacher_id)
);
create index subject_teachers_teacher_id_idx on public.subject_teachers (teacher_id);

create table public.guides (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references public.subjects (id) on delete cascade,
  title         text not null check (char_length(title) between 2 and 120),
  description   text,
  -- Ruta dentro del bucket "guides": {group_id}/{subject_id}/{guide_id}.pdf
  storage_path  text not null unique,
  size_bytes    integer not null check (size_bytes > 0 and size_bytes <= 20971520),
  uploaded_by   uuid not null references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index guides_subject_id_idx on public.guides (subject_id, created_at desc);

alter table public.profiles         enable row level security;
alter table public.groups           enable row level security;
alter table public.subjects         enable row level security;
alter table public.subject_teachers enable row level security;
alter table public.guides           enable row level security;

-- Crea el perfil cuando el admin invita a alguien desde la API (auth.admin.inviteUserByEmail
-- con user_metadata { full_name }). Siempre nace como profesor: el rol NUNCA se toma de los
-- metadatos (los escribe el usuario). Un admin se promueve a mano por SQL. Registro público desactivado.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'teacher'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bucket privado para los PDF. Solo la API (service_role) sube y firma URLs de descarga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guides', 'guides', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

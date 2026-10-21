-- CensaGuias · esquema inicial (v0.1.0)
-- Modelo (según el Figma): grupo CLEI → materias (un docente cada una) → guías PDF (borrador o publicada).
-- Toda la lectura/escritura pasa por la API (service_role). RLS activo y SIN políticas
-- para anon/authenticated: el navegador no puede tocar tablas ni Storage directamente (ADR 0003).

create extension if not exists pgcrypto;

create type public.staff_role   as enum ('admin', 'teacher');
create type public.shift        as enum ('morning', 'night', 'saturday');   -- Mañana, Noche, Sabatina
create type public.guide_status as enum ('draft', 'published');

-- Staff (admin y profesores). Los estudiantes NO tienen cuenta: entran con el código del grupo.
-- Entran con "usuario institucional"; el correo de auth.users es sintético (ADR 0006).
-- La API crea la fila al registrar al profesor; no hay trigger ni registro público.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9._-]{3,40}$'),
  full_name   text not null check (char_length(full_name) between 3 and 120),
  role        public.staff_role not null default 'teacher',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.groups (
  id            uuid primary key default gen_random_uuid(),
  clei          smallint not null check (clei between 1 and 6),          -- CLEI I…VI
  identifier    text not null check (identifier ~ '^[A-Z]$'),            -- A, B, C…
  shift         public.shift not null,
  school_year   smallint not null check (school_year between 2020 and 2100),
  -- CENSA-4AM-K7Q: grupo legible + 3 caracteres aleatorios (ADR 0004)
  access_code   text not null unique check (access_code ~ '^CENSA-[1-6][A-Z][MNS]-[A-HJKMNP-Z2-9]{3}$'),
  -- Sube cada vez que el admin regenera el código: invalida las sesiones de estudiante anteriores.
  code_version  integer not null default 1,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (clei, identifier, shift, school_year)
);

create table public.subjects (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  name         text not null check (char_length(name) between 2 and 80),
  description  text check (char_length(description) <= 300),
  -- Un docente por materia. Si se elimina el profesor, la materia queda sin docente y sus guías se conservan.
  teacher_id   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (group_id, name)
);
create index subjects_group_id_idx   on public.subjects (group_id);
create index subjects_teacher_id_idx on public.subjects (teacher_id);

create table public.guides (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references public.subjects (id) on delete cascade,
  topic         text not null check (char_length(topic) between 2 and 60),   -- "Álgebra", "Aritmética"…
  title         text not null check (char_length(title) between 2 and 120),
  description   text not null check (char_length(description) between 2 and 600),
  status        public.guide_status not null default 'draft',
  published_at  timestamptz,
  -- Ruta dentro del bucket "guides": {group_id}/{subject_id}/{guide_id}.pdf
  storage_path  text not null unique,
  file_name     text not null,
  size_bytes    integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  page_count    integer check (page_count > 0),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((status = 'published') = (published_at is not null))
);
create index guides_subject_id_idx on public.guides (subject_id, status, created_at desc);

alter table public.profiles enable row level security;
alter table public.groups   enable row level security;
alter table public.subjects enable row level security;
alter table public.guides   enable row level security;

-- Bucket privado para los PDF. Solo la API (service_role) sube y firma URLs de descarga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guides', 'guides', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

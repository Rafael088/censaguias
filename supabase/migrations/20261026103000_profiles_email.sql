-- CensaGuias · profiles.email
-- El staff sigue entrando con usuario institucional (ADR 0006). email es una copia del
-- correo sintético que vive en auth.users, para mostrarlo en la app sin llamar a la API de
-- Auth. Se rellena desde auth.users: esa sigue siendo la única fuente de verdad.
-- Además se elimina un trigger roto que había quedado en la base (insertaba email en
-- profiles y olvidaba username, que es NOT NULL). El repo no usa trigger: la fila en
-- profiles la crea la API al registrar al profesor (ver ARQUITECTURA.md).

alter table public.profiles add column email text;

-- Rellena desde el correo que ya tienen en Auth.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null;

do $$
begin
  if not exists (select 1 from public.profiles where email is null) then
    alter table public.profiles alter column email set not null;
  else
    raise notice 'profiles: quedan filas sin email, no se aplicó NOT NULL';
  end if;

  if not exists (
    select 1 from public.profiles
    where email is not null
    group by email
    having count(*) > 1
  ) then
    alter table public.profiles add constraint profiles_email_key unique (email);
  else
    raise notice 'profiles: hay emails repetidos, no se aplicó UNIQUE';
  end if;
end $$;

-- Trigger y función que quedaron de una prueba manual: no están en las migraciones del
-- repo y su insert falla porque profiles exige username.
do $$
declare r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and p.proname = 'handle_new_user'
  loop
    execute format('drop trigger %I on auth.users', r.tgname);
    raise notice 'trigger % eliminado', r.tgname;
  end loop;
end $$;

drop function if exists public.handle_new_user();

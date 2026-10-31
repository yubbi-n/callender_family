-- 가족 근무 캘린더 · Supabase 스키마
-- Supabase 대시보드 → SQL Editor → New query 에 이 파일 전체를 붙여넣고 Run 하세요.
-- (한 번만 실행하면 됩니다. 다시 실행하면 "already exists" 오류가 나요.)
--
-- 구조
--   기기마다 익명 로그인(auth.users) → devices 로 프로필(members)에 연결
--   가족 데이터는 RLS 로 "내 기기가 연결된 가족"만 읽고 쓸 수 있어요.
--   초대 코드 조회 / 가족 합류 / PIN 확인은 security definer 함수로만 가능해요.

create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────── 테이블 ─────────────────────────

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '우리 가족',
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

create table public.members (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families on delete cascade,
  name             text not null check (char_length(name) between 1 and 8),
  color            text not null,
  pin_hash         text not null,
  is_admin         boolean not null default false,
  pin_fails        int not null default 0,
  pin_locked_until timestamptz,
  created_at       timestamptz not null default now(),
  unique (family_id, color)
);
create index on public.members (family_id);

create table public.devices (
  user_id    uuid primary key references auth.users on delete cascade,
  member_id  uuid not null references public.members on delete cascade,
  created_at timestamptz not null default now()
);

create table public.shift_codes (
  member_id  uuid not null references public.members on delete cascade,
  code       text not null check (char_length(code) between 1 and 4),
  name       text not null default '',
  start_time text,
  end_time   text,
  is_off     boolean not null default false,
  sort       int not null default 0,
  primary key (member_id, code)
);

create table public.shifts (
  member_id uuid not null references public.members on delete cascade,
  day       date not null,
  code      text not null,
  primary key (member_id, day)
);

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families on delete cascade,
  created_by uuid references public.members on delete set null,
  title      text not null check (char_length(title) between 1 and 40),
  day        date not null,
  time       text not null default '종일',
  who        text[] not null default '{}',
  repeat     text not null default 'none' check (repeat in ('none', 'weekly', 'yearly')),
  memo       text not null default '',
  private    boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.events (family_id);

-- ───────────────────────── 도우미 함수 ─────────────────────────

create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select member_id from devices where user_id = auth.uid()
$$;

create or replace function public.my_family_id() returns uuid
language sql stable security definer set search_path = public as $$
  select m.family_id from devices d join members m on m.id = d.member_id
  where d.user_id = auth.uid()
$$;

-- ───────────────────────── 접근 권한 (RLS) ─────────────────────────

alter table public.families    enable row level security;
alter table public.members     enable row level security;
alter table public.devices     enable row level security;
alter table public.shift_codes enable row level security;
alter table public.shifts      enable row level security;
alter table public.events      enable row level security;

revoke all on public.families, public.members, public.devices,
              public.shift_codes, public.shifts, public.events from anon;

create policy fam_read on public.families for select to authenticated
  using (id = my_family_id());

-- PIN 해시는 가족에게도 보이지 않도록 열 단위로 막아요.
create policy mem_read on public.members for select to authenticated
  using (family_id = my_family_id());
create policy mem_update on public.members for update to authenticated
  using (id = my_member_id()) with check (id = my_member_id());
revoke select, insert, update, delete on public.members from authenticated;
grant select (id, family_id, name, color, is_admin, created_at) on public.members to authenticated;
grant update (name, color) on public.members to authenticated;

-- devices 는 정책이 없으므로 앱에서 직접 읽거나 쓸 수 없어요 (함수로만).
revoke all on public.devices from authenticated;

create policy sc_read on public.shift_codes for select to authenticated
  using (member_id in (select id from members where family_id = my_family_id()));
create policy sc_write on public.shift_codes for all to authenticated
  using (member_id = my_member_id()) with check (member_id = my_member_id());

create policy sh_read on public.shifts for select to authenticated
  using (member_id in (select id from members where family_id = my_family_id()));
create policy sh_write on public.shifts for all to authenticated
  using (member_id = my_member_id()) with check (member_id = my_member_id());

-- 비공개 일정은 만든 사람만 봐요. 수정은 만든 사람, 참여자, '가족' 일정이면 누구나.
create policy ev_read on public.events for select to authenticated
  using (family_id = my_family_id() and (not private or created_by = my_member_id()));
create policy ev_insert on public.events for insert to authenticated
  with check (family_id = my_family_id() and created_by = my_member_id());
create policy ev_update on public.events for update to authenticated
  using (family_id = my_family_id() and (created_by = my_member_id()
         or (not private and (my_member_id()::text = any (who) or 'fam' = any (who)))))
  with check (family_id = my_family_id());
create policy ev_delete on public.events for delete to authenticated
  using (family_id = my_family_id() and (created_by = my_member_id()
         or (not private and (my_member_id()::text = any (who) or 'fam' = any (who)))));

-- ───────────────────────── 가족 합류 함수 ─────────────────────────

create or replace function public.new_invite_code() returns text
language plpgsql set search_path = public, extensions as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
begin
  loop
    b := gen_random_bytes(6);
    c := '';
    for i in 0..5 loop
      c := c || substr(chars, 1 + get_byte(b, i) % 32, 1);
    end loop;
    exit when not exists (select 1 from families where invite_code = c);
  end loop;
  return c;
end $$;

create or replace function public.check_profile_input(p_name text, p_color text, p_pin text) returns void
language plpgsql as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if coalesce(trim(p_name), '') = '' or char_length(trim(p_name)) > 8 then
    raise exception '이름은 1~8자로 입력해주세요';
  end if;
  if p_color not in ('파랑','라벤더','핑크','코랄','피치','레몬','연두','민트','하늘','라일락','베이지') then
    raise exception '색상을 골라주세요';
  end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN은 숫자 4자리예요'; end if;
end $$;

create or replace function public.link_device(p_member uuid) returns void
language sql security definer set search_path = public as $$
  insert into devices (user_id, member_id) values (auth.uid(), p_member)
  on conflict (user_id) do update set member_id = excluded.member_id, created_at = now();
$$;

create or replace function public.my_session() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('member_id', d.member_id, 'family_id', m.family_id)
  from devices d join members m on m.id = d.member_id
  where d.user_id = auth.uid()
$$;

create or replace function public.create_family(p_name text, p_color text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  f uuid;
  m uuid;
begin
  perform check_profile_input(p_name, p_color, p_pin);
  insert into families (invite_code) values (new_invite_code()) returning id into f;
  insert into members (family_id, name, color, pin_hash, is_admin)
    values (f, trim(p_name), p_color, crypt(p_pin, gen_salt('bf')), true)
    returning id into m;
  perform link_device(m);
  return json_build_object('family_id', f, 'member_id', m);
end $$;

create or replace function public.family_profiles(p_code text)
returns table (id uuid, name text, color text)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.color
  from members m join families f on f.id = m.family_id
  where f.invite_code = upper(trim(p_code))
  order by m.created_at
$$;

-- 틀린 PIN 횟수를 기록해야 하므로 예외 대신 {ok:false} 를 돌려줘요.
create or replace function public.join_member(p_code text, p_member uuid, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  r members%rowtype;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'error', '로그인이 필요해요'); end if;
  select m.* into r from members m join families f on f.id = m.family_id
  where f.invite_code = upper(trim(p_code)) and m.id = p_member;
  if not found then return json_build_object('ok', false, 'error', '프로필을 찾을 수 없어요'); end if;
  if r.pin_locked_until > now() then
    return json_build_object('ok', false, 'error', 'PIN을 5번 틀렸어요. 10분 뒤에 다시 해주세요');
  end if;
  if r.pin_hash <> crypt(coalesce(p_pin, ''), r.pin_hash) then
    update members set
      pin_fails = case when pin_fails + 1 >= 5 then 0 else pin_fails + 1 end,
      pin_locked_until = case when pin_fails + 1 >= 5 then now() + interval '10 minutes' else pin_locked_until end
    where id = r.id;
    return json_build_object('ok', false, 'error', 'PIN이 맞지 않아요');
  end if;
  update members set pin_fails = 0, pin_locked_until = null where id = r.id;
  perform link_device(r.id);
  return json_build_object('ok', true, 'family_id', r.family_id, 'member_id', r.id);
end $$;

create or replace function public.create_member(p_code text, p_name text, p_color text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  f uuid;
  m uuid;
begin
  perform check_profile_input(p_name, p_color, p_pin);
  select id into f from families where invite_code = upper(trim(p_code));
  if f is null then raise exception '초대 코드를 찾을 수 없어요'; end if;
  if (select count(*) from members where family_id = f) >= 11 then
    raise exception '가족은 11명까지 만들 수 있어요';
  end if;
  begin
    insert into members (family_id, name, color, pin_hash)
      values (f, trim(p_name), p_color, crypt(p_pin, gen_salt('bf')))
      returning id into m;
  exception when unique_violation then
    raise exception '이미 다른 가족이 쓰는 색이에요';
  end;
  perform link_device(m);
  return json_build_object('family_id', f, 'member_id', m);
end $$;

create or replace function public.reset_pin(p_member uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from members where id = my_member_id() and is_admin) then
    raise exception '가족을 만든 사람만 PIN을 초기화할 수 있어요';
  end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN은 숫자 4자리예요'; end if;
  update members set pin_hash = crypt(p_pin, gen_salt('bf')), pin_fails = 0, pin_locked_until = null
  where id = p_member and family_id = my_family_id();
end $$;

create or replace function public.leave_device() returns void
language sql security definer set search_path = public as $$
  delete from devices where user_id = auth.uid();
$$;

-- 함수 실행 권한: 앱(로그인한 기기)에서 부를 함수만 열어요.
revoke execute on function public.new_invite_code(), public.check_profile_input(text, text, text),
  public.link_device(uuid), public.my_session(), public.create_family(text, text, text),
  public.family_profiles(text), public.join_member(text, uuid, text),
  public.create_member(text, text, text, text), public.reset_pin(uuid, text),
  public.leave_device() from public, anon;
grant execute on function public.my_session(), public.create_family(text, text, text),
  public.family_profiles(text), public.join_member(text, uuid, text),
  public.create_member(text, text, text, text), public.reset_pin(uuid, text),
  public.leave_device() to authenticated;

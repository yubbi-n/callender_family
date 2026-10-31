// 데이터 저장소. config.js 에 Supabase 정보가 있으면 Supabase, 없으면 이 기기의 localStorage(체험 모드).
// 두 구현은 같은 함수 목록을 가져요. 화면 코드는 어느 쪽인지 몰라도 돼요.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// ───────────────────────── Supabase ─────────────────────────

let sb;
async function client() {
  if (!sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return sb;
}

async function signedIn() {
  const c = await client();
  const { data } = await c.auth.getSession();
  if (!data.session) {
    const { error } = await c.auth.signInAnonymously();
    if (error) throw new Error(error.message.includes('Anonymous') ? 'Supabase에서 익명 로그인(Anonymous sign-ins)을 켜주세요' : error.message);
  }
  return c;
}

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

const remote = {
  async session() {
    const c = await client();
    const { data } = await c.auth.getSession();
    if (!data.session) return null;
    const s = check(await c.rpc('my_session'));
    return s && s.member_id ? s : null;
  },
  async createFamily({ name, color, pin }) {
    const c = await signedIn();
    return check(await c.rpc('create_family', { p_name: name, p_color: color, p_pin: pin }));
  },
  async lookupFamily(code) {
    const c = await signedIn();
    const rows = check(await c.rpc('family_profiles', { p_code: code }));
    if (!rows || !rows.length) throw new Error('초대 코드를 찾을 수 없어요');
    return rows;
  },
  async joinMember(code, memberId, pin) {
    const c = await signedIn();
    const r = check(await c.rpc('join_member', { p_code: code, p_member: memberId, p_pin: pin }));
    if (!r.ok) throw new Error(r.error);
    return r;
  },
  async createMember(code, { name, color, pin }) {
    const c = await signedIn();
    return check(await c.rpc('create_member', { p_code: code, p_name: name, p_color: color, p_pin: pin }));
  },
  async loadFamily() {
    const c = await client();
    const [family, members, codes] = await Promise.all([
      c.from('families').select('id,name,invite_code').single().then(check),
      c.from('members').select('id,name,color,is_admin,created_at').order('created_at').then(check),
      c.from('shift_codes').select('member_id,code,name,start_time,end_time,is_off,sort').order('sort').then(check)
    ]);
    return { family, members, codes };
  },
  async loadShifts(from, to) {
    const c = await client();
    return check(await c.from('shifts').select('member_id,day,code').gte('day', from).lte('day', to));
  },
  async loadEvents() {
    const c = await client();
    return check(await c.from('events').select('id,created_by,title,day,time,who,repeat,memo,private').order('day'));
  },
  async saveShifts(memberId, changes) {
    const c = await client();
    const put = changes.filter((x) => x.code).map((x) => ({ member_id: memberId, day: x.day, code: x.code }));
    const del = changes.filter((x) => !x.code).map((x) => x.day);
    if (put.length) check(await c.from('shifts').upsert(put, { onConflict: 'member_id,day' }));
    if (del.length) check(await c.from('shifts').delete().eq('member_id', memberId).in('day', del));
  },
  async saveCodes(memberId, list) {
    const c = await client();
    check(await c.from('shift_codes').delete().eq('member_id', memberId));
    if (list.length) check(await c.from('shift_codes').insert(list.map((x, i) => ({ ...x, member_id: memberId, sort: i }))));
  },
  async saveEvent(ev, sess) {
    const c = await client();
    const row = { title: ev.title, day: ev.day, time: ev.time, who: ev.who, repeat: ev.repeat, memo: ev.memo, private: ev.private };
    if (ev.id) check(await c.from('events').update(row).eq('id', ev.id));
    else check(await c.from('events').insert({ ...row, family_id: sess.family_id, created_by: sess.member_id }));
  },
  async deleteEvent(id) {
    const c = await client();
    check(await c.from('events').delete().eq('id', id));
  },
  async updateMe(memberId, patch) {
    const c = await client();
    const { error } = await c.from('members').update(patch).eq('id', memberId);
    if (error) throw new Error(error.code === '23505' ? '이미 다른 가족이 쓰는 색이에요' : error.message);
  },
  async resetPin(memberId, pin) {
    const c = await client();
    check(await c.rpc('reset_pin', { p_member: memberId, p_pin: pin }));
  },
  async parseSchedule(req) {
    const c = await client();
    // Supabase에 배포된 함수 이름 (코드: supabase/functions/parse-schedule/index.ts)
    const { data, error } = await c.functions.invoke('dynamic-api', { body: req });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) { /* 함수가 아직 배포 전이면 본문이 없어요 */ }
      if (/Failed to send|not found|404/i.test(msg)) msg = '사진 인식 서버(dynamic-api)가 아직 준비되지 않았어요';
      throw new Error(msg);
    }
    return data;
  },
  async signOut() {
    const c = await client();
    await c.rpc('leave_device');
    await c.auth.signOut();
  }
};

// ───────────────────────── 체험 모드 (localStorage) ─────────────────────────

const KEY = 'fwc-demo-v1';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
const pad = (n) => (n < 10 ? '0' : '') + n;

function seed() {
  const fam = { id: uid(), name: '우리 가족', invite_code: 'DEMO26' };
  const mom = { id: uid(), family_id: fam.id, name: '엄마', color: '피치', pin: '1234', is_admin: true, created_at: '2026-01-01T00:00:00Z' };
  const dad = { id: uid(), family_id: fam.id, name: '아빠', color: '민트', pin: '1234', is_admin: false, created_at: '2026-01-02T00:00:00Z' };
  const codes = [
    { member_id: mom.id, code: '주', name: '주간', start_time: '08:00', end_time: '20:00', is_off: false, sort: 0 },
    { member_id: mom.id, code: '야', name: '야간', start_time: '20:00', end_time: '08:00', is_off: false, sort: 1 },
    { member_id: mom.id, code: '휴', name: '휴무', start_time: null, end_time: null, is_off: true, sort: 2 }
  ];
  const shifts = [];
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  for (let i = 0; i < 120; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    shifts.push({ member_id: mom.id, day: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), code: ['주', '주', '야', '야', '휴', '휴'][i % 6] });
  }
  const ym = now.getFullYear() + '-' + pad(now.getMonth() + 1);
  const events = [
    { id: uid(), created_by: mom.id, title: '가족 외식', day: ym + '-05', time: '18:30', who: ['fam'], repeat: 'none', memo: '한우집 6시 반 예약 완료', private: false },
    { id: uid(), created_by: dad.id, title: '수영', day: ym + '-02', time: '07:00', who: [dad.id], repeat: 'weekly', memo: '', private: false },
    { id: uid(), created_by: mom.id, title: '할머니 생신', day: ym + '-18', time: '12:00', who: ['fam'], repeat: 'yearly', memo: '케이크는 엄마가 준비', private: false }
  ];
  return { families: [fam], members: [mom, dad], codes, shifts, events, session: null };
}

function db() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* 손상된 데이터는 새로 만들어요 */ }
  const d = seed();
  save(d);
  return d;
}
function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
const later = (v) => new Promise((r) => setTimeout(() => r(v), 120));

function checkInput({ name, color, pin }) {
  if (!name || !name.trim() || name.trim().length > 8) throw new Error('이름은 1~8자로 입력해주세요');
  if (!color || color === '회색') throw new Error('색상을 골라주세요');
  if (!/^\d{4}$/.test(pin || '')) throw new Error('PIN은 숫자 4자리예요');
}
const publicMember = (m) => ({ id: m.id, name: m.name, color: m.color, is_admin: m.is_admin, created_at: m.created_at });

const local = {
  async session() { return later(db().session); },
  async createFamily(p) {
    checkInput(p);
    const d = db();
    const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const fam = { id: uid(), name: '우리 가족', invite_code: code };
    const m = { id: uid(), family_id: fam.id, name: p.name.trim(), color: p.color, pin: p.pin, is_admin: true, created_at: new Date().toISOString() };
    d.families.push(fam);
    d.members.push(m);
    d.session = { family_id: fam.id, member_id: m.id };
    save(d);
    return later(d.session);
  },
  async lookupFamily(code) {
    const d = db();
    const fam = d.families.find((f) => f.invite_code === String(code).trim().toUpperCase());
    if (!fam) throw new Error('초대 코드를 찾을 수 없어요');
    return later(d.members.filter((m) => m.family_id === fam.id).map((m) => ({ id: m.id, name: m.name, color: m.color })));
  },
  async joinMember(code, memberId, pin) {
    const d = db();
    const fam = d.families.find((f) => f.invite_code === String(code).trim().toUpperCase());
    const m = fam && d.members.find((x) => x.id === memberId && x.family_id === fam.id);
    if (!m) throw new Error('프로필을 찾을 수 없어요');
    if (m.pin !== pin) { await later(); throw new Error('PIN이 맞지 않아요'); }
    d.session = { family_id: fam.id, member_id: m.id };
    save(d);
    return later(d.session);
  },
  async createMember(code, p) {
    checkInput(p);
    const d = db();
    const fam = d.families.find((f) => f.invite_code === String(code).trim().toUpperCase());
    if (!fam) throw new Error('초대 코드를 찾을 수 없어요');
    if (d.members.some((m) => m.family_id === fam.id && m.color === p.color)) throw new Error('이미 다른 가족이 쓰는 색이에요');
    const m = { id: uid(), family_id: fam.id, name: p.name.trim(), color: p.color, pin: p.pin, is_admin: false, created_at: new Date().toISOString() };
    d.members.push(m);
    d.session = { family_id: fam.id, member_id: m.id };
    save(d);
    return later(d.session);
  },
  async loadFamily() {
    const d = db();
    const fid = d.session.family_id;
    const members = d.members.filter((m) => m.family_id === fid);
    const ids = members.map((m) => m.id);
    return later({
      family: d.families.find((f) => f.id === fid),
      members: members.map(publicMember),
      codes: d.codes.filter((c) => ids.includes(c.member_id)).sort((a, b) => a.sort - b.sort)
    });
  },
  async loadShifts(from, to) {
    const d = db();
    const ids = d.members.filter((m) => m.family_id === d.session.family_id).map((m) => m.id);
    return later(d.shifts.filter((s) => ids.includes(s.member_id) && s.day >= from && s.day <= to));
  },
  async loadEvents() {
    const d = db();
    const ids = d.members.filter((m) => m.family_id === d.session.family_id).map((m) => m.id);
    return later(d.events.filter((e) => ids.includes(e.created_by) && (!e.private || e.created_by === d.session.member_id)));
  },
  async saveShifts(memberId, changes) {
    const d = db();
    for (const ch of changes) {
      d.shifts = d.shifts.filter((s) => !(s.member_id === memberId && s.day === ch.day));
      if (ch.code) d.shifts.push({ member_id: memberId, day: ch.day, code: ch.code });
    }
    save(d);
    return later();
  },
  async saveCodes(memberId, list) {
    const d = db();
    d.codes = d.codes.filter((c) => c.member_id !== memberId).concat(list.map((x, i) => ({ ...x, member_id: memberId, sort: i })));
    save(d);
    return later();
  },
  async saveEvent(ev, sess) {
    const d = db();
    if (ev.id) d.events = d.events.map((e) => (e.id === ev.id ? { ...e, ...ev } : e));
    else d.events.push({ ...ev, id: uid(), created_by: sess.member_id });
    save(d);
    return later();
  },
  async deleteEvent(id) {
    const d = db();
    d.events = d.events.filter((e) => e.id !== id);
    save(d);
    return later();
  },
  async updateMe(memberId, patch) {
    const d = db();
    const me = d.members.find((m) => m.id === memberId);
    if (patch.color && d.members.some((m) => m.family_id === me.family_id && m.id !== memberId && m.color === patch.color)) {
      throw new Error('이미 다른 가족이 쓰는 색이에요');
    }
    Object.assign(me, patch);
    save(d);
    return later();
  },
  async parseSchedule({ year, month, codes }) {
    // 체험 모드는 실제로 인식하지 않고, 화면 흐름만 볼 수 있게 그럴듯한 결과를 만들어요.
    await new Promise((r) => setTimeout(r, 1600));
    const list = codes.length ? codes.map((c) => c.code) : ['D', 'E', 'N', 'OFF'];
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days = Array.from({ length: last }, (_, i) => ({ day: i + 1, code: list[Math.floor(i / 2) % list.length] }));
    const legend = list.map((code) => ({ code, count: days.filter((d) => d.code === code).length }));
    legend[0].count += 1;
    return { year, month, days, legend, note: '체험 모드라 실제 사진은 읽지 않았어요.' };
  },
  async resetPin(memberId, pin) {
    if (!/^\d{4}$/.test(pin || '')) throw new Error('PIN은 숫자 4자리예요');
    const d = db();
    d.members.find((m) => m.id === memberId).pin = pin;
    save(d);
    return later();
  },
  async signOut() {
    const d = db();
    d.session = null;
    save(d);
    return later();
  }
};

export const api = DEMO ? local : remote;

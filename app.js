import { html, render, useState, useEffect, useRef } from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';
import { api, DEMO } from './data.js';

// ───────────────────────── 상수 ─────────────────────────

const PALETTE = [
  { n: '파랑', c: '#C7D0FF', d: '#2542FE', i: '#1B33D6' }, { n: '라벤더', c: '#DCCBFA', d: '#6A3FC8', i: '#5A32B0' },
  { n: '핑크', c: '#FAC6DA', d: '#B52D66', i: '#922251' }, { n: '코랄', c: '#FFC4BD', d: '#B83A2E', i: '#932C22' },
  { n: '피치', c: '#FFD3B5', d: '#B4510F', i: '#8F3F08' }, { n: '레몬', c: '#F7E9A6', d: '#7A6200', i: '#665200' },
  { n: '연두', c: '#D6EDB5', d: '#4E7A12', i: '#3D600D' }, { n: '민트', c: '#BDEBDD', d: '#0E7A5C', i: '#0B5E47' },
  { n: '하늘', c: '#BFE6F7', d: '#0B6E8F', i: '#08566F' }, { n: '라일락', c: '#EEC9F0', d: '#8E3A93', i: '#742F78' },
  { n: '베이지', c: '#EBD9C6', d: '#7D5636', i: '#65452A' }, { n: '회색', c: '#DDDDDD', d: '#555555', i: '#3F3F3F' }
];
const pal = (n) => PALETTE.find((p) => p.n === n) || PALETTE[11];
const BRAND = '#2542FE';
const FAM = 'fam'; // '가족' 전체를 뜻하는 가상 구성원. 회색을 씀.

const HOLIDAYS = {
  '2026-01-01': '신정', '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절', '2026-03-02': '대체공휴일', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일', '2026-06-03': '지방선거', '2026-06-06': '현충일', '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일', '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절', '2026-10-05': '대체공휴일', '2026-10-09': '한글날', '2026-12-25': '성탄절',
  '2027-01-01': '신정', '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴',
  '2027-02-09': '대체공휴일', '2027-03-01': '삼일절', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일', '2027-08-15': '광복절', '2027-08-16': '대체공휴일', '2027-09-14': '추석 연휴',
  '2027-09-15': '추석', '2027-09-16': '추석 연휴', '2027-10-03': '개천절', '2027-10-04': '대체공휴일',
  '2027-10-09': '한글날', '2027-10-11': '대체공휴일', '2027-12-25': '성탄절', '2027-12-27': '대체공휴일'
};

const PRESETS = {
  '3교대': [
    { code: 'D', name: '데이', start_time: '07:00', end_time: '15:00', is_off: false },
    { code: 'E', name: '이브닝', start_time: '15:00', end_time: '23:00', is_off: false },
    { code: 'N', name: '나이트', start_time: '23:00', end_time: '07:00', is_off: false },
    { code: 'OFF', name: '휴무', start_time: null, end_time: null, is_off: true }
  ],
  '2교대': [
    { code: '주', name: '주간', start_time: '08:00', end_time: '20:00', is_off: false },
    { code: '야', name: '야간', start_time: '20:00', end_time: '08:00', is_off: false },
    { code: '휴', name: '휴무', start_time: null, end_time: null, is_off: true }
  ],
  '평일 근무': [
    { code: '출', name: '출근', start_time: '09:00', end_time: '18:00', is_off: false },
    { code: '휴', name: '휴무', start_time: null, end_time: null, is_off: true }
  ]
};

// ───────────────────────── 날짜 도우미 ─────────────────────────

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => (n < 10 ? '0' : '') + n;
const iso = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
const parse = (s) => ({ y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) });
const dn = (y, m, d) => Date.UTC(y, m - 1, d) / 864e5;
const dowOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const today = () => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }; };
const shiftMonth = (y, m, k) => { const t = (y * 12 + (m - 1)) + k; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; };

function monthGrid(y, m) {
  const first = dowOf(y, m, 1);
  const total = daysIn(y, m);
  const pm = shiftMonth(y, m, -1);
  const nm = shiftMonth(y, m, 1);
  const prevTotal = daysIn(pm.y, pm.m);
  const rows = Math.ceil((first + total) / 7);
  const cells = [];
  for (let i = 0; i < rows * 7; i++) {
    const off = i - first + 1;
    let c = { y, m, d: off, faded: false };
    if (off < 1) c = { y: pm.y, m: pm.m, d: prevTotal + off, faded: true };
    else if (off > total) c = { y: nm.y, m: nm.m, d: off - total, faded: true };
    c.iso = iso(c.y, c.m, c.d);
    c.dow = i % 7;
    cells.push(c);
  }
  return { rows, cells, from: cells[0].iso, to: cells[cells.length - 1].iso };
}

function occurs(e, y, m, d) {
  const p = parse(e.day);
  const t = dn(y, m, d);
  const t0 = dn(p.y, p.m, p.d);
  if (e.repeat === 'weekly') return t >= t0 && (t - t0) % 7 === 0;
  if (e.repeat === 'yearly') return p.m === m && p.d === d && y >= p.y;
  return t === t0;
}

const dateTxt = (y, m, d) => (y !== today().y ? y + '년 ' : '') + m + '월 ' + d + '일 (' + WD[dowOf(y, m, d)] + ')';
const codeTime = (c) => {
  if (!c) return '시간 미등록';
  if (c.is_off) return '쉬는 날';
  if (!c.start_time || !c.end_time) return '시간 미등록';
  return c.start_time + ' – ' + (c.end_time <= c.start_time ? '다음 날 ' : '') + c.end_time;
};

// ───────────────────────── 스타일 도우미 ─────────────────────────

const chip = (p, off, big) =>
  'display:inline-flex;align-items:center;justify-content:center;min-width:' + (big ? 24 : 22) + 'px;height:' + (big ? 20 : 18) +
  'px;padding:0 3px;box-sizing:border-box;border-radius:5px;font-size:11px;font-weight:700;line-height:1;flex:none;white-space:nowrap;border:1.5px solid ' +
  (off ? p.i : p.c) + ';background:' + (off ? '#FFFFFF' : p.c) + ';color:' + p.i;
const dot = (c, size = 7) => 'width:' + size + 'px;height:' + size + 'px;border-radius:' + size / 2 + 'px;flex:none;background:' + c;
const avatar = (p, size) =>
  'width:' + size + 'px;height:' + size + 'px;border-radius:' + size / 2 + 'px;flex:none;background:' + p.c + ';color:' + p.i +
  ';display:flex;align-items:center;justify-content:center;font-size:' + Math.round(size * 0.4) + 'px;font-weight:700';
const S = {
  navBtn: 'width:44px;height:44px;border:none;background:transparent;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#1F1F1F;flex:none',
  input: 'height:44px;width:100%;min-width:0;box-sizing:border-box;border:1px solid #D6D6D6;border-radius:10px;padding:0 10px;font-size:16px;font-weight:400;color:#1F1F1F;background:#FFFFFF',
  label: 'display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:600;color:#3D3D3D;min-width:0',
  btnSecondary: 'flex:1;height:46px;border:1px solid #D6D6D6;border-radius:12px;background:#FFFFFF;color:#1F1F1F;font-size:15px;font-weight:600',
  bottomBar: 'display:flex;gap:8px;padding:12px 16px calc(16px + env(safe-area-inset-bottom));border-top:1px solid #EBEBEB;background:#FAFAFA;flex:none'
};
const btnPrimary = (p) => 'flex:1;height:46px;border:none;border-radius:12px;background:' + p.c + ';color:' + p.i + ';font-size:15px;font-weight:600';

// ───────────────────────── 아이콘 ─────────────────────────

const Svg = ({ size = 20, sw = 2, stroke = 'currentColor', children }) =>
  html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke=${stroke} stroke-width=${sw} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">${children}</svg>`;
const IconBack = () => html`<${Svg}><path d="M15 5l-7 7 7 7" /><//>`;
const IconFwd = () => html`<${Svg}><path d="M9 5l7 7-7 7" /><//>`;
const IconPlus = ({ size }) => html`<${Svg} size=${size}><path d="M12 5v14M5 12h14" /><//>`;
const IconCheck = ({ size = 16 }) => html`<${Svg} size=${size} sw="2.5"><path d="M5 12l5 5 9-10" /><//>`;
const IconLock = ({ size = 12 }) => html`<${Svg} size=${size}><path d="M7 11V8a5 5 0 0 1 10 0v3" /><rect x="5" y="11" width="14" height="10" rx="2" /><//>`;
const IconRepeat = () => html`<${Svg} size="16"><path d="M4 9a6 6 0 0 1 10-4l2 2M20 15a6 6 0 0 1-10 4l-2-2" /><path d="M16 3v4h-4M8 21v-4h4" /><//>`;
const IconEdit = () => html`<${Svg}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /><//>`;
const IconCal = ({ size = 28 }) => html`<${Svg} size=${size}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><//>`;
const IconPhoto = ({ size = 20 }) => html`<${Svg} size=${size}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /><//>`;
const IconWarn = () => html`<${Svg}><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /><//>`;
const IconGear = () => html`<${Svg} size="22" sw="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /><//>`;

// 한글 입력용. value 를 매번 다시 넣으면 조합 중인 글자가 두 번 들어가서, 입력 중에는 DOM 값을 그대로 둬요.
function TextInput({ value, onValue, ...rest }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (el && el !== document.activeElement && el.value !== (value || '')) el.value = value || '';
  }, [value]);
  return html`<input ref=${ref} defaultValue=${value || ''} onInput=${(e) => onValue(e.target.value)} ...${rest} />`;
}

// ───────────────────────── 토스트 ─────────────────────────

let toast = () => {};
function Toast({ p }) {
  const [msg, setMsg] = useState(null);
  const t = useRef();
  useEffect(() => {
    toast = (text, bad) => {
      setMsg({ text, bad });
      clearTimeout(t.current);
      t.current = setTimeout(() => setMsg(null), 2600);
    };
  }, []);
  if (!msg) return null;
  const bg = msg.bad ? '#FFF0F0' : p.c;
  const fg = msg.bad ? '#D00000' : p.i;
  return html`<div role="status" style=${'position:fixed;left:50%;bottom:calc(104px + env(safe-area-inset-bottom));transform:translateX(-50%);background:' + bg + ';color:' + fg + ';font-size:13px;padding:10px 16px;border-radius:20px;max-width:calc(100% - 32px);display:flex;gap:6px;align-items:center;z-index:50;box-shadow:0 2px 8px rgba(0,0,0,0.08)'}>${!msg.bad && html`<${IconCheck} />`}${msg.text}</div>`;
}

// ───────────────────────── 시작 / 가족 합류 ─────────────────────────

function Onboarding({ onDone }) {
  const [screen, setScreen] = useState('invite');
  const [prev, setPrev] = useState([]);
  const [code, setCode] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [who, setWho] = useState(null);
  const [pin, setPin] = useState('');
  const [forgot, setForgot] = useState(false);
  const [mode, setMode] = useState('new');
  const [form, setForm] = useState({ name: '', color: '', pin: '', pin2: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  const go = (next) => { setPrev(prev.concat([screen])); setScreen(next); setPin(''); setForgot(false); setErr(''); };
  const back = () => {
    const p = prev.slice();
    setScreen(p.pop() || 'invite');
    setPrev(p);
    setPin('');
    setErr('');
  };
  const run = async (fn) => {
    setBusy(true);
    setErr('');
    try { await fn(); } catch (e) { setErr(e.message || String(e)); } finally { setBusy(false); }
  };

  const enterCode = () => run(async () => {
    if (code.length !== 6) throw new Error('초대 코드 6자리를 입력해주세요');
    setProfiles(await api.lookupFamily(code));
    go('who');
  });
  const startCreate = (m) => {
    const taken = m === 'join' ? profiles.map((p) => p.color) : [];
    const free = PALETTE.find((p) => p.n !== '회색' && !taken.includes(p.n));
    setMode(m);
    setForm({ name: '', color: free ? free.n : '', pin: '', pin2: '' });
    go('create');
  };
  const pressDigit = (k) => {
    if (busy) return;
    if (k === 'del') { setPin(pin.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    setErr('');
    if (next.length === 4) {
      run(async () => {
        try {
          const s = await api.joinMember(code, who.id, next);
          setDone({ s, name: who.name, color: who.color });
          setPrev([]);
          setScreen('done');
        } finally {
          setPin('');
        }
      });
    }
  };
  const finishCreate = () => run(async () => {
    if (!form.name.trim()) throw new Error('이름을 입력해주세요');
    if (!/^\d{4}$/.test(form.pin)) throw new Error('PIN은 숫자 4자리로 정해주세요');
    if (form.pin !== form.pin2) throw new Error('PIN 확인이 일치하지 않아요');
    const p = { name: form.name.trim(), color: form.color, pin: form.pin };
    const s = mode === 'new' ? await api.createFamily(p) : await api.createMember(code, p);
    setDone({ s, name: p.name, color: p.color });
    setPrev([]);
    setScreen('done');
  });

  const errLine = err && html`<p role="alert" style="margin:10px 0 0;font-size:13px;color:#D00000;font-weight:600">${err}</p>`;
  const hasBack = screen === 'who' || screen === 'pin' || screen === 'create';
  const whoP = who ? pal(who.color) : PALETTE[0];
  const sel = pal(form.color);

  let body;
  if (screen === 'invite') {
    body = html`
      <div style="flex:1;display:flex;flex-direction:column;padding:72px 24px calc(28px + env(safe-area-inset-bottom))">
        <div style=${'width:56px;height:56px;border-radius:16px;background:' + BRAND + ';color:#FFFFFF;display:flex;align-items:center;justify-content:center'}><${IconCal} /></div>
        <h1 style="margin:24px 0 0;font-size:24px;font-weight:700;letter-spacing:-0.4px">가족 캘린더에 들어가기</h1>
        <p style="margin:8px 0 0;font-size:14px;color:#5E5E5E;line-height:1.6">가족에게 받은 초대 코드 6자리를 입력해주세요.</p>
        <label for="invite-code" style="margin-top:32px;font-size:13px;font-weight:600;color:#3D3D3D">초대 코드</label>
        <input id="invite-code" value=${code} maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="K7Q2M9"
          onInput=${(e) => setCode(String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          onKeyDown=${(e) => e.key === 'Enter' && enterCode()}
          style="margin-top:8px;height:60px;box-sizing:border-box;border:1.5px solid #D6D6D6;border-radius:12px;background:#FFFFFF;font-size:24px;font-weight:700;letter-spacing:8px;text-align:center;color:#1F1F1F;width:100%" />
        <p style="margin:10px 0 0;font-size:12.5px;color:#5E5E5E">초대 코드는 가족 중 한 명의 설정 화면에서 확인할 수 있어요.</p>
        ${errLine}
        ${DEMO && html`<p style="margin:16px 0 0;padding:10px 12px;border-radius:10px;background:#F2F2F2;font-size:12.5px;color:#3D3D3D;line-height:1.6">체험 모드예요. 초대 코드 <b>DEMO26</b>, PIN <b>1234</b>로 둘러볼 수 있어요. 데이터는 이 기기에만 저장돼요.</p>`}
        <div style="margin-top:auto;padding-top:24px;display:flex;flex-direction:column;gap:8px">
          <button disabled=${busy} onClick=${enterCode} style=${'height:52px;border:none;border-radius:12px;background:' + BRAND + ';color:#FFFFFF;font-size:15px;font-weight:600;opacity:' + (busy ? 0.6 : 1)}>${busy ? '확인 중…' : '가족 들어가기'}</button>
          <button onClick=${() => startCreate('new')} style="height:48px;border:none;background:transparent;color:#3D3D3D;font-size:14px;font-weight:600">처음이에요 · 새 가족 만들기</button>
        </div>
      </div>`;
  } else if (screen === 'who') {
    body = html`
      <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;padding:16px 24px 28px">
        <span style="align-self:flex-start;font-size:12px;font-weight:600;color:#3D3D3D;background:#EEEEEE;border-radius:12px;padding:5px 10px">우리 가족 · 구성원 ${profiles.length}명</span>
        <h1 style="margin:16px 0 0;font-size:24px;font-weight:700;letter-spacing:-0.4px">누구세요?</h1>
        <p style="margin:8px 0 0;font-size:14px;color:#5E5E5E">내 프로필을 고르고 PIN을 입력하면 이 기기가 연결돼요.</p>
        <div style="margin-top:28px;display:flex;flex-direction:column;gap:10px">
          ${profiles.map((p) => html`
            <button onClick=${() => { setWho(p); go('pin'); }} style="display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid #E5E5E5;border-radius:14px;background:#FFFFFF;text-align:left;color:#1F1F1F">
              <span style=${avatar(pal(p.color), 44)}>${p.name.slice(0, 1)}</span>
              <span style="flex:1;display:flex;flex-direction:column;gap:2px">
                <span style="font-size:16px;font-weight:700">${p.name}</span>
                <span style="display:flex;align-items:center;gap:4px;font-size:12px;color:#5E5E5E"><${IconLock} />PIN 설정됨</span>
              </span>
              <${Svg} size="18" stroke="#8A8A8A"><path d="M9 5l7 7-7 7" /><//>
            </button>`)}
          <button onClick=${() => startCreate('join')} style="display:flex;align-items:center;justify-content:center;gap:8px;height:56px;border:1.5px dashed #C7C7C7;border-radius:14px;background:transparent;color:#3D3D3D;font-size:14px;font-weight:600"><${IconPlus} size="18" />새 프로필 만들기</button>
        </div>
      </div>`;
  } else if (screen === 'pin') {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
    body = html`
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:24px 24px calc(32px + env(safe-area-inset-bottom))">
        <span style=${avatar(whoP, 64)}>${who.name.slice(0, 1)}</span>
        <h1 style="margin:16px 0 0;font-size:20px;font-weight:700;text-align:center">${who.name}님, 반가워요</h1>
        <p style="margin:6px 0 0;font-size:13.5px;color:#5E5E5E">PIN 4자리를 입력해주세요</p>
        <div role="status" aria-label=${'PIN ' + pin.length + '자리 입력됨'} style="display:flex;gap:16px;margin-top:28px">
          ${[0, 1, 2, 3].map((i) => html`<span style=${'width:16px;height:16px;border-radius:8px;box-sizing:border-box;border:2px solid ' + whoP.i + ';background:' + (i < pin.length ? whoP.i : 'transparent')}></span>`)}
        </div>
        ${busy ? html`<p style="margin:14px 0 0;font-size:13px;color:#5E5E5E">확인 중…</p>` : errLine}
        <button onClick=${() => setForgot(!forgot)} style=${'margin-top:14px;height:36px;border:none;background:transparent;color:' + BRAND + ';font-size:13px;font-weight:600'}>PIN을 잊었어요</button>
        ${forgot && html`<div style="margin-top:4px;background:#F2F2F2;border-radius:12px;padding:12px 14px;font-size:12.5px;color:#3D3D3D;line-height:1.6;text-align:center">가족을 처음 만든 사람(관리자)이<br />가족 설정에서 내 PIN을 초기화할 수 있어요.</div>`}
        <div style="margin-top:auto;padding-top:20px;width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
          ${keys.map((k) => (k === '' ? html`<span></span>` : k === 'del'
            ? html`<button onClick=${() => pressDigit('del')} aria-label="지우기" style="height:64px;border:none;border-radius:14px;background:transparent;color:#1F1F1F;display:flex;align-items:center;justify-content:center"><${Svg} size="26" sw="1.8"><path d="M21 5H9l-6 7 6 7h12z" /><path d="M12 9l6 6M18 9l-6 6" /><//></button>`
            : html`<button onClick=${() => pressDigit(k)} style="height:64px;border:none;border-radius:14px;background:#FFFFFF;box-shadow:inset 0 0 0 1px #E5E5E5;font-size:24px;font-weight:600;color:#1F1F1F">${k}</button>`))}
        </div>
      </div>`;
  } else if (screen === 'create') {
    const takenBy = { '회색': '가족' };
    if (mode === 'join') profiles.forEach((p) => { takenBy[p.color] = p.name; });
    body = html`
      <div style="flex:1;display:flex;flex-direction:column;min-height:0">
        <div style="flex:1;overflow-y:auto;padding:8px 24px 16px;display:flex;flex-direction:column">
          <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-0.4px">${mode === 'new' ? '새 가족 만들기' : '프로필 만들기'}</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#5E5E5E">가족에게 보일 이름과 색, PIN을 정해주세요.</p>
          <label for="profile-name" style="margin-top:24px;font-size:13px;font-weight:600;color:#3D3D3D">이름</label>
          <${TextInput} id="profile-name" value=${form.name} maxlength="8" placeholder="예: 유빈" onValue=${(v) => setForm((f) => ({ ...f, name: v.slice(0, 8) }))}
            style="margin-top:8px;height:48px;box-sizing:border-box;border:1.5px solid #D6D6D6;border-radius:12px;background:#FFFFFF;padding:0 14px;font-size:16px;color:#1F1F1F;width:100%" />
          <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:baseline;gap:8px">
            <span style="font-size:13px;font-weight:600;color:#3D3D3D">색상</span>
            <span style="font-size:11.5px;color:#5E5E5E">줄 그어진 색은 다른 가족이 사용 중</span>
          </div>
          <${Swatches} value=${form.color} takenBy=${takenBy} onPick=${(n) => setForm({ ...form, color: n })} />
          <div style="margin-top:14px;display:flex;align-items:center;gap:10px;padding:12px 14px;background:#FFFFFF;border:1px solid #E5E5E5;border-radius:12px">
            <span style="font-size:12px;color:#5E5E5E">미리보기</span>
            <span style=${'display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:14px;border:1px solid #D6D6D6;font-size:13px;font-weight:600;color:' + (form.name ? '#1F1F1F' : '#5E5E5E')}><span style=${dot(sel.d, 8)}></span>${form.name || '이름'}</span>
            <span style=${chip(sel, false, true)}>N</span>
            <span style=${chip(sel, true, true)}>OFF</span>
          </div>
          <div style="margin-top:24px;display:flex;gap:10px">
            <label style="flex:1;display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:600;color:#3D3D3D;min-width:0">PIN 4자리<input type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••" value=${form.pin} onInput=${(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} style="height:48px;box-sizing:border-box;border:1.5px solid #D6D6D6;border-radius:12px;background:#FFFFFF;padding:0 14px;font-size:18px;letter-spacing:6px;color:#1F1F1F;width:100%" /></label>
            <label style="flex:1;display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:600;color:#3D3D3D;min-width:0">PIN 확인<input type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••" value=${form.pin2} onInput=${(e) => setForm({ ...form, pin2: e.target.value.replace(/\D/g, '').slice(0, 4) })} style="height:48px;box-sizing:border-box;border:1.5px solid #D6D6D6;border-radius:12px;background:#FFFFFF;padding:0 14px;font-size:18px;letter-spacing:6px;color:#1F1F1F;width:100%" /></label>
          </div>
          <p style="margin:10px 0 0;font-size:12.5px;color:#5E5E5E;line-height:1.6">폰을 바꿨을 때 이 PIN으로 내 프로필을 다시 연결해요.</p>
          ${errLine}
        </div>
        <div style="padding:12px 24px calc(20px + env(safe-area-inset-bottom));border-top:1px solid #EBEBEB">
          <button disabled=${busy} onClick=${finishCreate} style=${'width:100%;height:52px;border:none;border-radius:12px;background:' + sel.d + ';color:#FFFFFF;font-size:15px;font-weight:600;opacity:' + (busy ? 0.6 : 1)}>${busy ? '만드는 중…' : '프로필 만들기'}</button>
        </div>
      </div>`;
  } else {
    const p = pal(done.color);
    body = html`
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 24px calc(28px + env(safe-area-inset-bottom));text-align:center">
        <div style=${'width:72px;height:72px;border-radius:36px;background:' + p.c + ';color:' + p.i + ';display:flex;align-items:center;justify-content:center'}><${IconCheck} size="34" /></div>
        <h1 style="margin:20px 0 0;font-size:22px;font-weight:700">${done.name}님으로 연결됐어요</h1>
        <p style="margin:8px 0 0;font-size:14px;color:#5E5E5E;line-height:1.6">다음부터는 이 기기에서 바로 캘린더가 열려요.</p>
        <button onClick=${() => onDone(done.s)} style=${'margin-top:32px;width:100%;height:52px;border:none;border-radius:12px;background:' + p.d + ';color:#FFFFFF;font-size:15px;font-weight:600'}>캘린더 열기</button>
      </div>`;
  }

  return html`
    ${hasBack && html`<div style="padding:16px 8px 0;display:flex;align-items:center;flex:none"><button onClick=${back} aria-label="뒤로" style=${S.navBtn}><${IconBack} /></button></div>`}
    ${body}`;
}

function Swatches({ value, takenBy, onPick }) {
  return html`
    <div role="radiogroup" aria-label="프로필 색상" style="margin-top:10px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;justify-items:center">
      ${PALETTE.map((p) => {
        const taken = takenBy[p.n];
        const selected = !taken && p.n === value;
        return html`<button role="radio" aria-checked=${selected ? 'true' : 'false'} aria-label=${p.n + (taken ? ', ' + taken + ' 사용 중' : '')} disabled=${!!taken} onClick=${() => onPick(p.n)}
          style=${'width:44px;height:44px;border-radius:22px;padding:0;display:flex;align-items:center;justify-content:center;background:' + p.c + ';border:none;' + (selected ? 'box-shadow:0 0 0 3px #FAFAFA,0 0 0 5px ' + p.d + ';' : '') + (taken ? 'opacity:0.45;cursor:not-allowed' : '')}>
          ${selected && html`<${Svg} size="18" sw="3" stroke=${p.i}><path d="M5 12l5 5 9-10" /><//>`}
          ${taken && html`<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><path d="M10 34L34 10" stroke=${p.i} stroke-width="3" stroke-linecap="round" /></svg>`}
        </button>`;
      })}
    </div>`;
}

// ───────────────────────── 메인 ─────────────────────────

function Main({ sess, onSignOut }) {
  const T = today();
  const [fam, setFam] = useState(null);
  const [events, setEvents] = useState([]);
  const [shifts, setShifts] = useState({});
  const [view, setView] = useState({ y: T.y, m: T.m });
  const [hidden, setHidden] = useState({});
  const [screen, setScreen] = useState(null); // null = 캘린더, {y,m} = 근무 입력
  const [modal, setModal] = useState(null);
  const [fatal, setFatal] = useState('');
  const viewRef = useRef(view);
  viewRef.current = view;
  const loadedRef = useRef(false);

  const loadShifts = async (y, m) => {
    const g = monthGrid(y, m);
    const rows = await api.loadShifts(g.from, g.to);
    setShifts((prev) => {
      const next = {};
      for (const k in prev) { const day = k.slice(k.indexOf('|') + 1); if (day < g.from || day > g.to) next[k] = prev[k]; }
      rows.forEach((r) => { next[r.member_id + '|' + r.day] = r.code; });
      return next;
    });
  };
  const loadAll = async () => {
    try {
      const [f, ev] = await Promise.all([api.loadFamily(), api.loadEvents()]);
      setFam(f);
      setEvents(ev);
      await loadShifts(viewRef.current.y, viewRef.current.m);
      loadedRef.current = true;
      setFatal('');
    } catch (e) {
      if (!loadedRef.current) setFatal(e.message || String(e));
      else toast('불러오지 못했어요: ' + (e.message || e), true);
    }
  };

  useEffect(() => {
    loadAll();
    const onVis = () => { if (document.visibilityState === 'visible') loadAll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  useEffect(() => { if (fam) loadShifts(view.y, view.m).catch((e) => toast(e.message, true)); }, [view.y, view.m]);

  if (fatal) {
    return html`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center">
      <div style="font-size:17px;font-weight:700">불러오지 못했어요</div>
      <div style="font-size:13px;color:#5E5E5E;line-height:1.6">${fatal}</div>
      <button onClick=${loadAll} style=${S.btnSecondary + ';flex:none;padding:0 24px'}>다시 시도</button>
      <button onClick=${async () => { await api.signOut().catch(() => {}); onSignOut(); }} style="border:none;background:transparent;color:#5E5E5E;font-size:13px;text-decoration:underline">처음 화면으로</button>
    </div>`;
  }
  if (!fam) return html`<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#8A8A8A;font-size:14px">불러오는 중…</div>`;

  const meRow = fam.members.find((x) => x.id === sess.member_id);
  if (!meRow) {
    return html`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center">
      <div style="font-size:15px">이 기기와 연결된 프로필이 없어요.</div>
      <button onClick=${async () => { await api.signOut().catch(() => {}); onSignOut(); }} style=${S.btnSecondary + ';flex:none;padding:0 24px'}>다시 연결하기</button>
    </div>`;
  }
  const me = meRow.id;
  const M = {};
  const order = [me].concat(fam.members.filter((x) => x.id !== me).map((x) => x.id), [FAM]);
  fam.members.forEach((x) => { M[x.id] = { ...pal(x.color), id: x.id, name: x.id === me ? '나' : x.name, full: x.name, admin: x.is_admin }; });
  M[FAM] = { ...pal('회색'), id: FAM, name: '가족', full: '가족' };
  const P = M[me];
  const codesBy = {};
  fam.codes.forEach((c) => { (codesBy[c.member_id] = codesBy[c.member_id] || {})[c.code] = c; });
  const myCodes = fam.codes.filter((c) => c.member_id === me);

  const vis = (k) => !hidden[k];
  const whoOf = (e) => { const w = (e.who || []).filter((k) => M[k]); return w.length ? w : [FAM]; };
  const canEdit = (e) => e.created_by === me || (!e.private && (e.who.includes(me) || e.who.includes(FAM)));

  if (screen) {
    return html`
      <${ShiftEntry} key="entry" start=${screen} P=${P} me=${me} codes=${myCodes} shifts=${shifts} loadShifts=${loadShifts}
        onCodes=${async (list) => { await api.saveCodes(me, list); await loadAll(); }}
        onClose=${(saved) => { if (saved) setView(saved); setScreen(null); }} />
      <${Toast} p=${P} />`;
  }

  const g = monthGrid(view.y, view.m);
  const isThisMonth = view.y === T.y && view.m === T.m;
  const mineInMonth = g.cells.some((c) => !c.faded && shifts[me + '|' + c.iso]);
  const showNoShift = vis(me) && myCodes.length > 0 && !mineInMonth && dn(view.y, view.m, 1) >= dn(T.y, T.m, 1);

  const cells = g.cells.map((c) => {
    const hol = c.faded ? '' : (HOLIDAYS[c.iso] || '');
    const isToday = !c.faded && c.y === T.y && c.m === T.m && c.d === T.d;
    const col = c.faded ? '#C2C2C2' : ((c.dow === 0 || hol) ? '#FF0000' : (c.dow === 6 ? '#3A5BA0' : '#2B2B2B'));
    const badges = c.faded ? [] : order.filter((k) => k !== FAM && vis(k) && shifts[k + '|' + c.iso]).map((k) => {
      const code = shifts[k + '|' + c.iso];
      const info = codesBy[k] && codesBy[k][code];
      return html`<button onClick=${() => setModal({ kind: 'shift', member: k, ...c })} aria-label=${M[k].full + ' ' + code + ' 근무 상세 보기'} style=${chip(M[k], info && info.is_off) + ';cursor:pointer'}>${code}</button>`;
    });
    const evs = c.faded ? [] : events.filter((e) => occurs(e, c.y, c.m, c.d) && whoOf(e).some(vis));
    return html`
      <div style="padding:4px 3px;box-sizing:border-box;border-top:1px solid #EBEBEB;display:flex;flex-direction:column;gap:3px;min-width:0;min-height:0;overflow:hidden">
        <div style="display:flex;align-items:center;gap:2px;min-width:0">
          <span style=${'font-size:12px;font-weight:600;flex:none;line-height:18px;' + (isToday ? 'min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;text-align:center;background:' + P.c + ';color:' + P.i : 'padding-left:2px;color:' + col)}>${c.d}</span>
          ${hol && html`<span style="font-size:10px;color:#FF0000;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0">${hol}</span>`}
        </div>
        ${badges.length > 0 && html`<div style="display:flex;flex-wrap:wrap;gap:2px">${badges}</div>`}
        ${evs.map((e) => {
          const w = whoOf(e);
          const p = M[w[0]];
          return html`<button onClick=${() => setModal({ kind: 'event', id: e.id, ...c })} style=${'display:flex;align-items:center;gap:3px;width:100%;padding:1px 4px;box-sizing:border-box;border:none;border-radius:4px;text-align:left;font-size:10.5px;min-width:0;flex:none;background:' + p.c + ';color:' + p.i}>
            ${w.length > 1 && w.map((k) => html`<span style=${dot(M[k].d, 6)}></span>`)}
            <span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${e.title}</span>
          </button>`;
        })}
      </div>`;
  });

  return html`
    <div style="display:flex;flex-direction:column;flex:1;min-height:0">
      <div style="padding:12px 8px 0;display:flex;align-items:center;flex:none">
        <button onClick=${() => setView(shiftMonth(view.y, view.m, -1))} aria-label="이전 달" style=${S.navBtn}><${IconBack} /></button>
        <h1 style="margin:0;font-size:21px;font-weight:700;letter-spacing:-0.3px;min-width:136px;text-align:center">${view.y}년 ${view.m}월</h1>
        <button onClick=${() => setView(shiftMonth(view.y, view.m, 1))} aria-label="다음 달" style=${S.navBtn}><${IconFwd} /></button>
        <div style="margin-left:auto;display:flex;align-items:center;gap:2px">
          ${!isThisMonth && html`<button onClick=${() => setView({ y: T.y, m: T.m })} style="height:32px;padding:0 14px;border:1px solid #D6D6D6;border-radius:16px;background:#FFFFFF;font-size:13px;font-weight:600;color:#3D3D3D">오늘</button>`}
          <button onClick=${() => setModal({ kind: 'settings' })} aria-label="가족 설정" style=${S.navBtn}><${IconGear} /></button>
        </div>
      </div>
      <div style="display:flex;gap:6px;padding:10px 16px 6px;flex-wrap:wrap;flex:none">
        ${order.map((k) => {
          const on = vis(k);
          const p = M[k];
          return html`<button onClick=${() => setHidden({ ...hidden, [k]: on })} aria-pressed=${on ? 'true' : 'false'}
            style=${'display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:16px;font-size:13px;font-weight:600;border:1px solid ' + (on ? p.c : '#E5E5E5') + ';background:' + (on ? p.c : '#FFFFFF') + ';color:' + (on ? p.i : '#5E5E5E') + (on ? '' : ';text-decoration:line-through')}>
            <span style=${dot(on ? p.i : p.c)}></span>${p.name}</button>`;
        })}
      </div>
      ${showNoShift && html`
        <div style="margin:2px 16px 6px;display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;background:#F2F2F2;border-radius:10px;font-size:12.5px;color:#3D3D3D;flex:none">
          <span style="flex:1">${view.m}월 근무를 아직 입력하지 않았어요</span>
          <button onClick=${() => setScreen({ y: view.y, m: view.m })} style=${'height:30px;padding:0 12px;border:none;border-radius:8px;background:' + P.c + ';color:' + P.i + ';font-size:12.5px;font-weight:600'}>입력</button>
        </div>`}
      <div style="height:4px;flex:none"></div>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));padding:0 8px;font-size:11px;color:#5E5E5E;text-align:center;flex:none">
        <span style="color:#FF0000">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span style="color:#3A5BA0">토</span>
      </div>
      <div style=${'flex:1;min-height:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-template-rows:repeat(' + g.rows + ',minmax(0,1fr));padding:4px 8px 0'}>${cells}</div>
      <div style=${S.bottomBar}>
        <button onClick=${() => setScreen({ y: view.y, m: view.m })} style=${'flex:1;height:48px;border:none;border-radius:12px;background:' + P.c + ';color:' + P.i + ';font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px'}><${IconEdit} />내 근무 입력</button>
        <button onClick=${() => setModal({ kind: 'form', draft: { title: '', day: isThisMonth ? iso(T.y, T.m, T.d) : iso(view.y, view.m, 1), time: '', who: [me], repeat: 'none', memo: '', private: false } })} aria-label="일정 추가" style="width:48px;height:48px;border:1px solid #D6D6D6;border-radius:12px;background:#FFFFFF;color:#1F1F1F;display:flex;align-items:center;justify-content:center"><${IconPlus} /></button>
      </div>
    </div>
    ${modal && html`<${Modal} modal=${modal} setModal=${setModal} ctx=${{ fam, M, P, me, order, codesBy, shifts, events, whoOf, canEdit, loadAll, setView, setScreen, onSignOut, sess }} />`}
    <${Toast} p=${P} />`;
}

// ───────────────────────── 팝업 ─────────────────────────

function Modal({ modal, setModal, ctx }) {
  const close = () => setModal(null);
  const sheet = modal.kind === 'settings';
  let inner = null;
  if (modal.kind === 'shift') inner = html`<${ShiftDetail} modal=${modal} ctx=${ctx} close=${close} />`;
  if (modal.kind === 'event') inner = html`<${EventDetail} modal=${modal} ctx=${ctx} close=${close} setModal=${setModal} />`;
  if (modal.kind === 'form') inner = html`<${EventForm} key=${modal.draft.id || 'new'} draft0=${modal.draft} ctx=${ctx} close=${close} />`;
  if (modal.kind === 'settings') inner = html`<${Settings} ctx=${ctx} close=${close} />`;
  const label = { shift: '근무 상세', event: '일정 상세', form: '일정', settings: '가족 설정' }[modal.kind];
  return html`
    <div onClick=${(e) => e.target === e.currentTarget && close()} style="position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;padding:20px;z-index:40">
      <div role="dialog" aria-modal="true" aria-label=${label} style=${'width:100%;max-width:' + (sheet ? 400 : 340) + 'px;max-height:calc(100dvh - 40px);overflow-y:auto;background:#FFFFFF;border-radius:18px;padding:20px;box-sizing:border-box'}>${inner}</div>
    </div>`;
}

function ShiftDetail({ modal, ctx, close }) {
  const { M, codesBy, shifts, me, setScreen } = ctx;
  const p = M[modal.member];
  const code = shifts[modal.member + '|' + modal.iso] || '';
  const info = codesBy[modal.member] && codesBy[modal.member][code];
  const off = info && info.is_off;
  return html`
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600"><span style=${dot(p.d)}></span>${p.full}</span>
        <span style="font-size:13px;color:#5E5E5E">${dateTxt(modal.y, modal.m, modal.d)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:14px">
        <div style=${'width:64px;height:64px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:' + (code.length > 1 ? 20 : 28) + 'px;font-weight:700;flex:none;box-sizing:border-box;border:2px solid ' + (off ? p.i : p.c) + ';background:' + (off ? '#FFFFFF' : p.c) + ';color:' + p.i}>${code}</div>
        <div>
          <div style="font-size:19px;font-weight:700">${info ? (info.name || code) : code + ' 근무'}</div>
          <div style="font-size:15px;color:#4A4A4A;margin-top:2px">${codeTime(info)}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button onClick=${close} style=${S.btnSecondary}>닫기</button>
        ${modal.member === me && html`<button onClick=${() => { close(); setScreen({ y: modal.y, m: modal.m }); }} style=${btnPrimary(ctx.P)}>수정</button>`}
      </div>
    </div>`;
}

function EventDetail({ modal, ctx, close, setModal }) {
  const { M, events, whoOf, canEdit } = ctx;
  const e = events.find((x) => x.id === modal.id);
  if (!e) return html`<div style="font-size:14px">일정을 찾을 수 없어요.</div><button onClick=${close} style=${S.btnSecondary + ';width:100%;margin-top:16px'}>닫기</button>`;
  const p0 = parse(e.day);
  const repeat = e.repeat === 'weekly' ? '매주 ' + WD[dowOf(p0.y, p0.m, p0.d)] + '요일 반복' : e.repeat === 'yearly' ? '매년 반복' : '';
  const editable = canEdit(e);
  return html`
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="font-size:19px;font-weight:700;word-break:break-all">${e.title}</div>
        ${e.private && html`<span style="display:flex;align-items:center;gap:4px;font-size:12px;color:#4A4A4A;background:#F2F2F2;border-radius:8px;padding:4px 8px;flex:none"><${IconLock} />공유 안 함</span>`}
      </div>
      <div style="font-size:14px;color:#4A4A4A">${dateTxt(modal.y, modal.m, modal.d)} · ${e.time}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${whoOf(e).map((k) => html`<span style=${'display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:14px;font-size:12.5px;font-weight:600;color:' + M[k].i + ';background:' + M[k].c}><span style=${dot(M[k].d)}></span>${M[k].full}</span>`)}
      </div>
      ${repeat && html`<div style="font-size:13px;color:#4A4A4A;display:flex;gap:6px;align-items:center"><${IconRepeat} />${repeat}</div>`}
      ${e.private && html`<div style="font-size:12.5px;color:#4A4A4A">나만 볼 수 있어요. 다른 가족 화면에는 표시되지 않아요.</div>`}
      ${e.memo && html`<div style="background:#F5F5F5;border-radius:10px;padding:10px 12px;font-size:13px;white-space:pre-wrap">${e.memo}</div>`}
      ${!editable && html`<div style="font-size:12px;color:#5E5E5E">만든 사람과 참여자만 수정할 수 있어요</div>`}
      <div style="display:flex;gap:8px">
        <button onClick=${close} style=${S.btnSecondary}>닫기</button>
        ${editable && html`<button onClick=${() => setModal({ kind: 'form', draft: { ...e, time: e.time === '종일' ? '' : e.time } })} style=${btnPrimary(ctx.P)}>수정</button>`}
      </div>
    </div>`;
}

function EventForm({ draft0, ctx, close }) {
  const { M, P, me, order, loadAll, setView, sess } = ctx;
  const [d, setD] = useState(draft0);
  const [busy, setBusy] = useState(false);
  const upd = (patch) => setD((prev) => ({ ...prev, ...patch }));
  const seg = (a) => 'flex:1;height:32px;border:none;border-radius:8px;font-size:13px;font-weight:600;background:' + (a ? '#FFFFFF' : 'transparent') + ';color:' + (a ? '#1F1F1F' : '#5E5E5E') + (a ? ';box-shadow:0 1px 2px rgba(0,0,0,0.08)' : '');

  const save = async () => {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(d.day) ? d.day : iso(today().y, today().m, today().d);
    const ev = {
      id: d.id, title: (d.title || '').trim().slice(0, 40) || '새 일정', day, time: d.time || '종일',
      who: d.private ? [me] : d.who, repeat: d.repeat, memo: (d.memo || '').trim(), private: !!d.private
    };
    setBusy(true);
    try {
      await api.saveEvent(ev, sess);
      await loadAll();
      const p = parse(day);
      setView({ y: p.y, m: p.m });
      close();
      toast(d.id ? '일정을 수정했어요' : '일정을 추가했어요');
    } catch (e) {
      toast('저장하지 못했어요: ' + e.message, true);
      setBusy(false);
    }
  };
  const del = async () => {
    if (!confirm('이 일정을 삭제할까요?' + (d.repeat !== 'none' ? '\n반복되는 일정 전체가 삭제돼요.' : ''))) return;
    setBusy(true);
    try {
      await api.deleteEvent(d.id);
      await loadAll();
      close();
      toast('일정을 삭제했어요');
    } catch (e) {
      toast('삭제하지 못했어요: ' + e.message, true);
      setBusy(false);
    }
  };

  return html`
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="font-size:18px;font-weight:700">${d.id ? '일정 수정' : '일정 추가'}</div>
      <label style=${S.label}>제목<${TextInput} value=${d.title} maxlength="40" onValue=${(v) => upd({ title: v })} placeholder="예: 사촌 결혼식" style=${S.input} /></label>
      <div style="display:flex;gap:8px">
        <label style=${S.label + ';flex:1.4'}>날짜<input type="date" value=${d.day} onInput=${(e) => upd({ day: e.target.value })} style=${S.input} /></label>
        <label style=${S.label + ';flex:1'}>시간<input type="time" value=${d.time} onInput=${(e) => upd({ time: e.target.value })} style=${S.input} /></label>
      </div>
      ${!d.private && html`
        <div style="display:flex;flex-direction:column;gap:6px">
          <span style="font-size:12.5px;font-weight:600;color:#3D3D3D">함께하는 사람</span>
          <div role="group" aria-label="함께하는 사람" style="display:flex;gap:6px;flex-wrap:wrap">
            ${order.map((k) => {
              const on = d.who.includes(k);
              const p = M[k];
              return html`<button aria-pressed=${on ? 'true' : 'false'} onClick=${() => {
                let w = order.filter((x) => (x === k ? !on : d.who.includes(x)));
                if (!w.length) w = [me];
                upd({ who: w });
              }} style=${'height:34px;padding:0 14px;border-radius:17px;font-size:13px;font-weight:600;border:1px solid ' + (on ? p.c : '#D6D6D6') + ';background:' + (on ? p.c : '#FFFFFF') + ';color:' + (on ? p.i : '#5E5E5E')}>${p.name}</button>`;
            })}
          </div>
        </div>`}
      <div style="display:flex;flex-direction:column;gap:6px">
        <span style="font-size:12.5px;font-weight:600;color:#3D3D3D">반복</span>
        <div role="group" aria-label="반복" style="display:flex;background:#EEEEEE;border-radius:10px;padding:3px">
          ${[['none', '반복 안 함'], ['weekly', '매주'], ['yearly', '매년']].map((o) => html`<button aria-pressed=${d.repeat === o[0] ? 'true' : 'false'} onClick=${() => upd({ repeat: o[0] })} style=${seg(d.repeat === o[0])}>${o[1]}</button>`)}
        </div>
      </div>
      <label style=${S.label}>메모<${TextInput} value=${d.memo} onValue=${(v) => upd({ memo: v })} placeholder="선택 사항" style=${S.input} /></label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:#1F1F1F"><input type="checkbox" checked=${!!d.private} onChange=${(e) => upd({ private: e.target.checked })} style="width:18px;height:18px;margin:0" />공유 안 함 · 나만 보기</label>
      <div style="display:flex;gap:8px">
        <button onClick=${close} style=${S.btnSecondary}>취소</button>
        <button disabled=${busy} onClick=${save} style=${btnPrimary(P) + ';opacity:' + (busy ? 0.6 : 1)}>${busy ? '저장 중…' : '저장'}</button>
      </div>
      ${d.id && html`<button disabled=${busy} onClick=${del} style="height:40px;border:none;background:transparent;color:#D00000;font-size:14px;font-weight:600">일정 삭제</button>`}
    </div>`;
}

function Settings({ ctx, close }) {
  const { fam, M, P, me, order, loadAll, onSignOut } = ctx;
  const meAdmin = M[me].admin;
  const code = fam.family.invite_code;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const takenBy = { '회색': '가족' };
  fam.members.forEach((x) => { if (x.id !== me) takenBy[x.color] = x.name; });

  const share = async () => {
    const text = '가족 근무 캘린더 초대 코드: ' + code + '\n' + location.origin;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('초대 문구를 복사했어요'); }
    } catch (e) { /* 공유 취소 */ }
  };
  const recolor = async (n) => {
    try { await api.updateMe(me, { color: n }); await loadAll(); toast('내 색을 바꿨어요'); } catch (e) { toast(e.message, true); }
  };
  const resetPin = async (id) => {
    const pin = prompt(M[id].full + '님의 새 PIN 4자리를 입력해주세요');
    if (pin == null) return;
    try { await api.resetPin(id, pin.trim()); toast(M[id].full + '님 PIN을 바꿨어요'); } catch (e) { toast(e.message, true); }
  };
  const signOut = async () => {
    if (!confirm('이 기기에서 연결을 해제할까요?\n다시 들어오려면 초대 코드와 PIN이 필요해요.')) return;
    try { await api.signOut(); } catch (e) { /* 오프라인이어도 로컬 연결은 끊어요 */ }
    close();
    onSignOut();
  };

  return html`
    <div style="display:flex;flex-direction:column;gap:18px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:18px;font-weight:700">가족 설정</div>
        <button onClick=${close} aria-label="닫기" style=${S.navBtn + ';width:36px;height:36px'}><${Svg}><path d="M6 6l12 12M18 6L6 18" /><//></button>
      </div>
      <div style="background:#F5F5F5;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;align-items:center">
        <div style="font-size:12.5px;color:#5E5E5E;font-weight:600">초대 코드</div>
        <div style="font-size:28px;font-weight:700;letter-spacing:8px;padding-left:8px">${code}</div>
        <button onClick=${share} style=${btnPrimary(P) + ';flex:none;width:100%;height:42px;font-size:14px'}>가족에게 초대 코드 보내기</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:13px;font-weight:700;color:#3D3D3D">구성원</div>
        ${order.filter((k) => k !== 'fam').map((k) => html`
          <div style="display:flex;align-items:center;gap:10px">
            <span style=${avatar(M[k], 32)}>${M[k].full.slice(0, 1)}</span>
            <span style="flex:1;font-size:14px;font-weight:600">${M[k].full}${k === me ? ' (나)' : ''}${M[k].admin ? html` <span style="font-size:11px;color:#5E5E5E;font-weight:500">관리자</span>` : ''}</span>
            ${meAdmin && k !== me && html`<button onClick=${() => resetPin(k)} style="height:30px;padding:0 10px;border:1px solid #D6D6D6;border-radius:8px;background:#FFFFFF;font-size:12px;font-weight:600;color:#3D3D3D">PIN 초기화</button>`}
          </div>`)}
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:#3D3D3D">내 색</div>
        <${Swatches} value=${fam.members.find((x) => x.id === me).color} takenBy=${takenBy} onPick=${recolor} />
      </div>
      ${!standalone && html`<div style="background:#F2F2F2;border-radius:12px;padding:12px 14px;font-size:12.5px;color:#3D3D3D;line-height:1.7">
        <b>앱처럼 쓰려면 홈 화면에 추가하세요</b><br />
        iPhone: Safari 공유 버튼 → 홈 화면에 추가<br />
        안드로이드: Chrome 메뉴(⋮) → 앱 설치 / 홈 화면에 추가
      </div>`}
      ${DEMO && html`<div style="font-size:12px;color:#8A8A8A">체험 모드 · 데이터가 이 기기에만 저장돼요</div>`}
      <button onClick=${signOut} style="height:44px;border:1px solid #F2C4C4;border-radius:12px;background:#FFFFFF;color:#D00000;font-size:14px;font-weight:600">이 기기 연결 해제</button>
    </div>`;
}

// ───────────────────────── 내 근무 입력 ─────────────────────────

// 휴대폰 캡처는 크기가 커서, 긴 변 1568px JPEG로 줄여서 보내요 (Claude가 읽는 최대 해상도와 같아요).
async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error('사진을 열 수 없어요. JPG나 PNG 사진으로 올려주세요'));
      i.src = url;
    });
    const k = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext('2d');
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return { image: c.toDataURL('image/jpeg', 0.9).split(',')[1], media_type: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const stripCode = (c) => ({ code: c.code, name: c.name, start_time: c.start_time, end_time: c.end_time, is_off: c.is_off });
// 사진에서 처음 나온 코드는 자주 쓰는 형태에 있으면 그 이름·시간으로 채워요.
function guessCode(code) {
  for (const k in PRESETS) {
    const hit = PRESETS[k].find((c) => c.code === code);
    if (hit) return { ...hit };
  }
  return { code, name: '', start_time: null, end_time: null, is_off: /^(OFF|휴|휴무|비번|O)$/i.test(code) };
}

function ShiftEntry({ start, P, me, codes, shifts, loadShifts, onCodes, onClose }) {
  const [ym, setYm] = useState(start);
  const [brush, setBrush] = useState(codes.length ? codes[0].code : null);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | 기존 코드
  const [form, setForm] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState(null); // 마지막 사진 인식 결과 {y, m, legend, note, count, unknown}
  const fileRef = useRef();

  const pickPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setScanning(true);
    try {
      const img = await shrinkImage(file);
      const r = await api.parseSchedule({ ...img, year: ym.y, month: ym.m, codes: codes.map(stripCode) });
      const y = r.year >= 2000 && r.year <= 2100 ? r.year : ym.y;
      const m = r.month >= 1 && r.month <= 12 ? r.month : ym.m;
      if (!r.days.length) throw new Error('근무 코드를 찾지 못했어요. 한 달 달력 화면을 올려주세요');
      const unknown = [...new Set(r.days.map((d) => d.code))].filter((c) => !codes.some((x) => x.code === c));
      if (unknown.length) await onCodes(codes.map(stripCode).concat(unknown.map(guessCode)));
      const next = { ...edits };
      r.days.forEach((d) => { next[iso(y, m, d.day)] = d.code; });
      setEdits(next);
      setYm({ y, m });
      setBrush(r.days[0].code);
      setScan({ y, m, legend: r.legend || [], note: r.note || '', count: r.days.length, unknown });
    } catch (err) {
      toast(err.message || String(err), true);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => { loadShifts(ym.y, ym.m).catch((e) => toast(e.message, true)); }, [ym.y, ym.m]);
  useEffect(() => { if (brush !== '' && !codes.some((c) => c.code === brush)) setBrush(codes.length ? codes[0].code : null); }, [codes]);

  const info = {};
  codes.forEach((c) => { info[c.code] = c; });
  const value = (day) => (day in edits ? edits[day] : (shifts[me + '|' + day] || null));
  const g = monthGrid(ym.y, ym.m);
  const dirty = Object.keys(edits).filter((day) => (edits[day] || null) !== (shifts[me + '|' + day] || null));

  const tap = (day) => {
    if (brush == null) { toast('먼저 아래에서 근무 코드를 만들어주세요', true); return; }
    const cur = value(day);
    setEdits({ ...edits, [day]: brush === '' || cur === brush ? null : brush });
  };
  const fillOff = () => {
    const off = codes.find((c) => c.is_off);
    if (!off) { toast('휴무 코드가 없어요', true); return; }
    const next = { ...edits };
    g.cells.forEach((c) => { if (!c.faded && !value(c.iso)) next[c.iso] = off.code; });
    setEdits(next);
  };
  const save = async () => {
    if (!dirty.length) { onClose(null); return; }
    setBusy(true);
    try {
      await api.saveShifts(me, dirty.map((day) => ({ day, code: edits[day] || null })));
      const months = new Set(dirty.map((d) => d.slice(0, 7)));
      await Promise.all([...months].map((k) => loadShifts(+k.slice(0, 4), +k.slice(5, 7))));
      toast('근무 ' + dirty.length + '일을 저장했어요');
      onClose(ym);
    } catch (e) {
      toast('저장하지 못했어요: ' + e.message, true);
      setBusy(false);
    }
  };
  const leave = () => { if (!dirty.length || confirm('저장하지 않은 변경이 있어요. 나갈까요?')) onClose(null); };

  const counts = codes.map((c) => ({ c, n: g.cells.filter((x) => !x.faded && value(x.iso) === c.code).length }));
  const filled = g.cells.filter((x) => !x.faded && value(x.iso)).length;
  const total = daysIn(ym.y, ym.m);

  const saveCodes = async (list) => {
    try { await onCodes(list); setEditing(null); } catch (e) { toast('코드를 저장하지 못했어요: ' + e.message, true); }
  };
  const openCode = (c) => {
    setEditing(c ? c.code : 'new');
    setForm(c ? { ...c, start_time: c.start_time || '', end_time: c.end_time || '' } : { code: '', name: '', start_time: '', end_time: '', is_off: false });
  };
  const submitCode = () => {
    const code = form.code.trim().toUpperCase().slice(0, 4);
    if (!code) { toast('코드를 입력해주세요', true); return; }
    if (codes.some((c) => c.code === code && c.code !== editing)) { toast('이미 있는 코드예요', true); return; }
    const row = { code, name: form.name.trim(), start_time: form.is_off ? null : (form.start_time || null), end_time: form.is_off ? null : (form.end_time || null), is_off: !!form.is_off };
    const strip = (c) => ({ code: c.code, name: c.name, start_time: c.start_time, end_time: c.end_time, is_off: c.is_off });
    const list = editing === 'new' ? codes.map(strip).concat([row]) : codes.map((c) => (c.code === editing ? row : strip(c)));
    saveCodes(list);
  };
  const removeCode = () => {
    if (!confirm(editing + ' 코드를 삭제할까요?\n이미 입력한 날짜에는 코드 글자만 남아요.')) return;
    saveCodes(codes.filter((c) => c.code !== editing).map((c) => ({ code: c.code, name: c.name, start_time: c.start_time, end_time: c.end_time, is_off: c.is_off })));
  };

  if (scanning) {
    return html`
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 16px 96px">
        <div style="position:relative;width:210px;height:300px;border-radius:16px;background:#FFFFFF;border:1px solid #E0E0E0;overflow:hidden;padding:16px;box-sizing:border-box">
          <div style="height:12px;width:90px;background:#E5E5E5;border-radius:3px"></div>
          <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-top:18px">
            ${Array.from({ length: 35 }, (_, i) => html`<span style=${'height:26px;border-radius:3px;background:' + ['#9CD0F5', '#F6A8D8', '#F8E58A', '#9EEDB0', '#E8E8E8'][(i * 7 + (i >> 2)) % 5] + (i < 4 ? ';opacity:0.4' : '')}></span>`)}
          </div>
          <div style=${'position:absolute;left:0;right:0;height:3px;background:' + P.d + ';animation:scan 1.2s ease-in-out infinite alternate'}></div>
        </div>
        <div style="font-size:17px;font-weight:700;margin-top:8px">근무 코드를 읽는 중…</div>
        <div style="font-size:13px;color:#5E5E5E">날짜 칸과 범례를 확인하고 있어요. 10~30초쯤 걸려요</div>
      </div>`;
  }

  let status = null;
  if (scan && scan.y === ym.y && scan.m === ym.m) {
    const got = {};
    g.cells.forEach((c) => { if (!c.faded && value(c.iso)) got[value(c.iso)] = (got[value(c.iso)] || 0) + 1; });
    const mism = scan.legend.filter((l) => (got[l.code] || 0) !== l.count);
    const ok = scan.legend.length > 0 && mism.length === 0;
    const bad = mism.length > 0;
    const title = bad
      ? '범례와 달라요: ' + mism.map((l) => { const df = (got[l.code] || 0) - l.count; return l.code + ' ' + Math.abs(df) + '개 ' + (df < 0 ? '부족' : '초과'); }).join(', ')
      : ok ? scan.count + '일 모두 인식했어요' : scan.count + '일을 인식했어요';
    status = html`
      <div style=${'display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:14px;background:' + (bad ? '#FFF0F0' : '#E7F4EE') + ';color:' + (bad ? '#D00000' : '#0E6B4F')}>
        <div style="display:flex;gap:10px;align-items:center">${bad ? html`<${IconWarn} />` : html`<${IconCheck} size="20" />`}<span style="font-weight:700;font-size:14px">${title}</span></div>
        <div style="font-size:12.5px;color:#3D3D3D;line-height:1.6">
          ${scan.note && html`<div>${scan.note}</div>`}
          ${scan.unknown.length > 0 && html`<div>처음 보는 코드 <b>${scan.unknown.join(', ')}</b>를 추가했어요. 아래 근무 코드 설정에서 시간을 확인해주세요.</div>`}
          <div>틀린 칸은 근무를 고르고 눌러서 고친 뒤 저장하세요.</div>
        </div>
      </div>`;
  }

  const brushBtn = (key, label, styleOn, styleOff) => {
    const on = brush === key;
    return html`<button aria-pressed=${on ? 'true' : 'false'} onClick=${() => setBrush(key)} style=${'height:40px;min-width:48px;padding:0 12px;border-radius:10px;font-size:14px;font-weight:700;' + (on ? styleOn : styleOff)}>${label}</button>`;
  };

  return html`
    <div style="display:flex;flex-direction:column;flex:1;min-height:0">
      <div style="padding:12px 8px 4px;display:flex;align-items:center;gap:2px;flex:none">
        <button onClick=${leave} aria-label="캘린더로 돌아가기" style=${S.navBtn}><${IconBack} /></button>
        <h1 style="margin:0;font-size:18px;font-weight:700">내 근무 입력</h1>
      </div>
      <div style="flex:1;overflow-y:auto;padding:4px 16px 16px;display:flex;flex-direction:column;gap:12px">
        <input ref=${fileRef} type="file" accept="image/*" onChange=${pickPhoto} style="display:none" />
        ${status || html`
          <button onClick=${() => fileRef.current.click()} style="display:flex;align-items:center;gap:12px;padding:14px;border:1.5px dashed #C7C7C7;border-radius:14px;background:#FFFFFF;text-align:left;color:#1F1F1F">
            <span style=${'width:44px;height:44px;border-radius:22px;background:' + P.c + ';color:' + P.d + ';display:flex;align-items:center;justify-content:center;flex:none'}><${IconPhoto} /></span>
            <span style="flex:1;display:flex;flex-direction:column;gap:2px">
              <span style="font-size:15px;font-weight:700">근무표 사진으로 한 번에 입력</span>
              <span style="font-size:12px;color:#5E5E5E;line-height:1.5">근무표 앱의 한 달 달력 화면을 캡처해서 올려주세요. 본인 근무만 보이는 화면이면 돼요.</span>
            </span>
          </button>`}
        ${codes.length > 0 && html`
          <div style="background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px">
            <div style="font-size:12.5px;color:#5E5E5E">근무를 고르고 날짜를 누르세요. 같은 근무를 한 번 더 누르면 지워져요.</div>
            <div role="group" aria-label="입력할 근무" style="display:flex;gap:6px;flex-wrap:wrap">
              ${codes.map((c) => brushBtn(c.code, c.code,
                'border:2px solid ' + P.i + ';background:' + (c.is_off ? '#FFFFFF' : P.c) + ';color:' + P.i,
                'border:1.5px solid ' + (c.is_off ? P.i : P.c) + ';background:' + (c.is_off ? '#FFFFFF' : P.c) + ';color:' + P.i + ';opacity:0.75'))}
              ${brushBtn('', '지우기', 'border:2px solid #3D3D3D;background:#FFFFFF;color:#3D3D3D', 'border:1.5px solid #D6D6D6;background:#FFFFFF;color:#5E5E5E')}
            </div>
          </div>`}

        <div style="background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;padding:8px 8px 8px">
          <div style="display:flex;align-items:center;padding:0 0 6px">
            <button onClick=${() => setYm(shiftMonth(ym.y, ym.m, -1))} aria-label="이전 달" style=${S.navBtn + ';width:36px;height:36px'}><${IconBack} /></button>
            <span style="font-size:15px;font-weight:700;flex:1;text-align:center">${ym.y !== today().y ? ym.y + '년 ' : ''}${ym.m}월 · 나</span>
            <button onClick=${() => setYm(shiftMonth(ym.y, ym.m, 1))} aria-label="다음 달" style=${S.navBtn + ';width:36px;height:36px'}><${IconFwd} /></button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));font-size:10.5px;color:#5E5E5E;text-align:center;padding-bottom:4px">
            <span style="color:#FF0000">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span style="color:#3A5BA0">토</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px">
            ${g.cells.map((c) => {
              if (c.faded) return html`<div style="height:50px;font-size:10px;color:#C2C2C2;text-align:center;padding-top:3px;box-sizing:border-box">${c.d}</div>`;
              const v = value(c.iso);
              const changed = c.iso in edits && (edits[c.iso] || null) !== (shifts[me + '|' + c.iso] || null);
              const hol = HOLIDAYS[c.iso];
              return html`<button onClick=${() => tap(c.iso)} aria-label=${ym.m + '월 ' + c.d + '일 ' + (v || '비어 있음')}
                style=${'height:50px;border:' + (changed ? '1.5px dashed ' + P.d : '1.5px solid transparent') + ';border-radius:8px;background:#F5F5F5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:0;color:' + ((c.dow === 0 || hol) ? '#FF0000' : c.dow === 6 ? '#3A5BA0' : '#2B2B2B')}>
                <span style="font-size:10px">${c.d}</span>
                ${v ? html`<span style=${chip(P, info[v] && info[v].is_off)}>${v}</span>` : html`<span style="height:18px"></span>`}
              </button>`;
            })}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 4px 2px;font-size:12px;color:#5E5E5E">
            <span>${total}일 중 ${filled}일 입력</span>
            ${codes.some((c) => c.is_off) && filled < total && html`<button onClick=${fillOff} style="height:28px;padding:0 10px;border:1px solid #D6D6D6;border-radius:8px;background:#FFFFFF;font-size:12px;font-weight:600;color:#3D3D3D">빈 날 모두 휴무로</button>`}
          </div>
          ${counts.length > 0 && html`
            <div style="display:flex;gap:6px;flex-wrap:wrap;padding:6px 4px 2px">
              ${counts.map((x) => html`<span style="display:flex;align-items:center;gap:4px;font-size:12px;color:#3D3D3D"><span style=${chip(P, x.c.is_off)}>${x.c.code}</span>${x.n}</span>`)}
            </div>`}
        </div>

        <div style="background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px">
          <div>
            <div style="font-size:14px;font-weight:700">근무 코드 설정</div>
            <div style="font-size:12px;color:#5E5E5E;margin-top:2px">한 번만 설정하면 계속 쓸 수 있어요. 가족에게는 이름과 시간이 보여요.</div>
          </div>
          ${codes.length === 0 && editing == null && html`
            <div style="display:flex;flex-direction:column;gap:6px">
              <div style="font-size:12.5px;color:#3D3D3D">자주 쓰는 형태로 시작하기</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${Object.keys(PRESETS).map((k) => html`<button onClick=${() => saveCodes(PRESETS[k])} style=${'height:36px;padding:0 12px;border:none;border-radius:10px;background:' + P.c + ';color:' + P.i + ';font-size:13px;font-weight:600'}>${k} (${PRESETS[k].map((c) => c.code).join('·')})</button>`)}
              </div>
            </div>`}
          ${codes.map((c) => (editing === c.code ? html`<${CodeForm} form=${form} setForm=${setForm} P=${P} onSave=${submitCode} onCancel=${() => setEditing(null)} onDelete=${removeCode} />` : html`
            <button onClick=${() => openCode(c)} style="display:flex;align-items:center;gap:10px;font-size:13px;border:none;background:transparent;padding:4px 0;text-align:left;color:#1F1F1F">
              <span style=${chip(P, c.is_off, true)}>${c.code}</span>
              <span style="font-weight:600;min-width:52px">${c.name || '-'}</span>
              <span style=${'color:' + (!c.is_off && (!c.start_time || !c.end_time) ? '#D00000' : '#4A4A4A') + ';flex:1'}>${codeTime(c)}</span>
              <span style="color:#8A8A8A;font-size:12px">수정</span>
            </button>`))}
          ${editing === 'new' ? html`<${CodeForm} form=${form} setForm=${setForm} P=${P} onSave=${submitCode} onCancel=${() => setEditing(null)} />`
            : html`<button onClick=${() => openCode(null)} style="display:flex;align-items:center;justify-content:center;gap:6px;height:40px;border:1.5px dashed #C7C7C7;border-radius:10px;background:transparent;color:#3D3D3D;font-size:13px;font-weight:600"><${IconPlus} size="16" />근무 코드 추가</button>`}
        </div>
      </div>
      <div style=${S.bottomBar}>
        <button disabled=${busy} onClick=${save} style=${'width:100%;height:50px;border:none;border-radius:12px;background:' + P.c + ';color:' + P.i + ';font-size:15px;font-weight:600;opacity:' + (busy ? 0.6 : 1)}>${busy ? '저장 중…' : dirty.length ? '저장하고 가족과 공유 (' + dirty.length + '일)' : '캘린더로 돌아가기'}</button>
      </div>
    </div>`;
}

function CodeForm({ form, setForm, P, onSave, onCancel, onDelete }) {
  const f = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  return html`
    <div style=${'border:1.5px solid ' + P.c + ';background:#FAFAFA;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px'}>
      <div style="display:flex;gap:8px">
        <label style=${S.label + ';flex:1'}>코드<${TextInput} value=${form.code} maxlength="4" placeholder="예: D" onValue=${(v) => f({ code: v })} style=${S.input + ';height:40px'} /></label>
        <label style=${S.label + ';flex:1.6'}>이름<${TextInput} value=${form.name} maxlength="8" placeholder="예: 데이" onValue=${(v) => f({ name: v })} style=${S.input + ';height:40px'} /></label>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" checked=${form.is_off} onChange=${(e) => f({ is_off: e.target.checked })} style="width:18px;height:18px;margin:0" />쉬는 날(휴무) 코드</label>
      ${!form.is_off && html`
        <div style="display:flex;gap:8px">
          <label style=${S.label + ';flex:1'}>시작<input type="time" value=${form.start_time} onInput=${(e) => f({ start_time: e.target.value })} style=${S.input + ';height:40px'} /></label>
          <label style=${S.label + ';flex:1'}>종료<input type="time" value=${form.end_time} onInput=${(e) => f({ end_time: e.target.value })} style=${S.input + ';height:40px'} /></label>
        </div>`}
      <div style="display:flex;gap:6px">
        ${onDelete && html`<button onClick=${onDelete} style="height:38px;padding:0 12px;border:none;background:transparent;color:#D00000;font-size:13px;font-weight:600">삭제</button>`}
        <span style="flex:1"></span>
        <button onClick=${onCancel} style="height:38px;padding:0 14px;border:1px solid #D6D6D6;border-radius:10px;background:#FFFFFF;font-size:13px;font-weight:600">취소</button>
        <button onClick=${onSave} style=${'height:38px;padding:0 16px;border:none;border-radius:10px;background:' + P.c + ';color:' + P.i + ';font-size:13px;font-weight:600'}>저장</button>
      </div>
    </div>`;
}

// ───────────────────────── 시작 ─────────────────────────

function App() {
  const [state, setState] = useState({ phase: 'loading', sess: null, err: '' });
  useEffect(() => {
    api.session()
      .then((s) => setState({ phase: s ? 'main' : 'onboard', sess: s, err: '' }))
      .catch((e) => setState({ phase: 'onboard', sess: null, err: e.message || String(e) }));
  }, []);
  if (state.phase === 'loading') {
    return html`<div style="flex:1;display:flex;align-items:center;justify-content:center"><div style=${'width:56px;height:56px;border-radius:16px;background:' + BRAND + ';color:#FFFFFF;display:flex;align-items:center;justify-content:center'}><${IconCal} /></div></div>`;
  }
  if (state.phase === 'onboard') {
    return html`
      ${state.err && html`<div role="alert" style="margin:12px 16px 0;padding:10px 12px;border-radius:10px;background:#FFF0F0;color:#D00000;font-size:12.5px">${state.err}</div>`}
      <${Onboarding} onDone=${(s) => setState({ phase: 'main', sess: s, err: '' })} />`;
  }
  return html`<${Main} key=${state.sess.member_id} sess=${state.sess} onSignOut=${() => setState({ phase: 'onboard', sess: null, err: '' })} />`;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js');
}

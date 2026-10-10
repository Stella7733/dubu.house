'use client';
// TRPG 캐릭터 등록/수정 폼 (v1.9) — 페이지형.
// 이미지 방식: 단일 인장(표정마다 개별 1:1 크롭) / 스탠딩 인장(모든 파일의 가로세로 크기 동일 강제 —
// 썸네일 크롭 위치를 한 번만 잡아 전 표정에 공유). 표정: 라벨 · ⠿ 순서 · 첫 장 = 대표
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocalList, newId } from '@/lib/postStore';
import { CocInvestigatorSheet, CocInventoryItem, CocSkill, CocWeapon, TrpgChar, TrpgFace, COC7_SKILL_DEFAULTS, TCHAR_SEED } from '@/lib/tcharStore';
import { putBlob, getBlob, useBlobUrl } from '@/lib/blobStore';
import { CropEditor, CropImg, CropValue } from '@/components/ui/CropEditor';
import { KInput } from '@/components/ui/Kit';
import { RichEditor } from '@/components/ui/RichEditor';
import { DragList } from '@/components/ui/DragList';
import { Modal, useConfirmDelete } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

interface FaceDraft {
  id: string;
  label: string;
  imgId?: string;            // 저장돼 있던 이미지 (수정 모드)
  file?: File;               // 새 업로드
  url?: string;              // objectURL 미리보기
  crop?: CropValue;          // 단일 인장 모드의 개별 크롭
  ph?: string;               // 시드 데모
  w?: number; h?: number;    // 원본 크기 (스탠딩 검증)
}

const imgDims = (src: string) => new Promise<{ w: number; h: number }>((resolve, reject) => {
  const im = new Image();
  im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
  im.onerror = reject;
  im.src = src;
});

/** 표정 행 썸네일 (1:1 크롭 미리보기) */
function FaceThumb({ f, crop }: { f: FaceDraft; crop?: CropValue }) {
  const loaded = useBlobUrl(f.imgId);
  const src = f.url ?? loaded;
  if (!src) return <div className={`ph ${f.ph ?? 'cool'}`} style={{ position: 'absolute', inset: 0 }} />;
  return <CropImg src={src} crop={crop} />;
}

/** 표정 원본 전체 보기 (v1.9) — 썸네일 클릭 시 크롭 없이 원본 그대로 */
function FaceViewModal({ f, onClose }: { f: FaceDraft; onClose: () => void }) {
  const loaded = useBlobUrl(f.imgId);
  const src = f.url ?? loaded;
  return (
    <Modal open onClose={onClose} title={f.label || undefined}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={f.label} style={{ display: 'block', maxWidth: '100%', maxHeight: '72vh', margin: '0 auto', borderRadius: 10 }} />
      ) : (
        <div className={`ph ${f.ph ?? 'cool'}`} style={{ height: 280, borderRadius: 10 }} />
      )}
    </Modal>
  );
}

/** 크롭 편집기 소스 — 새 파일이면 objectURL, 저장본이면 blob 로드 */
function FaceCropModal({ f, initial, onClose, onApply }: {
  f: FaceDraft; initial?: CropValue; onClose: () => void; onApply: (c: CropValue) => void;
}) {
  const loaded = useBlobUrl(f.imgId);
  const src = f.url ?? loaded;
  if (!src) return null;
  return <CropEditor open src={src} aspect="1:1" initial={initial} onClose={onClose} onApply={onApply} />;
}

const emptyCocSheet = (sheet?: CocInvestigatorSheet): CocInvestigatorSheet => ({
  investigator: {
    player: '', occupation: '', age: '', gender: '', residence: '', birthplace: '', catchphrase: '',
    ...sheet?.investigator,
  },
  characteristics: {
    str: '', con: '', siz: '', dex: '', app: '', int: '', pow: '', edu: '',
    ...sheet?.characteristics,
  },
  derived: {
    hp: '', hpMax: '', mp: '', mpMax: '', sanity: '', sanityMax: '', luck: '',
    damageBonus: '', build: '', moveRate: '', ...sheet?.derived,
  },
  mental: {
    sanityAdaptation: '', temporaryInsanity: false, longTermInsanity: false,
    bout: '', currentState: '', ...sheet?.mental,
  },
  skills: sheet?.skills ?? COC7_SKILL_DEFAULTS.map(([name, base]) => ({
    id: newId(), name, base, current: base, growthChecked: false,
  })),
  backstoryHtml: sheet?.backstoryHtml ?? '',
  weapons: sheet?.weapons ?? [],
  equipment: sheet?.equipment ?? [],
  possessions: sheet?.possessions ?? [],
  finance: { spendingLevel: '', cash: '', assets: '', ...sheet?.finance },
  scenarioLogs: sheet?.scenarioLogs ?? [],
});

function CocField({ label, value, onChange }: {
  label: string; value: string; onChange: (value: string) => void;
}) {
  return <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
    <span className="k-label" style={{ margin: 0 }}>{label}</span>
    <KInput value={value} onChange={e => onChange(e.target.value)} />
  </label>;
}

function CocSheetEditor({ data, onChange }: {
  data: CocInvestigatorSheet; onChange: (next: CocInvestigatorSheet) => void;
}) {
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 9 };
  const patch = <K extends 'investigator' | 'characteristics' | 'derived' | 'mental' | 'finance',>(
    key: K, values: Partial<CocInvestigatorSheet[K]>,
  ) => {
    onChange({ ...data, [key]: { ...data[key], ...values } } as CocInvestigatorSheet);
  };
  const patchSkill = (id: string, values: Partial<CocSkill>) =>
    onChange({ ...data, skills: data.skills.map(skill => skill.id === id ? { ...skill, ...values } : skill) });
  const patchWeapon = (id: string, values: Partial<CocWeapon>) =>
    onChange({ ...data, weapons: data.weapons.map(weapon => weapon.id === id ? { ...weapon, ...values } : weapon) });
  const patchItems = (key: 'equipment' | 'possessions', id: string, values: Partial<CocInventoryItem>) =>
    onChange({ ...data, [key]: data[key].map(item => item.id === id ? { ...item, ...values } : item) });

  return <div style={{ display: 'grid', gap: 10 }}>
    <details className="panel" open style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>탐사자 정보</summary>
      <div style={grid}>
        <CocField label="플레이어" value={data.investigator.player} onChange={v => patch('investigator', { player: v })} />
        <CocField label="직업" value={data.investigator.occupation} onChange={v => patch('investigator', { occupation: v })} />
        <CocField label="나이" value={data.investigator.age} onChange={v => patch('investigator', { age: v })} />
        <CocField label="성별" value={data.investigator.gender} onChange={v => patch('investigator', { gender: v })} />
        <CocField label="거주지" value={data.investigator.residence} onChange={v => patch('investigator', { residence: v })} />
        <CocField label="출생지" value={data.investigator.birthplace} onChange={v => patch('investigator', { birthplace: v })} />
        <CocField label="한마디 / 비고" value={data.investigator.catchphrase} onChange={v => patch('investigator', { catchphrase: v })} />
      </div>
    </details>

    <details className="panel" open style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>특성치와 파생 수치</summary>
      <div style={grid}>
        {([['str', '근력'], ['con', '건강'], ['siz', '크기'], ['dex', '민첩'], ['app', '외모'], ['int', '지능'], ['pow', '정신력'], ['edu', '교육']] as const).map(([key, label]) =>
          <CocField key={key} label={label} value={data.characteristics[key]} onChange={v => patch('characteristics', { [key]: v })} />)}
      </div>
      <div style={{ ...grid, marginTop: 12 }}>
        <CocField label="체력 현재" value={data.derived.hp} onChange={v => patch('derived', { hp: v })} />
        <CocField label="체력 최대" value={data.derived.hpMax} onChange={v => patch('derived', { hpMax: v })} />
        <CocField label="마력 현재" value={data.derived.mp} onChange={v => patch('derived', { mp: v })} />
        <CocField label="마력 최대" value={data.derived.mpMax} onChange={v => patch('derived', { mpMax: v })} />
        <CocField label="이성 현재" value={data.derived.sanity} onChange={v => patch('derived', { sanity: v })} />
        <CocField label="이성 최대" value={data.derived.sanityMax} onChange={v => patch('derived', { sanityMax: v })} />
        <CocField label="행운" value={data.derived.luck} onChange={v => patch('derived', { luck: v })} />
        <CocField label="피해 보너스" value={data.derived.damageBonus} onChange={v => patch('derived', { damageBonus: v })} />
        <CocField label="체구" value={data.derived.build} onChange={v => patch('derived', { build: v })} />
        <CocField label="이동력" value={data.derived.moveRate} onChange={v => patch('derived', { moveRate: v })} />
      </div>
      <div style={{ ...grid, marginTop: 12 }}>
        <CocField label="이성 손실 상태 (적응)" value={data.mental.sanityAdaptation} onChange={v => patch('mental', { sanityAdaptation: v })} />
        <CocField label="광기의 발작" value={data.mental.bout} onChange={v => patch('mental', { bout: v })} />
        <CocField label="현재 정신 상태" value={data.mental.currentState} onChange={v => patch('mental', { currentState: v })} />
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        <label><input type="checkbox" checked={data.mental.temporaryInsanity} onChange={e => patch('mental', { temporaryInsanity: e.target.checked })} /> 일시적 광기</label>
        <label><input type="checkbox" checked={data.mental.longTermInsanity} onChange={e => patch('mental', { longTermInsanity: e.target.checked })} /> 장기적 광기</label>
      </div>
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>기능 목록 ({data.skills.length})</summary>
      <div style={{ display: 'grid', gap: 5 }}>
        {data.skills.map(skill => <div key={skill.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(115px, 1fr) 72px 72px auto auto', gap: 6, alignItems: 'center' }}>
          <KInput value={skill.name} aria-label="기능 이름" onChange={e => patchSkill(skill.id, { name: e.target.value })} />
          <KInput value={skill.base} aria-label="기본값" placeholder="기본" onChange={e => patchSkill(skill.id, { base: e.target.value })} />
          <KInput value={skill.current} aria-label="현재값" placeholder="현재" onChange={e => patchSkill(skill.id, { current: e.target.value })} />
          <label style={{ whiteSpace: 'nowrap', fontSize: 11 }}><input type="checkbox" checked={skill.growthChecked} onChange={e => patchSkill(skill.id, { growthChecked: e.target.checked })} /> 성장</label>
          <button className="btn btn-ghost" aria-label={`${skill.name} 삭제`} onClick={() => onChange({ ...data, skills: data.skills.filter(item => item.id !== skill.id) })}>✕</button>
        </div>)}
      </div>
      <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => onChange({ ...data, skills: [...data.skills, { id: newId(), name: '', base: '', current: '', growthChecked: false }] })}>＋ 기능 추가</button>
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>백스토리</summary>
      <RichEditor value={data.backstoryHtml} onChange={backstoryHtml => onChange({ ...data, backstoryHtml })} placeholder="겉보기, 성격, 관계, 사상/신념, 공포증과 집착증, 이상한 경험 등을 작성하세요" />
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>전투, 장비와 소지품</summary>
      <div style={{ display: 'grid', gap: 8 }}>
        {data.weapons.map(weapon => <div key={weapon.id} style={{ ...grid, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
          <CocField label="무기" value={weapon.name} onChange={v => patchWeapon(weapon.id, { name: v })} />
          <CocField label="기능" value={weapon.skill} onChange={v => patchWeapon(weapon.id, { skill: v })} />
          <CocField label="피해" value={weapon.damage} onChange={v => patchWeapon(weapon.id, { damage: v })} />
          <CocField label="사거리" value={weapon.range} onChange={v => patchWeapon(weapon.id, { range: v })} />
          <CocField label="공격 횟수" value={weapon.attacks} onChange={v => patchWeapon(weapon.id, { attacks: v })} />
          <CocField label="탄약" value={weapon.ammo} onChange={v => patchWeapon(weapon.id, { ammo: v })} />
          <CocField label="고장" value={weapon.malfunction} onChange={v => patchWeapon(weapon.id, { malfunction: v })} />
          <CocField label="이미지 URL" value={weapon.image} onChange={v => patchWeapon(weapon.id, { image: v })} />
          <button className="btn btn-ghost" onClick={() => onChange({ ...data, weapons: data.weapons.filter(item => item.id !== weapon.id) })}>무기 삭제</button>
        </div>)}
      </div>
      <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => onChange({ ...data, weapons: [...data.weapons, { id: newId(), name: '', skill: '', damage: '', range: '', attacks: '', ammo: '', malfunction: '', image: '' }] })}>＋ 무기 추가</button>
      {(['equipment', 'possessions'] as const).map(key => <div key={key} style={{ marginTop: 12 }}>
        <label className="k-label">{key === 'equipment' ? '장비' : '소지품'}</label>
        {data[key].map(item => <div key={item.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <KInput placeholder="이름" value={item.name} onChange={e => patchItems(key, item.id, { name: e.target.value })} />
          <KInput placeholder="설명" value={item.description} onChange={e => patchItems(key, item.id, { description: e.target.value })} />
          <button className="btn btn-ghost" onClick={() => onChange({ ...data, [key]: data[key].filter(row => row.id !== item.id) })}>✕</button>
        </div>)}
        <button className="btn btn-ghost" onClick={() => onChange({ ...data, [key]: [...data[key], { id: newId(), name: '', description: '' }] })}>＋ 추가</button>
      </div>)}
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>현금과 자산</summary>
      <div style={grid}>
        <CocField label="소비 수준" value={data.finance.spendingLevel} onChange={v => patch('finance', { spendingLevel: v })} />
        <CocField label="현금" value={data.finance.cash} onChange={v => patch('finance', { cash: v })} />
        <CocField label="자산" value={data.finance.assets} onChange={v => patch('finance', { assets: v })} />
      </div>
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>다녀온 시나리오 ({data.scenarioLogs.length})</summary>
      {data.scenarioLogs.map(log => <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 2fr auto', gap: 6, marginBottom: 6 }}>
        <KInput placeholder="시나리오 제목" value={log.title} onChange={e => onChange({ ...data, scenarioLogs: data.scenarioLogs.map(item => item.id === log.id ? { ...item, title: e.target.value } : item) })} />
        <KInput type="date" value={log.date} onChange={e => onChange({ ...data, scenarioLogs: data.scenarioLogs.map(item => item.id === log.id ? { ...item, date: e.target.value } : item) })} />
        <KInput placeholder="한마디 또는 비고" value={log.note} onChange={e => onChange({ ...data, scenarioLogs: data.scenarioLogs.map(item => item.id === log.id ? { ...item, note: e.target.value } : item) })} />
        <button className="btn btn-ghost" onClick={() => onChange({ ...data, scenarioLogs: data.scenarioLogs.filter(item => item.id !== log.id) })}>✕</button>
      </div>)}
      <button className="btn btn-ghost" onClick={() => onChange({ ...data, scenarioLogs: [...data.scenarioLogs, { id: newId(), title: '', date: '', note: '' }] })}>＋ 시나리오 기록</button>
    </details>
  </div>;
}

export function TCharForm({ editId }: { editId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const del = useConfirmDelete();
  const [tchars, setTchars, loaded] = useLocalList<TrpgChar>('ohome.tchars.v1', TCHAR_SEED);
  const orig = editId ? tchars.find(c => c.id === editId) : undefined;

  const [name, setName] = useState(orig?.name ?? '');
  const [scenario, setScenario] = useState(orig?.scenario ?? '');
  const [rule, setRule] = useState(orig?.rule ?? '');
  const [sheetType, setSheetType] = useState<'general' | 'coc'>(orig?.sheetType ?? 'general');
  const [coc, setCoc] = useState<CocInvestigatorSheet>(() => emptyCocSheet(orig?.coc));
  const [role, setRole] = useState(orig?.role ?? '');
  const [desc, setDesc] = useState(orig?.desc ?? '');
  const [imgMode, setImgMode] = useState<'stamp' | 'standing'>(orig?.imgMode ?? 'stamp');
  const [sharedCrop, setSharedCrop] = useState<CropValue | undefined>(orig?.crop);
  const [stdDims, setStdDims] = useState<{ w: number; h: number } | null>(
    orig?.stdW && orig?.stdH ? { w: orig.stdW, h: orig.stdH } : null);
  const [faces, setFaces] = useState<FaceDraft[]>(() =>
    (orig?.faces ?? []).map(f => ({ id: f.id, label: f.label ?? '', imgId: f.imgId, crop: f.crop, ph: f.ph })));
  const [cropFor, setCropFor] = useState<FaceDraft | null>(null);      // 단일 인장 — 개별 크롭
  const [viewFor, setViewFor] = useState<FaceDraft | null>(null);      // 썸네일 클릭 — 원본 전체 보기 (v1.9)
  const [sharedCropOpen, setSharedCropOpen] = useState(false);         // 스탠딩 — 공유 크롭
  const fileRef = useRef<HTMLInputElement>(null);

  // 수정 모드 — 저장본은 mount 후에 로드되므로, 로드가 끝나면 폼을 한 번 채움
  // (첫 렌더의 useState 초기값 시점엔 orig가 아직 시드뿐이라 직접 등록한 캐릭터는 비어 있던 버그 수정)
  const hydrated = useRef(false);
  useEffect(() => {
    if (!editId || !loaded || hydrated.current) return;
    const o = tchars.find(c => c.id === editId);
    if (!o) return;
    hydrated.current = true;
    setName(o.name); setScenario(o.scenario ?? ''); setRule(o.rule ?? '');
    setSheetType(o.sheetType ?? 'general'); setCoc(emptyCocSheet(o.coc)); setRole(o.role ?? '');
    setDesc(o.desc ?? '');
    setImgMode(o.imgMode ?? 'stamp');
    setSharedCrop(o.crop);
    setStdDims(o.stdW && o.stdH ? { w: o.stdW, h: o.stdH } : null);
    setFaces((o.faces ?? []).map(f => ({ id: f.id, label: f.label ?? '', imgId: f.imgId, crop: f.crop, ph: f.ph })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, loaded, tchars]);

  // 스탠딩 기준 크기 — 첫 이미지에서 확정 (기존 저장분은 저장된 기준값 사용)
  const resolveBase = async (): Promise<{ w: number; h: number } | null> => {
    if (stdDims) return stdDims;
    const first = faces.find(f => f.url || f.imgId);
    if (!first) return null;
    const src = first.url ?? (first.imgId ? URL.createObjectURL((await getBlob(first.imgId))!) : null);
    if (!src) return null;
    const d = await imgDims(src);
    setStdDims(d);
    return d;
  };

  const addFaces = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const picked = Array.from(list); // 라이브 FileList 즉시 복사
    const items: FaceDraft[] = [];
    let base = imgMode === 'standing' ? await resolveBase() : null;
    for (const f of picked) {
      const url = URL.createObjectURL(f);
      const d = await imgDims(url).catch(() => null);
      if (!d) { toast(`이미지를 읽을 수 없습니다: ${f.name}`); continue; }
      if (imgMode === 'standing') {
        // 스탠딩 인장 — 모든 파일의 가로세로 크기가 같아야 썸네일 위치를 공유할 수 있음 (v1.9)
        if (!base) { base = d; setStdDims(d); }
        else if (d.w !== base.w || d.h !== base.h) {
          toast(`크기가 달라 제외되었습니다: ${f.name} (기준 ${base.w}×${base.h})`);
          URL.revokeObjectURL(url);
          continue;
        }
      }
      items.push({ id: newId(), label: '', file: f, url, w: d.w, h: d.h });
    }
    if (items.length === 0) return;
    setFaces(fs => [...fs, ...items]);
    // 첫 이미지면 바로 썸네일 위치 잡기
    if (faces.length === 0) {
      if (imgMode === 'standing') setSharedCropOpen(true);
      else setCropFor(items[0]);
    }
  };

  const save = async () => {
    if (!name.trim()) { toast('이름을 입력해 주세요'); return; }
    const outFaces: TrpgFace[] = [];
    for (const f of faces) {
      outFaces.push({
        id: f.id, label: f.label.trim() || undefined,
        imgId: f.file ? await putBlob(f.file) : f.imgId,
        crop: imgMode === 'stamp' ? f.crop : undefined,
        ph: f.ph,
      });
    }
    if (outFaces.length === 0) outFaces.push({ id: newId(), label: '기본', ph: 'cool' });
    const patch = {
      name: name.trim(), scenario: scenario.trim(), rule: rule.trim(), role: role.trim(),
      sheetType, coc: sheetType === 'coc' || orig?.coc ? coc : undefined,
      desc, faces: outFaces, imgMode,
      crop: imgMode === 'standing' ? sharedCrop : undefined,
      stdW: imgMode === 'standing' ? stdDims?.w : undefined,
      stdH: imgMode === 'standing' ? stdDims?.h : undefined,
    };
    if (orig) {
      setTchars(tchars.map(c => c.id === orig.id ? { ...c, ...patch } : c));
      toast('저장되었습니다');
    } else {
      setTchars([{ id: newId(), ph: 'cool', ...patch }, ...tchars]);
      toast('캐릭터가 등록되었습니다');
    }
    router.push('/tchars');
  };

  const firstFace = faces.find(f => f.url || f.imgId);

  return (
    <div className="panel" style={{ maxWidth: 620, margin: '0 auto', padding: 26, display: 'grid', gap: 13 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label className="k-label" style={{ marginBottom: 5 }}>Name</label>
          <KInput value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ width: 130 }}>
          <label className="k-label" style={{ marginBottom: 5 }}>Role</label>
          {/* PL · GMPC · HO1 등 자유 표기 */}
          <KInput value={role} onChange={e => setRole(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label className="k-label" style={{ marginBottom: 5 }}>Scenario</label>
          <KInput value={scenario} onChange={e => setScenario(e.target.value)} />
        </div>
        <div style={{ width: 160 }}>
          <label className="k-label" style={{ marginBottom: 5 }}>Rule</label>
          <KInput value={rule} onChange={e => setRule(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="k-label" style={{ marginBottom: 7 }}>캐릭터 시트</label>
        <div className="mini-seg">
          <button className={sheetType === 'general' ? 'on' : ''} onClick={() => setSheetType('general')}>일반</button>
          <button className={sheetType === 'coc' ? 'on' : ''} onClick={() => setSheetType('coc')}>CoC</button>
        </div>
      </div>
      {sheetType === 'coc' && <CocSheetEditor data={coc} onChange={setCoc} />}

      {/* 이미지 방식 + 표정 목록 */}
      <div>
        <label className="k-label" style={{ marginBottom: 7 }}>이미지 방식</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="mini-seg">
            <button className={imgMode === 'stamp' ? 'on' : ''} onClick={() => setImgMode('stamp')}>단일 인장</button>
            <button className={imgMode === 'standing' ? 'on' : ''} onClick={() => setImgMode('standing')}>스탠딩 인장</button>
          </div>
          {imgMode === 'standing' && (
            <>
              {stdDims && <span style={{ fontSize: 11, color: 'var(--faint)' }}>기준 {stdDims.w}×{stdDims.h}</span>}
              {firstFace && (
                <button className="btn btn-ghost" style={{ padding: '5px 11px', fontSize: 11 }}
                  onClick={() => setSharedCropOpen(true)}>✂ 썸네일 위치 (전 표정 공유)</button>
              )}
            </>
          )}
        </div>
        <p className="hint" style={{ margin: '6px 0 8px' }}>
          {imgMode === 'standing'
            ? '스탠딩 인장은 모든 표정 파일의 가로세로 크기가 같아야 합니다 — 썸네일 위치를 한 번만 잡아 전 표정에 적용'
            : '단일 인장은 표정마다 1:1 썸네일 위치를 따로 지정합니다'}
        </p>
        <div className="upzone" style={{ marginBottom: 8 }} onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); addFaces(e.dataTransfer.files); }}>
          <b style={{ display: 'block', marginBottom: 3 }}>
            {faces.length === 0 ? '표정 이미지를 끌어다 놓거나 클릭' : '＋ ADD FACE'}
          </b>
          표정별로 여러 장 등록 · ⠿ 드래그로 순서 · 첫 장이 대표
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => { addFaces(e.target.files); e.target.value = ''; }} />
        <DragList items={faces} keyOf={f => f.id} onReorder={setFaces}
          render={(f, i) => (
            <div className="upfile-row" style={{ width: '100%' }}>
              <span className="drag-h">⠿</span>
              <span className="mw-no">{i + 1}</span>
              <div className="pv" style={{ width: 44, height: 44, borderRadius: 9, overflow: 'hidden', position: 'relative', flexShrink: 0, cursor: 'var(--cur-pointer,pointer)' }}
                onClick={() => setViewFor(f)}>
                <FaceThumb f={f} crop={imgMode === 'standing' ? sharedCrop : f.crop} />
              </div>
              <KInput placeholder="표정 이름 (선택)" value={f.label}
                onChange={e => setFaces(l => l.map(x => x.id === f.id ? { ...x, label: e.target.value } : x))}
                style={{ flex: 1 }} />
              {imgMode === 'stamp' && (
                <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 10, whiteSpace: 'nowrap' }}
                  onClick={() => setCropFor(f)}>✂ 위치</button>
              )}
              <span className="fx" onClick={() =>
                del.ask('이 표정을 삭제하시겠습니까?', () => setFaces(l => l.filter(x => x.id !== f.id)))}>✕</span>
            </div>
          )} />
      </div>

      <div>
        <label className="k-label" style={{ marginBottom: 5 }}>간단한 설명</label>
        <RichEditor value={desc} onChange={setDesc} placeholder="캐릭터 소개를 작성하세요 (선택)" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button className="btn btn-ghost" onClick={() => router.push('/tchars')}>CANCEL</button>
        <button className="btn btn-dark" onClick={save}>{orig ? 'SAVE' : 'ADD'}</button>
      </div>

      {/* 단일 인장 — 표정별 개별 크롭 */}
      {cropFor && imgMode === 'stamp' && (
        <FaceCropModal f={faces.find(x => x.id === cropFor.id) ?? cropFor}
          initial={faces.find(x => x.id === cropFor.id)?.crop}
          onClose={() => setCropFor(null)}
          onApply={c => {
            setFaces(l => l.map(x => x.id === cropFor.id ? { ...x, crop: c } : x));
            setCropFor(null);
          }} />
      )}
      {/* 스탠딩 인장 — 공유 크롭 (첫 이미지 기준, 전 표정 동일 적용) */}
      {sharedCropOpen && firstFace && (
        <FaceCropModal f={firstFace} initial={sharedCrop}
          onClose={() => setSharedCropOpen(false)}
          onApply={c => { setSharedCrop(c); setSharedCropOpen(false); }} />
      )}
      {/* 썸네일 클릭 — 원본 전체 보기 (v1.9) */}
      {viewFor && <FaceViewModal f={faces.find(x => x.id === viewFor.id) ?? viewFor} onClose={() => setViewFor(null)} />}
      {del.element}
    </div>
  );
}

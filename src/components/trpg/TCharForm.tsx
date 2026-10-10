'use client';
// TRPG 캐릭터 등록/수정 폼 (v1.9) — 페이지형.
// 이미지 방식: 단일 인장(표정마다 개별 1:1 크롭) / 스탠딩 인장(모든 파일의 가로세로 크기 동일 강제 —
// 썸네일 크롭 위치를 한 번만 잡아 전 표정에 공유). 표정: 라벨 · ⠿ 순서 · 첫 장 = 대표
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocalList, newId } from '@/lib/postStore';
import { CocInvestigatorSheet, CocInventoryItem, CocSkill, CocWeapon, Dx3rdAbilityKey, Dx3rdArmor, Dx3rdCharacterSheet, Dx3rdCombo, Dx3rdEffect, Dx3rdEffectCategory, Dx3rdItem, Dx3rdLois, Dx3rdMemory, Dx3rdSeedData, Dx3rdSkill, Dx3rdVehicle, Dx3rdWeapon, InsaneAbility, InsaneCharacterSheet, InsaneRelationship, InsaneSpecialty, MagiaAnchor, MagiaObligation, MagiaSpell, MagicaLogiaCharacterSheet, TrpgChar, TrpgFace, TrpgScenarioLog, COC7_SKILL_DEFAULTS, INSANE_SPECIALTY_GROUPS, MAGICALOGIA_SPECIALTY_GROUPS, TCHAR_SEED } from '@/lib/tcharStore';
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

  </div>;
}

const allInsaneSpecialties = INSANE_SPECIALTY_GROUPS.flatMap(group =>
  group.skills.map((name, index) => ({ id: `${group.id}-${index}`, groupId: group.id, groupName: group.name, name, index })));

const emptyInsaneSheet = (sheet?: InsaneCharacterSheet): InsaneCharacterSheet => ({
  player: '', age: '', gender: '', occupation: '', achievement: '', referenceUrl: '', catchphrase: '',
  curiosityGroupId: 'violence', fearSpecialtyId: '',
  ...sheet,
  life: sheet?.life ?? '',
  lifeMax: sheet?.lifeMax ?? '',
  sanity: sheet?.sanity ?? '',
  sanityMax: sheet?.sanityMax ?? '',
  specialties: sheet?.specialties ?? allInsaneSpecialties.map(skill => ({ id: skill.id, selected: false })),
  abilities: sheet?.abilities ?? [],
  relationships: sheet?.relationships ?? [],
});

function insaneTarget(sheet: InsaneCharacterSheet, specialtyId: string) {
  const target = allInsaneSpecialties.find(skill => skill.id === specialtyId);
  const selected = allInsaneSpecialties.filter(skill =>
    sheet.specialties.some(entry => entry.id === skill.id && entry.selected));
  if (!target || selected.length === 0) return '';
  const targetGroup = INSANE_SPECIALTY_GROUPS.findIndex(group => group.id === target.groupId);
  const distance = Math.min(...selected.map(skill =>
    Math.abs(targetGroup - INSANE_SPECIALTY_GROUPS.findIndex(group => group.id === skill.groupId))
      + Math.abs(target.index - skill.index)));
  return String(5 + distance);
}

function InsaneSheetEditor({ data, onChange }: {
  data: InsaneCharacterSheet; onChange: (next: InsaneCharacterSheet) => void;
}) {
  const patch = <K extends keyof InsaneCharacterSheet>(key: K, value: InsaneCharacterSheet[K]) =>
    onChange({ ...data, [key]: value });
  const patchSpecialty = (id: string, values: Partial<InsaneSpecialty>) =>
    patch('specialties', data.specialties.map(skill => skill.id === id ? { ...skill, ...values } : skill));
  const patchAbility = (id: string, values: Partial<InsaneAbility>) =>
    patch('abilities', data.abilities.map(ability => ability.id === id ? { ...ability, ...values } : ability));
  const patchRelationship = (id: string, values: Partial<InsaneRelationship>) =>
    patch('relationships', data.relationships.map(person => person.id === id ? { ...person, ...values } : person));
  const fieldGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 9 };
  const selectStyle: React.CSSProperties = { width: '100%', minHeight: 34, padding: '6px 9px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel-solid)', color: 'var(--ink)' };

  return <div style={{ display: 'grid', gap: 10 }}>
    <details className="panel" open style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>인세인 캐릭터 정보</summary>
      <div style={fieldGrid}>
        <CocField label="플레이어" value={data.player} onChange={player => patch('player', player)} />
        <CocField label="나이" value={data.age} onChange={age => patch('age', age)} />
        <CocField label="성별" value={data.gender} onChange={gender => patch('gender', gender)} />
        <CocField label="직업" value={data.occupation} onChange={occupation => patch('occupation', occupation)} />
        <CocField label="공적점" value={data.achievement} onChange={achievement => patch('achievement', achievement)} />
        <CocField label="참고 URL" value={data.referenceUrl} onChange={referenceUrl => patch('referenceUrl', referenceUrl)} />
        <CocField label="한마디" value={data.catchphrase} onChange={catchphrase => patch('catchphrase', catchphrase)} />
      </div>
      <div style={{ ...fieldGrid, marginTop: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="k-label" style={{ margin: 0 }}>호기심 분야</span>
          <select style={selectStyle} value={data.curiosityGroupId} onChange={e => patch('curiosityGroupId', e.target.value)}>
            {INSANE_SPECIALTY_GROUPS.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="k-label" style={{ margin: 0 }}>공포심 특기</span>
          <select style={selectStyle} value={data.fearSpecialtyId} onChange={e => patch('fearSpecialtyId', e.target.value)}>
            <option value="">선택</option>
            {INSANE_SPECIALTY_GROUPS.map(group => <optgroup key={group.id} label={group.name}>
              {group.skills.map((name, index) => {
                const id = `${group.id}-${index}`;
                return <option key={id} value={id}>{name}</option>;
              })}
            </optgroup>)}
          </select>
        </label>
      </div>
      <div style={{ ...fieldGrid, marginTop: 12 }}>
        <CocField label="생명력 현재" value={data.life} onChange={life => patch('life', life)} />
        <CocField label="생명력 최대" value={data.lifeMax} onChange={lifeMax => patch('lifeMax', lifeMax)} />
        <CocField label="이성치 현재" value={data.sanity} onChange={sanity => patch('sanity', sanity)} />
        <CocField label="이성치 최대" value={data.sanityMax} onChange={sanityMax => patch('sanityMax', sanityMax)} />
      </div>
    </details>

    <details className="panel" open style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>특기 ({data.specialties.filter(skill => skill.selected).length} 선택)</summary>
      <p className="hint" style={{ margin: '0 0 10px' }}>선택한 특기 중 가장 가까운 특기와의 표상 거리를 기준으로 목표치를 계산합니다. 필요하면 개별 목표치를 수정할 수 있습니다.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10 }}>
        {INSANE_SPECIALTY_GROUPS.map(group => <section key={group.id} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 9 }}>
          <b style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>{group.name}</b>
          {group.skills.map((name, index) => {
            const id = `${group.id}-${index}`;
            const skill = data.specialties.find(item => item.id === id) ?? { id, selected: false };
            const calculated = insaneTarget(data, id);
            return <div key={id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 52px', gap: 5, alignItems: 'center', minHeight: 30 }}>
              <label style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 0, fontSize: 11.5 }}>
                <input type="checkbox" checked={skill.selected} onChange={e => patchSpecialty(id, { selected: e.target.checked })} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
              </label>
              <KInput aria-label={`${name} 판정 기준치`} title={calculated ? `자동 계산 ${calculated}` : '공포심 특기를 선택하세요'} value={skill.targetOverride ?? calculated} placeholder="-" onChange={e => patchSpecialty(id, { targetOverride: e.target.value || undefined })} style={{ padding: '4px 5px', textAlign: 'center', fontSize: 11 }} />
            </div>;
          })}
        </section>)}
      </div>
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>어빌리티 ({data.abilities.length})</summary>
      {data.abilities.map(ability => <div key={ability.id} style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 110px 1fr', marginBottom: 8 }}>
        <KInput placeholder="어빌리티명" value={ability.name} onChange={e => patchAbility(ability.id, { name: e.target.value })} />
        <select style={selectStyle} value={ability.type} onChange={e => patchAbility(ability.id, { type: e.target.value })}>
          <option>공격</option><option>서포트</option><option>기타</option>
        </select>
        <select style={selectStyle} value={ability.specialtyId} onChange={e => patchAbility(ability.id, { specialtyId: e.target.value })}>
          <option value="">지정 특기 없음</option>
          {INSANE_SPECIALTY_GROUPS.map(group => <optgroup key={group.id} label={group.name}>
            {group.skills.map((name, index) => <option key={`${group.id}-${index}`} value={`${group.id}-${index}`}>{name}</option>)}
          </optgroup>)}
        </select>
        <textarea aria-label="어빌리티 효과" placeholder="효과" value={ability.effect} onChange={e => patchAbility(ability.id, { effect: e.target.value })} style={{ gridColumn: '1 / -2', minHeight: 54, padding: 8, resize: 'vertical' }} />
        <button className="btn btn-ghost" onClick={() => patch('abilities', data.abilities.filter(item => item.id !== ability.id))}>삭제</button>
      </div>)}
      <button className="btn btn-ghost" onClick={() => patch('abilities', [...data.abilities, { id: newId(), name: '', type: '공격', specialtyId: '', effect: '' }])}>＋ 어빌리티 추가</button>
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>인물 관계 ({data.relationships.length})</summary>
      {data.relationships.map(person => <div key={person.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
        <KInput placeholder="이름" value={person.name} onChange={e => patchRelationship(person.id, { name: e.target.value })} />
        <KInput placeholder="거처" value={person.residence} onChange={e => patchRelationship(person.id, { residence: e.target.value })} />
        <KInput placeholder="감정" value={person.emotion} onChange={e => patchRelationship(person.id, { emotion: e.target.value })} />
        <button className="btn btn-ghost" onClick={() => patch('relationships', data.relationships.filter(item => item.id !== person.id))}>✕</button>
      </div>)}
      <button className="btn btn-ghost" onClick={() => patch('relationships', [...data.relationships, { id: newId(), name: '', residence: '', emotion: '' }])}>＋ 인물 추가</button>
    </details>
  </div>;
}

const allMagiaSpecialties = MAGICALOGIA_SPECIALTY_GROUPS.flatMap(group =>
  group.skills.map((name, index) => ({ id: `${group.id}-${index}`, groupId: group.id, name, index })));

const emptyMagicaLogiaSheet = (sheet?: MagicaLogiaCharacterSheet): MagicaLogiaCharacterSheet => ({
  magicName: '', practitioner: '', rank: '', gender: '', age: '', codeName: '', socialStatus: '',
  attack: '', defense: '', root: '', trueForm: '', trueFormEffect: '', mana: '', achievement: '',
  magia: '', temporaryMana: '', credo: '', career: '', institution: '', introduction: '',
  condition: '', specialtyNotes: '', soulSpecialtyId: '',
  grimoireSettings: '', domainSettings: '', statusAilments: '',
  ...sheet,
  specialties: sheet?.specialties ?? allMagiaSpecialties.map(skill => ({ id: skill.id, selected: false })),
  anchors: sheet?.anchors ?? [],
  obligations: sheet?.obligations ?? [],
  spells: sheet?.spells ?? [],
  sessionLogs: sheet?.sessionLogs ?? [],
});

function magiaTarget(sheet: MagicaLogiaCharacterSheet, specialtyId: string) {
  const origin = allMagiaSpecialties.find(skill => skill.id === sheet.soulSpecialtyId);
  const target = allMagiaSpecialties.find(skill => skill.id === specialtyId);
  if (!origin || !target) return '';
  const groupDistance = Math.abs(MAGICALOGIA_SPECIALTY_GROUPS.findIndex(group => group.id === origin.groupId)
    - MAGICALOGIA_SPECIALTY_GROUPS.findIndex(group => group.id === target.groupId));
  return String(6 + groupDistance + Math.abs(origin.index - target.index));
}

const DX3RD_ABILITY_GROUPS: { id: Dx3rdAbilityKey; label: string; skills: string[] }[] = [
  { id: 'body', label: '육체', skills: ['백병', '회피', '운전:'] },
  { id: 'sense', label: '감각', skills: ['사격', '지각', '예술:'] },
  { id: 'mind', label: '정신', skills: ['RC', '의지', '지식:'] },
  { id: 'social', label: '사회', skills: ['교섭', '조달', '정보:'] },
];

const DX3RD_EFFECT_CATEGORIES: { id: Dx3rdEffectCategory; label: string }[] = [
  { id: 'effect', label: '이펙트' },
  { id: 'easy', label: '이지 이펙트' },
  { id: 'nonConsumptive', label: '비소모 이펙트' },
  { id: 'eLois', label: 'E로이스' },
  { id: 'psionic', label: '사이오닉' },
];

const newDxEffect = (): Dx3rdEffect => ({
  id: newId(), name: '', level: '', timing: '', skill: '', difficulty: '', target: '', range: '',
  cost: '', restriction: '', description: '', active: false,
});

const newDxWeapon = (): Dx3rdWeapon => ({
  id: newId(), name: '', category: '', skill: '', range: '', accuracy: '', attack: '', guard: '', stock: '', exp: '', description: '',
});

const newDxArmor = (): Dx3rdArmor => ({
  id: newId(), name: '', category: '', dodge: '', action: '', armor: '', stock: '', exp: '', description: '',
});

const newDxVehicle = (): Dx3rdVehicle => ({
  id: newId(), name: '', category: '', skill: '', attack: '', action: '', armor: '', movement: '', stock: '', exp: '', description: '',
});

const newDxItem = (): Dx3rdItem => ({
  id: newId(), name: '', category: '', skill: '', stock: '', exp: '', description: '',
});

const emptyDx3rdSheet = (sheet?: Dx3rdCharacterSheet): Dx3rdCharacterSheet => ({
  codename: '', codenameRuby: '', characterName: '', characterNameRuby: '', age: '', gender: '', birthday: '',
  height: '', cover: '', works: '', birth: '', experience: '', reunion: '', catchphrase: '', characterSetting: '',
  breed: '',
  hp: '', hpMaxOverride: '', erosion: '', bonusOverride: '', initiativeOverride: '', stockPoints: '', propertyPoints: '',
  experienceTotal: '', experienceSpent: '', experienceRemaining: '',
  ...sheet,
  syndromes: sheet?.syndromes ?? ['', '', ''],
  abilities: { body: '0', sense: '0', mind: '0', social: '0', ...sheet?.abilities },
  skills: sheet?.skills ?? DX3RD_ABILITY_GROUPS.flatMap(group => group.skills.map(name => ({ id: newId(), group: group.id, name, value: '0' }))),
  effects: {
    effect: [], easy: [], nonConsumptive: [], eLois: [], psionic: [], ...sheet?.effects,
  },
  lois: sheet?.lois ?? [], memories: sheet?.memories ?? [],
  weapons: sheet?.weapons ?? [], armors: sheet?.armors ?? [], vehicles: sheet?.vehicles ?? [],
  items: sheet?.items ?? [], combos: sheet?.combos ?? [],
});

const dx3rdMaxHp = (sheet: Dx3rdCharacterSheet) =>
  (Number(sheet.abilities.body) || 0) * 2 + (Number(sheet.abilities.mind) || 0) + 20;

const dx3rdInitiative = (sheet: Dx3rdCharacterSheet) =>
  (Number(sheet.abilities.sense) || 0) * 2 + (Number(sheet.abilities.mind) || 0);

const dx3rdBonus = (erosion: string) => {
  const value = Number(erosion) || 0;
  if (value < 60) return 0;
  if (value < 80) return 1;
  if (value < 100) return 2;
  if (value < 130) return 3;
  if (value < 160) return 4;
  if (value < 190) return 5;
  if (value < 220) return 6;
  if (value < 260) return 7;
  if (value < 300) return 8;
  return 9;
};

interface Dx3rdColumn<T extends { id: string }> {
  key: keyof T & string;
  label: string;
  checkbox?: boolean;
}

function Dx3rdRows<T extends { id: string }>({ items, columns, onChange, create, addLabel }: {
  items: T[];
  columns: Dx3rdColumn<T>[];
  onChange: (items: T[]) => void;
  create: () => T;
  addLabel: string;
}) {
  const update = (id: string, key: Dx3rdColumn<T>['key'], value: string | boolean) =>
    onChange(items.map(item => item.id === id ? { ...item, [key]: value } as T : item));
  return <div>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: Math.max(500, columns.length * 125), borderCollapse: 'collapse', fontSize: 11 }}>
        <thead><tr>{columns.map(column => <th key={column.key} style={{ textAlign: 'left', padding: '4px 5px', color: 'var(--faint)', fontWeight: 500 }}>{column.label}</th>)}<th /></tr></thead>
        <tbody>{items.map(item => <tr key={item.id}>
          {columns.map(column => <td key={column.key} style={{ padding: 3, verticalAlign: 'top' }}>
            {column.checkbox
              ? <input type="checkbox" aria-label={column.label} checked={Boolean(item[column.key])} onChange={e => update(item.id, column.key, e.target.checked)} />
              : <KInput aria-label={column.label} value={String(item[column.key] ?? '')} onChange={e => update(item.id, column.key, e.target.value)} style={{ minWidth: 90, padding: '5px 7px', fontSize: 11 }} />}
          </td>)}
          <td style={{ padding: 3 }}><button className="btn btn-ghost" aria-label="행 삭제" onClick={() => onChange(items.filter(row => row.id !== item.id))}>✕</button></td>
        </tr>)}</tbody>
      </table>
    </div>
    <button className="btn btn-ghost" style={{ marginTop: 7 }} onClick={() => onChange([...items, create()])}>＋ {addLabel}</button>
  </div>;
}

function Dx3rdSheetEditor({ data, onChange }: {
  data: Dx3rdCharacterSheet; onChange: (next: Dx3rdCharacterSheet) => void;
}) {
  const patch = <K extends keyof Dx3rdCharacterSheet>(key: K, value: Dx3rdCharacterSheet[K]) =>
    onChange({ ...data, [key]: value });
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 9 };
  const selectStyle: React.CSSProperties = { width: '100%', minHeight: 34, padding: '6px 9px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel-solid)', color: 'var(--ink)' };
  const computedHp = data.hpMaxOverride || String(dx3rdMaxHp(data));
  const computedInitiative = data.initiativeOverride || String(dx3rdInitiative(data));
  const computedBonus = data.bonusOverride || String(dx3rdBonus(data.erosion));

  return <div style={{ display: 'grid', gap: 10 }}>
    <details className="panel" open style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>캐릭터 정보</summary>
      <div style={grid}>
        <CocField label="코드네임" value={data.codename} onChange={value => patch('codename', value)} />
        <CocField label="코드네임 루비" value={data.codenameRuby} onChange={value => patch('codenameRuby', value)} />
        <CocField label="캐릭터명" value={data.characterName} onChange={value => patch('characterName', value)} />
        <CocField label="원어/루비" value={data.characterNameRuby} onChange={value => patch('characterNameRuby', value)} />
        <CocField label="연령" value={data.age} onChange={value => patch('age', value)} />
        <CocField label="성별" value={data.gender} onChange={value => patch('gender', value)} />
        <CocField label="생일" value={data.birthday} onChange={value => patch('birthday', value)} />
        <CocField label="신장" value={data.height} onChange={value => patch('height', value)} />
        <CocField label="커버" value={data.cover} onChange={value => patch('cover', value)} />
        <CocField label="워크스" value={data.works} onChange={value => patch('works', value)} />
        <CocField label="출신" value={data.birth} onChange={value => patch('birth', value)} />
        <CocField label="경험" value={data.experience} onChange={value => patch('experience', value)} />
        <CocField label="리유니온" value={data.reunion} onChange={value => patch('reunion', value)} />
        <CocField label="한마디" value={data.catchphrase} onChange={value => patch('catchphrase', value)} />
      </div>
      <label style={{ display: 'grid', gap: 4, marginTop: 10 }}>
        <span className="k-label" style={{ margin: 0 }}>캐릭터 설정</span>
        <textarea value={data.characterSetting} onChange={e => patch('characterSetting', e.target.value)} style={{ minHeight: 80, padding: 9, resize: 'vertical' }} />
      </label>
      <div style={{ ...grid, marginTop: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}><span className="k-label" style={{ margin: 0 }}>브리드</span>
          <select style={selectStyle} value={data.breed} onChange={e => patch('breed', e.target.value)}>
            <option value="">선택</option><option value="퓨어">퓨어</option><option value="크로스">크로스</option><option value="트라이">트라이</option>
          </select>
        </label>
        {data.syndromes.map((syndrome, index) => <CocField key={index} label={`신드롬 ${index + 1}`} value={syndrome} onChange={value => patch('syndromes', data.syndromes.map((item, i) => i === index ? value : item))} />)}
      </div>
    </details>

    <details className="panel" open style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>능력치 · 기능</summary>
      <div style={grid}>
        {DX3RD_ABILITY_GROUPS.map(group => <CocField key={group.id} label={group.label} value={data.abilities[group.id]}
          onChange={value => patch('abilities', { ...data.abilities, [group.id]: value })} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10, marginTop: 12 }}>
        {DX3RD_ABILITY_GROUPS.map(group => <section key={group.id} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 9 }}>
          <b style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>{group.label} 기능</b>
          {data.skills.filter(skill => skill.group === group.id).map(skill => <div key={skill.id} style={{ display: 'grid', gridTemplateColumns: '1fr 75px auto', gap: 5, marginBottom: 5 }}>
            <KInput value={skill.name} aria-label="기능명" onChange={e => patch('skills', data.skills.map(row => row.id === skill.id ? { ...row, name: e.target.value } : row))} />
            <KInput value={skill.value} aria-label="기능값" onChange={e => patch('skills', data.skills.map(row => row.id === skill.id ? { ...row, value: e.target.value } : row))} />
            <button className="btn btn-ghost" aria-label="기능 삭제" onClick={() => patch('skills', data.skills.filter(row => row.id !== skill.id))}>✕</button>
          </div>)}
          <button className="btn btn-ghost" onClick={() => patch('skills', [...data.skills, { id: newId(), group: group.id, name: '', value: '0' }])}>＋ 기능 추가</button>
        </section>)}
      </div>
    </details>

    <details className="panel" open style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>상태 · 경험점</summary>
      <p className="hint" style={{ margin: '0 0 10px' }}>자동값: HP 최대 = 육체×2 + 정신 + 20, 행동치 = 감각×2 + 정신. BN은 침식률 구간에 따라 계산하며, 수동 보정란을 채우면 자동값 대신 적용합니다.</p>
      <div style={grid}>
        <CocField label="HP 현재" value={data.hp} onChange={value => patch('hp', value)} />
        <label style={{ display: 'grid', gap: 4 }}><span className="k-label" style={{ margin: 0 }}>HP 최대 (자동)</span><KInput value={computedHp} readOnly /></label>
        <CocField label="HP 최대 수동 보정" value={data.hpMaxOverride} onChange={value => patch('hpMaxOverride', value)} />
        <CocField label="침식률" value={data.erosion} onChange={value => patch('erosion', value)} />
        <label style={{ display: 'grid', gap: 4 }}><span className="k-label" style={{ margin: 0 }}>BN (자동)</span><KInput value={computedBonus} readOnly /></label>
        <CocField label="BN 수동 보정" value={data.bonusOverride} onChange={value => patch('bonusOverride', value)} />
        <label style={{ display: 'grid', gap: 4 }}><span className="k-label" style={{ margin: 0 }}>행동치 (자동)</span><KInput value={computedInitiative} readOnly /></label>
        <CocField label="행동치 수동 보정" value={data.initiativeOverride} onChange={value => patch('initiativeOverride', value)} />
        <CocField label="상비화 P" value={data.stockPoints} onChange={value => patch('stockPoints', value)} />
        <CocField label="재산 P" value={data.propertyPoints} onChange={value => patch('propertyPoints', value)} />
        <CocField label="경험점 총합" value={data.experienceTotal} onChange={value => patch('experienceTotal', value)} />
        <CocField label="경험점 사용" value={data.experienceSpent} onChange={value => patch('experienceSpent', value)} />
        <CocField label="경험점 잔여" value={data.experienceRemaining} onChange={value => patch('experienceRemaining', value)} />
      </div>
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>이펙트 · 특수 능력</summary>
      {DX3RD_EFFECT_CATEGORIES.map(category => <section key={category.id} style={{ marginBottom: 14 }}>
        <b style={{ display: 'block', marginBottom: 5, fontSize: 12 }}>{category.label}</b>
        <Dx3rdRows<Dx3rdEffect> items={data.effects[category.id]} onChange={rows => patch('effects', { ...data.effects, [category.id]: rows })} create={newDxEffect} addLabel={`${category.label} 추가`}
          columns={[
            { key: 'active', label: '사용', checkbox: true }, { key: 'name', label: '이펙트명' }, { key: 'level', label: 'LV' },
            { key: 'timing', label: '타이밍' }, { key: 'skill', label: '기능' }, { key: 'difficulty', label: '난이도' },
            { key: 'target', label: '대상' }, { key: 'range', label: '사정' }, { key: 'cost', label: '침식' },
            { key: 'restriction', label: '제한' }, { key: 'description', label: '효과' },
          ]} />
      </section>)}
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>로이스 · 메모리</summary>
      <b style={{ display: 'block', margin: '0 0 5px', fontSize: 12 }}>로이스</b>
      <Dx3rdRows<Dx3rdLois> items={data.lois} onChange={rows => patch('lois', rows)} create={() => ({ id: newId(), category: '', name: '', positive: '', positiveActive: false, negative: '', negativeActive: false, description: '', t: false, s: false })} addLabel="로이스 추가"
        columns={[{ key: 'category', label: '구분' }, { key: 'name', label: '이름' }, { key: 'positive', label: '포지티브' }, { key: 'positiveActive', label: '선택', checkbox: true }, { key: 'negative', label: '네거티브' }, { key: 'negativeActive', label: '선택', checkbox: true }, { key: 'description', label: '해설' }, { key: 't', label: 'T', checkbox: true }, { key: 's', label: 'S', checkbox: true }]} />
      <b style={{ display: 'block', margin: '14px 0 5px', fontSize: 12 }}>메모리</b>
      <Dx3rdRows<Dx3rdMemory> items={data.memories} onChange={rows => patch('memories', rows)} create={() => ({ id: newId(), relationship: '', name: '', emotion: '', description: '' })} addLabel="메모리 추가"
        columns={[{ key: 'relationship', label: '관계' }, { key: 'name', label: '이름' }, { key: 'emotion', label: '감정' }, { key: 'description', label: '해설' }]} />
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>무기 · 방어구 · 비클 · 아이템</summary>
      <b style={{ display: 'block', marginBottom: 5, fontSize: 12 }}>무기</b>
      <Dx3rdRows<Dx3rdWeapon> items={data.weapons} onChange={rows => patch('weapons', rows)} create={newDxWeapon} addLabel="무기 추가"
        columns={[{ key: 'name', label: '무기명' }, { key: 'category', label: '종별' }, { key: 'skill', label: '기능' }, { key: 'range', label: '사정' }, { key: 'accuracy', label: '명중' }, { key: 'attack', label: '공격력' }, { key: 'guard', label: '가드치' }, { key: 'stock', label: '상비화' }, { key: 'exp', label: '경험점' }, { key: 'description', label: '해설' }]} />
      <b style={{ display: 'block', margin: '14px 0 5px', fontSize: 12 }}>방어구</b>
      <Dx3rdRows<Dx3rdArmor> items={data.armors} onChange={rows => patch('armors', rows)} create={newDxArmor} addLabel="방어구 추가"
        columns={[{ key: 'name', label: '방어구명' }, { key: 'category', label: '종별' }, { key: 'dodge', label: '닷지' }, { key: 'action', label: '행동' }, { key: 'armor', label: '장갑' }, { key: 'stock', label: '상비화' }, { key: 'exp', label: '경험점' }, { key: 'description', label: '해설' }]} />
      <b style={{ display: 'block', margin: '14px 0 5px', fontSize: 12 }}>비클</b>
      <Dx3rdRows<Dx3rdVehicle> items={data.vehicles} onChange={rows => patch('vehicles', rows)} create={newDxVehicle} addLabel="비클 추가"
        columns={[{ key: 'name', label: '비클명' }, { key: 'category', label: '종별' }, { key: 'skill', label: '기능' }, { key: 'attack', label: '공격력' }, { key: 'action', label: '행동' }, { key: 'armor', label: '장갑' }, { key: 'movement', label: '이동' }, { key: 'stock', label: '상비화' }, { key: 'exp', label: '경험점' }, { key: 'description', label: '해설' }]} />
      <b style={{ display: 'block', margin: '14px 0 5px', fontSize: 12 }}>아이템</b>
      <Dx3rdRows<Dx3rdItem> items={data.items} onChange={rows => patch('items', rows)} create={newDxItem} addLabel="아이템 추가"
        columns={[{ key: 'name', label: '아이템명' }, { key: 'category', label: '종별' }, { key: 'skill', label: '기능' }, { key: 'stock', label: '상비화' }, { key: 'exp', label: '경험점' }, { key: 'description', label: '해설' }]} />
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>콤보</summary>
      <Dx3rdRows<Dx3rdCombo> items={data.combos} onChange={rows => patch('combos', rows)} create={() => ({
        id: newId(), name: '', timing: '', skill: '', difficulty: '', target: '', range: '', restriction: '', cost: '',
        diceUnder100: '', diceOver100: '', criticalUnder100: '', criticalOver100: '', attackUnder100: '', attackOver100: '',
      })} addLabel="콤보 추가" columns={[
        { key: 'name', label: '콤보명' }, { key: 'timing', label: '타이밍' }, { key: 'skill', label: '기능' },
        { key: 'difficulty', label: '난이도' }, { key: 'target', label: '대상' }, { key: 'range', label: '사정' },
        { key: 'restriction', label: '제한' }, { key: 'cost', label: '침식' }, { key: 'diceUnder100', label: '99↓ 다이스' },
        { key: 'criticalUnder100', label: '99↓ 크리치' }, { key: 'attackUnder100', label: '99↓ 공격력' },
        { key: 'diceOver100', label: '100↑ 다이스' }, { key: 'criticalOver100', label: '100↑ 크리치' }, { key: 'attackOver100', label: '100↑ 공격력' },
      ]} />
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>적 · 종자 데이터 (선택)</summary>
      {!data.enemyData ? <button className="btn btn-ghost" onClick={() => patch('enemyData', {
        category: '', name: '', hp: '', action: '', armor: '', guard: '', attack: '',
        abilities: { body: '3', sense: '3', mind: '3', social: '3' }, skills: [], items: [],
      })}>＋ 적/종자 데이터 사용</button> : <>
        <div style={grid}>
          <CocField label="종자 구분" value={data.enemyData.category} onChange={value => patch('enemyData', { ...data.enemyData!, category: value })} />
          <CocField label="종자 데이터명" value={data.enemyData.name} onChange={value => patch('enemyData', { ...data.enemyData!, name: value })} />
          <CocField label="HP" value={data.enemyData.hp} onChange={value => patch('enemyData', { ...data.enemyData!, hp: value })} />
          <CocField label="행동치" value={data.enemyData.action} onChange={value => patch('enemyData', { ...data.enemyData!, action: value })} />
          <CocField label="장갑치" value={data.enemyData.armor} onChange={value => patch('enemyData', { ...data.enemyData!, armor: value })} />
          <CocField label="가드치" value={data.enemyData.guard} onChange={value => patch('enemyData', { ...data.enemyData!, guard: value })} />
          <CocField label="공격력" value={data.enemyData.attack} onChange={value => patch('enemyData', { ...data.enemyData!, attack: value })} />
        </div>
        <div style={{ ...grid, marginTop: 10 }}>
          {DX3RD_ABILITY_GROUPS.map(group => <CocField key={group.id} label={`종자 ${group.label}`} value={data.enemyData!.abilities[group.id]}
            onChange={value => patch('enemyData', { ...data.enemyData!, abilities: { ...data.enemyData!.abilities, [group.id]: value } })} />)}
        </div>
        <div style={{ marginTop: 10 }}><Dx3rdRows<Dx3rdSkill> items={data.enemyData.skills} onChange={skills => patch('enemyData', { ...data.enemyData!, skills })}
          create={() => ({ id: newId(), group: 'body', name: '', value: '0' })} addLabel="종자 기능 추가"
          columns={[{ key: 'group', label: '능력' }, { key: 'name', label: '기능' }, { key: 'value', label: '값' }]} /></div>
        <div style={{ marginTop: 10 }}><Dx3rdRows<Dx3rdItem> items={data.enemyData.items} onChange={items => patch('enemyData', { ...data.enemyData!, items })} create={newDxItem} addLabel="서번트 아이템 추가"
          columns={[{ key: 'name', label: '아이템명' }, { key: 'category', label: '종별' }, { key: 'skill', label: '기능' }, { key: 'stock', label: '상비화' }, { key: 'exp', label: '경험점' }, { key: 'description', label: '해설' }]} /></div>
        <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => patch('enemyData', undefined)}>적/종자 데이터 제거</button>
      </>}
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>크롤링 카오스 (선택)</summary>
      {!data.crawlingChaos ? <button className="btn btn-ghost" onClick={() => patch('crawlingChaos', { insanity: '', insanityDescription: '', root: '', grimoire: [], spells: [] })}>＋ 크롤링 카오스 데이터 사용</button> : <>
        <div style={grid}>
          <CocField label="영구적 광기" value={data.crawlingChaos.insanity} onChange={value => patch('crawlingChaos', { ...data.crawlingChaos!, insanity: value })} />
          <CocField label="루트" value={data.crawlingChaos.root} onChange={value => patch('crawlingChaos', { ...data.crawlingChaos!, root: value })} />
        </div>
        <label style={{ display: 'grid', gap: 4, marginTop: 8 }}><span className="k-label" style={{ margin: 0 }}>광기 해설</span>
          <textarea value={data.crawlingChaos.insanityDescription} onChange={e => patch('crawlingChaos', { ...data.crawlingChaos!, insanityDescription: e.target.value })} style={{ minHeight: 55, padding: 8, resize: 'vertical' }} />
        </label>
        <div style={{ marginTop: 10 }}><b style={{ display: 'block', fontSize: 12 }}>그리모어</b>
          <Dx3rdRows<Dx3rdItem> items={data.crawlingChaos.grimoire} onChange={grimoire => patch('crawlingChaos', { ...data.crawlingChaos!, grimoire })} create={newDxItem} addLabel="그리모어 추가"
            columns={[{ key: 'name', label: '이름' }, { key: 'category', label: '종별' }, { key: 'skill', label: '해독 난이도' }, { key: 'stock', label: '상비화' }, { key: 'description', label: '해설/술식' }]} /></div>
        <div style={{ marginTop: 10 }}><b style={{ display: 'block', fontSize: 12 }}>술식</b>
          <Dx3rdRows<Dx3rdItem> items={data.crawlingChaos.spells} onChange={spells => patch('crawlingChaos', { ...data.crawlingChaos!, spells })} create={newDxItem} addLabel="술식 추가"
            columns={[{ key: 'name', label: '술식명' }, { key: 'category', label: '종별' }, { key: 'skill', label: '발동' }, { key: 'stock', label: '침식' }, { key: 'exp', label: '경험점' }, { key: 'description', label: '해설' }]} /></div>
        <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => patch('crawlingChaos', undefined)}>크롤링 카오스 데이터 제거</button>
      </>}
    </details>
  </div>;
}

function MagicaLogiaSheetEditor({ data, onChange }: {
  data: MagicaLogiaCharacterSheet; onChange: (next: MagicaLogiaCharacterSheet) => void;
}) {
  const patch = <K extends keyof MagicaLogiaCharacterSheet>(key: K, value: MagicaLogiaCharacterSheet[K]) =>
    onChange({ ...data, [key]: value });
  const patchAnchor = (id: string, values: Partial<MagiaAnchor>) =>
    patch('anchors', data.anchors.map(anchor => anchor.id === id ? { ...anchor, ...values } : anchor));
  const patchSpell = (id: string, values: Partial<MagiaSpell>) =>
    patch('spells', data.spells.map(spell => spell.id === id ? { ...spell, ...values } : spell));
  const patchObligation = (id: string, values: Partial<MagiaObligation>) =>
    patch('obligations', data.obligations.map(item => item.id === id ? { ...item, ...values } : item));
  const fieldGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 9 };
  const selectStyle: React.CSSProperties = { width: '100%', minHeight: 34, padding: '6px 9px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel-solid)', color: 'var(--ink)' };

  return <div style={{ display: 'grid', gap: 10 }}>
    <details className="panel" open style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>마법사 정보</summary>
      <div style={fieldGrid}>
        <CocField label="마법명" value={data.magicName} onChange={value => patch('magicName', value)} />
        <CocField label="실천자" value={data.practitioner} onChange={value => patch('practitioner', value)} />
        <CocField label="계제" value={data.rank} onChange={value => patch('rank', value)} />
        <CocField label="성별" value={data.gender} onChange={value => patch('gender', value)} />
        <CocField label="연령" value={data.age} onChange={value => patch('age', value)} />
        <CocField label="문호" value={data.codeName} onChange={value => patch('codeName', value)} />
        <CocField label="사회적 신분" value={data.socialStatus} onChange={value => patch('socialStatus', value)} />
        <CocField label="공격력" value={data.attack} onChange={value => patch('attack', value)} />
        <CocField label="방어력" value={data.defense} onChange={value => patch('defense', value)} />
        <CocField label="근원력" value={data.root} onChange={value => patch('root', value)} />
        <CocField label="마력" value={data.mana} onChange={value => patch('mana', value)} />
        <CocField label="일시적 마력" value={data.temporaryMana} onChange={value => patch('temporaryMana', value)} />
        <CocField label="공적점" value={data.achievement} onChange={value => patch('achievement', value)} />
        <CocField label="마화" value={data.magia} onChange={value => patch('magia', value)} />
      </div>
      <div style={{ ...fieldGrid, marginTop: 12 }}>
        <CocField label="진정한 모습" value={data.trueForm} onChange={value => patch('trueForm', value)} />
        <CocField label="진정한 모습 효과" value={data.trueFormEffect} onChange={value => patch('trueFormEffect', value)} />
        <CocField label="신조" value={data.credo} onChange={value => patch('credo', value)} />
        <CocField label="경력" value={data.career} onChange={value => patch('career', value)} />
        <CocField label="기관" value={data.institution} onChange={value => patch('institution', value)} />
      </div>
      <label style={{ display: 'grid', gap: 4, marginTop: 12 }}>
        <span className="k-label" style={{ margin: 0 }}>소개</span>
        <textarea value={data.introduction} onChange={e => patch('introduction', e.target.value)} style={{ minHeight: 90, padding: 9, resize: 'vertical' }} />
      </label>
      <div style={{ ...fieldGrid, marginTop: 12 }}>
        <CocField label="조건" value={data.condition} onChange={value => patch('condition', value)} />
        <CocField label="특기 사항" value={data.specialtyNotes} onChange={value => patch('specialtyNotes', value)} />
      </div>
    </details>

    <details className="panel" open style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>영역 특기 · 혼의 특기</summary>
      <label style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 120px', gap: 8, maxWidth: 430, alignItems: 'end', marginBottom: 12 }}>
        <span style={{ display: 'grid', gap: 4 }}>
          <span className="k-label" style={{ margin: 0 }}>혼의 특기</span>
          <select style={selectStyle} value={data.soulSpecialtyId} onChange={e => patch('soulSpecialtyId', e.target.value)}>
            <option value="">선택</option>
            {MAGICALOGIA_SPECIALTY_GROUPS.map(group => <optgroup key={group.id} label={group.name}>
              {group.skills.map((name, index) => <option key={`${group.id}-${index}`} value={`${group.id}-${index}`}>{name}</option>)}
            </optgroup>)}
          </select>
        </span>
        <CocField label="혼의 특기 목표치" value={data.soulTargetOverride ?? '6'} onChange={value => patch('soulTargetOverride', value || undefined)} />
      </label>
      <p className="hint" style={{ margin: '0 0 10px' }}>각 특기 목표치는 혼의 특기와 표상 거리로 계산하며, 특기별 입력란에서 덮어쓸 수 있습니다.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10 }}>
        {MAGICALOGIA_SPECIALTY_GROUPS.map(group => <section key={group.id} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 9 }}>
          <b style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>{group.name}</b>
          {group.skills.map((name, index) => {
            const id = `${group.id}-${index}`;
            const specialty = data.specialties.find(item => item.id === id) ?? { id, selected: false };
            const target = magiaTarget(data, id);
            return <div key={id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 52px', gap: 5, alignItems: 'center', minHeight: 30 }}>
              <label style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 0, fontSize: 11.5 }}>
                <input type="checkbox" checked={specialty.selected} onChange={e => patch('specialties', data.specialties.map(item => item.id === id ? { ...item, selected: e.target.checked } : item))} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
              </label>
              <KInput aria-label={`${name} 목표치`} title={target ? `자동 계산 ${target}` : '혼의 특기를 선택하세요'} value={specialty.targetOverride ?? target} placeholder="-" onChange={e => patch('specialties', data.specialties.map(item => item.id === id ? { ...item, targetOverride: e.target.value || undefined } : item))} style={{ padding: '4px 5px', textAlign: 'center', fontSize: 11 }} />
            </div>;
          })}
        </section>)}
      </div>
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>앵커 · 운명 ({data.anchors.length})</summary>
      {data.anchors.map(anchor => <div key={anchor.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 90px 110px minmax(140px, 2fr) auto', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <input aria-label="활성 앵커" type="checkbox" checked={anchor.active} onChange={e => patchAnchor(anchor.id, { active: e.target.checked })} />
        <KInput placeholder="이름" value={anchor.name} onChange={e => patchAnchor(anchor.id, { name: e.target.value })} />
        <KInput placeholder="운명" value={anchor.destiny} onChange={e => patchAnchor(anchor.id, { destiny: e.target.value })} />
        <KInput placeholder="속성" value={anchor.aspect} onChange={e => patchAnchor(anchor.id, { aspect: e.target.value })} />
        <KInput placeholder="설정" value={anchor.description} onChange={e => patchAnchor(anchor.id, { description: e.target.value })} />
        <button className="btn btn-ghost" onClick={() => patch('anchors', data.anchors.filter(item => item.id !== anchor.id))}>✕</button>
      </div>)}
      <button className="btn btn-ghost" onClick={() => patch('anchors', [...data.anchors, { id: newId(), active: false, name: '', destiny: '', aspect: '', description: '' }])}>＋ 앵커 추가</button>
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>마도서 · 주권 설정</summary>
      <label style={{ display: 'grid', gap: 4 }}><span className="k-label" style={{ margin: 0 }}>마도서 설정</span><textarea value={data.grimoireSettings} onChange={e => patch('grimoireSettings', e.target.value)} style={{ minHeight: 90, padding: 9, resize: 'vertical' }} /></label>
      <label style={{ display: 'grid', gap: 4, marginTop: 10 }}><span className="k-label" style={{ margin: 0 }}>주권 설정</span><textarea value={data.domainSettings} onChange={e => patch('domainSettings', e.target.value)} style={{ minHeight: 90, padding: 9, resize: 'vertical' }} /></label>
      <label style={{ display: 'grid', gap: 4, marginTop: 10 }}><span className="k-label" style={{ margin: 0 }}>상태 이상</span><textarea value={data.statusAilments} onChange={e => patch('statusAilments', e.target.value)} style={{ minHeight: 65, padding: 9, resize: 'vertical' }} /></label>
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>의무 ({data.obligations.length})</summary>
      {data.obligations.map(item => <div key={item.id} style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 6 }}>
        <input aria-label="의무 달성" type="checkbox" checked={item.fulfilled} onChange={e => patchObligation(item.id, { fulfilled: e.target.checked })} />
        <KInput placeholder="의무" value={item.text} onChange={e => patchObligation(item.id, { text: e.target.value })} />
        <button className="btn btn-ghost" onClick={() => patch('obligations', data.obligations.filter(row => row.id !== item.id))}>✕</button>
      </div>)}
      <button className="btn btn-ghost" onClick={() => patch('obligations', [...data.obligations, { id: newId(), text: '', fulfilled: false }])}>＋ 의무 추가</button>
    </details>

    <details className="panel" style={{ padding: 16 }}>
      <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>장서 · 마법 ({data.spells.length})</summary>
      {data.spells.map(spell => <div key={spell.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12, marginBottom: 12 }}>
        <div style={fieldGrid}>
          <CocField label="마법 이름" value={spell.name} onChange={value => patchSpell(spell.id, { name: value })} />
          <CocField label="타입" value={spell.type} onChange={value => patchSpell(spell.id, { type: value })} />
          <CocField label="목표" value={spell.target} onChange={value => patchSpell(spell.id, { target: value })} />
          <CocField label="코스트" value={spell.cost} onChange={value => patchSpell(spell.id, { cost: value })} />
          <CocField label="주구" value={spell.tool} onChange={value => patchSpell(spell.id, { tool: value })} />
          <label style={{ display: 'grid', gap: 4 }}><span className="k-label" style={{ margin: 0 }}>지정 특기</span>
            <select style={selectStyle} value={spell.specialtyId} onChange={e => patchSpell(spell.id, { specialtyId: e.target.value })}>
              <option value="">선택 안 함</option>
              {MAGICALOGIA_SPECIALTY_GROUPS.map(group => <optgroup key={group.id} label={group.name}>
                {group.skills.map((name, index) => <option key={`${group.id}-${index}`} value={`${group.id}-${index}`}>{name}</option>)}
              </optgroup>)}
            </select>
          </label>
        </div>
        <label style={{ display: 'grid', gap: 4, marginTop: 8 }}><span className="k-label" style={{ margin: 0 }}>효과</span><textarea value={spell.effect} onChange={e => patchSpell(spell.id, { effect: e.target.value })} style={{ minHeight: 52, padding: 8, resize: 'vertical' }} /></label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 8 }}>
          <span className="k-label" style={{ margin: 0 }}>차지</span>
          {Array.from({ length: 7 }, (_, index) => <label key={index} style={{ display: 'flex', gap: 3, alignItems: 'center', fontSize: 11 }}>
            <input type="checkbox" checked={spell.charges[index] ?? false} onChange={e => {
              const charges = Array.from({ length: 7 }, (_, i) => spell.charges[i] ?? false);
              charges[index] = e.target.checked;
              patchSpell(spell.id, { charges });
            }} /> {index + 1}
          </label>)}
        </div>
        <div style={{ ...fieldGrid, marginTop: 8 }}>
          <CocField label="개요" value={spell.overview} onChange={value => patchSpell(spell.id, { overview: value })} />
          <CocField label="메모" value={spell.memo} onChange={value => patchSpell(spell.id, { memo: value })} />
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => patch('spells', data.spells.filter(item => item.id !== spell.id))}>마법 삭제</button>
      </div>)}
      <button className="btn btn-ghost" onClick={() => patch('spells', [...data.spells, { id: newId(), name: '', type: '', target: '', effect: '', specialtyId: '', cost: '', charges: Array(7).fill(false), tool: '', overview: '', memo: '' }])}>＋ 마법 추가</button>
    </details>

  </div>;
}

const SHEET_RULE_LABELS = {
  general: '기타 / 자유 입력', coc: 'CoC 7판', insane: 'inSANe', magicalogia: '마기카로기아', dx3rd: 'DX3rd',
} as const;

function inferSheetType(character?: TrpgChar): TrpgChar['sheetType'] {
  if (character?.sheetType) return character.sheetType;
  const rule = (character?.rule ?? '').toLowerCase();
  if (rule.includes('insane') || rule.includes('인세인')) return 'insane';
  if (rule.includes('coc') || rule.includes('크툴루')) return 'coc';
  if (rule.includes('마기카')) return 'magicalogia';
  if (rule.includes('dx3')) return 'dx3rd';
  return 'general';
}

function scenarioLogsFor(character?: TrpgChar): TrpgScenarioLog[] {
  if (!character) return [];
  if (character.scenarioLogs?.length) return character.scenarioLogs;

  const sheetType = inferSheetType(character);
  if (sheetType === 'coc' && character.coc?.scenarioLogs?.length) {
    return character.coc.scenarioLogs.map(log => ({ ...log, role: '' }));
  }
  if (sheetType === 'magicalogia' && character.magicalogia?.sessionLogs?.length) {
    return character.magicalogia.sessionLogs.map(log => ({
      id: log.id,
      date: log.date,
      role: log.role,
      title: log.scenarioTitle,
      note: [log.memo, log.rank && `계제 ${log.rank}`, log.achievement && `공적점 ${log.achievement}`, log.magia && `마화 ${log.magia}`, log.magicName && `마법명 ${log.magicName}`]
        .filter(Boolean).join(' · '),
    }));
  }
  return character.scenario?.trim()
    ? [{ id: newId(), date: '', role: '', title: character.scenario.trim(), note: '' }]
    : [];
}

export function TCharForm({ editId }: { editId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const del = useConfirmDelete();
  const [tchars, setTchars, loaded] = useLocalList<TrpgChar>('ohome.tchars.v1', TCHAR_SEED);
  const orig = editId ? tchars.find(c => c.id === editId) : undefined;

  const [name, setName] = useState(orig?.name ?? '');
  const [scenarioLogs, setScenarioLogs] = useState<TrpgScenarioLog[]>(() => scenarioLogsFor(orig));
  const [rule, setRule] = useState(orig?.rule ?? '');
  const [sheetType, setSheetType] = useState<NonNullable<TrpgChar['sheetType']>>(() => inferSheetType(orig));
  const [coc, setCoc] = useState<CocInvestigatorSheet>(() => emptyCocSheet(orig?.coc));
  const [insane, setInsane] = useState<InsaneCharacterSheet>(() => emptyInsaneSheet(orig?.insane));
  const [magicalogia, setMagicalogia] = useState<MagicaLogiaCharacterSheet>(() => emptyMagicaLogiaSheet(orig?.magicalogia));
  const [dx3rd, setDx3rd] = useState<Dx3rdCharacterSheet>(() => emptyDx3rdSheet(orig?.dx3rd));
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
    setName(o.name); setRule(o.rule ?? '');
    setScenarioLogs(scenarioLogsFor(o));
    setSheetType(inferSheetType(o)); setCoc(emptyCocSheet(o.coc)); setInsane(emptyInsaneSheet(o.insane));
    setMagicalogia(emptyMagicaLogiaSheet(o.magicalogia)); setDx3rd(emptyDx3rdSheet(o.dx3rd)); setRole(o.role ?? '');
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
      name: name.trim(), scenario: scenarioLogs[scenarioLogs.length - 1]?.title ?? '', scenarioLogs,
      rule: sheetType === 'general' ? rule.trim() : SHEET_RULE_LABELS[sheetType], role: role.trim(),
      sheetType,
      coc: sheetType === 'coc' || orig?.coc ? { ...coc, scenarioLogs: undefined } : undefined,
      insane: sheetType === 'insane' || orig?.insane ? insane : undefined,
      magicalogia: sheetType === 'magicalogia' || orig?.magicalogia ? { ...magicalogia, sessionLogs: undefined } : undefined,
      dx3rd: sheetType === 'dx3rd' || orig?.dx3rd ? dx3rd : undefined,
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
      <div>
        <label className="k-label" style={{ marginBottom: 5 }}>룰</label>
        <select value={sheetType} onChange={e => {
          const selected = e.target.value as NonNullable<TrpgChar['sheetType']>;
          setSheetType(selected);
          if (selected !== 'general') setRule(SHEET_RULE_LABELS[selected]);
          else setRule('');
        }} style={{ width: '100%', minHeight: 36, padding: '6px 9px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel-solid)', color: 'var(--ink)' }}>
          {Object.entries(SHEET_RULE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {sheetType === 'general' && <KInput placeholder="룰 이름" value={rule} onChange={e => setRule(e.target.value)} />}
      </div>

      <details className="panel" open style={{ padding: 16 }}>
        <summary className="k-label" style={{ cursor: 'pointer', marginBottom: 12 }}>시나리오 기록 ({scenarioLogs.length})</summary>
        {scenarioLogs.map(log => <div key={log.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6, marginBottom: 6 }}>
          <KInput type="date" aria-label="플레이 날짜" value={log.date} onChange={e => setScenarioLogs(rows => rows.map(row => row.id === log.id ? { ...row, date: e.target.value } : row))} />
          <KInput placeholder="역할" aria-label="플레이 역할" value={log.role} onChange={e => setScenarioLogs(rows => rows.map(row => row.id === log.id ? { ...row, role: e.target.value } : row))} />
          <KInput placeholder="시나리오 제목" aria-label="시나리오 제목" value={log.title} onChange={e => setScenarioLogs(rows => rows.map(row => row.id === log.id ? { ...row, title: e.target.value } : row))} />
          <KInput placeholder="한마디 또는 비고" aria-label="시나리오 비고" value={log.note} onChange={e => setScenarioLogs(rows => rows.map(row => row.id === log.id ? { ...row, note: e.target.value } : row))} />
          <button className="btn btn-ghost" aria-label="시나리오 기록 삭제" onClick={() => setScenarioLogs(rows => rows.filter(row => row.id !== log.id))}>✕</button>
        </div>)}
        <button className="btn btn-ghost" onClick={() => setScenarioLogs(rows => [...rows, { id: newId(), date: '', role: '', title: '', note: '' }])}>＋ 시나리오 기록</button>
      </details>

      {sheetType === 'coc' && <CocSheetEditor data={coc} onChange={setCoc} />}
      {sheetType === 'insane' && <InsaneSheetEditor data={insane} onChange={setInsane} />}
      {sheetType === 'magicalogia' && <MagicaLogiaSheetEditor data={magicalogia} onChange={setMagicalogia} />}
      {sheetType === 'dx3rd' && <Dx3rdSheetEditor data={dx3rd} onChange={setDx3rd} />}

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

'use client';
// TRPG 캐릭터 상세 (v1.9) — 좌 큰 이미지(원본/스탠딩, 표정 전환은 여기서) + 우 정보·설명
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import {
  CocInvestigatorSheet, Dx3rdCharacterSheet, InsaneCharacterSheet, MagicaLogiaCharacterSheet,
  TrpgChar, TCHAR_SEED, faceCrop, INSANE_SPECIALTY_GROUPS, MAGICALOGIA_SPECIALTY_GROUPS,
} from '@/lib/tcharStore';
import { sanitizeHtml } from '@/lib/sanitize';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { Lightbox } from '@/components/ui/Lightbox';
import { ConfirmModal } from '@/components/ui/Modal';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

// 상세 메인 (사용자 확정): 단일 인장 = 1:1 크롭 · 스탠딩 인장 = 원본 전신(비율 그대로)
import { useBlobUrl } from '@/lib/blobStore';

type DisplayField = readonly [label: string, value: string | number | boolean | undefined | null];

function DisplayFields({ fields }: { fields: DisplayField[] }) {
  const visibleFields = fields.filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (visibleFields.length === 0) return null;
  return <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 12 }}>
    {visibleFields.map(([label, value]) => <div key={label}>
      <dt className="k-label">{label}</dt>
      <dd style={{ margin: '3px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{String(value)}</dd>
    </div>)}
  </dl>;
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel" style={{ maxWidth: 1000, margin: '16px auto 0', padding: 24 }}>
    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{title}</h2>
    {children}
  </section>;
}

function MagiaSheetDetails({ character }: { character: MagicaLogiaCharacterSheet }) {
  const domains = MAGICALOGIA_SPECIALTY_GROUPS
    .filter(domain => character.specialties?.some(specialty => specialty.selected
      && (specialty.id === domain.id || specialty.id.startsWith(`${domain.id}-`))))
    .map(domain => domain.name);
  const [legacyDomainId, legacyIndex] = (character.soulSpecialtyId ?? '').split('-');
  const legacySoul = MAGICALOGIA_SPECIALTY_GROUPS.find(domain => domain.id === legacyDomainId)?.skills[Number(legacyIndex)] ?? '';
  const spells = character.spells ?? [];
  const stats = [
    ['공격력', character.attack],
    ['방어력', character.defense],
    ['근원력', character.root],
  ] as const;
  const profile = [
    ['계제', character.rank],
    ['경력 · 기관', [character.career, character.institution].filter(Boolean).join(' · ')],
    ['영역', domains.join(' · ')],
    ['혼의 특기', character.soulSpecialty || legacySoul],
    ['사회적 신분', character.socialStatus],
    ['나이', character.age],
    ['성별', character.gender],
    ['진정한 모습', [character.trueForm, character.trueFormEffect].filter(Boolean).join('\n')],
  ] as DisplayField[];

  return <SheetSection title="마기카로기아">
    <DisplayFields fields={stats} />
    <div style={{ marginTop: 14 }}><DisplayFields fields={profile} /></div>
    {(spells.length > 0 || character.grimoireSettings) && <div style={{ marginTop: 18 }}>
      <h3 className="k-label">마도서</h3>
      {character.grimoireSettings && <p style={{ marginTop: 6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{character.grimoireSettings}</p>}
      {spells.length > 0 && <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {spells.map(spell => <article key={spell.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
          <b>{spell.name || '이름 없는 마법'}</b>
          {[spell.type, spell.target, spell.cost].filter(Boolean).length > 0
            && <span className="hint" style={{ marginLeft: 8 }}>{[spell.type, spell.target, spell.cost].filter(Boolean).join(' · ')}</span>}
          {spell.effect && <p style={{ margin: '5px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{spell.effect}</p>}
          {spell.memo && <p className="hint" style={{ margin: '5px 0 0', whiteSpace: 'pre-wrap' }}>{spell.memo}</p>}
        </article>)}
      </div>}
    </div>}
  </SheetSection>;
}

function CocSheetDetails({ character }: { character: CocInvestigatorSheet }) {
  const stats = [
    ['근력', character.characteristics.str], ['민첩', character.characteristics.dex],
    ['정신', character.characteristics.pow], ['건강', character.characteristics.con],
    ['외모', character.characteristics.app], ['교육', character.characteristics.edu],
    ['크기', character.characteristics.siz], ['지능', character.characteristics.int],
    ['행운', character.derived.luck],
  ] as const;
  const basic = [
    ['직업', character.investigator.occupation],
    ['나이', character.investigator.age],
    ['성별', character.investigator.gender],
    ['거주지', character.investigator.residence],
    ['출생지', character.investigator.birthplace],
    ['한마디', character.investigator.catchphrase],
  ] as DisplayField[];
  return <SheetSection title="CoC">
    <DisplayFields fields={basic} />
    <h3 className="k-label" style={{ margin: '18px 0 10px' }}>능력치</h3>
    <DisplayFields fields={stats} />
    {character.backstoryHtml && <div style={{ marginTop: 18 }}>
      <h3 className="k-label">백스토리</h3>
      <div className="post-body" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(character.backstoryHtml) }} />
    </div>}
  </SheetSection>;
}

function InsaneSheetDetails({ character }: { character: InsaneCharacterSheet }) {
  const curiosity = INSANE_SPECIALTY_GROUPS.find(group => group.id === character.curiosityGroupId)?.name ?? '';
  const fearGroupId = character.fearSpecialtyId.split('-')[0];
  const fearIndex = Number(character.fearSpecialtyId.split('-')[1]);
  const fear = INSANE_SPECIALTY_GROUPS.find(group => group.id === fearGroupId)?.skills[fearIndex] ?? character.fearSpecialtyId;
  const selected = INSANE_SPECIALTY_GROUPS.flatMap(group => group.skills
    .map((name, index) => ({ id: `${group.id}-${index}`, group: group.name, name })))
    .filter(specialty => character.specialties.some(item => item.id === specialty.id && item.selected))
    .map(specialty => `${specialty.group}: ${specialty.name}`);
  const basic = [
    ['나이', character.age],
    ['성별', character.gender],
    ['직업', character.occupation],
    ['키워드', character.catchphrase],
    ['호기심', curiosity],
    ['공포심', fear],
  ] as DisplayField[];
  const status = [
    ['생명력', [character.life, character.lifeMax].filter(Boolean).join(' / ')],
    ['정신력', [character.sanity, character.sanityMax].filter(Boolean).join(' / ')],
  ] as DisplayField[];

  return <SheetSection title="inSANe">
    <DisplayFields fields={basic} />
    <div style={{ marginTop: 14 }}><DisplayFields fields={status} /></div>
    {selected.length > 0 && <div style={{ marginTop: 16 }}>
      <h3 className="k-label">특기</h3>
      <p style={{ marginTop: 5 }}>{selected.join(' · ')}</p>
    </div>}
    {character.abilities.length > 0 && <div style={{ marginTop: 16 }}>
      <h3 className="k-label">어빌리티</h3>
      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {character.abilities.map(ability => <div key={ability.id}>
          <b>{ability.name}</b>{ability.type && <span className="hint"> · {ability.type}</span>}
          {ability.effect && <p style={{ marginTop: 3, whiteSpace: 'pre-wrap' }}>{ability.effect}</p>}
        </div>)}
      </div>
    </div>}
  </SheetSection>;
}

function Dx3rdSheetDetails({ character }: { character: Dx3rdCharacterSheet }) {
  const basic = [
    ['코드네임', [character.codename, character.codenameRuby].filter(Boolean).join(' · ')],
    ['나이', character.age],
    ['성별', character.gender],
    ['커버', character.cover],
    ['웍스', character.works],
    ['브리드', character.breed],
    ['신드롬', character.syndromes.filter(Boolean).join(' · ')],
  ] as DisplayField[];
  const abilities = [
    ['육체', character.abilities.body],
    ['감각', character.abilities.sense],
    ['정신', character.abilities.mind],
    ['사회', character.abilities.social],
  ] as const;
  const lois = (character.lois ?? []).filter(item =>
    item.category.trim().toLocaleLowerCase().startsWith('d') && (item.name || item.category))
    .map(item => [item.category, item.name].filter(Boolean).join(' · '));

  return <SheetSection title="DX3rd">
    <DisplayFields fields={basic} />
    <h3 className="k-label" style={{ margin: '18px 0 10px' }}>능력치</h3>
    <DisplayFields fields={abilities} />
    {lois.length > 0 && <div style={{ marginTop: 16 }}>
      <h3 className="k-label">D로이스</h3>
      <p style={{ marginTop: 5 }}>{lois.join(' · ')}</p>
    </div>}
  </SheetSection>;
}

function StandingImg({ imgId, ph }: { imgId?: string; ph: string }) {
  const url = useBlobUrl(imgId);
  if (!url) return <div className={`ph ${ph}`} style={{ position: 'absolute', inset: 0 }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" style={{ maxWidth: '100%', display: 'block' }} />;
}

export default function TCharDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [tchars, setTchars, loaded] = useLocalList<TrpgChar>('ohome.tchars.v1', TCHAR_SEED);
  const [faceIdx, setFaceIdx] = useState(0);
  const [delAsk, setDelAsk] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);

  const c = tchars.find(x => x.id === id);
  if (!loaded) return <section className="page" />;
  if (!c) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>TRPG CHARACTERS</PageTitle><p>캐릭터를 찾을 수 없습니다</p></div>
      </section>
    );
  }

  const face = c.faces[Math.min(faceIdx, c.faces.length - 1)] ?? c.faces[0];

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>TRPG CHARACTERS</PageTitle>
        <EditableDesc k="tchars-detail-desc" def="표정 썸네일을 누르면 이미지가 전환됩니다" />
        <div className="head-actions">
          {isAdmin && <button className="btn btn-dark" onClick={() => router.push(`/tchars/${c.id}/edit`)}>EDIT</button>}
          {isAdmin && <button className="btn btn-dark" onClick={() => setDelAsk(true)}>DELETE</button>}
        </div>
      </div>

      <div className="tcd-layout">
        {/* 좌 — 현재 표정 원본 (스탠딩이면 전신), 클릭 시 확대 */}
        <div className="panel" style={{ padding: 14 }}>
          {c.imgMode === 'standing' ? (
            /* 스탠딩 인장 — 전신 원본 비율 그대로 (클릭 확대) */
            <div className="tcd-img" style={{
              aspectRatio: 'auto', minHeight: 260, display: 'grid', placeItems: 'center',
              cursor: face?.imgId ? 'zoom-in' : undefined,
            }}
              onClick={() => { if (face?.imgId) setLbOpen(true); }}>
              <StandingImg imgId={face?.imgId} ph={face?.ph ?? c.ph} />
            </div>
          ) : (
            /* 단일 인장 — 1:1 규격 */
            <div className="tcd-img" style={{ cursor: face?.imgId ? 'zoom-in' : undefined }}
              onClick={() => { if (face?.imgId) setLbOpen(true); }}>
              <CroppedBlobImg fileRef={face?.imgId} crop={faceCrop(c, face)} ph={face?.ph ?? c.ph} />
            </div>
          )}
          {/* 표정 전환 — 1:1 썸네일 (스탠딩은 공유 크롭 위치) */}
          {c.faces.length > 1 && (
            <div className="tc-faces" style={{ marginTop: 10 }}>
              {c.faces.map((f, i) => (
                <div key={f.id} className={`fc ${i === faceIdx ? 'on' : ''}`}
                  data-tip={f.label || undefined}
                  onClick={() => setFaceIdx(i)}>
                  <CroppedBlobImg fileRef={f.imgId} crop={faceCrop(c, f)} ph={f.ph ?? c.ph} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우 — 정보 + 설명 */}
        <div className="panel" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            {c.name}
            {c.role && <span className="pill dark">{c.role}</span>}
            {face?.label && c.faces.length > 1 && (
              <span className="pill" style={{ marginLeft: 'auto' }}>{face.label}</span>
            )}
          </h2>
          <div style={{ display: 'grid', gap: 7, padding: '12px 0', borderBottom: '1px dashed var(--line)', fontSize: 12.5 }}>
            {c.scenario && (
              <div style={{ display: 'flex', gap: 10 }}>
                <b style={{ minWidth: 70, color: 'var(--faint)', fontWeight: 600 }}>Scenario</b>{c.scenario}
              </div>
            )}
            {c.rule && (
              <div style={{ display: 'flex', gap: 10 }}>
                <b style={{ minWidth: 70, color: 'var(--faint)', fontWeight: 600 }}>Rule</b>{c.rule}
              </div>
            )}
            {c.role && (
              <div style={{ display: 'flex', gap: 10 }}>
                <b style={{ minWidth: 70, color: 'var(--faint)', fontWeight: 600 }}>Role</b>{c.role}
              </div>
            )}
          </div>
          {c.desc ? (
            <div className="post-body" style={{ fontSize: 13, paddingTop: 14 }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.desc) }} />
          ) : (
            <p className="hint" style={{ paddingTop: 14 }}>설명이 없습니다</p>
          )}
        </div>
      </div>

      {c.coc && <CocSheetDetails character={c.coc} />}
      {c.insane && <InsaneSheetDetails character={c.insane} />}
      {c.magicalogia && <MagiaSheetDetails character={c.magicalogia} />}
      {c.dx3rd && <Dx3rdSheetDetails character={c.dx3rd} />}

      {lbOpen && face?.imgId && (
        <Lightbox srcs={c.faces.filter(f => f.imgId).map(f => f.imgId!)}
          index={c.faces.filter(f => f.imgId).findIndex(f => f.id === face.id)}
          onClose={() => setLbOpen(false)} />
      )}

      <ConfirmModal open={delAsk} title={`「${c.name}」를 삭제하시겠습니까?`}
        body="삭제한 캐릭터는 복구할 수 없습니다."
        onClose={() => setDelAsk(false)}
        buttons={[
          { label: 'DELETE', kind: 'accent', onClick: () => { setTchars(tchars.filter(x => x.id !== c.id)); router.push('/tchars'); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelAsk(false) },
        ]} />
    </section>
  );
}

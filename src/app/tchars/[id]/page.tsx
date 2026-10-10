'use client';
// TRPG 캐릭터 상세 (v1.9) — 좌 큰 이미지(원본/스탠딩, 표정 전환은 여기서) + 우 정보·설명
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { TrpgChar, TCHAR_SEED, faceCrop, MAGICALOGIA_SPECIALTY_GROUPS } from '@/lib/tcharStore';
import { sanitizeHtml } from '@/lib/sanitize';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { Lightbox } from '@/components/ui/Lightbox';
import { ConfirmModal } from '@/components/ui/Modal';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

// 상세 메인 (사용자 확정): 단일 인장 = 1:1 크롭 · 스탠딩 인장 = 원본 전신(비율 그대로)
import { useBlobUrl } from '@/lib/blobStore';

function MagiaSheetDetails({ character }: { character: NonNullable<TrpgChar['magicalogia']> }) {
  const values = [
    ['마법명', character.magicName],
    ['계제', character.rank],
    ['성별', character.gender],
    ['연령', character.age],
    ['사회적 신분', character.socialStatus],
    ['공격력', character.attack],
    ['방어력', character.defense],
    ['근원력', character.root],
    ['마력', character.mana],
    ['일시적 마력', character.temporaryMana],
    ['공적점', character.achievement],
    ['마화', character.magia],
    ['진정한 모습', character.trueForm],
    ['진정한 모습 효과', character.trueFormEffect],
    ['신조', character.credo],
    ['경력', character.career],
    ['기관', character.institution],
    ['혼의 특기', character.soulSpecialty || legacySoulSpecialty(character.soulSpecialtyId)],
  ].filter(([, value]) => value);

  const selectedDomains = MAGICALOGIA_SPECIALTY_GROUPS
    .filter(domain => character.specialties?.some(specialty => specialty.selected
      && (specialty.id === domain.id || specialty.id.startsWith(`${domain.id}-`))))
    .map(domain => domain.name);
  const spells = character.spells ?? [];
  const anchors = character.anchors ?? [];
  const obligations = character.obligations ?? [];
  const sessionLogs = character.sessionLogs ?? [];
  const notes = [
    ['소개', character.introduction],
    ['마도서 설정', character.grimoireSettings],
    ['주권 설정', character.domainSettings],
    ['상태 이상', character.statusAilments],
  ].filter(([, value]) => value);

  return <section className="panel" style={{ maxWidth: 1000, margin: '16px auto 0', padding: 24 }}>
    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>마기카로기아 시트</h2>
    {values.length > 0 && <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
      {values.map(([label, value]) => <div key={label}>
        <dt className="k-label">{label}</dt>
        <dd style={{ margin: '3px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</dd>
      </div>)}
    </dl>}
    {selectedDomains.length > 0 && <div style={{ marginTop: 14 }}>
      <b className="k-label">영역 특기</b>
      <p style={{ marginTop: 4 }}>{selectedDomains.join(' · ')}</p>
    </div>}
    {notes.map(([label, value]) => <div key={label} style={{ marginTop: 14 }}>
      <b className="k-label">{label}</b>
      <p style={{ marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</p>
    </div>)}
    {spells.length > 0 && <div style={{ marginTop: 18 }}>
      <h3 className="k-label">장서 · 마법 ({spells.length})</h3>
      <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
        {spells.map(spell => <article key={spell.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
          <b>{spell.name || '이름 없는 마법'}</b>
          {[spell.type, spell.target, spell.cost].filter(Boolean).length > 0
            && <p className="hint" style={{ margin: '4px 0' }}>{[spell.type, spell.target, spell.cost].filter(Boolean).join(' · ')}</p>}
          {spell.effect && <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{spell.effect}</p>}
          {spell.memo && <p className="hint" style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{spell.memo}</p>}
        </article>)}
      </div>
    </div>}
    {anchors.length > 0 && <div style={{ marginTop: 18 }}>
      <h3 className="k-label">앵커 · 운명 ({anchors.length})</h3>
      {anchors.map(anchor => <p key={anchor.id} style={{ marginTop: 6 }}>
        {[anchor.active ? '활성' : '', anchor.name, anchor.destiny, anchor.aspect, anchor.description].filter(Boolean).join(' · ')}
      </p>)}
    </div>}
    {obligations.length > 0 && <div style={{ marginTop: 18 }}>
      <h3 className="k-label">의무 ({obligations.length})</h3>
      {obligations.map(item => <p key={item.id} style={{ marginTop: 6 }}>{item.fulfilled ? '✓ ' : ''}{item.text}</p>)}
    </div>}
    {sessionLogs.length > 0 && <div style={{ marginTop: 18 }}>
      <h3 className="k-label">세션 기록 ({sessionLogs.length})</h3>
      {sessionLogs.map(log => <p key={log.id} style={{ marginTop: 6 }}>
        {[log.date, log.role, log.scenarioTitle, log.rank, log.achievement, log.magia, log.magicName, log.memo].filter(Boolean).join(' · ')}
      </p>)}
    </div>}
  </section>;
}

function legacySoulSpecialty(id?: string) {
  if (!id) return '';
  const [domainId, index] = id.split('-');
  return MAGICALOGIA_SPECIALTY_GROUPS.find(domain => domain.id === domainId)?.skills[Number(index)] ?? '';
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

      {c.magicalogia && <MagiaSheetDetails character={c.magicalogia} />}

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

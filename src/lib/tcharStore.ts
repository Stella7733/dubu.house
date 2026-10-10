// TRPG 캐릭터 리스트 (v1.9 신규) — 1:1 인장 카드 + 표정별 스탠딩/차분 전환
// 표정마다 원본 이미지(인장·스탠딩 무관)와 1:1 썸네일 위치(크롭)를 저장 —
// 카드 메인은 현재 표정의 1:1 크롭, 썸네일 클릭으로 표정 전환, 메인 클릭 시 원본(스탠딩) 확대
import type { CropValue } from '@/components/ui/CropEditor';

export interface TrpgFace {
  id: string;
  label?: string;            // 표정 이름 (선택 — 기본/웃음 등)
  imgId?: string;            // 원본 이미지 (IndexedDB — 인장 또는 스탠딩)
  crop?: CropValue;          // 1:1 썸네일 위치
  ph?: string;               // 데모 플레이스홀더
}

export interface CocSkill {
  id: string;
  name: string;
  base: string;
  current: string;
  growthChecked: boolean;
}

export interface CocWeapon {
  id: string;
  name: string;
  skill: string;
  damage: string;
  range: string;
  attacks: string;
  ammo: string;
  malfunction: string;
  image: string;
}

export interface CocInventoryItem {
  id: string;
  name: string;
  description: string;
}

export interface CocScenarioLog {
  id: string;
  title: string;
  date: string;
  note: string;
}

export interface TrpgScenarioLog {
  id: string;
  date: string;
  role: string;
  title: string;
  note: string;
}

export interface CocInvestigatorSheet {
  investigator: {
    player: string;
    occupation: string;
    age: string;
    gender: string;
    residence: string;
    birthplace: string;
    catchphrase: string;
  };
  characteristics: Record<'str' | 'con' | 'siz' | 'dex' | 'app' | 'int' | 'pow' | 'edu', string>;
  derived: {
    hp: string;
    hpMax: string;
    mp: string;
    mpMax: string;
    sanity: string;
    sanityMax: string;
    luck: string;
    damageBonus: string;
    build: string;
    moveRate: string;
  };
  mental: {
    sanityAdaptation: string;
    temporaryInsanity: boolean;
    longTermInsanity: boolean;
    bout: string;
    currentState: string;
  };
  skills: CocSkill[];
  backstoryHtml: string;
  weapons: CocWeapon[];
  equipment: CocInventoryItem[];
  possessions: CocInventoryItem[];
  finance: { spendingLevel: string; cash: string; assets: string };
  scenarioLogs?: CocScenarioLog[];
}

export const COC7_SKILL_DEFAULTS = [
  ['회계', '5'], ['인류학', '1'], ['감정', '5'], ['고고학', '1'],
  ['예술/공예(전문화)', '5'], ['매혹', '15'], ['등반', '20'], ['신용', '0'],
  ['크툴루 신화', '0'], ['변장', '5'], ['회피', 'DEX/2'], ['자동차 운전', '20'],
  ['전기수리', '10'], ['전자기기', '1'], ['컴퓨터 사용', '5'], ['말재주', '5'], ['근접전(격투)', '25'],
  ['사격(권총)', '20'], ['사격(소총/산탄총)', '25'], ['응급처치', '30'], ['역사', '5'],
  ['위협', '15'], ['도약', '20'], ['외국어(모국어)', 'EDU'], ['외국어(전문화)', '1'],
  ['법률', '5'], ['자료조사', '20'], ['듣기', '20'], ['열쇠공', '1'],
  ['기계수리', '10'], ['의료', '1'], ['자연', '10'], ['항법', '10'],
  ['오컬트', '5'], ['설득', '10'], ['조종(전문화)', '1'], ['정신분석', '1'],
  ['심리학', '10'], ['승마', '5'], ['과학(전문화)', '1'], ['손놀림', '10'],
  ['관찰력', '25'], ['은밀행동', '20'], ['생존술(전문화)', '10'], ['수영', '20'],
  ['투척', '20'], ['추적', '10'],
] as const;

export const INSANE_SPECIALTY_GROUPS = [
  { id: 'violence', name: '폭력', skills: ['소각', '고문', '포박', '협박', '파괴', '구타', '절단', '찌르기', '사격', '전쟁', '매장'] },
  { id: 'emotion', name: '정서', skills: ['연심', '기쁨', '걱정', '부끄러움', '웃음', '인내', '놀람', '노여움', '원한', '슬픔', '친애'] },
  { id: 'perception', name: '지각', skills: ['고통', '관능', '촉감', '냄새', '맛', '소리', '풍경', '추적', '예술', '제육감', '그늘'] },
  { id: 'technology', name: '기술', skills: ['분해', '전자기기', '정리', '약품', '효율', '미디어', '카메라', '탈것', '기계', '함정', '병기'] },
  { id: 'knowledge', name: '지식', skills: ['물리학', '수학', '화학', '생물학', '의학', '교양', '인류학', '역사', '민속학', '고고학', '천문학'] },
  { id: 'mystery', name: '괴이', skills: ['시간', '혼돈', '심해', '죽음', '영혼', '마술', '암흑', '종말', '꿈', '지저', '우주'] },
] as const;

export interface InsaneSpecialty {
  id: string;
  selected: boolean;
  targetOverride?: string;
}

export interface InsaneAbility {
  id: string;
  name: string;
  type: string;
  specialtyId: string;
  effect: string;
}

export interface InsaneRelationship {
  id: string;
  name: string;
  residence: string;
  emotion: string;
}

export interface InsaneCharacterSheet {
  player: string;
  age: string;
  gender: string;
  occupation: string;
  achievement: string;
  referenceUrl: string;
  catchphrase: string;
  curiosityGroupId: string;
  fearSpecialtyId: string;
  specialties: InsaneSpecialty[];
  abilities: InsaneAbility[];
  life: string;
  lifeMax: string;
  sanity: string;
  sanityMax: string;
  relationships: InsaneRelationship[];
}

export const MAGICALOGIA_SPECIALTY_GROUPS = [
  { id: 'star', name: '별', skills: ['황금', '대지', '숲', '길', '바다', '정적', '비', '폭풍', '태양', '천공', '이계'] },
  { id: 'beast', name: '짐승', skills: ['살', '벌레', '꽃', '피', '비늘', '혼돈', '이빨', '외침', '분노', '날개', '에로스'] },
  { id: 'force', name: '힘', skills: ['중력', '바람', '흐름', '물', '파문', '자유', '충격', '우레', '불', '빛', '원환'] },
  { id: 'song', name: '노래', skills: ['이야기', '선율', '눈물', '이별', '미소', '마음', '승리', '사랑', '정열', '치유', '시간'] },
  { id: 'dream', name: '꿈', skills: ['추억', '수수께끼', '거짓', '불안', '잠', '우연', '환각', '광기', '기도', '희망', '미래'] },
  { id: 'darkness', name: '어둠', skills: ['심연', '부패', '배신', '방황', '나태', '왜곡', '불행', '바보', '악의', '절망', '죽음'] },
] as const;

export interface MagiaSpecialty {
  id: string;
  selected: boolean;
  targetOverride?: string;
}

export interface MagiaAnchor {
  id: string;
  active: boolean;
  name: string;
  destiny: string;
  aspect: string;
  description: string;
}

export interface MagiaSpell {
  id: string;
  name: string;
  type: string;
  target: string;
  effect: string;
  specialtyId: string;
  cost: string;
  charges: boolean[];
  tool: string;
  overview: string;
  memo: string;
}

export interface MagiaObligation {
  id: string;
  text: string;
  fulfilled: boolean;
}

export interface MagiaSessionLog {
  id: string;
  date: string;
  role: string;
  scenarioTitle: string;
  rank: string;
  memo: string;
  achievement: string;
  magia: string;
  magicName: string;
}

export interface MagicaLogiaCharacterSheet {
  magicName: string;
  practitioner: string;
  rank: string;
  gender: string;
  age: string;
  codeName: string;
  socialStatus: string;
  attack: string;
  defense: string;
  root: string;
  trueForm: string;
  trueFormEffect: string;
  mana: string;
  achievement: string;
  magia: string;
  temporaryMana: string;
  credo: string;
  career: string;
  institution: string;
  introduction: string;
  condition: string;
  specialtyNotes: string;
  specialties: MagiaSpecialty[];
  soulSpecialtyId: string;
  soulTargetOverride?: string;
  anchors: MagiaAnchor[];
  grimoireSettings: string;
  domainSettings: string;
  obligations: MagiaObligation[];
  statusAilments: string;
  spells: MagiaSpell[];
  sessionLogs?: MagiaSessionLog[];
}

export type Dx3rdAbilityKey = 'body' | 'sense' | 'mind' | 'social';
export type Dx3rdEffectCategory = 'effect' | 'easy' | 'nonConsumptive' | 'eLois' | 'psionic';

export interface Dx3rdSkill {
  id: string;
  group: Dx3rdAbilityKey;
  name: string;
  value: string;
}

export interface Dx3rdEffect {
  id: string;
  name: string;
  level: string;
  timing: string;
  skill: string;
  difficulty: string;
  target: string;
  range: string;
  cost: string;
  restriction: string;
  description: string;
  active: boolean;
}

export interface Dx3rdLois {
  id: string;
  category: string;
  name: string;
  positive: string;
  positiveActive: boolean;
  negative: string;
  negativeActive: boolean;
  description: string;
  t: boolean;
  s: boolean;
}

export interface Dx3rdMemory {
  id: string;
  relationship: string;
  name: string;
  emotion: string;
  description: string;
}

export interface Dx3rdWeapon {
  id: string;
  name: string;
  category: string;
  skill: string;
  range: string;
  accuracy: string;
  attack: string;
  guard: string;
  stock: string;
  exp: string;
  description: string;
}

export interface Dx3rdArmor {
  id: string;
  name: string;
  category: string;
  dodge: string;
  action: string;
  armor: string;
  stock: string;
  exp: string;
  description: string;
}

export interface Dx3rdVehicle {
  id: string;
  name: string;
  category: string;
  skill: string;
  attack: string;
  action: string;
  armor: string;
  movement: string;
  stock: string;
  exp: string;
  description: string;
}

export interface Dx3rdItem {
  id: string;
  name: string;
  category: string;
  skill: string;
  stock: string;
  exp: string;
  description: string;
}

export interface Dx3rdCombo {
  id: string;
  name: string;
  timing: string;
  skill: string;
  difficulty: string;
  target: string;
  range: string;
  restriction: string;
  cost: string;
  diceUnder100: string;
  diceOver100: string;
  criticalUnder100: string;
  criticalOver100: string;
  attackUnder100: string;
  attackOver100: string;
}

export interface Dx3rdSeedData {
  category: string;
  name: string;
  hp: string;
  action: string;
  armor: string;
  guard: string;
  attack: string;
  abilities: Record<Dx3rdAbilityKey, string>;
  skills: Dx3rdSkill[];
  items: Dx3rdItem[];
}

export interface Dx3rdCharacterSheet {
  codename: string;
  codenameRuby: string;
  characterName: string;
  characterNameRuby: string;
  age: string;
  gender: string;
  birthday: string;
  height: string;
  cover: string;
  works: string;
  birth: string;
  experience: string;
  reunion: string;
  catchphrase: string;
  characterSetting: string;
  breed: string;
  syndromes: string[];
  abilities: Record<Dx3rdAbilityKey, string>;
  skills: Dx3rdSkill[];
  hp: string;
  hpMaxOverride: string;
  erosion: string;
  bonusOverride: string;
  initiativeOverride: string;
  stockPoints: string;
  propertyPoints: string;
  experienceTotal: string;
  experienceSpent: string;
  experienceRemaining: string;
  lois: Dx3rdLois[];
  memories: Dx3rdMemory[];
  effects: Record<Dx3rdEffectCategory, Dx3rdEffect[]>;
  weapons: Dx3rdWeapon[];
  armors: Dx3rdArmor[];
  vehicles: Dx3rdVehicle[];
  items: Dx3rdItem[];
  combos: Dx3rdCombo[];
  enemyData?: Dx3rdSeedData;
  crawlingChaos?: { insanity: string; insanityDescription: string; root: string; grimoire: Dx3rdItem[]; spells: Dx3rdItem[] };
}

export interface TrpgChar {
  id: string;
  name: string;              // 이름 (필수)
  scenario: string;          // 다녀온 시나리오
  rule: string;              // 룰 (CoC 7th 등)
  role: string;              // 역할 — PL · GMPC · HO1 등
  desc: string;              // 간단한 설명 (리치 에디터 HTML — 격리 렌더)
  // 이미지 방식 (v1.9): 단일 인장(표정마다 1:1 인장, 개별 크롭) /
  // 스탠딩 인장(표정 차분 — 모든 파일의 가로세로 크기 동일 강제, 썸네일 크롭 위치 공유)
  imgMode?: 'stamp' | 'standing';
  crop?: import('@/components/ui/CropEditor').CropValue; // 스탠딩 공유 썸네일 위치
  stdW?: number; stdH?: number; // 스탠딩 기준 크기 (업로드 검증용)
  faces: TrpgFace[];         // 첫 번째가 대표 인장
  ph: string;
  sheetType?: 'general' | 'coc' | 'insane' | 'magicalogia' | 'dx3rd';
  coc?: CocInvestigatorSheet;
  insane?: InsaneCharacterSheet;
  magicalogia?: MagicaLogiaCharacterSheet;
  dx3rd?: Dx3rdCharacterSheet;
  scenarioLogs?: TrpgScenarioLog[];
}

/** 표정의 썸네일 크롭 — 스탠딩이면 공유 크롭, 단일 인장이면 개별 크롭 */
export const faceCrop = (c: TrpgChar, f?: TrpgFace) =>
  (c.imgMode === 'standing' ? c.crop : f?.crop) ?? f?.crop;

export const TCHAR_SEED: TrpgChar[] = [];

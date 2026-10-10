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
  scenarioLogs: CocScenarioLog[];
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
  sheetType?: 'general' | 'coc';
  coc?: CocInvestigatorSheet;
}

/** 표정의 썸네일 크롭 — 스탠딩이면 공유 크롭, 단일 인장이면 개별 크롭 */
export const faceCrop = (c: TrpgChar, f?: TrpgFace) =>
  (c.imgMode === 'standing' ? c.crop : f?.crop) ?? f?.crop;

export const TCHAR_SEED: TrpgChar[] = [];

/* =========================================================
   pracActionAdvisor.ts
   Rule-based AI Action Advisor for dp001 Practice Dashboard
   (LOD-aware version)
   ========================================================= */

/* ---------- LOD Definition ---------- */
export type LODLevel = 1 | 2 | 3;

/* ---------- Input Context ---------- */
export type PracContext = {
  /** 當前分析層級（LOD） */
  lodLevel?: LODLevel;

  /** 平均正確率（0–100） */
  avgScore: number;

  /** 平均每題作答秒數 */
  avgSpeedSec: number;

  /** 低於班級平均的能力指標數 */
  belowClassCount: number;

  /** 仍低於及格線的能力指標數 */
  struggleCount: number;

  /** 是否已達整體學習目標 */
  reachedGoal: boolean;

  /** 最近是否出現表現下降 */
  recentDrop?: boolean;

  /** 最近是否有明顯進步 */
  recentImprovement?: boolean;

  /** 是否存在明顯作答速度過慢 */
  slowSpeed?: boolean;
};

/* ---------- Output Schema ---------- */
export type AIActionSuggestion = {
  level: "info" | "warning" | "success";
  title: string;
  explanation: string;
  actions: string[];
  nextStep?: "overview" | "indicator" | "item";
  tag?: "risk" | "opportunity" | "maintenance";
};

/* ---------- Threshold Settings ---------- */
const PASS_SCORE = 60;
const GOAL_SCORE = 80;
const FAST_SPEED_SEC = 4;
const SLOW_SPEED_SEC = 8;

/* =========================================================
   Main Generator
   ========================================================= */

export function generatePracSuggestion(
  ctx: PracContext
): AIActionSuggestion | null {

  const lod: LODLevel = ctx.lodLevel ?? 1;

  /* =====================================================
     情境 1：高投入但仍卡關（最重要）
     ===================================================== */
  if (ctx.struggleCount > 0 && ctx.avgScore < PASS_SCORE) {
    return {
      level: "warning",
      tag: "risk",
      title: "發現卡關的能力指標",
      explanation:
        lod === 1
          ? "目前整體學習狀態顯示，部分能力指標仍未達及格標準，需要特別留意。"
          : lod === 2
          ? "你在部分能力指標中已有多次練習，但正確率仍偏低，顯示現行策略尚未有效突破。"
          : "在多次練習後仍錯誤的題目，代表你可能在特定概念或解題步驟上卡關。",
      actions:
        lod === 1
          ? ["點選查看卡關的能力指標"]
          : lod === 2
          ? [
              "查看低於及格線的能力指標",
              "觀察是否集中在特定題型或概念",
            ]
          : [
              "逐題檢視錯題的解題步驟",
              "標記反覆錯誤的題目進行重練",
              "嘗試放慢作答速度並驗算",
            ],
      nextStep: lod === 3 ? "item" : "indicator",
    };
  }

  /* =====================================================
     情境 2：正確率高但作答偏慢
     ===================================================== */
  if (ctx.avgScore >= GOAL_SCORE && ctx.avgSpeedSec > SLOW_SPEED_SEC) {
    return {
      level: "info",
      tag: "maintenance",
      title: "概念正確，但作答尚未流暢",
      explanation:
        lod === 1
          ? "整體學習成果良好，但仍有精進空間。"
          : lod === 2
          ? "你的正確率已達目標，但作答速度偏慢，代表熟練度仍可提升。"
          : "題目多能答對，但部分題型花費時間較長，顯示尚未內化解題流程。",
      actions:
        lod === 1
          ? ["進一步查看作答速度表現"]
          : lod === 2
          ? [
              "檢視作答時間偏長的能力指標",
              "嘗試限時練習",
            ]
          : [
              "進行短時高頻練習",
              "針對耗時題型做流程整理",
            ],
      nextStep: lod === 3 ? "item" : "indicator",
    };
  }

  /* =====================================================
     情境 3：作答速度快但正確率低（猜測）
     ===================================================== */
  if (ctx.avgScore < PASS_SCORE && ctx.avgSpeedSec <= FAST_SPEED_SEC) {
    return {
      level: "warning",
      tag: "risk",
      title: "作答速度快但正確率偏低",
      explanation:
        lod === 1
          ? "目前學習狀態顯示理解可能尚未穩定。"
          : lod === 2
          ? "作答速度偏快但正確率低，可能存在猜測作答的情形。"
          : "部分題目作答過快且錯誤，建議重新檢視題目理解。",
      actions:
        lod === 1
          ? ["查看相關能力指標"]
          : lod === 2
          ? [
              "觀察錯誤是否集中在特定題型",
              "留意作答時間與正確率關係",
            ]
          : [
              "逐題檢查題目條件",
              "練習完整寫出解題步驟",
            ],
      nextStep: "item",
    };
  }

  /* =====================================================
     情境 4：低於班級平均
     ===================================================== */
  if (ctx.belowClassCount > 0) {
    return {
      level: "info",
      tag: "risk",
      title: "部分能力表現低於班級平均",
      explanation:
        lod === 1
          ? "部分能力指標的表現低於班級平均。"
          : lod === 2
          ? "你在部分能力指標中與班級存在差距，值得進一步檢視。"
          : "這些能力指標的錯題可作為優先補強的重點。",
      actions:
        lod === 1
          ? ["查看落後的能力指標"]
          : lod === 2
          ? ["比較與班級差距最大的指標"]
          : ["整理低於班級平均的錯題清單"],
      nextStep: lod === 3 ? "item" : "indicator",
    };
  }

  /* =====================================================
     情境 5：已達學習目標
     ===================================================== */
  if (ctx.reachedGoal) {
    return {
      level: "success",
      tag: "opportunity",
      title: "已達目前學習目標",
      explanation:
        lod === 1
          ? "目前整體學習狀態良好。"
          : lod === 2
          ? "所有能力指標已達學習目標，學習策略有效。"
          : "你已能穩定完成題目，可嘗試進階或挑戰型題目。",
      actions:
        lod === 1
          ? ["繼續維持學習節奏"]
          : lod === 2
          ? ["嘗試新的學習單元"]
          : ["挑戰高難度或跨單元題目"],
      nextStep: "overview",
    };
  }

  /* =====================================================
     預設
     ===================================================== */
  return {
    level: "info",
    tag: "maintenance",
    title: "目前學習狀態穩定",
    explanation:
      "目前未偵測到明顯的學習風險，建議持續觀察學習表現變化。",
    actions: ["定期檢視學習狀態"],
    nextStep: "overview",
  };
}

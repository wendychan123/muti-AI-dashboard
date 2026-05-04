export type PolicyExplainTarget =
  | "policy_overview"    // 總覽練習概況
  | "development_index"  // 練習診斷指標 (四象限)
  | "regional_gap"       // 區域學習差距 (長條圖)
  | "gap_trend"          // 區域成效對標 (面積圖)
  | "practice_trend"     // 練習時間走勢 (柱線雙軸)
  | "effect_trend"       // 正確率走勢 (折線圖)
  | "scissors_gap"       // 校際差距走勢 (雙軸趨勢)
  | "school_matrix";     // 學校落點分佈 (散佈圖)

// 供介面與 Prompt 使用的圖表顯示名稱
const POLICY_CHART_LABEL_MAP: Record<PolicyExplainTarget, string> = {
  policy_overview: "總覽練習概況",
  development_index: "練習診斷指標",
  regional_gap: "區域學習差距",
  gap_trend: "區域成效對標",
  practice_trend: "練習時間走勢",
  effect_trend: "正確率走勢",
  scissors_gap: "校際差距走勢",
  school_matrix: "學校落點分佈"
};

// 針對每張圖表的AI 判讀重點指引
const CHART_FOCUS_GUIDE: Record<PolicyExplainTarget, string> = {
  policy_overview: "重點：評估整體學生參與規模、平均成效與投入強度的基本健康度，定調該區學習現況。",
  development_index: "重點：評估「人均練習」與「正確率」的投資報酬率(ROI)，找出高投入低成效的「苦勞/瓶頸區」或低投入低成效的「待觀察區」。",
  regional_gap: "重點：檢視該區域平均與「全部縣市基準」的正負差距幅度，評估整體學力在全國的相對位置。",
  gap_trend: "重點：觀察該區域與基準線差距的長期波動，抓出特定時間點(如考前/連假)的劇烈落差變化。",
  practice_trend: "重點：比對「活躍學生數」與「練習總次數」，觀察學習動能的延續性，並警示可能出現的「學習疲勞」期。",
  effect_trend: "重點：觀察平均正確率的波動穩定度，判斷學習成效是否具備長期可持續性，抑或只是短暫拉抬。",
  scissors_gap: "重點：交叉比對「平均正確率」與「校際差距(標準差)」。若出現平均上升但差距擴大(剪刀差現象)，請強烈預警資源嚴重傾斜的問題，並『直接從中點出極端落後的學校代碼』作為關注重點。",
  school_matrix: "重點：以學校為單位，揪出落入「高投入低成效(需教學端支援)」或「低投入低成效(需行政端介入)」的具體長尾/弱勢學校群體結構。"
};

export interface BuildPolicyPracPromptParams {
  city: string;
  subject: string;
  period: string;
  startDate: string | null;
  endDate: string | null;
  selectedCharts: PolicyExplainTarget[];

  stats: {
    totalStudents: number;
    avgScore: number;            // 百分比 (0-100)
    avgPracPerStudent: number;   // 人均練習
    schoolGap: number | null;    // 平均校際差距
  };
  chartData?: any;           // 供 AI 讀取的 JSON 乾淨數據
  knowledgeContext?: string; // 供 AI 讀取的 RAG 教學知識庫
}

function fmtInt(n: number) {
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}
function fmt1(n: number) {
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}
function fmt2(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

export function buildPolicyPracPrompt(
  params: BuildPolicyPracPromptParams
): string {
  const {
    city,
    subject,
    period,
    startDate,
    endDate,
    selectedCharts,
    stats,
    chartData,
    knowledgeContext
  } = params;

  const subjectLabel =
    subject === "全部科目" ? "跨科目整體分析" : subject;

  const dateLabel =
    startDate && endDate ? `${startDate} ～ ${endDate}` : "—";

  const schoolGapLabel =
    typeof stats.schoolGap === "number" && Number.isFinite(stats.schoolGap)
      ? fmt2(stats.schoolGap)
      : "—";

  // 將選中的圖表名稱與其專屬的判讀重點組合起來
  const chartsGuideText = selectedCharts
    .map((c) => `- ${POLICY_CHART_LABEL_MAP[c]}\n  分析焦點：${CHART_FOCUS_GUIDE[c]}`)
    .join("\n\n");

  const isSingle = selectedCharts.length === 1;

  const crossSubjectWarning = selectedCharts.includes("scissors_gap") && subject !== "全部科目"
    ? `\n本次分析包含「校際差距走勢」圖表，該圖表系統已設定為固定顯示「全區跨科目整體數據」，**不受上述單一科目（${subject}）範圍限制**。進行跨圖表整合分析時，請務必意識到此維度的差異，不可將校際差距解讀為單一科目的現象。`
    : "";

  return `
你是一位「教育政策分析顧問」，針對「${city} 教育管理者」之區域學習分析儀表板進行專業判讀。
請使用「專業、客觀、審慎、策略導向」語氣，不得使用口語化表達或對話式語句。

⚠️ 所有判斷必須嚴格依據提供的數據與圖表焦點。
⚠️ 不得臆測未提供的數據。
⚠️ 不得假設學校個別情境。
⚠️ 不得給學生個別學習建議。

【分析範圍】
行政區域：${city}
科目範圍：${subjectLabel}
資料期間：${period || dateLabel}

【區域整體摘要數據】
學生人數：${fmtInt(stats.totalStudents)}
平均答題正確率：${fmt1(stats.avgScore)}%
人均練習次數：${fmt2(stats.avgPracPerStudent)}
平均校際差距：${schoolGapLabel}

【本次納入分析的圖表與指引】
${chartsGuideText}
${crossSubjectWarning}

【圖表 JSON 乾淨數據】
${JSON.stringify(chartData ?? {}, null, 2)}

【專屬政策知識庫支援 (RAG Context)】
以下是系統針對該科目/節點為您檢索出的「專屬政策知識庫」。給予行政與資源調度建議時，【絕對必須】引用這裡的【管理者建議 (Policy)】來提出解方，避免給出「加強關注」等空泛言論：
${knowledgeContext ? knowledgeContext : "（無特定單元知識庫，請依區域數據客觀分析並給予一般性政策建議）"}

---------------------------------------------------
重要任務說明：

${
  isSingle
    ? `
本次僅選擇 1 張圖表：
- 請依據上述【分析焦點】進行「深入解析」。
- 必須說明該圖表的政策意涵。
- 必須說明其所反映的區域發展現象。
- 不可延伸至未選圖表。
`
    : `
本次選擇 2 張以上圖表：
- 必須依據上述【分析焦點】進行「跨圖整合分析」。
- 不得逐張圖分開解釋。
- 必須說明圖與圖之間的因果或結構關聯。
- 必須回答：
  1. 投入與成效是否一致？
  2. 成效差距是否與投入強度相關？
  3. 趨勢變化是否與區域結構有關？
  4. 是否存在結構性風險訊號？
`
}

所有判讀需依據：
- 提供之摘要數據與 JSON 乾淨數據
- 所選圖表之【分析焦點】與潛在呈現之趨勢差距
- 專屬政策知識庫中提示的教學斷點

---------------------------------------------------
【輸出格式規範（嚴格遵守）】

請務必將回覆分為兩個部分，中間用「===詳細分析===」隔開：

第一部分：
(此處請勿出現「｜快讀總結」字樣)
請遵循以下限制：
- 專業、冷靜、直指出該 ${city} 縣市問題。開頭無需打招呼，禁用「本報告、本分析、根據數據顯示」等冗贅詞彙。
- 禁止使用 Markdown 粗體符號（**），保持純文本或簡單清單

請提供 1-2 句極其精簡的宏觀判讀：
1. 直接說明區域整體的教育表現健康度（如：科目表現穩定、呈現資源失衡趨勢、或跨校差距擴大）。
2. 識別非單一學校，而是全區性的知識盲點，指出最顯著的結構性風險或區域資源缺口。
3. 給出一項具備「政策資源調度」意義的具體優先級動作。

第二部分：詳細分析報告內容
請用以下結構：
- 主項目請使用「•」
- 子說明請使用「  ◦」(縮排兩空格)
- 每個段落請空一行
- 請勿使用敘述段落
- 請勿使用 Markdown 粗體符號（**）
- 確保建議屬於「行政區與資源配置」層級，而非個別學生指導

===詳細分析===

｜整體狀況
• （列出 1-2 點，每點 1 句）
  ◦ 必須清楚說明本次分析條件（行政區域、科目、期間）
  ◦ 判讀整體學習發展狀態（穩定 / 改善 / 波動 / 需關注）
  ◦ 判讀投入與成效是否呈現合理關聯
  ◦ 針對「平均校際差距」說明其政策關注意義，若無資料請說明資料缺口風險

｜圖表解讀
${
  isSingle
    ? `
• （針對該圖表提出 1 點解析）
  ◦ 依據該圖表的【分析焦點】說明教育狀況意義
  ◦ 說明數據呈現出的結構現象
  ◦ 說明可能的制度層面影響（不得超出數據）
`
    : `
• （列出 1 點跨圖整合發現）
  ◦ 每一點必須同時引用至少 2 張圖的【分析焦點】
  ◦ 必須說明圖與圖之間的因果或結構關聯
  ◦ 不得僅做單圖描述
`
}

｜決策提醒
區域優勢：
  ◦ 指出 1 項具政策價值之發展優勢（以系統層級表述）

潛在風險：
  ◦ 指出 1 項需監測之結構性風險
  ◦ 說明建議監測之指標或警戒訊號

｜行動建議
（請務必根據上方的【專屬政策知識庫】中的「管理者建議(Policy)」來撰寫，絕對不可捏造空泛建議）
• （列出 3 點）
  ◦ 每一點需包含「策略動作 + 目的 + 針對對象」
  ◦ 必須屬於政策層級（例如：將特定數位教具資源導入落後學區、針對某特定單元規劃跨校研習）
  ◦ 不可給學生個別建議
  ◦ 不可假設未提供之數據

請保留上述標題格式，嚴格禁止使用粗體符號，直接輸出內容。
`;
}
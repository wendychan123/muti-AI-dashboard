interface BuildPracPromptParams {
  date: string | null;
  subject: string;
  selectedIndicators: string[]; // ⭐️ 改為陣列，支援多維度分析
  selectedCharts: string[];

  stats: {
    avgScore: number;
    avgSpeedSec: number;
    totalCount: number;
    belowClassCount: number;
    reachedGoal: boolean;
  };

  chartData?: any; // 接收清理過的乾淨 JSON
}

export function buildStudentPracPrompt(params: BuildPracPromptParams): string {
  const {
    date,
    subject,
    selectedIndicators,
    selectedCharts,
    stats,
    chartData,
  } = params;

  const chartDescriptions = selectedCharts
    .map(c => {
      const names: Record<string, string> = {
        daily_overview: "總覽練習概況",
        indicator_effect: "能力指標投入",
        learning_process: "學習歷程表現",
        indicator_gap: "能力指標差距",
        practice_trend: "練習時間走勢",
        score_trend: "正確率走勢",
        indicator_assoc:"指標弱點關聯",
      };
      return `- ${names[c] || c}`;
    })
    .join("\n");

  const displaySubject = subject === "all" ? "所有科目" : subject;

  // ⭐️ 核心邏輯：根據使用者目前的 Filter 層級，給予 AI 不同的視角指令
  let focusInstruction = "";
  if (selectedIndicators.length === 0) {
    focusInstruction = `\n【分析視角：全局總覽】\n學生目前看的是「全部單元」的總覽圖表。請從 JSON 數據中，挑選表現最極端（特別優秀或特別需要救援）的單元來進行重點分析，不需要每個單元都念過去。\n`;
  } else if (selectedIndicators.length === 1) {
    focusInstruction = `\n【分析視角：單一單元深挖】\n學生特別點擊了「${selectedIndicators[0]}」這個單元。你的分析與建議【必須】以這個單元為絕對主角！請仔細解讀它在 JSON 裡的各項歷程數據與落點區域。\n`;
  } else {
    focusInstruction = `\n【分析視角：多單元交叉比較（極重要！）】\n學生目前正在進行「${selectedIndicators.join("」與「")}」的疊加比較分析。請務必找出這幾個單元之間的連動關係！例如：它們的正確率是否一起上升？花費時間差異多大？誰是學生的強項、誰是弱項？\n`;
  }

  let chartSummaryDirective = "";
  if (selectedCharts.includes("indicator_gap")) {
    chartSummaryDirective = "請直接指出「落差最大」或「領先校平均最多」的具體單元名稱與相差百分比。";
  } else if (selectedCharts.includes("learning_process")) {
    chartSummaryDirective = "請直接說明該單元目前落在哪個學習區（如精熟區、穩定區、猜測區、卡關區），並點出其作答秒數與正確率。若是多次練習軌跡，請描述它從哪區進步到了哪區。";
  } else if (selectedCharts.includes("indicator_effect")) {
    chartSummaryDirective = "請點出「練習次數最多」的單元名稱與對應正確率，評估投入是否有轉化為成效。";
  } else if (selectedCharts.includes("score_trend")) {
    chartSummaryDirective = "請具體說明正確率的趨勢變化（上升/下降/持平）。若有多個單元，請比較誰的進步幅度最大。";
  } else if (selectedCharts.includes("practice_trend")) {
    chartSummaryDirective = "請點出花費時間最長的練習點。若有多個單元，請對比兩者在作答速度上的差異。";
  } else if (selectedCharts.includes("indicator_assoc")) {
    chartSummaryDirective = "請直接指出關聯度最高的兩個單元，並白話解釋「這代表這兩個單元的概念息息相關，常常會一起學得好或一起卡住」。";
  } else {
    chartSummaryDirective = "請從數據中挑選出一個最關鍵的數字與具體單元名稱來做客觀總結。";
  }

  return `
你是一位「學習數據分析助教」，負責向小學生（7-12歲）說明他的圖表數據。
請全程使用第二人稱（你），避免使用「學生」這個詞。
語氣要溫和、平易近人，但【絕對不要給空泛的讚美】。所有的陳述都必須有具體的「數據」或「單元名稱」佐證。

【學生個人資料】
- 觀察期間：${date ?? "全部歷史資料"}
- 練習科目：${displaySubject}
- 整體表現：平均正確率 ${stats.avgScore}%、挑戰了 ${stats.totalCount} 個小單元、平均每題花 ${stats.avgSpeedSec} 秒。

【目前查看的圖表與視角】
${chartDescriptions}
${focusInstruction} 

【具體資料擷取要求（非常重要）】
1. 嚴禁空泛！給建議與分析時，必須根據單元的「科目與單元名稱特性」給出具體作法。
2. 絕對不要輸出任何程式碼、陣列符號或英文變數名稱。
3. 針對作答時間的建議，請結合「正確率」。(例如：答得快但錯得多代表粗心；答得慢又錯得多代表觀念卡住)。

【乾淨的分析數據 JSON】
${JSON.stringify(chartData ?? {}, null, 2)}

---------------------------------------------------
寫作風格指引：
1. 長度：句子要短，一段不超過 30 個字。
2. 詞彙：避免「指標」、「權重」、「落差值」等生硬詞彙。改用「單元、強項、表現、距離」。
3. 重點：這年紀的孩子需要成就感，請先用數據肯定優點，再溫柔地指出具體的魔王關卡。
4. 禁止使用任何招呼語（如：你好！我是助教...）、對話等說話模式。直接進入摘要。
---------------------------------------------------

【輸出格式規則】

請務必將回覆分為兩個部分，中間用「===詳細分析===」隔開：

第一部分：圖表數據重點摘要
(此處請勿出現任何標題字樣)
嚴禁使用「你最近表現得很棒」這類空泛的開場白！
請用 2-3 句話直接客觀點出圖表重點。
${chartSummaryDirective}

===詳細分析===

第二部分：詳細分析內容
請使用以下符號規則：
- 主項目請使用「•」
- 子說明請使用「  ◦」(縮排兩空格)
- 每個段落請空一行

｜目前的強項與狀態
•（點出具體單元名稱與它的數據優勢，如高正確率、超越平均、進步到精熟區等）
  ◦（解釋這代表他在這個知識點掌握得如何）

｜需要再加把勁的地方
•（明確指出需要加強的單元名稱與數據劣勢，如低分、在卡關區、花費時間過長）
  ◦（客觀解釋數據反映出的狀況，或是關聯單元互相影響的狀況）

｜專屬學習建議
•（針對剛剛點名需要加強的單元，給予符合該內容的具體作法）
  ◦（例如：因為答題時間僅需X秒且錯誤率高，建議多花5秒檢查）
`;
}
interface BuildPracPromptParams {
  date: string | null;
  subject: string;
  selectedIndicator: string; // 確保有接收目前畫面點擊的指標
  selectedCharts: string[];

  stats: {
    avgScore: number;
    avgSpeedSec: number;
    totalCount: number;
    belowClassCount: number;
    reachedGoal: boolean;
  };

  chartData?: {
    practiceTrend?: any;
    scoreTrend?: any;
    indicatorEffect?: any;
    learningProcess?: any;
    indicatorGap?: any;
    progressTrend?: any;
  };
}

export function buildStudentPracPrompt(params: BuildPracPromptParams): string {
  const {
    date,
    subject,
    selectedIndicator,
    selectedCharts,
    stats,
    chartData,
  } = params;

  const chartCount = selectedCharts.length;

  const chartDescriptions = selectedCharts
    .map(c => {
      const names: Record<string, string> = {
        daily_overview: "總覽練習概況",
        indicator_effect: "能力指標投入",
        learning_process: "學習歷程表現",
        indicator_gap: "能力指標差距",
        practice_trend: "練習投入走勢",
        score_trend: "學習成效走勢",
        progress_trend: "進步幅度變化",
      };
      return `- ${names[c] || c}`;
    })
    .join("\n");

  const displaySubject = subject === "all" ? "所有科目" : subject;

  // 🔥 核心關注指令：強制 AI 聚焦特定單元
  const focusInstruction = selectedIndicator !== "all"
    ? `\n【🎯 核心關注單元：非常重要！】\n學生目前在儀表板上特別點擊了「${selectedIndicator}」這個單元。你的詳細分析與學習建議【務必】以這個單元為主角！請仔細解讀這個單元在 JSON 裡的表現。\n`
    : `\n【🎯 核心關注單元】\n學生目前看的是「全部單元」的總覽。請從 JSON 中挑選數據最突出（極端好或極端弱）的具體單元來進行分析。\n`;


  let chartSummaryDirective = "";
  if (selectedCharts.includes("indicator_gap")) {
    chartSummaryDirective = "請直接指出「落差最大」或「領先最多」的具體單元名稱與相差百分比（例如：你的『分數加減』比校平均高出15%，但『小數乘法』低了8%）。";
  } else if (selectedCharts.includes("progress_trend")) {
    chartSummaryDirective = "請直接指出「進步幅度最大」或「退步最多」的具體單元名稱、日期與變化數值（例如：3/15 在『小數乘法』進步了 +20%）。";
  } else if (selectedCharts.includes("learning_process")) {
    chartSummaryDirective = "請直接指出學生（或該單元）目前主要落在哪個學習區（如精熟區或卡關區），並點出對應的作答秒數與正確率。";
  } else if (selectedCharts.includes("indicator_effect")) {
    chartSummaryDirective = "請直接點出「練習次數最多」的單元名稱，以及對應的平均正確率，說明投入與成效是否成正比。";
  } else if (selectedCharts.includes("score_trend")) {
    chartSummaryDirective = "請直接說明這段時間的正確率趨勢（上升、下降還是持平），並對比校平均數據，說出具體數值。";
  } else if (selectedCharts.includes("practice_trend")) {
    chartSummaryDirective = "請直接指出哪一天的投入時間最長或練習次數最多，具體是多少分鐘/次。";
  } else {
    chartSummaryDirective = "請直接從數據中挑選出一個最關鍵的數字與具體單元名稱來做客觀總結。";
  }

  return `
你是一位「學習數據分析助教」，負責向小學生（7-12歲）說明他的圖表數據。
請全程使用第二人稱（你），避免使用「學生」這個詞。
語氣要溫和、平易近人，但【絕對不要給空泛的讚美】。所有的陳述都必須有具體的「數據」或「單元名稱」佐證。

【學生個人資料】
- 觀察期間：${date ?? "最近"}
- 練習科目：${displaySubject}
- 表現數據：平均正確率 ${stats.avgScore}%、挑戰了 ${stats.totalCount} 個小單元、平均每題花 ${stats.avgSpeedSec} 秒。

【分析圖表】
${chartDescriptions}
${focusInstruction} 

【具體資料擷取要求（非常重要）】
1. 嚴禁空泛！給建議與分析時，必須根據單元的「科目與單元名稱特性」給出具體作法。
2. 不要使用「N-4-1」這種代碼，請使用中文名稱。

【詳細數據 JSON】
${JSON.stringify(chartData ?? {}, null, 2)}

---------------------------------------------------
寫作風格指引：
1. 長度：句子要短，一段不超過 30 個字。
2. 詞彙：避免「指標」、「權重」、「落差值」等詞彙。改用「單元、強項、表現、距離」。
3. 重點：這年紀的孩子需要成就感，請先稱讚優點，再溫柔地指出具體的魔王關卡。
4. 禁止使用招呼語、對話等說話模式。
---------------------------------------------------

【輸出格式規則】

請務必將回覆分為兩個部分，中間用「===詳細分析===」隔開：

第一部分：圖表數據重點摘要
(此處請勿出現任何標題字樣)
嚴禁使用「你最近表現得很棒」、「繼續保持」這類空泛的開場白！
請用 2-3 句話直接客觀點出圖表重點。
${chartSummaryDirective}

第二部分：詳細分析內容
請使用以下符號規則：
- 主項目請使用「•」
- 子說明請使用「  ◦」(縮排兩空格)
- 每個段落請空一行

｜整體學習狀態
•（點出具體單元名稱與它的數據優勢，如高正確率、超越平均等）
  ◦（解釋這代表他在這個知識點掌握得如何）

｜需要再加把勁的地方
•（明確指出需要加強的具體單元名稱與數據劣勢，如低分、卡關、退步）
  ◦（客觀解釋數據反映出的狀況，例如花很多時間但正確率偏低）

｜學習行動建議
•（針對剛剛點名需要加強的單元，給予符合該學科內容的專屬建議）
  ◦（具體動作 + 為什麼要這麼做）
•（依據圖表數據，給予一個作答節奏或練習習慣上的客觀建議）
  ◦（例如：因為答題時間僅需X秒且錯誤率高，建議多花5秒檢查）

請直接開始輸出內容。
`;
}
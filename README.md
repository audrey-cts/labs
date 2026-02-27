# test_p01
測試線上編輯

## 系統架構規劃（第一版）

目標流程：**上傳檔案 → 分析內容 → 暫時儲存分析結果 → 分流到「單字卡練習」與「測驗」**。

### 1) 整體模組

1. **檔案上傳模組（Upload）**
   - 支援使用者上傳檔案（例如：txt、pdf、docx，實作時可先從 txt 開始）
   - 進行基本檔案驗證（格式、大小、是否可解析）

2. **內容分析模組（Analyzer）**
   - 文字擷取與清理（去除雜訊、標準化）
   - 斷詞/詞彙抽取
   - 產生可學習資料（單字、詞性、例句、題目素材）

3. **暫存模組（Temporary Storage）**
   - 將分析結果暫時存放（Session/Cache）
   - 建議預設 TTL = 24 小時（可由環境變數調整）
   - 以 `analysisId` 對應單次上傳與後續練習/測驗

4. **學習分流模組（Learning Router）**
   - 分流 A：**單字卡練習（Flashcard）**
   - 分流 B：**測驗（Quiz）**

5. **評分模組（Scoring）**
   - 測驗題型固定為填中題（cloze/fill-in-the-blank）
   - **每題需完全正確才得分**（預設先做 `trim`，再以大小寫敏感、標點敏感進行完整字串比對）

### 2) 建議資料流

1. 使用者上傳檔案  
2. 系統建立 `analysisId`  
3. Analyzer 回傳結構化資料（詞彙清單、題目素材）  
4. 暫存到快取層（key: `analysisId`）  
5. 前端選擇進入：
   - `/flashcards/:analysisId`（單字卡）
   - `/quiz/:analysisId`（填中題測驗）

### 3) 建議資料模型（簡化）

- `AnalysisResult`
  - `analysisId: string`
  - `sourceFileName: string`
  - `tokens: Token[]`
  - `flashcards: FlashcardItem[]`
  - `quizItems: QuizItem[]`
  - `createdAt: datetime`
  - `expiresAt: datetime`

- `QuizItem`
  - `id: string`
  - `prompt: string`（含空格）
  - `answer: string`（標準答案）
  - `acceptedAnswers: string[]`（可選；若有設定，表示可接受答案清單，仍採「完整字串比對且全對才得分」）

### 4) API（草案）

- `POST /api/upload`
  - 上傳檔案並觸發分析
  - 回傳：`analysisId`

- `GET /api/analysis/:analysisId`
  - 取得暫存分析結果摘要

- `GET /api/flashcards/:analysisId`
  - 取得單字卡資料

- `GET /api/quiz/:analysisId`
  - 取得填中題題目（可不直接回傳答案）

- `POST /api/quiz/:analysisId/submit`
  - 送出答案並評分
  - 規則：**全對才算該題得分**

### 5) 測驗評分規則（明確化）

- 預設比對方式：字串完全相等（可先 `trim`）
- 一題一分：只有答案完整正確才得 1 分，否則 0 分
- 總分 = 各題分數加總

### 6) 非功能性需求（第一階段）

- 上傳限制：檔案大小上限、MIME type 白名單
- 安全性：檔名清理、避免惡意內容直接渲染
- 暫存清理：TTL 到期自動移除，避免資料長期堆積
- 可觀測性：上傳失敗率、分析耗時、測驗完成率

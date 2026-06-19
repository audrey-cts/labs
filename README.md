# test_p01

## 英文單字上傳與學習系統（第一階段：架構設計）

> 依需求，本階段**只提供完整系統架構設計**，不進入程式開發。

---

## 1) 需求拆解

使用者上傳一個文字檔（`.txt`），內容包含英文單字與中文翻譯。系統收到後分成兩條功能分支：

1. **解析分支（Normalization Pipeline）**
   - 讀取原始文字
   - 解析為制式化資料
   - 欄位至少包含：
    - 英文單字（lemma, 詞條原型）
     - 中文翻譯（zh-TW）
     - 延伸資訊（例：詞性、動詞三態、例句、同反義詞）

2. **學習分支（Learning Features）**
   - **字卡練習（Flashcard）**
   - **線上測驗（Quiz）**，且題目呈現模式固定為「田中里」樣式（單一題型/模板，避免混用其他題型）

---

## 2) 整體架構（Logical Architecture）

```text
[Web Upload UI]
      |
      v
[Upload API] --> [File Validation] --> [Parsing Service] --> [Normalized Vocabulary Store]
                                                            |                     |
                                                            |                     +--> [Flashcard Service]
                                                            |
                                                            +------------------------> [Quiz Service (田中里模式)]
```

### 核心模組

- **Upload UI**
  - 上傳 `.txt` 檔
  - 顯示解析成功/失敗摘要（筆數、錯誤行）

- **Upload API**
  - 接收檔案
  - 觸發驗證與解析流程

- **File Validation**
  - 驗證副檔名、MIME、大小限制、編碼（UTF-8）
  - 基本惡意內容防護（非預期控制字元、超長行）

- **Parsing Service**
  - 將每行文字拆解為標準欄位
  - 支援錯誤容忍（缺欄位時標註 warning）
  - 產生 normalized record

- **Normalized Vocabulary Store**
  - 儲存單字資料（可先以 JSON/SQLite，後續可升級 DB）

- **Flashcard Service**
  - 讀取標準化單字
  - 提供正反面、熟練度、重複練習排程

- **Quiz Service（田中里模式）**
  - 題目產生與評分全部走固定模板
  - 不允許切換其他題型

---

## 3) 文字檔輸入規格（建議）

### 檔案格式
- 副檔名：`.txt`
- 編碼：UTF-8
- 單行一筆資料
- 欄位分隔符號：`|`（pipe）
- `|` 前後空白可有可無（建議保留單一空白以利閱讀）

### 行格式（建議）

```text
英文單字 | 中文翻譯 | 詞性 | 三態(若為動詞) | 例句(可選)
```

範例：

```text
run | 跑步；經營 | v. | run-ran-run | I run every morning.
apple | 蘋果 | n. | - | This apple is sweet.
```

---

## 4) 標準化資料模型（Canonical Schema）

```json
{
  "id": "uuid",
  "lemma": "run",
  "translationZh": ["跑步", "經營"],
  "pos": "verb",
  "verbForms": {
    "base": "run",
    "past": "ran",
    "pastParticiple": "run"
  },
  "examples": ["I run every morning."],
  "source": {
    "fileName": "vocab.txt",
    "line": 12
  },
  "createdAt": "ISO-8601"
}
```

### 解析規則（重點）
- `lemma` 必填
- `translationZh` 必填，可多義
- `verbForms` 僅 `pos = "verb"` 時要求
- 缺欄位可入庫但需帶 warning flag，供 UI 提示修正

---

## 5) 功能分支設計

### A. 字卡練習

- 題卡面：英文 -> 中文、中文 -> 英文雙向切換
- 操作：
  - 顯示答案
  - 標記「熟悉 / 不熟」
- 資料回寫：
  - `lastReviewedAt`
  - `confidenceScore`
  - `nextReviewAt`

### B. 線上測驗（田中里模式）

- 題型固定：**田中里模板**（單一渲染模式）
- 出題來源：標準化單字庫
- 評分：
  - 以「隊伍模式」進行：隊伍內每位成員皆需提交答案
  - 回合正確率與最終結果（隊伍內全員皆答對才算該隊正確）
- 限制：
  - 禁止混用其他測驗版型

---

## 6) API 草案

### `POST /api/v1/uploads/vocabulary`
- 輸入：`multipart/form-data`（file）
- 輸出：
  - `jobId`
  - `totalLines`
  - `validCount`
  - `warningCount`
  - `errorLines`

### `GET /api/v1/vocabulary`
- 取得標準化後單字清單（支援分頁/篩選）

### `GET /api/v1/flashcards/session`
- 取得字卡練習題組

### `POST /api/v1/quiz/tanaka-mode/start`
- 開始田中里模式測驗（固定模板）

### `POST /api/v1/quiz/tanaka-mode/submit`
- 提交隊伍成員答案並回傳是否達標（隊伍內全員皆答對）

---

## 7) 非功能需求

- **效能**：單次上傳最多 5,000 行或 5MB（以先達到者為準），5 秒內完成解析（目標）
- **可靠性**：解析失敗行不影響其他行入庫
- **安全性**：
  - 檔案大小與格式白名單
  - 輸入內容清洗（避免 XSS/注入）
  - 後端統一驗證，不信任前端
- **可觀測性**：保留 upload/parse/error logs 與追蹤 ID

---

## 8) 第一階段交付範圍（本次）

- [x] 完整需求分解
- [x] 模組化系統架構
- [x] 資料模型與解析規則
- [x] 字卡/測驗兩分支設計
- [x] 田中里測驗模式限制定義
- [x] API 與非功能需求草案

> 第二階段可在此架構基礎上進入實作（UI + API + Parser + Flashcard + Quiz）。

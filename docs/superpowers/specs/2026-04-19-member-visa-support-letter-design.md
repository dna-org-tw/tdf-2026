# 會員頁簽證輔助邀請函（`/me`）— 設計規格

**日期：** 2026-04-19  
**狀態：** Approved  
**範圍：** 在會員頁新增 Visa Support Documents 功能，讓任何可登入會員系統的會員都能自助填寫簽證文件資料並下載正式 PDF 邀請函，供申請來台簽證時作為輔助文件。

## 問題

目前站上已經在 guide 文案中說明，購票後可寄信向主辦方索取參與證明或邀請函，但這仍是人工流程，對會員與營運都有明顯成本：

- 會員不知道需要提供哪些正式資料，來回補件成本高。
- 主辦方人工產出文件，難以維持一致格式與措辭。
- 無法追蹤某位會員下載過哪些版本、使用的是哪組身分資料。
- 現有會員資料結構偏向公開名片與票券資訊，沒有護照英文名、國籍、出生日期、護照號碼、預計入出境日等簽證文件欄位。
- 若未來要回應館處查核、客服重寄、或釐清文件爭議，目前沒有 document number 與 issuance log 可追蹤。

同時，產品方向已明確定為：

- 只要是「有帳號、可登入會員系統」的會員，就能自助下載。
- 但文件內容只能陳述系統可證明的事實，不能替未付款會員自動背書不存在的票券資格。

## 目標

1. 在 `/me` 提供一個自助式簽證文件流程，讓會員能自行填寫、儲存並下載正式 PDF。
2. 讓 PDF 內容使用統一的主辦單位資訊、正式聯絡資訊、簽署區與大小章，提升館處閱讀時的可信度。
3. 讓有 `paid order` 的會員自動附帶票券驗證段落；沒有 `paid order` 的會員仍可下載一般會員邀請函。
4. 把敏感簽證資料與公開 member card 資料分離，降低資料誤用風險。
5. 為每次下載建立可追溯的 issuance log，支援客服、法務與後台查核。

## 非目標

- 不保證簽證核發或提供簽證申請代辦。
- 不做自動判斷會員是否需要簽證的分流 wizard。
- 不做 QR code 驗證頁或公開線上驗證入口。
- 不做 admin 端完整歷史文件列表 UI。
- 不在第一版支援人工審核、人工作廢或文件撤銷。
- 不把 PDF 改成中英雙語混排版本；第一版維持 English-first。
- 不把簽證資料併入既有 `member_profiles`。

## Brainstorming 已確認決策

| 主題 | 決策 |
| --- | --- |
| 使用資格 | 任何可登入 `/me` 的會員皆可自助下載 |
| 文件定位 | `Visa Support Invitation Letter`，為簽證輔助文件，不保證核發 |
| 內容策略 | PDF 只陳述系統可證明的事實，避免過度背書 |
| 票券背書 | 有 `paid order` 才顯示票券驗證段落 |
| 無付費會員 | 仍可下載，但只顯示 general membership invitation |
| PDF 語言 | English-first，主辦單位抬頭保留中英雙語法人名稱 |
| 敏感資料存放 | 另建 `member_visa_profiles`，不放入 `member_profiles` |
| 稽核追蹤 | 每次下載寫入 `visa_letter_issuances` |
| 文件編號 | `TDF-VISA-2026-000123` 形式 |
| 正式資訊來源 | 使用主辦方提供的正式中英文法人名稱、地址、VAT、立案字號、聯絡人與簽署人 |
| 用章 | 可使用 repo 根目錄的 `tdna_stamp.png` 疊於簽署區附近增加公信力 |

## 正式主辦資訊

以下資訊為 PDF 固定內容，不由會員編輯：

- 中文名稱：`社團法人台灣數位遊牧者協會`
- 英文名稱：`TAIWAN DIGITAL NOMADS ASSOCIATION, INCORPORATED ASSOCIATION`
- VAT：`93214386`
- 地址：`臺北市中正區黎明里忠孝西路1段72號2樓之1`
- 英文地址：`2F-1, NO. 72, SECTION 1, ZHONGXIAO WEST ROAD, LIMING DISTRICT, ZHONGZHENG DISTRICT, TAIPEI CITY`
- 人民團體立案證書字號：`1130006174`
- 聯絡人：`徐愷 Kai Hsu`
- 聯絡信箱：`kk@dna.org.tw`
- 聯絡電話：`+886 983665352`
- 簽署人：`徐愷 Kai Hsu`
- 簽署人職稱：`President`

## UX 與資訊架構

### 主入口：`/me`

在現有會員頁新增一個新的 `CollapsibleSection`，標題為 `Visa Support Documents`，位置放在 member card / upcoming events / orders 區塊同層級，不併入公開名片編輯器。

此區塊包含三個部分：

1. 說明文字
2. 簽證資料表單
3. 文件摘要與下載操作

### 說明文字

區塊頂部固定顯示：

- 這是簽證申請輔助文件。
- 不保證簽證核發。
- 會員仍需依所屬中華民國駐外館處要求，自行準備其他文件，例如護照、照片、財力證明、回程機票與行程。

### 表單欄位

會員需填寫以下欄位：

- `Legal name (as shown on passport)`
- `Nationality`
- `Date of birth`
- `Passport number`
- `Passport issuing country`
- `Passport expiry date`
- `Planned arrival date`
- `Planned departure date`
- `Address in Taiwan`
- `ROC mission / office for application`（選填）

欄位資料在會員端應可重複編輯；第一次儲存後，之後回到 `/me` 會回填最近一次儲存內容。

### 預覽摘要卡

表單下方顯示 `Letter summary` 卡片，讓會員在下載前先理解文件內容：

- 若會員有 `paid order`：顯示 `Verified purchase will be included`
- 若會員沒有 `paid order`：顯示 `General membership invitation only`
- 顯示即將帶入的姓名、國籍、旅行期間、申請館處與文件類型
- 顯示 `Document will be generated in English`

### 操作按鈕

- `Save details`
- `Download visa support letter`

`Download visa support letter` 在以下情況 disabled：

- 必填欄位未填完
- 欄位驗證未通過
- 尚未完成第一次儲存
- 正在產生 PDF

## 使用者流程

### A. 初次填寫與儲存

1. 會員登入 `/me`
2. 展開 `Visa Support Documents`
3. 填寫簽證資料
4. 點擊 `Save details`
5. 系統驗證並寫入 `member_visa_profiles`
6. 成功後顯示成功訊息，並更新摘要卡

### B. 下載 PDF

1. 會員資料已儲存且驗證通過
2. 點擊 `Download visa support letter`
3. 前端呼叫 `POST /api/member/visa-letter`
4. 後端載入會員簽證資料與訂單狀態
5. 產生文件編號與 PDF
6. 後端寫入 issuance log
7. 前端觸發下載

### C. 重複下載

1. 會員回到 `/me`
2. 舊資料自動回填
3. 若沒有變更，可直接重新下載
4. 每次重新下載都視為新一次 issuance，需產生新 `document_no` 與新 log

## 資料模型

敏感簽證資料不與現有 `member_profiles` 混存，避免護照資訊與公開個人名片資料共享 API。

### 新表：`member_visa_profiles`

每位會員一筆，存放最新簽證文件資料。

```sql
CREATE TABLE member_visa_profiles (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  legal_name_en TEXT NOT NULL,
  nationality TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  passport_number TEXT NOT NULL,
  passport_country TEXT NOT NULL,
  passport_expiry_date DATE NOT NULL,
  planned_arrival_date DATE NOT NULL,
  planned_departure_date DATE NOT NULL,
  taiwan_stay_address TEXT NOT NULL,
  destination_mission TEXT,
  notes_for_letter TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

需求說明：

- `member_id` 唯一，確保每位會員只有一組最新簽證資料。
- `notes_for_letter` 第一版不顯示於 PDF，但先預留欄位，避免未來要加特殊館處備註時重做 migration。
- 應加 `updated_at` trigger，沿用 `member_profiles` 的更新模式。

### 新表：`visa_letter_issuances`

記錄每次文件產生。

```sql
CREATE TABLE visa_letter_issuances (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  document_no TEXT NOT NULL UNIQUE,
  letter_type TEXT NOT NULL CHECK (letter_type IN ('visa_support')),
  has_paid_order BOOLEAN NOT NULL DEFAULT FALSE,
  order_snapshot JSONB,
  profile_snapshot JSONB NOT NULL,
  pdf_checksum TEXT,
  issued_by TEXT NOT NULL DEFAULT 'system',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

需求說明：

- `profile_snapshot` 必填，確保能追溯文件當時使用的護照資料。
- `order_snapshot` 僅在有 `paid order` 時寫入。
- `pdf_checksum` 可選；若第一版不實作檔案落地，可先用雜湊值代表本次 PDF 內容。
- 第一版不要求持久化 PDF 檔案到 storage，但資料表預留後續擴充空間。

## 訂單選取邏輯

系統不應把所有訂單都寫進 PDF，而是只挑一筆最具代表性的付款紀錄。

規則如下：

1. 只考慮 `status = 'paid'` 的訂單
2. 若有 parent / child upgrade 鏈，取實際生效的最高等級 paid order
3. 若 festival 已開始，優先取目前有效期間中的 paid order
4. 若沒有當前有效訂單，則取 paid order 中等級最高者

PDF 只顯示單一驗證段落：

- `Order reference`
- `Ticket tier`
- `Order status: Paid`
- `Validity period`

不顯示：

- 退款訂單
- 失敗訂單
- 全部歷史訂單
- Stripe session id
- 內部備註

## API 設計

### `GET /api/member/visa-profile`

用途：

- 讀取當前會員的最新簽證資料

行為：

- 用 `getSessionFromRequest` 取得 session
- 依 session email 解析對應 `members.id`
- 若無資料則回傳空物件預設值

回傳 shape：

```ts
{
  legal_name_en: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  passport_number: string | null;
  passport_country: string | null;
  passport_expiry_date: string | null;
  planned_arrival_date: string | null;
  planned_departure_date: string | null;
  taiwan_stay_address: string | null;
  destination_mission: string | null;
  notes_for_letter: string | null;
  updated_at: string | null;
}
```

### `PUT /api/member/visa-profile`

用途：

- 儲存會員自己的簽證資料

行為：

- 驗證 session
- 驗證欄位格式
- upsert 到 `member_visa_profiles`
- 回傳儲存後內容

### `POST /api/member/visa-letter`

用途：

- 驗證資料完整性、產生 PDF、寫 issuance log、回傳下載檔案

行為：

1. 驗證 session
2. 讀取會員資料與 `member_visa_profiles`
3. 驗證必填欄位與日期關係
4. 讀取符合條件的 paid order
5. 產生下一個 `document_no`
6. 生成 PDF
7. 寫入 `visa_letter_issuances`
8. 回傳 `application/pdf`

Response headers：

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="tdf-visa-support-letter-TDF-VISA-2026-000123.pdf"`

## 驗證規則

### 必填驗證

以下欄位必填：

- `legal_name_en`
- `nationality`
- `date_of_birth`
- `passport_number`
- `passport_country`
- `passport_expiry_date`
- `planned_arrival_date`
- `planned_departure_date`
- `taiwan_stay_address`

### 格式與邏輯驗證

- `legal_name_en` 不得含中文字符
- `date_of_birth` 必須早於今日
- `passport_expiry_date` 必須晚於 `planned_departure_date`
- `planned_departure_date` 必須晚於 `planned_arrival_date`
- `planned_arrival_date` 不得早於文件產生日前太久；第一版不硬性限制，但 UI 可提醒需填真實預計日期

### 下載限制

- 每位會員每小時最多產生 5 次 PDF
- 超過上限時回傳 `429`
- 前端顯示友善錯誤訊息，避免會員重複點擊造成濫用

## PDF 內容設計

### 語言策略

第一版 PDF 使用 English-first。原因：

- 館處審件多以英文文件最穩定
- 可降低措辭分歧與維護成本
- 能先聚焦於格式可信度與資料正確性

### 版面結構

1. Header
2. Document metadata
3. Addressee
4. Applicant identity
5. Invitation body
6. Travel plan
7. Conditional verification
8. Organizer / signature block
9. Disclaimer footer

### Header

固定顯示：

- `社團法人台灣數位遊牧者協會`
- `TAIWAN DIGITAL NOMADS ASSOCIATION, INCORPORATED ASSOCIATION`
- `VAT 93214386`
- 中文與英文地址
- `Certificate No. 1130006174`
- `Email: kk@dna.org.tw`
- `Phone: +886 983665352`

### Document metadata

- `Document No.: TDF-VISA-2026-000123`
- `Issue Date: April 19, 2026`
- `Subject: Visa Support Invitation Letter for Taiwan Digital Fest 2026`

### Addressee

- 若 `destination_mission` 有值：`To: <destination_mission>`
- 否則：`To Whom It May Concern`

### Applicant identity section

- `Legal Name`
- `Nationality`
- `Date of Birth`
- `Passport Number`

### Invitation body

正文應陳述：

- 主辦單位為 `TAIWAN DIGITAL NOMADS ASSOCIATION, INCORPORATED ASSOCIATION`
- 該會員受邀於 2026 年 5 月赴台參與 `Taiwan Digital Fest 2026`
- 活動性質描述為：
  - festival
  - community gatherings
  - networking
  - workshops
  - cultural exchange
- 地點描述為 `Taiwan, primarily Taitung and Hualien`

若無 paid order，不得出現：

- `ticket holder`
- `fully paid attendee`
- `VIP`
- `confirmed purchaser`

### Travel plan section

- `Planned Arrival`
- `Planned Departure`
- `Intended Stay Address in Taiwan`

### Conditional verification section

只有在系統找到符合條件的 `paid order` 時才顯示：

- `Verified Festival Purchase Details`
- `Order Reference`
- `Ticket Tier`
- `Order Status: Paid`
- `Validity Period`

若無 paid order，整段完全不顯示，而不是顯示 `N/A`。

### Organizer / signature block

固定顯示：

- `Contact Person: Kai Hsu`
- `Email: kk@dna.org.tw`
- `Phone: +886 983665352`
- `Signatory: Kai Hsu, President`

### 大小章使用規則

使用 repo 根目錄的 `tdna_stamp.png`：

- 路徑：`/Users/kkshyu/Repos/tdf-2026/tdna_stamp.png`
- 圖檔規格：透明底 PNG，可直接疊印於 PDF

用章規則：

- 放在簽署區附近
- 不可蓋住主要正文、申請人護照資訊、文件編號
- 建議與 `Kai Hsu, President` 同區塊呈現
- 保持原紅色，不做重新著色
- 若渲染過重，可降低不透明度，但不可降低到失去正式感

### Disclaimer footer

頁尾固定顯示：

- `This letter is issued as a supporting document for visa application purposes only.`
- `This letter does not guarantee visa issuance.`
- `Visa approval remains subject to the decision of the relevant Republic of China (Taiwan) overseas mission.`
- `This letter is issued based on the information provided by the member and the records available in our system as of the issue date.`

## 文件編號策略

文件編號格式：

`TDF-VISA-2026-000123`

規則：

- 固定前綴 `TDF-VISA-2026`
- 後段使用遞增數字，左補零到 6 碼
- 每次 issuance 都需產生新編號，即使同一會員重新下載也是新編號

第一版可用 `visa_letter_issuances.id` 實際生成 display 編號，避免另做 sequence 管理。

## 前端元件建議

### 新增元件

- `components/member/VisaSupportSection.tsx`
- `components/member/VisaSupportForm.tsx`
- `components/member/VisaLetterSummary.tsx`

### 前端責任切分

- `VisaSupportSection`
  - 負責資料讀取、儲存、下載、狀態管理
- `VisaSupportForm`
  - 負責欄位輸入與前端驗證
- `VisaLetterSummary`
  - 負責顯示將被帶入 PDF 的摘要

這樣可避免把 `/app/me/page.tsx` 再次膨脹成單一大檔案。

## 後端實作建議

### PDF 產生方式

第一版使用 server-side HTML-to-PDF 或程式化 PDF 皆可，但必須符合以下要求：

- 可精準控制 header / footer / signature block
- 可插入透明底 PNG 章
- 可輸出可下載的正式 A4 PDF

實作選型不是本 spec 的重點，但版面與輸出可靠性優先於動畫與視覺特效。

### Server-only 邏輯

下列資料不可下放前端自行判斷：

- paid order 是否存在
- 應該選哪一筆 paid order
- document number
- issuance log
- PDF 內正式主辦資訊與簽署資訊

## 安全與隱私

- `member_visa_profiles` 為高敏感個資，只能由 server route 讀寫
- 前端只透過 authenticated API 取得自己的資料
- 不可讓公開 member 頁或 `/api/members` 搜索結果接觸這些欄位
- 不在 UI 顯示完整歷史文件清單，降低敏感資料暴露面
- admin UI 第一版非必要，但資料庫必須保留查核能力

## Admin 可見性

第一版不強制新增 admin UI，但至少要讓後台或 API 可查到：

- 最後一次 issuance 時間
- `document_no`
- `has_paid_order`

第二版可再擴充：

- admin 重新產生 PDF
- admin 下載歷史 PDF
- admin 作廢文件

## 錯誤處理

- **401**：未登入
- **404**：session 有效但找不到 `members` row
- **400**：資料不完整或日期驗證失敗
- **429**：超過下載速率限制
- **500**：PDF 產生失敗、資料庫寫入失敗、讀取章檔失敗

所有錯誤皆需：

- 後端 `console.error('[Visa Support]', ...)`
- 前端顯示可理解的訊息
- 不回傳內部 stack trace 給會員

## 驗收標準

1. 已登入會員可在 `/me` 成功開啟 `Visa Support Documents` 區塊並讀到既有簽證資料。
2. 會員可成功儲存簽證資料，重新整理後資料仍存在。
3. 必填欄位未填完時，下載按鈕 disabled，且錯誤訊息清楚。
4. 有 `paid order` 的會員下載 PDF 時，會出現 `Verified Festival Purchase Details`。
5. 無 `paid order` 的會員下載 PDF 時，不會出現任何已付款或票券背書語句。
6. PDF 會帶入固定主辦資訊、聯絡資訊、簽署人資訊與 `tdna_stamp.png` 大小章。
7. 每次下載都會寫入一筆 `visa_letter_issuances`。
8. API 速率限制生效，超過上限回傳 `429`。
9. `npm run lint` 與 `npm run build` 通過。

## Files Touched / Created

**New**：

- `supabase/migrations/add_member_visa_profiles.sql`
- `supabase/migrations/create_visa_letter_issuances.sql`
- `app/api/member/visa-profile/route.ts`
- `app/api/member/visa-letter/route.ts`
- `components/member/VisaSupportSection.tsx`
- `components/member/VisaSupportForm.tsx`
- `components/member/VisaLetterSummary.tsx`
- `lib/visaLetter.ts`
- `docs/superpowers/specs/2026-04-19-member-visa-support-letter-design.md`（本文件）

**Modified**：

- `app/me/page.tsx`
- `hooks/useTranslation.ts` 或對應文案來源
- `data/content.ts`（若會員頁文案集中在此）
- 可能新增 PDF 樣板或樣式檔

## 風險與注意事項

- **帳號不等於購票**：產品已決定任何會員都可下載，因此文案與條件式段落必須嚴格區分 paid / unpaid。
- **個資敏感度高**：護照資訊不能與現有公開名片 API 共用。
- **PDF 引擎相容性**：需確認透明底章在正式 PDF 中不會出現黑底或鋸齒。
- **英文措辭一致性**：文件文案應集中在單一 helper，避免前後端各寫一版造成不一致。
- **編號生成一致性**：若之後支援多種文件類型，需要保留 document number namespace 的可擴充性。

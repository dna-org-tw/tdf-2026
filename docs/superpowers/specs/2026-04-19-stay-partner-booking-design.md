# 合作住宿訂房（`/stay`）— 設計規格

**日期：** 2026-04-19  
**狀態：** Approved  
**範圍：** 新增 Norden Ruder 合作住宿的 `/stay` 訂房流程，以及會員管理流程、候補、轉讓、招待碼與後台操作。

## 問題

目前網站只提供住宿資訊或導向外部聯絡方式，沒有一個站內的訂房流程可以處理 Norden Ruder 的保留房量，也無法落實這次合作住宿需要的特殊規則：

- 會員只能以整週為單位訂房。
- 頁面上只有一個合作住宿、只有一種房型。
- 每位會員最多只能訂 1 間房，但可以在同一流程中預訂多個週次。
- 每間房可入住 1–2 人，但只有主要訂房者必須是會員。
- 一般訂房需要先完成信用卡驗證，現場刷卡付款；只要取消或 no-show，就要收整週房費。
- 招待碼訂房是免費住宿，不需綁卡，轉讓後也仍維持免費住宿。
- 某週售罄後仍需要候補名單與遞補通知流程。
- 會員需要能免費改到其他尚有空房的週次，也需要可以轉讓給其他會員。

現有的 `orders` 模型是為了立即付款的票券訂單設計，不適合直接承接「住宿庫存 + 責任轉移 + 信用卡擔保」這種流程。

## 目標

1. 上線一個單一合作住宿、只支援 light mode 的 `/stay` 頁面，整體感受要像 booking flow，而不是一般資訊頁。
2. 讓任何可以登入 `/me` 的會員，都能在單一流程中預訂一間合作房，並一次選取一個以上週次。
3. 同時支援一般擔保訂房與招待碼免費訂房。
4. 讓每週庫存、候補順位、轉讓接受規則都可以被系統正確執行，並在後台可追蹤。
5. 讓「任何取消或未到都收整週房費」這條高風險規則在多個關鍵節點被重複清楚提示，避免誤解。

## 非目標

- 多房源、多房型 marketplace 介面
- 改動現有 path-based 語系策略
- 取代既有票券 `orders` / `checkout` 系統
- 提供給飯店櫃檯使用的現場收款工具
- 部分退款、取消折抵、優惠券折扣等住宿優惠機制
- 對非會員開放公開預訂

## Brainstorming 已確認決策

| 主題 | 決策 |
| --- | --- |
| 房源模型 | 只有單一合作住宿，頁面不是 marketplace |
| 訂房資格 | 任何可登入會員系統的人都能訂 |
| 房間數限制 | 每位會員最多持有 1 間房，但可一次預訂多個週次 |
| 入住人數 | 每間房 1–2 人，只有主要訂房者必須是會員 |
| 週次選擇 UX | 前台看起來像一筆預約，後端拆成每週一筆資料 |
| 招待碼 | 單次使用；免費住宿；免綁卡；免現場付款 |
| 取消 / 未到 | 任何取消或 no-show 都收整週房費 |
| 改期 | 若目標週仍有空房，可免費改到其他週 |
| 轉讓 | 可轉讓給其他會員 |
| 轉讓責任 | 一般訂單受讓人必須接受並重新綁卡；招待轉讓仍免綁卡 |
| 訂房成立時機 | 庫存確認與擔保步驟完成後立即成立 |
| 售罄處理 | 開放候補；有名額時依順位發限時保留通知 |
| 視覺方向 | 只做 light mode，不提供 dark variant |

## UX 與資訊架構

### 主頁：`/stay`

`/stay` 是一個單一合作住宿的 landing + booking page，使用者感受應該更接近 booking detail page，而不是住宿列表頁。

桌機版：

- 左欄：住宿資訊與規則內容
- 右欄：sticky 的訂房／管理面板

手機版：

- 先看到 Hero 與高風險警示
- 再看到每週庫存
- 最後才進入訂房／管理面板

整頁只使用 light mode，採用淺色底、白卡片、高對比深色文字。不可出現 dark hero、dark card 或 dark warning band。

### `/stay` 必要區塊

1. Hero
   - Norden Ruder 合作住宿標示
   - 房型名稱
   - 單一房源 / 週次訂房 / members only badges
2. 高風險警示區塊
   - 位於首屏 above the fold
   - 直接寫明任何取消或未到都收整週房費
3. 每週庫存區
   - 固定 4 個住宿週次
   - 顯示價格、房量、目前可訂狀態
   - 售罄週次顯示候補 CTA，而不是訂房 CTA
4. 房型資訊
   - 房間照片
   - 8 m²、1 張雙人床、獨立衛浴、1–2 人入住
   - 不可加床 / 不適合 12 歲以下兒童
5. 訂房規則
   - 一般訂房：先驗卡、現場付款、取消 / 未到收整週
   - 招待訂房：需招待碼、免綁卡、免現場付款
   - 改期與轉讓規則
6. FAQ / logistics
   - 地址
   - 僅提供主辦方已提供的到場／支援說明；飯店詳細 check-in 作業不在 MVP 範圍內
   - 主辦單位聯絡方式

### 右側面板狀態切換

右側面板需依登入狀態與住宿狀態切換：

- 未登入：顯示登入 gate
- 已登入、尚未訂房：顯示訂房表單
- 已登入、已有住宿：顯示管理摘要 + 管理 CTA
- 選到售罄週次：切成候補表單
- 收到轉讓：切成接受轉讓流程

系統不應提示同一位會員再訂第二間房。

## 使用者流程

### A. 一般訂房流程

1. 會員進入 `/stay`
2. 若尚未登入，先登入
3. 選擇一個或多個可訂週次
4. 填寫主要住客資料、第二位住客資料（可選）、招待碼（可選）
5. 系統驗證：
   - 會員已登入
   - 所選週次仍有名額
   - 會員未在相同週次持有另一間有效房間
6. 若沒有招待碼：
   - 再次顯示高風險條款
   - 收集未來 no-show / cancellation 扣款的明確同意
   - 執行 Stripe 卡片設定流程
7. 成功後：
   - 建立一筆 booking 容器
   - 為每個週次建立一筆 booking-week 資料
   - 連結 guarantee 紀錄
   - 寄送確認信
8. 會員進入成功頁或管理狀態

### B. 招待碼免費訂房流程

1. 與一般訂房相同地進入流程
2. 輸入有效且未使用的招待碼
3. 系統驗證並保留招待碼
4. 跳過卡片設定流程
5. 直接建立免費住宿 booking
6. 確認信中需明確寫出：
   - 此為免費住宿
   - 不需綁卡
   - 不需現場付款

### C. 候補流程

1. 會員選到某個售罄週次
2. 面板從訂房模式切為候補模式
3. 會員送出候補申請
4. 系統記錄候補順位
5. 若名額重新釋出：
   - 先寄信給第一順位候補者
   - 給一段限時保留時間
   - 若過期或放棄，再輪到下一位

### D. 改期流程

1. 會員進入住宿管理畫面
2. 選擇某一個已成立週次進行改期
3. 系統顯示仍有空房的目標週次
4. 會員選擇目標週次
5. 系統原子性執行：
   - 將原週次標記為 modified out
   - 建立或確認新的週次 booking
   - 釋出舊週次庫存
   - 保留原本的 guarantee 類型
6. 寄送改期成功通知，列出舊週與新週

### E. 轉讓流程

1. 原會員發起轉讓給另一位會員 email
2. 系統建立 pending transfer request
3. 受讓會員收到 email 並開啟接受頁
4. 若是一般訂房：
   - 受讓人需再次接受條款
   - 受讓人需完成自己的卡片設定
5. 若是招待訂房：
   - 受讓人直接接受，不需綁卡
6. 接受後：
   - 責任轉移到受讓會員
   - 原持有人失去管理權
   - booking-week 所屬更新
7. 若轉讓逾期：
   - 住宿仍維持在原會員名下

## 資料模型

住宿功能應該使用獨立資料表，而不是延伸既有 `orders`。

### 新表：`stay_weeks`

定義每個 7 晚週次的固定庫存。

```sql
CREATE TABLE stay_weeks (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  price_twd INTEGER NOT NULL,
  room_capacity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'sold_out', 'closed')),
  waitlist_offer_expires_in_minutes INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

初始化資料：

- `2026-w1` → 2026-04-30 到 2026-05-07 → NT$7,656 → 30 間
- `2026-w2` → 2026-05-07 到 2026-05-14 → NT$6,130 → 40 間
- `2026-w3` → 2026-05-14 到 2026-05-21 → NT$6,282 → 40 間
- `2026-w4` → 2026-05-21 到 2026-05-28 → NT$6,400 → 40 間

### 新表：`stay_bookings`

會員看到的一筆住宿預約容器。

```sql
CREATE TABLE stay_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN (
    'draft', 'confirmed', 'partially_transferred', 'transferred', 'cancelled', 'completed'
  )),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('guaranteed', 'complimentary')),
  primary_guest_name TEXT NOT NULL,
  primary_guest_email TEXT NOT NULL,
  primary_guest_phone TEXT NOT NULL,
  guest_count INTEGER NOT NULL CHECK (guest_count IN (1, 2)),
  second_guest_name TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 新表：`stay_booking_weeks`

真正對應庫存的資料單位。每個被訂到的週次一筆。

```sql
CREATE TABLE stay_booking_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES stay_bookings(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  week_id BIGINT NOT NULL REFERENCES stay_weeks(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN (
    'confirmed', 'modified_out', 'modified_in', 'pending_transfer',
    'transferred', 'cancelled', 'no_show', 'completed'
  )),
  booked_price_twd INTEGER NOT NULL,
  hold_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, week_id)
);
```

額外唯一性限制：

- 同一會員在同一週最多只能持有 1 間有效房間。
- 可透過 partial unique index 在 `(member_id, week_id)` 上限制 `status IN ('confirmed', 'modified_in', 'pending_transfer')`。

### 新表：`stay_guarantees`

儲存住宿擔保方式與 Stripe 關聯資料。

```sql
CREATE TABLE stay_guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES stay_bookings(id) ON DELETE CASCADE,
  guarantee_type TEXT NOT NULL CHECK (guarantee_type IN ('stripe_card', 'complimentary')),
  stripe_customer_id TEXT,
  stripe_setup_intent_id TEXT,
  stripe_payment_method_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  consented_at TIMESTAMPTZ,
  replaced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 新表：`stay_invite_codes`

單次使用的免費住宿權限。

```sql
CREATE TABLE stay_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'reserved', 'used', 'disabled')),
  used_by_member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
  used_by_booking_id UUID REFERENCES stay_bookings(id) ON DELETE SET NULL,
  batch_label TEXT,
  notes TEXT,
  created_by TEXT,
  reserved_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 新表：`stay_waitlist_entries`

每個週次的候補隊列。

```sql
CREATE TABLE stay_waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id BIGINT NOT NULL REFERENCES stay_weeks(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN (
    'active', 'offered', 'accepted', 'expired', 'declined', 'removed'
  )),
  position INTEGER NOT NULL,
  offered_at TIMESTAMPTZ,
  offer_expires_at TIMESTAMPTZ,
  accepted_booking_week_id UUID REFERENCES stay_booking_weeks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_id, member_id)
);
```

### 新表：`stay_transfers`

明確描述轉讓生命週期，方便 admin 查詢與介入。

```sql
CREATE TABLE stay_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_week_id UUID NOT NULL REFERENCES stay_booking_weeks(id) ON DELETE CASCADE,
  from_member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  to_member_id BIGINT REFERENCES members(id) ON DELETE RESTRICT,
  to_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'pending_acceptance', 'accepted', 'expired', 'revoked'
  )),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('guaranteed', 'complimentary')),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Stripe 設計

### 重要技術限制

需求裡的規則是「先驗卡、現場付款、只有取消或未到才扣款」。這聽起來像飯店的信用卡授權，但不適合直接用長時間未請款的授權來做。

依目前 Stripe 官方文件：

- 線上卡片的 manual capture / authorization window 通常只有幾天，依卡組織不同，大約落在 5–7 天左右。
- 真正適合「之後再扣款」的做法，是先保存可供未來 off-session 使用的付款方式，再於需要時建立新的 PaymentIntent。

**根據官方文件推論：** 因為會員可能提前很久就訂房，`/stay` 不應依賴長時間有效的 manual-capture authorization。更合適的做法是：先保存並驗證卡片可供未來 off-session 使用，再於真的發生取消或 no-show 時建立扣款。

### 建議 Stripe 流程

一般訂房：

1. 為會員建立或重用 Stripe Customer
2. 透過 SetupIntent（或等價的 Checkout setup flow）完成 `off_session` future use 設定
3. 將 PaymentMethod 存到 booking guarantee
4. 記錄同意條款文字與時間
5. 若之後真的要對取消 / no-show 扣款：
   - 建立 off-session PaymentIntent
   - 金額 = 受影響週次的整週房費
   - 將 Stripe ID 記錄到 admin 端的 charge history

招待訂房：

- 不建立 SetupIntent
- 不保存 PaymentMethod
- `guarantee_type='complimentary'`

轉讓行為：

- 一般訂房轉讓後，要用受讓人的新 PaymentMethod 取代原本的 guarantee
- 招待訂房轉讓後，仍維持 `guarantee_type='complimentary'`

### 同意條款要求

訂房流程必須讓使用者明確同意：若發生取消或 no-show，主辦單位可使用事先保存的付款方式發起未來的 off-session 扣款。此同意文字必須在保證步驟中顯示，並記錄時間。

## API 設計

所有會員端 stay API 都應建立在現有 auth session 之上。

### 會員端 routes

| Method | Path | 用途 |
| --- | --- | --- |
| GET | `/api/stay/weeks` | 取得週次庫存摘要，可公開或登入後使用 |
| POST | `/api/stay/quote` | 驗證選定週次並回傳訂房摘要 |
| POST | `/api/stay/bookings` | 建立一般或招待訂房 |
| GET | `/api/stay/bookings/:id` | 讀取該會員自己的 booking |
| POST | `/api/stay/bookings/:id/modify` | 將某已訂週次改到另一個可用週次 |
| POST | `/api/stay/bookings/:id/transfer` | 發起轉讓 |
| POST | `/api/stay/transfers/:id/accept` | 受讓人接受轉讓 |
| POST | `/api/stay/waitlist` | 加入某週候補 |
| DELETE | `/api/stay/waitlist/:id` | 離開候補 |
| POST | `/api/stay/invite-code/validate` | 最後送出前驗證招待碼 |

### 後台 routes

所有 admin routes 都需要 `getAdminSession`。

| Method | Path | 用途 |
| --- | --- | --- |
| GET | `/api/admin/stay/summary` | 依週次 / 狀態回傳 dashboard 統計 |
| GET | `/api/admin/stay/bookings` | 篩選後的 booking 列表 |
| GET | `/api/admin/stay/bookings/:id` | 單筆 booking 詳情 |
| POST | `/api/admin/stay/invite-codes/batch` | 批次建立單次招待碼 |
| PATCH | `/api/admin/stay/weeks/:id` | 調整容量 / 狀態 / 保留時間 |
| POST | `/api/admin/stay/transfers/:id/resend` | 重送轉讓邀請 |
| POST | `/api/admin/stay/waitlist/:id/offer` | 手動發送候補遞補通知 |
| POST | `/api/admin/stay/bookings/:id/no-show` | 標記 no-show 並啟動扣款流程 |
| POST | `/api/admin/stay/bookings/:id/comp` | 後台手動建立招待訂房 |

## 會員端 UI 新增項目

### `/stay`

主訂房頁面，如上所述。

### `/me`

新增 stay 摘要卡，至少顯示：

- 目前是否有住宿 booking
- 已訂週次 chips
- 招待 / 一般 badge
- 候補數量
- 轉讓待接受狀態
- CTA：
  - `Book stay`
  - `Manage stay`
  - `Accept transfer`

### 住宿管理頁

可採 `/stay` 內嵌登入態管理面板，或獨立路由如 `/stay/manage/[id]`。

必須支援：

- 查看 booking 摘要
- 查看每個週次與狀態
- 發起改期
- 發起轉讓
- 查看 guarantee 類型
- 再次查看風險條款

### 接受轉讓頁

此頁由 email 連結進入，需清楚顯示：

- 被轉讓的是哪些週次
- 這筆是招待還是一般訂房
- 若是一般訂房，先做卡片設定再接受
- 若是招待訂房，直接接受即可

## 後台 UI

後台新增一個導覽項目：`住宿 Stay`。

### `/admin/stay`

Dashboard 卡片：

- 各週已確認 room-weeks 數量
- 各週剩餘容量
- 候補中的人數
- 待接受轉讓數
- guarantee 資料缺失的 booking 數
- 待處理 no-show 數

### `/admin/stay/bookings`

可篩選表格：

- member no
- email
- guest name
- 週次
- 一般 / 招待
- 狀態
- 卡片摘要（若有）
- created_at

### `/admin/stay/bookings/[id]`

詳情頁：

- booking 摘要
- 週次時間軸
- guarantee 資訊
- 招待碼使用資訊（若有）
- 轉讓歷史
- 候補 / 改期歷史
- admin notes

### `/admin/stay/weeks`

每週一張卡：

- 設定容量
- 已確認 room-weeks
- 保留 / pending 狀態數
- 候補數
- 關閉 / 重開 / 調整容量按鈕

### `/admin/stay/invite-codes`

支援批次建立：

- 數量
- prefix 或自動產生 code
- 可選 batch label
- created_by

顯示欄位：

- code
- status
- used_by member
- used_by booking
- used_at

## 風險提示與揭露

「取消 / no-show 收整週房費」是此功能最重要的高風險內容，必須重複提示，而不是只在某個角落寫一次。

必要出現位置：

1. `/stay` 首屏 above the fold
2. 緊鄰週次選擇區
3. 進入卡片設定前
4. 最後確認 checkbox 文案
5. 訂房成功頁
6. 訂房確認信
7. 接受轉讓流程中

建議最終同意文字：

> 我了解此住宿預約將以我保存的付款方式作為擔保。若我取消住宿或未入住，我授權 Taiwan Digital Fest 就受影響週次向我收取整週房費。

招待流程的文案必須與一般流程分開，且不可提到綁卡。

## Email / 通知事件

必要通知類型：

- `stay_booking_confirmed`
- `stay_booking_complimentary_confirmed`
- `stay_transfer_requested`
- `stay_transfer_accepted`
- `stay_waitlist_offer`
- `stay_waitlist_expired`
- `stay_modification_confirmed`
- `stay_no_show_charged`

所有通知都應走既有 Mailgun-based email infrastructure，並在現有 email log 系統中記錄清楚的 `email_type`。

## 錯誤處理

- 容量檢查必須在最終寫入時於 server-side 執行，不能只靠頁面載入時的前端資訊。
- 招待碼驗證必須是原子操作，避免同一個 code 被重複吃掉。
- 若受讓 email 對不到會員帳號，轉讓接受流程必須清楚失敗。
- 候補保留到期後，必須自動釋放 offer 權利並輪到下一位。
- 改期流程必須具交易性，避免新週建立失敗後舊週已被釋出，造成庫存遺失。

## 對這個 repo 的實作建議

- 沿用既有 auth（`AuthContext`、`/api/auth/session`、`/me`），不要再做一套新登入。
- 沿用既有 admin gate（`getAdminSession`、`/admin/layout.tsx`）。
- 住宿商業邏輯放在獨立的 `lib/stay*` 模組，不要埋進 `lib/orders.ts`。
- stay UI 建議拆成聚焦元件，例如：
  - `components/stay/StayBookingPanel.tsx`
  - `components/stay/StayWeekSelector.tsx`
  - `components/stay/StayPolicyNotice.tsx`
  - `components/stay/StayManagementPanel.tsx`
  - `components/stay/StayTransferAccept.tsx`
- 住宿文案要進 `data/content.ts`，維持與現有網站一致的雙語模式。

## 驗證方式

目前 repo 沒有自動化測試框架，因此實作完成後至少要手動驗證以下情境：

1. 會員可用卡片設定成功預訂一個可用週次。
2. 會員可在同一流程中預訂多個週次。
3. 招待碼可建立免費住宿，且無需綁卡。
4. 同一招待碼不可重複使用。
5. 同一會員不可在同一週持有第二間房。
6. 售罄週次只能加入候補，不能直接成立預約。
7. 候補 offer 過期後會輪到下一位。
8. 一般轉讓要求受讓人重新綁卡。
9. 招待轉讓不要求受讓人綁卡。
10. 改期能原子性地釋放舊週並保留新週。
11. 高風險條款在所有必要 UI 與 email 節點都有出現。

## 開放技術註記

若未來主辦方想要在入住前很短時間內做真正的短期授權保留，那應視為後續增強功能。第一版 `/stay` 應以 card-on-file setup + 後續 off-session charge 為基礎，因為這更符合 Stripe 目前的 future-use flow，也能避免早鳥訂房時 authorization expiry 的問題。

## 參考資料

- Stripe Setup Intents：https://docs.stripe.com/payments/setup-intents
- Stripe save and reuse for later charges：https://docs.stripe.com/payments/checkout/save-and-reuse
- Stripe manual capture / authorization windows：https://docs.stripe.com/payments/place-a-hold-on-a-payment-method

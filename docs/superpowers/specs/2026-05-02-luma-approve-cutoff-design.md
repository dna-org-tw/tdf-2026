# Luma 同步 approve cutoff 機制

**日期**：2026-05-02
**狀態**：設計完成，待實作
**相關檔案**：`lib/lumaAutoReview.ts`、`lib/lumaSyncWorker.ts`、`lib/lumaApi.ts`、`supabase/migrations/`

## 目的

避免 Luma sync 在活動前最後一刻才把人 approve，造成參加者沒時間準備。引入「approve cutoff」三個固定時鐘（GMT+8）：`00:00` / `06:00` / `12:00`，分別對應「隔日早上 / 當日下午 / 當日晚上」三個時段的活動。

cutoff 一過：

- 已 `approved` 的人保留座位（不會被 sync 主動降級為 `declined`，除非他不再符合資格）
- 其他狀態（`waitlist` / `pending_approval` / `null`）一律推為 `declined`，並使用 `declined:cutoff_*` 系列 reason 在 review log 中保留原本判斷因素
- 保護性變更（tier mismatch、membership lapse、weekly_backer 過期、no-show 等）仍執行，但結果改為 `declined` 而非 `waitlist`
- ticket 降級（`approved:downgraded`）只對「已 approved 的人」維持效力（保座位、修正票），對非 approved 的人改寫為 `declined:cutoff_eligible`

## 背景

目前 `lib/lumaAutoReview.ts` 的 `makeDecision` 是純粹的業務規則判斷（會員身份、票面 tier、no-show 紀錄、capacity），完全不考慮「現在距離活動多久」。`lib/lumaSyncWorker.ts` 每 30 分鐘（pg_cron `:15` / `:45`）對所有未來活動跑一次。也就是說，活動開始前 30 分鐘仍可能有人從 `waitlist` 被 promote 到 `approved`。對被 promote 的人來說「最後一刻才知道能參加」缺乏準備時間，這次設計要修正這個體驗問題。

## 規則

### 時段定義

依 `luma_events.start_at` 換算 GMT+8 後的 hour 判定。一個活動只屬一個時段（即便橫跨兩個時段，仍以 `start_at` 的 hour 為準）。

| 時段 | hour 範圍 | cutoff 時鐘（GMT+8） |
|---|---|---|
| 早上 | `[0, 12)` | 開始當日**前一日** `00:00` |
| 下午 | `[12, 18)` | 開始**當日** `06:00` |
| 晚上 | `[18, 24)` | 開始**當日** `12:00` |

### 邊界

- 整點：`now >= cutoffAt` 即視為已過 cutoff（包含整點當下）。
- DST：台灣不採行夏令時間，`UTC+8` 為固定偏移。
- 跨日 / 已開始 / 已結束的活動：`now >= cutoffAt` 自然為 true，行為一致。
- 活動晚於 cutoff 才被 admin 建立：所有 RSVP 一律 `declined`，admin 須手動處理（規則嚴格性的取捨）。

## 決策改寫表

`makeDecision` 邏輯不變。worker 在拿到結果後、push 之前，對 cutoff 後的活動套以下覆寫：

| `makeDecision` 結果 | 當前 status | cutoff 後改寫 |
|---|---|---|
| `approved:eligible` / `approved:upgraded` | 不是 `approved` | → `declined:cutoff_eligible` |
| `approved:eligible` / `approved:upgraded` | 已 `approved` | 維持（保留座位） |
| `approved:downgraded` | 已 `approved` | 維持（仍降票，保座位） |
| `approved:downgraded` | 不是 `approved` | → `declined:cutoff_eligible` |
| `waitlist:no_membership` | 任何 | → `declined:cutoff_no_membership` |
| `waitlist:tier_mismatch` | 任何 | → `declined:cutoff_tier_mismatch` |
| `waitlist:non_tdf_ticket` | 任何 | → `declined:cutoff_non_tdf_ticket` |
| `waitlist:no_show_penalty` | 任何 | → `declined:cutoff_no_show_penalty` |
| `waitlist:weekly_out_of_range` | 任何 | → `declined:cutoff_weekly_out_of_range` |
| `waitlist:capacity_full` | 任何 | → `declined:cutoff_capacity_full` |

`pending_approval` 從未 review 過的：跑 `makeDecision` 後一定回 `approved:*` 或 `waitlist:*`，被上表覆寫為 `declined`（除非他符合條件且狀態已是 `approved`，但 `pending_approval ≠ approved`，所以一律 `declined`）。

`declined` / `invited` 維持目前 `SILENT_SKIP_STATUSES` 行為，不被 review、不被覆寫。

## 架構

### 新檔案：`lib/lumaCutoff.ts`

純函式，無 IO，獨立可測。

```ts
export function getCutoffAt(eventStartAt: string): Date;
export function isPastCutoff(eventStartAt: string, now: Date): boolean;
export function applyCutoffOverride(
  decision: ReviewDecision,
  currentStatus: string | null,
): ReviewDecision;
```

`getCutoffAt`：把 `start_at`（UTC ISO）轉 `UTC+8` 取 hour，依時段算出 GMT+8 的 `00:00` / `06:00` / `12:00` cutoff，再轉回 UTC `Date` 回傳。

`isPastCutoff`：`now.getTime() >= getCutoffAt(eventStartAt).getTime()`。

`applyCutoffOverride`：依「決策改寫表」改寫 decision；若不過 cutoff，原樣回傳（呼叫端會先用 `isPastCutoff` 判斷，但此函式對 cutoff 與否盲目，由呼叫端控制是否套用）。

### 修改：`lib/lumaSyncWorker.ts`

`processEvent` 內：

1. 從 `luma_events.start_at` 算 `pastCutoff = isPastCutoff(eventStartAt, new Date())`，每個活動算一次。
2. `makeDecision()` 後、push 前，若 `pastCutoff === true` 呼叫 `applyCutoffOverride(decision, row.activity_status)` 改寫 decision。
3. push 路徑加入 `'declined'` 為合法 status。
4. counters 增加 `declined`，更新 `luma_sync_jobs` / `luma_sync_event_results` 寫入時帶上 `review_declined`。

`REVIEWABLE_STATUSES` 不變（仍只接受 `approved` / `waitlist` / `pending_approval` 進 review）；override 寫的 `declined` 在下一次 sync 自然落入 `SILENT_SKIP_STATUSES`，不再被碰。

### 修改：`lib/lumaApi.ts`

`updateGuestStatus` 簽章從 `'approved' | 'waitlist'` 擴成 `'approved' | 'waitlist' | 'declined'`。

備註：使用者確認 Luma API 支援把 status 推為 `declined`，無需額外 probe。

### Migration：`supabase/migrations/add_luma_review_declined_count.sql`

```sql
alter table luma_sync_jobs add column review_declined int not null default 0;
alter table luma_sync_event_results add column review_declined int not null default 0;
```

向下相容，舊紀錄預設 `0`。

### Admin UI

`luma-sync history expansion`（最近於 commit `cf098d0` 加入）顯示每個 job 的 `review_approved` / `review_waitlisted` / `review_skipped`。新增 `review_declined` 欄位顯示。新的 `declined:cutoff_*` reason 自然顯示在每筆 log 行內，無需特別處理。

## 測試

### 單元測試 `__tests__/lumaCutoff.test.ts`

`getCutoffAt`：

- 早上活動 `2026-05-10T01:00:00+08:00` → cutoff `2026-05-09T00:00+08:00`
- 早上活動 `2026-05-10T11:59:00+08:00` → cutoff `2026-05-09T00:00+08:00`
- 下午活動 `2026-05-10T12:00:00+08:00` → cutoff `2026-05-10T06:00+08:00`
- 下午活動 `2026-05-10T17:59:00+08:00` → cutoff `2026-05-10T06:00+08:00`
- 晚上活動 `2026-05-10T18:00:00+08:00` → cutoff `2026-05-10T12:00+08:00`
- 晚上活動 `2026-05-10T23:59:00+08:00` → cutoff `2026-05-10T12:00+08:00`

`isPastCutoff`：整點當下、整點前一秒、整點後一秒。

`applyCutoffOverride`：「決策改寫表」每一 row 至少一個 case 驗證。

### 整合驗證（手動）

1. 寫 `scripts/dry-run-luma-cutoff.ts`：列出每個未來活動的 `cutoffAt` / `isPastCutoff`、目前 `waitlist` + `pending_approval` 計數，估算正式上線後第一次 sync 會 decline 多少人。
2. 跑 dry-run，數字合理才 deploy。
3. Deploy 後第一個 cron sync 跑完，檢查：
   - admin sync history 是否正確顯示 `review_declined` 計數
   - 至少一筆 `declined:cutoff_*` review_log 對應的 Luma guest，狀態確實為 `declined`

## 部署順序

依專案習慣（最近 commits 多為單一 commit 直上 main，例如 `cf098d0` `ac5b775`），合併為一個 PR / 一個 commit：

1. 新增 `lib/lumaCutoff.ts` + 單元測試
2. Migration `add_luma_review_declined_count.sql`（apply 到 production Supabase）
3. `lib/lumaApi.ts` `updateGuestStatus` 簽章擴充
4. `lib/lumaSyncWorker.ts` 整合：counter / override / push declined
5. Admin UI 顯示 `review_declined`
6. `scripts/dry-run-luma-cutoff.ts`

dry-run 必須先在本地對 production data 跑過、數字確認合理，才合 commit。

## 非目標

- 不改 cron 排程（維持 `:15` / `:45` 每 30 分鐘）。
- 不改現有 `makeDecision` 業務規則（會員、tier、no-show、weekly_backer、capacity）。
- 不寄通知信給 admin（既有 sync history UI 已可看 declined 數）。
- 不提供 admin UI 切換「對特定活動跳過 cutoff」（規則嚴格、admin 若需例外靠手動 approve）。
- 不區分「cutoff 前的 waitlist 存量」與「cutoff 後新進入 waitlist 的人」— 兩者皆 decline。

## 風險

- **誤 decline**：若 `getCutoffAt` 時區計算有 bug，可能在錯誤時間點開始 decline。Mitigation：dry-run script 先驗證；單元測試覆蓋整點邊界。
- **Luma API decline 通知**：Luma 預設會發 decline 通知信給使用者，使用者需理解此行為（已於 brainstorming 中提示，使用者接受）。
- **admin 手動 approve 後被覆蓋**：若 admin 在 cutoff 後手動 approve，sync 看到 `approved` 不主動 push status；但若該 guest 觸發保護性條件（tier mismatch、membership lapse 等），仍會被改寫為 `declined`。這符合規則嚴格性，admin 若想保留例外需另行處理。

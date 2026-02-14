# Meta 標準事件遺漏檢查報告

本文件列出了網站中可能遺漏的 Meta (Facebook Pixel) 標準事件。

## 遺漏的標準事件

### 1. SubmitApplication（提交申請）

**狀態**: ❌ **未實現**

**說明**: 網站有多個「Call for」連結，這些連結指向 Google Forms 申請表單。當用戶點擊這些連結時，應該追蹤 `SubmitApplication` 事件，但目前只追蹤了 `Lead` 事件。

**適用場景**:
- Call for Speakers (https://forms.gle/pVc6oTEi1XZ1pAR49)
- Call for Volunteers (https://forms.gle/SPCggMHifbE3oqkk7)
- Call for Partners (https://forms.gle/KqJGkQhdWmSZVTdv6)
- Call for Side Events (https://forms.gle/EofTp9Qso27jEeeY7)
- Call for Sponsors (https://forms.gle/aN3LbaHy8iV5xqyi8)

**當前實現位置**:
- `components/sections/HeroSection.tsx` - 所有 Call for 連結
- `components/Footer.tsx` - 所有 Call for 連結
- `components/sections/EventsSection.tsx` - Call for Side Events 和 Speakers

**當前追蹤**: 使用 `Lead` 事件 + 自訂事件

**建議改進**: 
- 在用戶點擊申請表單連結時，同時追蹤 `SubmitApplication` 事件
- 保留 `Lead` 事件作為補充（因為申請也可以被視為潛在客戶線索）

**推薦參數**:
```javascript
trackEvent('SubmitApplication', {
  content_name: 'Call for Speakers', // 或其他申請類型
  content_category: 'Application',
  content_ids: ['speakers'], // 或其他識別碼
});
```

---

### 2. FindLocation（查找位置）

**狀態**: ⚠️ **部分實現**

**說明**: 網站有地圖功能（AccommodationSection），用戶可能會在地圖上查找位置。由於地圖是嵌入的 Google Maps iframe，我們無法直接追蹤用戶在地圖內的互動。但可以追蹤用戶查看地圖的行為。

**適用場景**:
- 用戶查看 Accommodation Section 中的地圖
- 用戶點擊地圖上的位置標記（如果可能）
- 用戶點擊「查看網站」連結查看住宿詳情

**當前實現位置**:
- `components/sections/AccommodationSection.tsx` - 地圖展示
- `components/NomadMap.tsx` - 地圖組件

**當前追蹤**: 使用 `ViewContent` 事件（透過 `useSectionTracking`）

**建議改進**:
- 在用戶首次查看地圖時，追蹤 `FindLocation` 事件
- 在用戶點擊住宿項目的「查看網站」連結時，追蹤 `FindLocation` 事件

**推薦參數**:
```javascript
trackEvent('FindLocation', {
  content_name: 'Accommodation Map',
  content_category: 'Location Search',
  // 如果用戶點擊了特定住宿，可以添加：
  // content_ids: [accommodationId],
});
```

---

### 3. Schedule（安排/查看日程）

**狀態**: ⚠️ **部分實現**

**說明**: 網站有日程表功能，用戶可能會查看或安排活動。雖然目前使用了 `ViewContent` 和 `Search`，但如果用戶實際安排/註冊活動，應該使用 `Schedule` 事件。

**適用場景**:
- 用戶開啟日程表模態框
- 用戶點擊活動連結進行註冊
- 用戶篩選日程表（已有 `Search` 事件）

**當前實現位置**:
- `components/sections/EventsSection.tsx` - 日程表展示
- `components/ScheduleModal.tsx` - 日程表模態框

**當前追蹤**: 
- `ViewContent` 事件（透過 `useSectionTracking`）
- `Search` 事件（日程篩選）

**建議改進**:
- 在用戶開啟日程表模態框時，追蹤 `Schedule` 事件
- 在用戶點擊活動連結進行註冊時，追蹤 `Schedule` 事件

**推薦參數**:
```javascript
trackEvent('Schedule', {
  content_name: 'Event Schedule',
  content_category: 'Event Registration',
  content_ids: [eventId], // 如果點擊了特定活動
});
```

---

## 已正確實現的標準事件

以下事件已經正確實現，無需修改：

✅ **PageView** - 頁面瀏覽
✅ **ViewContent** - 內容查看
✅ **CompleteRegistration** - 完成註冊（訂閱）
✅ **InitiateCheckout** - 開始結帳
✅ **AddPaymentInfo** - 添加支付資訊
✅ **Purchase** - 購買完成
✅ **Lead** - 潛在客戶線索
✅ **Search** - 搜尋/篩選
✅ **Contact** - 聯絡

---

## 實施建議

### 優先級 1: SubmitApplication（高優先級）

**原因**: 申請表單是重要的轉化目標，使用標準事件可以更好地在 Meta 廣告平台中建立轉化目標。

**實施步驟**:
1. 在所有「Call for」連結的 `onClick` 事件中添加 `SubmitApplication` 追蹤
2. 保留現有的 `Lead` 事件作為補充
3. 更新 `META_EVENTS_TRACKING.md` 文件

**影響檔案**:
- `components/sections/HeroSection.tsx`
- `components/Footer.tsx`
- `components/sections/EventsSection.tsx`

### 優先級 2: FindLocation（中優先級）

**原因**: 地圖功能是用戶查找住宿的重要工具，追蹤此事件有助於了解用戶對位置的興趣。

**實施步驟**:
1. 在 `AccommodationSection` 中，當用戶首次查看地圖時追蹤 `FindLocation`
2. 在用戶點擊住宿項目的「查看網站」連結時追蹤 `FindLocation`
3. 由於地圖是 iframe，無法追蹤地圖內的互動，但可以追蹤查看行為

**影響檔案**:
- `components/sections/AccommodationSection.tsx`

### 優先級 3: Schedule（中優先級）

**原因**: 日程表是活動網站的核心功能，追蹤此事件有助於了解用戶對活動的參與度。

**實施步驟**:
1. 在用戶開啟日程表模態框時追蹤 `Schedule`
2. 在用戶點擊活動連結進行註冊時追蹤 `Schedule`
3. 保留現有的 `ViewContent` 和 `Search` 事件

**影響檔案**:
- `components/sections/EventsSection.tsx`
- `components/ScheduleModal.tsx`

---

## 注意事項

1. **事件重複**: 某些場景可能同時觸發多個事件（如 `SubmitApplication` 和 `Lead`），這是可以接受的，因為它們追蹤不同的用戶意圖。

2. **iframe 限制**: 由於地圖是嵌入的 Google Maps iframe，我們無法追蹤用戶在地圖內的詳細互動。只能追蹤用戶查看地圖的行為。

3. **外部連結**: 申請表單連結指向外部 Google Forms，我們只能追蹤用戶點擊連結的行為，無法追蹤用戶實際提交表單的行為（除非使用 Google Forms API）。

4. **向後相容**: 添加新事件時，應保留現有的自訂事件追蹤，以確保數據連續性。

---

## 總結

- **遺漏事件數量**: 3 個標準事件
- **高優先級**: 1 個（SubmitApplication）
- **中優先級**: 2 個（FindLocation, Schedule）
- **低優先級**: 0 個

建議優先實施 `SubmitApplication` 事件，因為它與重要的轉化目標（申請表單）直接相關，可以更好地優化 Meta 廣告投放。

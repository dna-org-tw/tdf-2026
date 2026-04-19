# Unified Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current tabbed `/guide` page with a unified long-form guide that documents event participation, the member system, partner stay, and visa support documents, while keeping homepage FAQ links useful.

**Architecture:** `data/guide.ts` becomes the single bilingual content source for entry cards, grouped anchor nav, section-driven content blocks, and end-of-page limitations. `app/guide/page.tsx` renders a long-form guide with dedicated guide UI components instead of tab state, and `components/sections/FAQSection.tsx` keeps the homepage FAQ event-focused by linking into the new section IDs.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript strict mode, Tailwind CSS 4, existing `useTranslation` hook, existing Facebook Pixel tracking helper, and Playwright for smoke coverage.

**Testing note:** The repo does not use a unit-test framework for page logic. Verification for this feature should use `npm run lint`, `npm run build`, targeted Playwright guide coverage, and manual hash/scroll checks in both languages.

**Reference spec:** `docs/superpowers/specs/2026-04-19-unified-guide-design.md`

---

## File Structure

**Create:**
- `components/guide/GuideHero.tsx` — page hero plus two top-level entry cards
- `components/guide/GuideQuickNav.tsx` — sticky grouped anchor navigation
- `components/guide/GuideBlockRenderer.tsx` — renders `faq`, `feature-list`, `steps`, `table`, `callout`, and `checklist` blocks
- `components/guide/GuideSectionRenderer.tsx` — wraps each guide section with heading, intro, and content blocks
- `components/guide/GuideLimitationsSection.tsx` — renders the end-of-page limitations cards
- `tests/e2e/guide.spec.ts` — Playwright smoke coverage for guide rendering, anchor nav, and homepage FAQ targets

**Modify:**
- `data/guide.ts` — replace tab schema with section-driven guide content
- `app/guide/page.tsx` — remove tab state and render the new long-form guide
- `components/sections/FAQSection.tsx` — update homepage links from old tab hashes to new section hashes

**Keep as-is but reuse:**
- `components/Navbar.tsx` — still links to `/guide`
- `hooks/useTranslation.ts` — remains the source of current language
- `components/FacebookPixel.tsx` — keep `trackEvent('ViewContent', ...)` for the guide page

---

### Task 1: Refactor `data/guide.ts` Into a Section-Driven Event Guide Source

**Files:**
- Modify: `data/guide.ts`

- [ ] **Step 1: Replace the old tab interfaces with the new unified guide types**

Replace the top of `data/guide.ts` with these type definitions:

```ts
export interface GuideEntryCard {
  id: string;
  label: string;
  description: string;
  targetId: string;
}

export interface GuideNavItem {
  id: string;
  label: string;
}

export interface GuideNavGroup {
  id: string;
  label: string;
  items: GuideNavItem[];
}

export type GuideBlock =
  | { type: 'faq'; items: Array<{ question: string; answer: string }> }
  | { type: 'feature-list'; items: Array<{ title: string; body: string }> }
  | { type: 'steps'; items: Array<{ title: string; body: string }> }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'callout'; tone: 'info' | 'warning'; title?: string; body: string }
  | { type: 'checklist'; items: string[] };

export interface GuideSection {
  id: string;
  group: 'event' | 'member' | 'stay' | 'visa';
  label: string;
  title: string;
  intro?: string;
  blocks: GuideBlock[];
}

export interface GuideLimitationItem {
  title: string;
  body: string;
}

export interface HomeFAQItem {
  question: string;
  summary: string;
  guideSection: string;
}

export interface GuideContent {
  pageTitle: string;
  pageDescription: string;
  homeFaqTitle: string;
  homeFaqCta: string;
  entryCards: GuideEntryCard[];
  navGroups: GuideNavGroup[];
  sections: GuideSection[];
  limitations: {
    title: string;
    items: GuideLimitationItem[];
  };
  homeFaq: HomeFAQItem[];
}
```

- [ ] **Step 2: Rebuild the shared page shell metadata, entry cards, and grouped nav**

Inside `data/guide.ts`, define a shared bilingual structure that starts like this for `zh`:

```ts
export const guideContent: { en: GuideContent; zh: GuideContent } = {
  zh: {
    pageTitle: '完整指南',
    pageDescription: '活動參與、會員系統、合作住宿與簽證輔助文件的完整導覽。',
    homeFaqTitle: '常見問題',
    homeFaqCta: '查看完整指南',
    entryCards: [
      {
        id: 'event-guide',
        label: '活動指南',
        description: '先看票券、報名、住宿、交通與講者合作資訊。',
        targetId: 'event-guide',
      },
      {
        id: 'member-guide',
        label: '會員指南',
        description: '了解登入、身份卡、名片、收藏、訂單、住宿與簽證工具。',
        targetId: 'member-guide',
      },
    ],
    navGroups: [
      {
        id: 'event',
        label: '活動',
        items: [
          { id: 'event-guide', label: '總覽' },
          { id: 'event-tickets', label: '票券與參與' },
          { id: 'event-registration', label: '活動報名' },
          { id: 'event-accommodation', label: '住宿與生活費' },
          { id: 'event-transportation', label: '交通' },
          { id: 'event-hualien', label: '花蓮旅行' },
          { id: 'event-speakers', label: '講者與協辦' },
          { id: 'event-visa-contact', label: '簽證與聯絡' },
        ],
      },
      {
        id: 'member',
        label: '會員',
        items: [
          { id: 'member-guide', label: '總覽' },
          { id: 'member-basics', label: '會員是什麼' },
          { id: 'member-auth-passport', label: '登入與身份卡' },
          { id: 'member-profile-card', label: '名片與公開頁' },
          { id: 'member-collections', label: '收藏' },
          { id: 'member-activity-orders', label: '活動與訂單' },
          { id: 'member-transfers', label: '轉讓' },
          { id: 'member-preferences', label: '信件偏好' },
          { id: 'member-upgrade', label: '升級' },
        ],
      },
      {
        id: 'stay',
        label: '住宿',
        items: [
          { id: 'stay-overview', label: '合作住宿' },
          { id: 'stay-booking', label: '如何預訂' },
          { id: 'stay-after-booking', label: '預訂後能做什麼' },
          { id: 'stay-rules', label: '規則與注意事項' },
        ],
      },
      {
        id: 'visa',
        label: '簽證',
        items: [{ id: 'visa-support', label: '簽證輔助文件' }],
      },
    ],
```

Mirror the same structure for `en`, using matching IDs and English labels:

```ts
  en: {
    pageTitle: 'Complete Guide',
    pageDescription: 'A unified guide to festival participation, member tools, partner stay booking, and visa support documents.',
    homeFaqTitle: 'FAQ',
    homeFaqCta: 'View Full Guide',
    entryCards: [
      {
        id: 'event-guide',
        label: 'Event Guide',
        description: 'Start with tickets, registration, accommodation, transportation, and speaker info.',
        targetId: 'event-guide',
      },
      {
        id: 'member-guide',
        label: 'Member Guide',
        description: 'Learn how login, identity cards, profiles, collections, orders, stay, and visa tools work.',
        targetId: 'member-guide',
      },
    ],
    navGroups: [
      {
        id: 'event',
        label: 'Event',
        items: [
          { id: 'event-guide', label: 'Overview' },
          { id: 'event-tickets', label: 'Tickets & Access' },
          { id: 'event-registration', label: 'Registration' },
          { id: 'event-accommodation', label: 'Accommodation & Cost' },
          { id: 'event-transportation', label: 'Transportation' },
          { id: 'event-hualien', label: 'Hualien Tour' },
          { id: 'event-speakers', label: 'Speakers & Partners' },
          { id: 'event-visa-contact', label: 'Visa & Contact' },
        ],
      },
      {
        id: 'member',
        label: 'Member',
        items: [
          { id: 'member-guide', label: 'Overview' },
          { id: 'member-basics', label: 'What Counts as a Member' },
          { id: 'member-auth-passport', label: 'Login & Identity Card' },
          { id: 'member-profile-card', label: 'Profile Card & Public Page' },
          { id: 'member-collections', label: 'Collections' },
          { id: 'member-activity-orders', label: 'Events & Orders' },
          { id: 'member-transfers', label: 'Transfers' },
          { id: 'member-preferences', label: 'Email Preferences' },
          { id: 'member-upgrade', label: 'Upgrade' },
        ],
      },
      {
        id: 'stay',
        label: 'Stay',
        items: [
          { id: 'stay-overview', label: 'Partner Stay' },
          { id: 'stay-booking', label: 'How Booking Works' },
          { id: 'stay-after-booking', label: 'After Booking' },
          { id: 'stay-rules', label: 'Rules & Notes' },
        ],
      },
      {
        id: 'visa',
        label: 'Visa',
        items: [{ id: 'visa-support', label: 'Visa Support Documents' }],
      },
    ],
```

- [ ] **Step 3: Migrate the existing event tabs into `sections`, keeping the same facts but new IDs**

In `data/guide.ts`, replace the old `tabs` array with section objects for the event guide. Use the existing Q&A copy and tables, but express them with `faq`, `table`, and `callout` blocks. Start the `zh.sections` array like this:

```ts
    sections: [
      {
        id: 'event-guide',
        group: 'event',
        label: '活動指南',
        title: '先確認怎麼參與這場節慶',
        intro: '如果你是第一次來到 TDF，先從票券、報名、住宿、交通與講者合作資訊開始看。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '你會在這一區看到什麼',
                body: '這一區整合票券與參與方式、Luma 報名流程、台東生活成本、交通安排、花蓮旅行、講者與 Side Event 合作，以及簽證與聯絡資訊。',
              },
            ],
          },
        ],
      },
      {
        id: 'event-tickets',
        group: 'event',
        label: '票券與參與',
        title: '票券、單場參與與訂單確認',
        intro: '先理解票券等級和你能參加哪些活動，再決定是否需要登入會員頁查訂單。',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: '票券分幾個等級？各自可以參加哪些活動？',
                answer: 'TDF 2026 票券分為四個等級：PURPLE（免費，官網訂閱 + IG 追蹤可參加紫色活動）、BLUE（30 USD，藍＋紫色活動）、GREEN（300 USD，綠＋藍＋紫色活動）、YELLOW（600 USD，全部活動＋花蓮三天兩夜旅行）。另有 Weekly Backer 票種，適合只能參加單週活動的人。',
              },
              {
                question: '我可以不買嘉年華門票，只買單場活動嗎？',
                answer: '可以。白色 Side Event 可單獨付費報名，不需要先買嘉年華門票；其他顏色活動也可能提供單場付費選項。',
              },
              {
                question: '購票後要怎麼確認訂單？',
                answer: '購票成功後系統會寄送確認信。若沒有收到，請先到官網右上角用 email 登入查看 `/me` 與訂單中心；仍找不到再聯繫 registration@taiwandigitalfest.com 或 IG。',
              },
              {
                question: '可以退票嗎？',
                answer: '票券條款預設不可退款，但已付款母訂單支援在截止日前自助轉讓。',
              },
            ],
          },
        ],
      },
      {
        id: 'event-registration',
        group: 'event',
        label: '活動報名',
        title: '如何用票券去預約各場活動',
        intro: 'TDF 的活動報名與票券是分開處理：先拿到參與資格，再去 Luma 頁面送出預約。',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: '先取得參與資格',
                body: '先購買嘉年華票券，或持有對應活動可接受的身份與權限。',
              },
              {
                title: '到 Luma 頁面送出預約',
                body: '前往各場活動的 Luma 頁面提出申請，工作人員會在後台依票券等級與順序核對。',
              },
              {
                title: '等待審核結果',
                body: '核可後會收到 Luma 的批准狀態；活動當天以 Luma 預約紀錄完成報到。',
              },
            ],
          },
          {
            type: 'faq',
            items: [
              {
                question: '報名後什麼時候會收到確認？',
                answer: '系統會依主辦方審核節奏逐步核可。請以 Luma 狀態與通知信為準。',
              },
              {
                question: '報名了但沒到會怎樣？',
                answer: '未準時出席的名額會釋出給現場候補。無故缺席會讓你下次活動的預約權限降為候補，再下一次才恢復正常。',
              },
              {
                question: '活動是否有限制名額？',
                answer: '有。活動會依票券等級與報名順序放行，以維持活動品質。',
              },
            ],
          },
        ],
      },
```

Continue the same `sections` array with `event-accommodation`, `event-transportation`, `event-hualien`, `event-speakers`, and `event-visa-contact`, lifting the remaining current event copy into these exact IDs. Convert the current HTML tables into `table.rows` arrays and convert narrative paragraphs into `feature-list` or `callout` blocks.

- [ ] **Step 4: Update `homeFaq` to point at new event section IDs**

At the bottom of each locale, set `homeFaq` to event-only entries with the renamed property:

```ts
    homeFaq: [
      {
        question: '票券分幾個等級？',
        summary: '四個主要等級加上 Weekly Backer，活動權限不同。',
        guideSection: 'event-tickets',
      },
      {
        question: '活動怎麼報名？',
        summary: '先取得票券資格，再到 Luma 頁面送出預約。',
        guideSection: 'event-registration',
      },
      {
        question: '在台東住一個月大概花多少？',
        summary: '整體約 25,000–40,000 TWD，依生活型態與住宿類型而定。',
        guideSection: 'event-accommodation',
      },
      {
        question: '各場活動之間怎麼移動？',
        summary: '自行前往，建議善用火車、租車與社群共乘。',
        guideSection: 'event-transportation',
      },
      {
        question: '我想當講者，怎麼申請？',
        summary: '填寫 Call for Speaker 表單，通過審核後可獲免費票券。',
        guideSection: 'event-speakers',
      },
      {
        question: '活動場地有哪些？',
        summary: '主要會場、共創空間與花蓮旅行安排都整理在完整指南裡。',
        guideSection: 'event-guide',
      },
    ],
```

Mirror the same six items in English with matching `guideSection` IDs.

- [ ] **Step 5: Run lint on the refactored guide data**

Run:

```bash
npm run lint -- data/guide.ts
```

Expected: ESLint exits successfully with no parsing or type-shape errors.

- [ ] **Step 6: Commit**

```bash
git add data/guide.ts
git commit -m "refactor(guide): migrate event guide to section data"
```

---

### Task 2: Add Member, Stay, Visa, and Limitations Content to `data/guide.ts`

**Files:**
- Modify: `data/guide.ts`

- [ ] **Step 1: Add the member-guide sections in Chinese**

Append these Chinese sections to `zh.sections`, keeping the IDs exactly as listed:

```ts
      {
        id: 'member-guide',
        group: 'member',
        label: '會員指南',
        title: '這不只是查訂單，而是一套獨立會員系統',
        intro: 'TDF 的會員能力包含登入、身份卡、公開或私密名片、收藏、活動與訂單、自助轉讓、信件偏好，以及已上線但仍有缺口的自助升級流程。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '你會在這一區看到什麼',
                body: '這一區會先講什麼是 member，再說明登入與身份卡、名片與公開頁、收藏、活動與訂單、轉讓、信件偏好、升級，以及目前限制。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-basics',
        group: 'member',
        label: '會員是什麼',
        title: '登入帳號和會員身份是兩層不同資料',
        intro: '系統中的 `users` 是登入帳號，`members` 才是實際會員身份。只有進到 `members` 的 email 才會拿到 `member_no`，並啟用完整會員能力。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '什麼情況會成為 member',
                body: '`members` 不只來自付費訂單，也會從 newsletter 訂閱與系統寄信紀錄建立，所以 follower 也可能是 member。',
              },
              {
                title: '沒有 member row 會發生什麼事',
                body: '你仍然可以登入 `/me`，但若 email 尚未對應到 `members` row，`member_no`、公開卡、收藏等能力會受限或空白。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-auth-passport',
        group: 'member',
        label: '登入與身份卡',
        title: '用 email 驗證碼登入，再由系統判斷你的身份卡等級',
        intro: '會員登入走 email + 6 碼驗證碼，可重寄，session cookie 保留 7 天；登入後 `/me` 會集中顯示會員身份卡、活動、訂單、收藏提醒與設定。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '會員首頁是整合式 dashboard',
                body: '登入後會集中讀取 member 編號、身份等級、名片資料、活動、訂單、轉讓紀錄、收藏提醒、住宿摘要與信件偏好。',
              },
              {
                title: '身份卡等級如何決定',
                body: '系統會依已付款訂單決定 `follower / explore / contribute / weekly_backer / backer` 身份與有效期間；沒有付費單就回到 follower。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-profile-card',
        group: 'member',
        label: '名片與公開頁',
        title: '你的會員卡可以公開，也可以保持私密後用 QR 分享',
        intro: '目前可編輯顯示名稱、頭像、所在地、自介、標籤與社群連結，並在公開與私密之間切換。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '可編輯欄位',
                body: '顯示名稱、頭像、所在地、自介、標籤與社群連結都寫入 `member_profiles`；頭像支援 JPEG / PNG / WebP，大小上限 2MB。',
              },
              {
                title: '公開名片與目錄',
                body: '公開後會擁有 `/members/{memberNo}` 個人頁，也會出現在 `/members` 公開目錄中，支援搜尋與分頁。',
              },
              {
                title: '私密分享',
                body: '即使名片保持私密，仍可透過有效期 5 分鐘的 QR token 在現場分享。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-collections',
        group: 'member',
        label: '收藏',
        title: '你可以收藏其他會員，也能知道誰收藏了你',
        intro: '公開卡可以直接收藏；私密卡需帶有效 QR token。系統會阻擋收藏自己。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '怎麼收藏',
                body: '登入會員後，可在公開會員頁直接收藏；若對方是私密卡，需透過 QR token 驗證後才能收藏。',
              },
              {
                title: '在哪裡查看收藏',
                body: '`/me/collections` 會顯示你收藏的人、誰收藏了你、未讀數，以及移除自己已收藏對象的操作。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-activity-orders',
        group: 'member',
        label: '活動與訂單',
        title: '會員頁同時是你的 participation center',
        intro: '這裡同時整合了活動報名狀態與訂單紀錄，而不是只有單純查票。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '我的活動',
                body: 'Dashboard 會從 Luma 同步 upcoming / past events、核准或候補狀態、是否簽到，以及 no-show penalty 是否已被消化。',
              },
              {
                title: '訂單中心',
                body: '`/me` 會列出所有訂單，父訂單與升級子訂單分組展示；單筆詳情頁會顯示金額、折扣、稅、付款方式、聯絡資訊與轉讓紀錄。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-transfers',
        group: 'member',
        label: '轉讓',
        title: '已付款的母訂單可以在截止日前自助轉讓',
        intro: '若該訂單下已有已付款升級子單，系統會一起轉讓，並留下 audit trail 與通知信。',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: '從 dashboard 發起轉讓',
                body: '只有符合條件的已付款母訂單會出現轉讓操作；若截止日已過，按鈕會變成不可用。',
              },
              {
                title: '系統一起處理升級子單',
                body: '若該母訂單底下已有已付款升級子單，轉讓時會一起搬移，避免票種與 ownership 分離。',
              },
              {
                title: '追蹤轉讓結果',
                body: 'Dashboard 會列出已轉出訂單，轉出與接收雙方都會收到通知信。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-preferences',
        group: 'member',
        label: '信件偏好',
        title: '三類通知都能自助管理',
        intro: '會員可以調整 `newsletter / events / award` 三類通知，也可以一鍵全部退訂。',
        blocks: [
          {
            type: 'checklist',
            items: [
              'newsletter：電子報與內容更新',
              'events：活動相關通知',
              'award：Nomad Award 相關信件',
            ],
          },
        ],
      },
      {
        id: 'member-upgrade',
        group: 'member',
        label: '升級',
        title: '會員可從 `/upgrade` 走自助升級流程',
        intro: '升級頁會找出目前最高等的可升級母訂單、計算價差，並透過 Stripe hosted invoice 補差價。',
        blocks: [
          {
            type: 'callout',
            tone: 'info',
            title: '描述請保守',
            body: '一般升級流程已上線，但部分升級路徑仍有缺口，尤其是 `weekly_backer` 相關條件，詳見頁尾限制。',
          },
        ],
      },
```

- [ ] **Step 2: Add the stay, visa, and limitations sections in Chinese**

Continue `zh.sections` and `zh.limitations` with these exact content anchors:

```ts
      {
        id: 'stay-overview',
        group: 'stay',
        label: '合作住宿',
        title: 'Partner Stay 不是推薦住宿清單，而是一套獨立預訂流程',
        intro: '`/stay` 是已上線的合作住宿系統，提供 Norden Ruder 的週次房況、房型細節、預訂與後續管理流程。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '公開可見的資訊',
                body: '任何人都可以進 `/stay` 查看房型、每週價格、剩餘房數與住宿規則。',
              },
              {
                title: '只有會員可預訂',
                body: '真正送出 booking 仍需要會員登入與 member 身份，未登入會看到 sign-in gate。',
              },
            ],
          },
        ],
      },
      {
        id: 'stay-booking',
        group: 'stay',
        label: '如何預訂',
        title: '合作住宿目前支援一般擔保與 invite code 兩條路徑',
        intro: '使用者可選擇週次、填主住客資料；目前為單人入住 only，沒有雙人同住預訂流程。',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: '查看週次與房況',
                body: '公開 `/stay` 頁會顯示每週日期、價格、實際房型資訊與剩餘房數。',
              },
              {
                title: '登入會員後選週次',
                body: '會員在右側 booking panel 勾選欲入住週次，填寫主住客姓名與電話，系統固定用單人入住規則建立 booking。',
              },
              {
                title: '完成擔保或輸入 invite code',
                body: '一般 booking 需先完成 Stripe SetupIntent card guarantee；若持有有效 invite code，則可走 complimentary path。',
              },
            ],
          },
        ],
      },
      {
        id: 'stay-after-booking',
        group: 'stay',
        label: '預訂後能做什麼',
        title: 'Member 端已經接上摘要、候補與轉讓資料流，但前台管理介面仍偏第一版',
        intro: '這一區應如實描述已存在的 booking / waitlist / transfer / reconcile 流程，但不要把 member UI 寫成比實際更完整。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '在 `/me` 看到什麼',
                body: '會員頁已有 Partner Stay summary card，能依目前 summary 狀態顯示 Book stay、Manage stay 或 Accept transfer 的入口。',
              },
              {
                title: '系統已接好的流程',
                body: '後端已有 modify week、transfer initiate、transfer accept、waitlist join/leave、waitlist offer、以及 reconcile cron 流程。',
              },
              {
                title: '描述時的保守原則',
                body: '前台管理與接受轉讓頁面目前仍較精簡，因此指南應寫成「已有流程基礎」而不是「完整自助住宿後台」。',
              },
            ],
          },
        ],
      },
      {
        id: 'stay-rules',
        group: 'stay',
        label: '規則與注意事項',
        title: '合作住宿有自己的扣款、候補與轉讓規則',
        intro: '這些規則應在指南中明確告知，避免使用者以為住宿系統只是一般住宿推薦。',
        blocks: [
          {
            type: 'checklist',
            items: [
              'No-show 可能會收取整週房費，admin 端已有 no-show charge flow。',
              '候補 offer 與轉讓接受都有時效，過期後 reconcile 會回收狀態並釋出名額。',
              '剩餘房數與候補釋出會隨 waitlist / transfer / reconcile 流程更新。',
              '部分補救與後續操作目前由 `/admin/stay` tooling 支援。',
            ],
          },
        ],
      },
      {
        id: 'visa-support',
        group: 'visa',
        label: '簽證輔助文件',
        title: '會員現在可以在 `/me` 自助儲存資料並下載 PDF support letter',
        intro: '這不是公開 FAQ，而是會員後台的新工具：填好簽證資料後即可產出正式 PDF 輔助文件。',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: '先儲存簽證資料',
                body: '填寫護照英文姓名、國籍、生日、護照號碼、核發國家、到期日、預計入離境日、在台地址與申請館處後，先儲存資料。',
              },
              {
                title: '再下載 PDF',
                body: '系統會驗證 member 身份、讀取已儲存資料、挑選最佳 paid order snapshot，然後產生正式 PDF 下載。',
              },
            ],
          },
          {
            type: 'feature-list',
            items: [
              {
                title: '這份文件的性質',
                body: '它是簽證 support letter，不等同官方簽證核發保證。',
              },
              {
                title: '其他限制',
                body: '下載有 rate limit，且文件內容會依會員當下儲存的資料與最佳 paid order 狀態生成。',
              },
            ],
          },
        ],
      },
    ],
    limitations: {
      title: '目前限制與注意事項',
      items: [
        {
          title: '會員資料編輯仍有缺口',
          body: '`languages` 與 `timezone` 已存在於資料表與 API，也會顯示在公開會員頁，但 `/me` 前台目前沒有編輯介面。',
        },
        {
          title: 'Weekly Backer 自助升級未完整',
          body: '`/upgrade` 前台目前沒有收集 `target_week`，但後端升級到 `weekly_backer` 時需要這個欄位，因此這條升級路徑要保守描述。',
        },
        {
          title: 'Nomad Award 不是會員專屬功能',
          body: 'Nomad Award 走的是 email + newsletter + reCAPTCHA，不依賴 `/me` session，不應寫成會員能力。',
        },
        {
          title: 'Partner Stay 的前台管理仍偏第一版',
          body: '住宿系統的 booking、waitlist、transfer、admin tooling 都已存在，但 member 前台管理與接受轉讓頁仍較精簡。',
        },
        {
          title: '簽證文件屬於 support letter',
          body: '文件可作為輔助申請資料，但不構成官方簽證結果保證。',
        },
      ],
    },
```

- [ ] **Step 3: Mirror the same member, stay, visa, and limitations content in English**

Translate the same IDs into English inside `en.sections` and `en.limitations`, for example:

```ts
      {
        id: 'member-basics',
        group: 'member',
        label: 'What Counts as a Member',
        title: 'A login account and a member identity are not the same record',
        intro: '`users` is the sign-in account layer, while `members` is the actual member identity. Only emails that have a `members` row receive a `member_no` and unlock the full card, public page, and collection features.',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: 'How someone becomes a member',
                body: '`members` is populated not only from paid orders, but also from newsletter subscriptions and system email logs, so a follower can still count as a member.',
              },
              {
                title: 'What happens without a member row',
                body: 'A user can still sign in to `/me`, but if the email has no matching `members` row yet, `member_no`, public-card, and collection capabilities remain limited or blank.',
              },
            ],
          },
        ],
      },
      {
        id: 'stay-booking',
        group: 'stay',
        label: 'How Booking Works',
        title: 'Partner stay currently supports a guaranteed path and an invite-code path',
        intro: 'Members can choose weeks and fill in primary guest details. The current booking flow is single-occupancy only.',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Review weekly inventory and room details',
                body: 'The public `/stay` page shows weekly dates, prices, real room details, and remaining-room visibility.',
              },
              {
                title: 'Choose weeks after signing in',
                body: 'Signed-in members use the booking panel to pick weeks and submit primary guest details.',
              },
              {
                title: 'Either verify a card or use an invite code',
                body: 'Regular bookings require a Stripe SetupIntent card guarantee, while a valid invite code enables the complimentary path.',
              },
            ],
          },
        ],
      },
      {
        id: 'visa-support',
        group: 'visa',
        label: 'Visa Support Documents',
        title: 'Members can now save visa details and download a PDF support letter from `/me`',
        intro: 'This is a member tool rather than a public visa FAQ. Save your details first, then download a formal PDF document.',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Save your visa profile',
                body: 'Enter your passport English name, nationality, birth date, passport details, planned arrival and departure dates, Taiwan stay address, and destination mission, then save the form.',
              },
              {
                title: 'Download the PDF support letter',
                body: 'The server validates the saved profile, chooses the best paid-order snapshot when available, creates an issuance record, and returns a PDF download.',
              },
            ],
          },
        ],
      },
```

Include English equivalents for all remaining section IDs and all five limitation cards before closing `guideContent`.

- [ ] **Step 4: Run lint again**

Run:

```bash
npm run lint -- data/guide.ts
```

Expected: ESLint still passes after adding the member, stay, visa, and limitations content.

- [ ] **Step 5: Commit**

```bash
git add data/guide.ts
git commit -m "feat(guide): add member stay and visa guide content"
```

---

### Task 3: Build Reusable Guide UI Components

**Files:**
- Create: `components/guide/GuideHero.tsx`
- Create: `components/guide/GuideQuickNav.tsx`
- Create: `components/guide/GuideBlockRenderer.tsx`
- Create: `components/guide/GuideSectionRenderer.tsx`
- Create: `components/guide/GuideLimitationsSection.tsx`

- [ ] **Step 1: Create `GuideHero.tsx`**

Create `components/guide/GuideHero.tsx` with:

```tsx
import type { GuideContent } from '@/data/guide';

export default function GuideHero({ guide }: { guide: GuideContent }) {
  return (
    <section className="rounded-[32px] bg-[#1E1F1C] px-6 py-8 text-white sm:px-8 sm:py-10">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">TDF 2026</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{guide.pageTitle}</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/75 sm:text-base">{guide.pageDescription}</p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {guide.entryCards.map((card) => (
          <a
            key={card.id}
            href={`#${card.targetId}`}
            className="rounded-[24px] border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
          >
            <p className="text-lg font-semibold">{card.label}</p>
            <p className="mt-2 text-sm text-white/70">{card.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create `GuideQuickNav.tsx`**

Create `components/guide/GuideQuickNav.tsx` with:

```tsx
import type { GuideNavGroup } from '@/data/guide';

export default function GuideQuickNav({ navGroups }: { navGroups: GuideNavGroup[] }) {
  return (
    <div className="sticky top-20 z-30 -mx-4 overflow-x-auto border-y border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex min-w-max gap-6">
        {navGroups.map((group) => (
          <div key={group.id} className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              {group.label}
            </span>
            <div className="flex gap-2">
              {group.items.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-100"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `GuideBlockRenderer.tsx`**

Create `components/guide/GuideBlockRenderer.tsx` with:

```tsx
import type { GuideBlock } from '@/data/guide';

export default function GuideBlockRenderer({ block }: { block: GuideBlock }) {
  if (block.type === 'faq') {
    return (
      <div className="space-y-3">
        {block.items.map((item) => (
          <details key={item.question} className="group rounded-2xl border border-stone-200 bg-white">
            <summary className="cursor-pointer list-none px-5 py-4 text-base font-semibold text-stone-900">
              {item.question}
            </summary>
            <p className="px-5 pb-5 whitespace-pre-line text-sm leading-7 text-stone-600">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    );
  }

  if (block.type === 'feature-list' || block.type === 'steps') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {block.items.map((item) => (
          <article key={item.title} className="rounded-2xl border border-stone-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-stone-900">{item.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-stone-600">{item.body}</p>
          </article>
        ))}
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              {block.columns.map((column) => (
                <th key={column} className="border-b border-stone-200 px-4 py-3 text-left font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row.join('-')}`} className="border-t border-stone-100">
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top text-stone-600">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'callout') {
    return (
      <div
        className={`rounded-2xl p-5 ${
          block.tone === 'warning'
            ? 'border border-amber-200 bg-amber-50 text-amber-950'
            : 'border border-cyan-200 bg-cyan-50 text-cyan-950'
        }`}
      >
        {block.title ? <h3 className="text-base font-semibold">{block.title}</h3> : null}
        <p className={block.title ? 'mt-2 text-sm leading-7' : 'text-sm leading-7'}>{block.body}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-7 text-stone-600">
      {block.items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-stone-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Create `GuideSectionRenderer.tsx` and `GuideLimitationsSection.tsx`**

Create `components/guide/GuideSectionRenderer.tsx` with:

```tsx
import type { GuideSection } from '@/data/guide';
import GuideBlockRenderer from './GuideBlockRenderer';

export default function GuideSectionRenderer({ section }: { section: GuideSection }) {
  return (
    <section id={section.id} className="scroll-mt-32 space-y-5 rounded-[28px] border border-stone-200 bg-stone-50 p-6 sm:p-8">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
          {section.label}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">{section.title}</h2>
        {section.intro ? <p className="mt-3 text-sm leading-7 text-stone-600 sm:text-base">{section.intro}</p> : null}
      </div>
      <div className="space-y-5">
        {section.blocks.map((block, index) => (
          <GuideBlockRenderer key={`${section.id}-${index}`} block={block} />
        ))}
      </div>
    </section>
  );
}
```

Create `components/guide/GuideLimitationsSection.tsx` with:

```tsx
import type { GuideContent } from '@/data/guide';

export default function GuideLimitationsSection({
  limitations,
}: {
  limitations: GuideContent['limitations'];
}) {
  return (
    <section id="limitations" className="scroll-mt-32 rounded-[28px] border border-stone-200 bg-[#1E1F1C] p-6 text-white sm:p-8">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Notes</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{limitations.title}</h2>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {limitations.items.map((item) => (
          <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-white/70">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run lint on the new guide components**

Run:

```bash
npm run lint -- components/guide/GuideHero.tsx components/guide/GuideQuickNav.tsx components/guide/GuideBlockRenderer.tsx components/guide/GuideSectionRenderer.tsx components/guide/GuideLimitationsSection.tsx
```

Expected: ESLint passes with no import or JSX errors.

- [ ] **Step 6: Commit**

```bash
git add components/guide/GuideHero.tsx components/guide/GuideQuickNav.tsx components/guide/GuideBlockRenderer.tsx components/guide/GuideSectionRenderer.tsx components/guide/GuideLimitationsSection.tsx
git commit -m "feat(guide): add unified guide presentation components"
```

---

### Task 4: Rewrite `app/guide/page.tsx` Around Section Rendering and Hash Navigation

**Files:**
- Modify: `app/guide/page.tsx`

- [ ] **Step 1: Replace tab state with the new long-form guide page**

Rewrite `app/guide/page.tsx` to:

- load `guideContent` by language
- keep the existing `trackEvent('ViewContent', ...)`
- scroll to the current hash on mount and on `hashchange`
- render `GuideHero`, `GuideQuickNav`, all sections, and the limitations section

Use this structure:

```tsx
'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/components/FacebookPixel';
import { guideContent } from '@/data/guide';
import GuideHero from '@/components/guide/GuideHero';
import GuideQuickNav from '@/components/guide/GuideQuickNav';
import GuideSectionRenderer from '@/components/guide/GuideSectionRenderer';
import GuideLimitationsSection from '@/components/guide/GuideLimitationsSection';

const Footer = dynamic(() => import('@/components/Footer'), {
  ssr: false,
  loading: () => null,
});

function scrollToHash(hash: string) {
  const id = hash.replace(/^#/, '');
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function GuidePage() {
  const { lang } = useTranslation();
  const guide = lang === 'en' ? guideContent.en : guideContent.zh;

  useEffect(() => {
    trackEvent('ViewContent', {
      content_name: 'Guide Page',
      content_category: 'Information',
    });
  }, []);

  useEffect(() => {
    const syncHash = () => {
      if (!window.location.hash) return;
      window.setTimeout(() => scrollToHash(window.location.hash), 80);
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [lang]);

  return (
    <main className="min-h-screen bg-white text-[#1E1F1C]">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 pt-28 pb-16">
        <div className="mx-auto max-w-6xl space-y-8">
          <GuideHero guide={guide} />
          <GuideQuickNav navGroups={guide.navGroups} />
          {guide.sections.map((section) => (
            <GuideSectionRenderer key={section.id} section={section} />
          ))}
          <GuideLimitationsSection limitations={guide.limitations} />
        </div>
      </div>
      <Footer />
    </main>
  );
}
```

- [ ] **Step 2: Run lint on the new guide page**

Run:

```bash
npm run lint -- app/guide/page.tsx
```

Expected: ESLint passes and there are no dead imports from the old tab implementation.

- [ ] **Step 3: Commit**

```bash
git add app/guide/page.tsx
git commit -m "feat(guide): replace tabbed page with unified long-form guide"
```

---

### Task 5: Update Homepage FAQ Anchors and Add Guide Smoke Coverage

**Files:**
- Modify: `components/sections/FAQSection.tsx`
- Create: `tests/e2e/guide.spec.ts`

- [ ] **Step 1: Point homepage FAQ cards at the new section IDs**

Update `components/sections/FAQSection.tsx` so the event FAQ cards use the renamed property:

```tsx
<Link
  href={`/guide#${item.guideSection}`}
  className="block p-5 bg-white rounded-xl border border-stone-200 hover:border-stone-300 hover:shadow-sm transition-all h-full"
>
```

Do not change the homepage section copy or CTA structure. Keep it event-focused.

- [ ] **Step 2: Add a Playwright smoke test for the unified guide**

Create `tests/e2e/guide.spec.ts` with:

```ts
import { expect, test } from '@playwright/test';

test('guide page renders dual entry cards and grouped quick nav', async ({ page }) => {
  await page.goto('/guide?lang=zh');

  await expect(page.getByRole('heading', { name: /完整指南|參與指南/ })).toBeVisible();
  await expect(page.getByRole('link', { name: '活動指南' })).toBeVisible();
  await expect(page.getByRole('link', { name: '會員指南' })).toBeVisible();
  await expect(page.getByRole('link', { name: '票券與參與' })).toBeVisible();
  await expect(page.getByRole('link', { name: '會員是什麼' })).toBeVisible();
  await expect(page.getByRole('link', { name: '合作住宿' })).toBeVisible();
  await expect(page.getByRole('link', { name: '簽證輔助文件' })).toBeVisible();
});

test('guide deep link and homepage FAQ target the new section ids', async ({ page }) => {
  await page.goto('/guide?lang=zh#member-guide');
  await expect(page.locator('#member-guide')).toBeInViewport();

  await page.goto('/?lang=zh');
  await expect(page.locator('a[href="/guide#event-registration"]').first()).toBeVisible();
});
```

- [ ] **Step 3: Run lint for the homepage FAQ and guide smoke test**

Run:

```bash
npm run lint -- components/sections/FAQSection.tsx tests/e2e/guide.spec.ts
```

Expected: ESLint passes and recognizes the renamed `guideSection` property.

- [ ] **Step 4: Run the targeted Playwright suite**

Run:

```bash
npm run e2e -- tests/e2e/guide.spec.ts
```

Expected: both guide smoke tests pass, including the deep-link viewport assertion and the homepage FAQ anchor assertion.

- [ ] **Step 5: Commit**

```bash
git add components/sections/FAQSection.tsx tests/e2e/guide.spec.ts
git commit -m "test(guide): add unified guide smoke coverage"
```

---

### Task 6: Final Verification and Manual QA

**Files:**
- Modify: none

- [ ] **Step 1: Run full lint and production build**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands pass; the build should not fail on guide imports, client/server boundaries, or large bilingual data structures.

- [ ] **Step 2: Manually verify `/guide` in both languages**

Check these exact scenarios in the browser:

- `/guide?lang=zh` renders the hero, entry cards, grouped nav, event sections, member sections, stay sections, visa section, and limitations section in that order.
- `/guide?lang=en` renders the same section IDs with English copy.
- `/guide?lang=zh#member-guide` lands with the member overview section aligned below the sticky nav.
- `/guide?lang=zh#stay-booking` lands on the stay booking section.
- invalid hashes such as `/guide?lang=zh#nope` fail quietly and leave the page usable.

- [ ] **Step 3: Manually verify homepage FAQ routing**

From the homepage, click at least these cards and confirm they land on the correct new sections:

- 票券分幾個等級？ → `#event-tickets`
- 活動怎麼報名？ → `#event-registration`
- 在台東住一個月大概花多少？ → `#event-accommodation`

Expected: navigation lands on the matching section and does not depend on the removed tab UI.

- [ ] **Step 4: Manual content sanity-check against the approved spec**

Confirm the unified guide includes all approved capability groups:

- old public event FAQ and living guide
- existing member-system features
- new partner stay booking functionality
- new visa support document flow
- the limitations cards for member profile gaps, weekly backer upgrade gap, Nomad Award scope, stay UI maturity, and visa letter scope

Expected: no approved feature area is missing, and incomplete flows are described conservatively.

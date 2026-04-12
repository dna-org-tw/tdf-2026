# FAQ & Guide Page Design Spec

## Overview

Add a `/guide` page containing FAQ and Taitung living guide content, plus a condensed FAQ section on the homepage linking to it.

## Homepage FAQ Section

### Position

Between Accommodation and Team sections in `HomeContent.tsx`.

### Content — 6 Key Questions

| Question (zh) | Summary (zh) | Source |
|---|---|---|
| 票券分幾個等級？ | 四個等級：PURPLE 免費 → YELLOW VIP，含不同活動權限 | Q1 |
| 活動怎麼報名？ | 購票後到 Luma 頁面預約，工作人員核對後發送確認 | Q5 |
| 在台東住一個月大概花多少？ | 整體約 25,000–40,000 TWD，依生活型態而定 | Q8 |
| 各場活動之間怎麼移動？ | 自行前往，建議用 WhatsApp 群組共乘 | Q10 |
| 我想當講者，怎麼申請？ | 填寫 Call for Speaker 表單，通過審核可獲免費票券 | Q15 |
| 活動場地有哪些？ | 邸 Tai Dang、旅蒔 Roots Coworking、合流生活提案所、野室珈琲等 | Living Guide |

### Layout

- Title: "常見問題" / "FAQ"
- 6 cards in 3x2 grid (desktop), single column (mobile)
- Each card: question title + one-line summary text
- Bottom CTA button: "查看完整指南" / "View Full Guide" → `/guide`
- Style: consistent with existing section design patterns (stone/neutral palette)

## `/guide` Page

### Route

`app/guide/page.tsx` — client component using `useTranslation`.

### Page Structure

1. Top: page title "活動指南" / "Event Guide" + brief description
2. Horizontal tab bar (scrollable on mobile)
3. Tab content area below

### Tab Categories (8 tabs)

| Tab ID | Label (zh) | Label (en) | Content | Format |
|---|---|---|---|---|
| `tickets` | 票券與參與 | Tickets & Access | Q1–Q4 | Q&A accordion |
| `registration` | 活動報名 | Registration | Q5–Q7 | Q&A accordion |
| `accommodation` | 住宿與生活費 | Accommodation & Cost | Q8–Q9 + living guide housing section | Q&A accordion + info paragraphs |
| `transportation` | 交通 | Transportation | Q10–Q11 + living guide transport section | Q&A accordion + info paragraphs |
| `hualien` | 花蓮旅行 | Hualien Tour | Q12–Q14 | Q&A accordion |
| `speakers` | 講者與協辦 | Speakers & Partners | Q15–Q19 | Q&A accordion |
| `visa` | 簽證與聯絡 | Visa & Contact | Q20–Q21 + living guide visa/medical/utilities | Q&A accordion + info paragraphs |
| `living` | 台東生活 | Living in Taitung | Internet, food, budget, coworking, weather, apps | Info paragraphs (non-Q&A) |

### URL Hash Navigation

- Each tab corresponds to a URL hash: `/guide#transportation`, `/guide#tickets`, etc.
- On page load, if hash is present, activate the corresponding tab
- Clicking a tab updates the URL hash without page reload

### Data Structure

New file: `data/guide.ts`

Bilingual structure (`{ en, zh }`) consistent with `data/content.ts`. Contains:

- `faqSections`: array of tab sections, each with `id`, `label`, and `items` (question + answer pairs)
- `guideSections`: array of info sections with `id`, `label`, and `content` (markdown or structured text blocks with optional tables)
- `homeFaq`: the 6 selected questions for the homepage section, each with `question`, `summary`, and `guideTab` (which tab to link to)

### Accordion Component

- Click to expand/collapse
- Only one item open at a time within a section
- Smooth height animation

## Navigation

- Add "指南" / "Guide" link to Navbar (both desktop and mobile menu)

## i18n

- All text content bilingual in `data/guide.ts`
- Uses existing `useTranslation` hook
- Initially write Chinese content from the provided document; English translations to follow the same structure

## Design Style

- Follow existing site patterns: neutral/stone color palette, consistent typography
- Tab bar: horizontal, pill or underline style tabs
- Cards (homepage): light background with subtle border or shadow
- Responsive: mobile-first, tabs horizontally scrollable

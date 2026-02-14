# AEO (Answer Engine Optimization) 優化總結

本文件記錄了根據《答案引擎優化 (AEO) 2026 戰略白皮書》實施的優化措施。

## 已實施的優化

### 1. 結構化數據（Schema Markup）✅

#### Organization Schema
- ✅ 添加了完整的 Organization Schema
- ✅ 包含 `sameAs` 屬性，連結到社群媒體和官方網站
- ✅ 包含聯絡資訊和組織描述

#### Event Schema
- ✅ 添加了 Festival 類型的 Event Schema
- ✅ 包含完整的事件資訊：日期、地點、組織者
- ✅ 包含票種資訊（Explorer, Contributor, Backer）
- ✅ 包含關鍵詞和受眾資訊

#### FAQPage Schema
- ✅ 添加了 FAQPage Schema
- ✅ 包含所有常見問題的結構化數據
- ✅ 使用 Question/Answer 格式

#### 其他 Schema
- ✅ BreadcrumbList Schema
- ✅ WebSite Schema with SearchAction

**檔案位置：** `components/StructuredData.tsx`

### 2. 元數據優化 ✅

#### 豐富的 Metadata
- ✅ 優化的 title 和 description
- ✅ 添加了 keywords 陣列
- ✅ 添加了 authors, creator, publisher
- ✅ 配置了 OpenGraph 和 Twitter Card
- ✅ 設定了 robots 和 googleBot 規則
- ✅ 配置了多語言 alternate links

**檔案位置：** `app/layout.tsx`

### 3. 內容結構優化（BLUF 原則）✅

#### BLUF (Bottom Line Up Front)
- ✅ 在 AboutSection 中添加了答案塊格式
- ✅ 前 30-50 字直接回答問題
- ✅ 使用問題導向的 H2/H3 標題
- ✅ 使用 `<dl>`, `<dt>`, `<dd>` 語義化標籤

**檔案位置：** `components/sections/AboutSection.tsx`

### 4. SSR 優化 ✅

#### 伺服器端渲染
- ✅ 將關鍵內容組件的 SSR 設為 `true`
- ✅ 確保 AI 爬蟲可以存取完整內容
- ✅ 提升 First Contentful Paint (FCP) 效能

**優化的組件：**
- AboutSection
- WhySection
- EventsSection
- TicketsSection
- AccommodationSection
- TeamSection
- FollowUsSection

**檔案位置：** `components/HomeContent.tsx`

### 5. Robots.txt 優化 ✅

#### AI 爬蟲存取權限
- ✅ 明確允許 GPTBot (OpenAI)
- ✅ 明確允許 Google-Extended (Bard/Gemini)
- ✅ 明確允許 CCBot (Common Crawl)
- ✅ 明確允許 anthropic-ai (Claude)
- ✅ 明確允許 PerplexityBot

**檔案位置：** `app/robots.ts`

### 6. 實體連結（sameAs）✅

#### 外部知識庫連結
- ✅ 在 Organization Schema 中添加了 `sameAs` 屬性
- ✅ 連結到 Facebook、Instagram、官方網站
- ✅ 預留了 Wikipedia、Wikidata 連結位置

**檔案位置：** `components/StructuredData.tsx`

## AEO 最佳實踐實施

### ✅ 已實施的最佳實踐

1. **結構化數據優先**
   - 所有關鍵實體都有對應的 Schema 標記
   - 使用標準的 Schema.org 詞彙表

2. **結論先行（BLUF）**
   - 關鍵資訊在前 30-50 字內呈現
   - 使用答案塊格式

3. **問題導向標題**
   - H2/H3 標題直接回答用戶可能的問題
   - 提升 AI 擷取答案的準確性

4. **SSR 優先**
   - 關鍵內容使用伺服器端渲染
   - 確保 AI 爬蟲可以完整存取內容

5. **明確的爬蟲權限**
   - robots.txt 明確允許 AI 爬蟲
   - 避免內容被誤判為不可存取

### 📋 未來優化建議

1. **實體連結擴展**
   - 建立 Wikipedia 條目（如適用）
   - 建立 Wikidata 條目
   - 添加 LinkedIn 公司頁面連結

2. **內容新鮮度**
   - 定期更新 `dateModified` Schema
   - 確保內容在 3 個月內更新過

3. **數據密度提升**
   - 添加更多統計數據和原創研究
   - 使用表格和列表展示對比數據

4. **多模態優化**
   - 為圖片添加詳細的 Alt Text
   - 為影片添加字幕和文字腳本
   - 添加帶時間戳的章節劃分

5. **場外 AEO**
   - 在 Reddit、Quora 等平台建立存在
   - 獲取權威媒體的品牌提及
   - 管理第三方評論平台的情感分數

6. **AEO 監控**
   - 建立 AEO 追蹤試算表
   - 監控 Share of Model (SoM)
   - 追蹤被引用率 (Citation Rate)
   - 分析情感分數

## 技術細節

### 結構化數據位置
結構化數據透過 `StructuredData` 組件注入到頁面中，Next.js 會自動將其放在 `<head>` 部分。

### SSR 配置
關鍵組件透過 `dynamic()` 導入，並設定 `ssr: true` 以確保伺服器端渲染。

### 語言支援
所有優化都支援中英文雙語，根據用戶語言偏好動態調整。

## 參考文件

- [Schema.org](https://schema.org/)
- [Google Search Central - Structured Data](https://developers.google.com/search/docs/appearance/structured-data)
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)

## 更新日誌

- 2026-01-XX: 初始 AEO 優化實施
  - 添加結構化數據組件
  - 優化元數據
  - 實施 BLUF 原則
  - 啟用 SSR
  - 優化 robots.txt

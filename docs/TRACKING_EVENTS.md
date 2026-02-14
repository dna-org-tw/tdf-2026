# 網站追蹤事件清單

本文件列出所有經由 Facebook Pixel（與 `/api/events/track` webhook）送出的追蹤事件。

---

## 一、標準事件（Meta Standard Events）

### PageView
| 觸發時機 | 參數 |
|----------|------|
| 全站載入 | （無） |

**程式位置**：`components/FacebookPixel.tsx`（初始化時自動送出）

---

### ViewContent
| 觸發時機 | 參數 |
|----------|------|
| 區塊進入視窗 ≥50% | `content_name`, `content_category`, `content_type: 'section'`, `section_id`, `section_name` |
| 票券區（Tickets Section） | 同上，由 useSectionTracking 觸發 |
| 票券追蹤區（Ticket Follow Section） | 同上 |
| 關於區（About Section） | 同上 |
| 合作夥伴區（Team Section） | 同上 |
| 住宿區（Accommodation Section） | 同上 |
| Follow Us 區 | 同上 |
| YouTube 影片載入／點擊播放 | `content_name`, `content_category: 'Video'`, `content_type: 'video'`, `content_ids`, `video_id` |
| 結帳成功頁 | `content_name: 'Checkout Success'`, `content_category: 'Checkout'`, `tier`, `source` |
| 結帳取消頁 | `content_name: 'Checkout Cancelled'`, `content_category: 'Checkout'`, `tier`, `source` |
| 獎項頁載入 | `content_name: 'Nomad Award Page'`, `content_category: 'Award'` |
| 訂單查詢頁載入 | `content_name: 'Order Query Page'`, `content_category: 'Order'` |
| 訂單詳情頁 | `content_name`, `content_category`（依訂單） |

**程式位置**：`hooks/useSectionTracking.ts`、`components/LazyYouTubeEmbed.tsx`、`app/checkout/success/page.tsx`、`app/checkout/cancelled/page.tsx`、`app/award/page.tsx`、`app/order/query/page.tsx`、`app/order/[id]/page.tsx`

---

### Lead
| 觸發時機 | 參數（常見） |
|----------|----------------|
| 活動區：點擊活動連結（開 Luma） | `content_name: 'Luma Event Link'`, `content_category: 'Event Carousel'`, `event_title`, `event_url`, `location: 'events_section'` |
| 活動區：Call for Side Events | `content_name: 'Call for Side Events'`, `content_category: 'CTA'`, `location: 'events_section'` |
| 活動區：Call for Speakers | `content_name: 'Call for Speakers'`, `content_category: 'CTA'`, `location: 'events_section'` |
| Navbar：站內導覽點擊 | `content_name: 'Navigation'`, `content_category: 'Navigation'`, `section`, `location: 'navbar'` |
| Navbar：Award 按鈕 | `content_name: 'Award'`, `content_category: 'Navigation'`, `section: 'award'`, `location: 'navbar_desktop'` |
| Navbar：Instagram 連結 | `content_name: 'Instagram Link'`, `content_category: 'Social Media'`, `link_type: 'instagram'`, `location` |
| Footer：Call for Speakers / Sponsors / Partners / Volunteers / Side Events | `content_name`, `content_category: 'CTA'`, `location: 'footer'` |
| Footer：Order Query 連結 | `content_name: 'Order Query'`, `content_category: 'CTA'`, `location: 'footer'` |
| Footer：Instagram 連結（TDF / TDNA） | `content_name`, `content_category: 'Social Media'`, `link_type`, `location`, `account` |
| Hero：Call for Speakers / Volunteers / Partners / Side Events / Sponsors | `content_name`, `content_category: 'CTA'`, `location: 'hero_section'` |
| Partners：Call for Sponsors / Call for Partners | `content_name`, `content_category: 'CTA'`, `location: 'team_section'` |
| Partners：夥伴連結點擊 | `content_name`, `content_category: 'External Link'`, `link_type: 'partner_link'`, `location`, `partner_name` |
| 獎項頁：投票成功 | `content_name: 'Award Vote'`, `content_category: 'Award'`, `post_id` |

**程式位置**：`components/sections/EventsSection.tsx`、`components/Navbar.tsx`、`components/Footer.tsx`、`components/sections/HeroSection.tsx`、`components/sections/TeamSection.tsx`、`app/award/page.tsx`

---

### SelectContent
| 觸發時機 | 參數 |
|----------|------|
| 活動區：票種篩選切換 | `content_type: 'product_filter'`, `content_name: 'Events Ticket Tier'`, `content_category: 'Event Information'`, `tier`, `location: 'events_section'` |

**程式位置**：`components/sections/EventsSection.tsx`

---

### InitiateCheckout
| 觸發時機 | 參數 |
|----------|------|
| 票券區：點擊 Buy Now 進入結帳 | `content_name`, `content_category: 'Tickets'`, `content_ids`, `value`, `currency: 'USD'`, `num_items`, `location: 'tickets_section'`, `checkout_provider: 'stripe'`, `tier`, `on_sale` |

**程式位置**：`components/sections/TicketsSection.tsx`

---

### AddPaymentInfo
| 觸發時機 | 參數 |
|----------|------|
| 票券區：點擊 Stripe 結帳按鈕 | `content_name`, `content_category: 'Tickets'`, `content_ids`, `value`, `currency: 'USD'`, `location`, `checkout_provider: 'stripe'`, `tier` |

**程式位置**：`components/sections/TicketsSection.tsx`

---

### Purchase
| 觸發時機 | 參數 |
|----------|------|
| 結帳成功頁、訂單資料載入後 | Meta 標準：`value`, `currency`, `content_name`, `content_category: 'Tickets'`, `content_ids`, `num_items`；完整訂單：`order_id`, `customer_email`, `customer_name`, `ticket_tier`, `payment_status`, `payment_intent_id`, `amount_subtotal`, `amount_discount` |

**程式位置**：`app/checkout/success/page.tsx`

---

### CompleteRegistration
| 觸發時機 | 參數 |
|----------|------|
| Hero 訂閱成功 | `content_name`, `content_category`, `email`, `location: 'hero_section'` |
| 票券區訂閱成功（Follower modal） | `content_name`, `content_category`, `email`, `location: 'tickets_section_follower'` |
| 票券追蹤區訂閱成功 | `content_name`, `content_category`, `email`, `location: 'tickets_section'` |
| Follow Us 區訂閱成功 | `content_name`, `content_category`, `email`, `location: 'follow_us_section'` |

**程式位置**：`components/sections/HeroSection.tsx`、`components/sections/TicketsSection.tsx`、`components/sections/TicketFollowSection.tsx`、`components/sections/FollowUsSection.tsx`

---

### Contact
| 觸發時機 | 參數 |
|----------|------|
| Footer 點擊 Email | `content_category: 'Email Contact'`, `location: 'footer'` |

**程式位置**：`components/Footer.tsx`

---

### Search
| 觸發時機 | 參數 |
|----------|------|
| 訂單查詢頁：送出查詢 | `search_string`, `content_category: 'Order Query'`, `order_id` |

**程式位置**：`app/order/query/page.tsx`

---

### Unsubscribe
| 觸發時機 | 參數 |
|----------|------|
| Newsletter 取消訂閱成功 | `content_category: 'Newsletter'` |

**程式位置**：`app/newsletter/unsubscribe/page.tsx`

---

## 二、自訂事件（Custom Events）

### ScrollDepth
| 觸發時機 | 參數 |
|----------|------|
| 頁面捲動到達 25% / 50% / 75% / 100% | `depth` (25|50|75|100), `scroll_percentage` |

**程式位置**：`hooks/useScrollDepth.ts`

---

### NewsletterSubmitResult
| 觸發時機 | 參數 |
|----------|------|
| 訂閱表單：重複 email | `result: 'duplicate'`, `location`, `email` |
| 訂閱表單：API 或網路錯誤 | `result: 'error'`, `location`, `email`, 選填 `reason`, `status`, `message` |

**程式位置**：`components/sections/HeroSection.tsx`、`components/sections/TicketFollowSection.tsx`、`components/sections/FollowUsSection.tsx`

---

## 三、事件流向

- **Facebook Pixel**：上述標準事件經 `fbq('track', ...)`、自訂事件經 `fbq('trackCustom', ...)` 送出。
- **Webhook**：前端同時呼叫 `POST /api/events/track`；若環境變數 `EVENTS_WEBHOOK_URL` 已設定，後端會將相同 payload 轉發至該 URL。

---

## 四、依區塊／頁面速查

| 區塊／頁面 | 標準事件 | 自訂事件 |
|------------|----------|----------|
| 全站載入 | PageView | — |
| 各區塊進入視窗 | ViewContent | — |
| 捲動深度 | — | ScrollDepth |
| 活動區 | Lead, SelectContent | — |
| 票券區 | ViewContent, InitiateCheckout, AddPaymentInfo, CompleteRegistration | — |
| 票券追蹤區 | ViewContent, CompleteRegistration | NewsletterSubmitResult |
| Hero | Lead, CompleteRegistration | NewsletterSubmitResult |
| Follow Us | ViewContent, CompleteRegistration | NewsletterSubmitResult |
| Navbar | Lead | — |
| Footer | Lead, Contact | — |
| Partners | ViewContent, Lead | — |
| YouTube 嵌入 | ViewContent | — |
| 結帳成功 | ViewContent, Purchase | — |
| 結帳取消 | ViewContent | — |
| 獎項頁 | ViewContent, Lead | — |
| 訂單查詢 | ViewContent, Search | — |
| 訂單詳情 | ViewContent | — |
| Newsletter 取消訂閱 | Unsubscribe | — |

# Meta 标准事件追踪清单

本文档记录了整个网站中已实现的 Meta (Facebook Pixel) 标准事件追踪。

## 已实现的 Meta 标准事件

**注意**: 我们使用 `CompleteRegistration` 而非 `Subscribe` 来追踪免费邮箱订阅，因为 `Subscribe` 事件通常用于付费订阅服务。

### 1. PageView
**位置**: `components/FacebookPixel.tsx`
- **触发时机**: 每个页面加载时自动触发
- **说明**: 基础页面浏览追踪，已在 Facebook Pixel 初始化时自动设置

### 2. ViewContent
**位置**: 多个组件和页面
- **触发时机**: 
  - 各个 Section 进入视口时（通过 `useSectionTracking` hook）
  - 订单详情页面加载时
  - 订单查询页面加载时
  - 结账成功页面加载时
  - 结账取消页面加载时
  - 票务区块查看时
  - YouTube 视频播放时
- **实现位置**:
  - `hooks/useSectionTracking.ts` - 自动追踪所有使用该 hook 的 section
  - `app/order/[id]/page.tsx` - 订单详情页
  - `app/order/query/page.tsx` - 订单查询页
  - `app/checkout/success/page.tsx` - 结账成功页
  - `app/checkout/cancelled/page.tsx` - 结账取消页
  - `components/sections/TicketsSection.tsx` - 票务区块
  - `components/LazyYouTubeEmbed.tsx` - 视频播放

### 3. CompleteRegistration
**位置**: 订阅表单组件
- **触发时机**: 用户成功订阅免费时事通讯时
- **说明**: 使用 CompleteRegistration 而非 Subscribe，因为我们的邮箱订阅是免费的。Subscribe 事件通常用于付费订阅。
- **实现位置**:
  - `components/sections/HeroSection.tsx` - Hero 区块订阅表单
  - `components/sections/FollowUsSection.tsx` - Follow Us 区块订阅表单
  - `components/sections/TicketFollowSection.tsx` - 票务区块订阅表单
- **参数**:
  - `content_name`: 表单名称
  - `content_category`: 'Newsletter Subscription'

### 4. Subscribe
**说明**: 目前未使用。Subscribe 事件通常用于付费订阅服务。我们的邮箱订阅是免费的，因此使用 CompleteRegistration 事件。

### 5. InitiateCheckout
**位置**: `components/sections/TicketsSection.tsx`
- **触发时机**: 用户点击票务购买按钮，开始结账流程
- **参数**:
  - `content_name`: 票务类型名称
  - `content_category`: 'Tickets'
  - `content_ids`: 票务层级标识
  - `value`: 价格
  - `currency`: 'USD'
  - `num_items`: 1

### 6. AddPaymentInfo
**位置**: `components/sections/TicketsSection.tsx`
- **触发时机**: 用户点击结账按钮，即将进入支付信息输入页面
- **参数**:
  - `content_name`: 票务类型名称
  - `content_category`: 'Tickets'
  - `content_ids`: 票务层级标识
  - `value`: 价格
  - `currency`: 'USD'

### 7. Purchase
**位置**: `app/checkout/success/page.tsx`
- **触发时机**: 用户完成支付，订单确认成功
- **参数**:
  - `value`: 订单总金额（转换为美元）
  - `currency`: 货币代码（大写）
  - `content_name`: 票务类型
  - `content_category`: 'Tickets'
  - `content_ids`: 订单 ID 数组
  - `num_items`: 商品数量

### 8. Lead
**位置**: 多个 CTA 按钮和链接
- **触发时机**: 用户点击潜在客户生成相关的链接
- **实现位置**:
  - `components/sections/HeroSection.tsx` - Call for Speakers/Volunteers/Partners/Side Events
  - `components/Navbar.tsx` - Instagram 链接、Register CTA
  - `components/Footer.tsx` - 所有 CTA 链接、Instagram 链接
  - `components/sections/EventsSection.tsx` - Luma 活动链接和活动轮播链接
- **参数**:
  - `content_name`: CTA 名称
  - `content_category`: 分类（'CTA', 'Social Media', 'Event Schedule' 等）

### 9. Search
**位置**: 搜索相关功能
- **触发时机**: 
  - 用户提交订单查询
  - 用户在日程表中使用筛选器
- **实现位置**:
  - `app/order/query/page.tsx` - 订单查询
  - `components/sections/EventsSection.tsx` - 日程筛选
- **参数**:
  - `search_string`: 搜索关键词或筛选类型
  - `content_category`: 搜索类别

### 10. Contact
**位置**: `components/Footer.tsx`
- **触发时机**: 用户点击邮箱联系链接
- **参数**:
  - `content_category`: 'Email Contact'

### 11. Unsubscribe (自定义事件)
**位置**: `app/newsletter/unsubscribe/page.tsx`
- **触发时机**: 用户成功取消订阅时事通讯
- **说明**: 虽然 Meta 没有标准的 Unsubscribe 事件，但我们使用自定义事件追踪

## 自定义事件追踪

除了 Meta 标准事件外，我们还使用自定义事件来追踪更细粒度的用户行为：

### 导航相关
- `NavClick` - 导航栏点击
- `SectionView` - Section 查看

### 订阅相关
- `HeroFollowSubmit`, `HeroFollowSuccess`, `HeroFollowError`, `HeroFollowDuplicate` - Hero 区块订阅
- `FollowUsSubmit`, `FollowUsSuccess`, `FollowUsError`, `FollowUsDuplicate` - Follow Us 区块订阅
- `TicketsFollowSuccess`, `TicketsFollowError`, `TicketsFollowDuplicate` - 票务区块订阅
- `NewsletterUnsubscribe` - 取消订阅

### 结账相关
- `StripeCheckoutClick` - Stripe 结账点击
- `TicketPurchaseSuccess` - 票务购买成功
- `TicketPurchaseCancelled` - 票务购买取消
- `OrderQuerySearch` - 订单查询搜索

### 活动相关
- `EventClick` - 日程表活动点击（EventsSection）
- `EventCarouselClick` - 活动轮播点击（EventsSection）
- `ScheduleFilter` - 日程筛选器使用（EventsSection）

### CTA 相关
- `CallForSpeakersClick` - Call for Speakers 点击
- `CallForVolunteersClick` - Call for Volunteers 点击
- `CallForPartnersClick` - Call for Partners 点击
- `CallForSideEventsClick` - Call for Side Events 点击
- `CallForSponsorsClick` - Call for Sponsors 点击

### 外部链接
- `ExternalLinkClick` - 外部链接点击（Instagram 等）
- `EmailClick` - 邮箱链接点击
- `OrderQueryClick` - 订单查询链接点击

### 视频相关
- `YouTubeVideoPlay` - YouTube 视频播放

## 事件追踪覆盖范围

### 页面级别
- ✅ 首页 (Home)
- ✅ 订单查询页 (`/order/query`)
- ✅ 订单详情页 (`/order/[id]`)
- ✅ 结账成功页 (`/checkout/success`)
- ✅ 结账取消页 (`/checkout/cancelled`)
- ✅ 取消订阅页 (`/newsletter/unsubscribe`)

### Section 级别
所有主要 Section 都通过 `useSectionTracking` hook 自动追踪 ViewContent：
- ✅ Hero Section
- ✅ About Section
- ✅ Why Section
- ✅ Highlights Section
- ✅ Schedule Section
- ✅ Tickets Section
- ✅ Ticket Follow Section
- ✅ Accommodation Section
- ✅ Team Section
- ✅ Follow Us Section

### 用户交互
- ✅ 表单提交（订阅、订单查询）
- ✅ 按钮点击（结账、CTA）
- ✅ 链接点击（外部链接、社交媒体）
- ✅ 视频播放
- ✅ 筛选器使用
- ✅ 导航点击

## 事件参数规范

所有事件都遵循 Meta 标准事件参数规范：

### 通用参数
- `content_name`: 内容名称
- `content_category`: 内容分类
- `content_type`: 内容类型（如 'section', 'video', 'product_listing'）
- `content_ids`: 内容 ID 数组

### 电商相关参数
- `value`: 金额（美元）
- `currency`: 货币代码（大写，如 'USD'）
- `num_items`: 商品数量

### 搜索相关参数
- `search_string`: 搜索关键词

## 注意事项

1. **隐私合规**: 所有事件追踪都符合 GDPR 和隐私法规要求
2. **性能优化**: 事件追踪不会影响页面性能，使用异步方式发送
3. **错误处理**: 所有事件追踪都有错误处理，不会影响用户体验
4. **数据准确性**: 使用标准事件名称和参数，确保数据在 Meta 平台中正确识别

## 未来改进建议

1. 考虑添加 `AddToCart` 事件（如果未来有购物车功能）
2. 考虑添加 `CompleteRegistration` 事件（用于用户注册，如果有注册功能）
3. 考虑添加 `StartTrial` 事件（如果有试用功能）
4. 优化事件参数，添加更多上下文信息（如用户来源、设备类型等）

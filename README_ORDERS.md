# 订单系统说明

本系统实现了在 Supabase 中存储和管理 Stripe 支付订单的功能。

## 功能概述

1. **创建订单**：在用户发起购买时，创建 Stripe checkout session 的同时在 Supabase 中创建订单记录
2. **更新订单状态**：通过 Stripe webhook 和 success 页面同步更新订单状态

## 数据库设置

### 1. 创建 orders 表

在 Supabase Dashboard 中执行 SQL 迁移文件：

```bash
# 文件位置：supabase/migrations/create_orders_table.sql
```

或者直接在 Supabase SQL Editor 中执行该文件的内容。

### 2. 表结构说明

- `id`: UUID 主键
- `stripe_session_id`: Stripe checkout session ID（唯一）
- `stripe_payment_intent_id`: Stripe payment intent ID
- `ticket_tier`: 票种类型（explore, contribute, backer）
- `status`: 订单状态（pending, paid, failed, cancelled, refunded）
- `amount_*`: 金额字段（以分为单位）
- `currency`: 货币代码
- `customer_*`: 客户信息字段
- `customer_address`: JSONB 格式的地址信息
- `payment_method_*`: 支付方式信息
- `created_at`, `updated_at`: 时间戳

## API 端点

### 1. 创建订单
- **端点**: `POST /api/checkout`
- **功能**: 创建 Stripe checkout session 并在 Supabase 中创建订单记录
- **修改文件**: `app/api/checkout/route.ts`

### 2. Webhook 处理
- **端点**: `POST /api/webhooks/stripe`
- **功能**: 处理 Stripe webhook 事件，更新订单状态
- **文件**: `app/api/webhooks/stripe/route.ts`
- **需要配置**: `STRIPE_WEBHOOK_SECRET` 环境变量

### 3. 同步订单状态
- **端点**: `POST /api/order/sync`
- **功能**: 从 Stripe 同步订单信息到 Supabase
- **文件**: `app/api/order/sync/route.ts`

## 环境变量

确保以下环境变量已配置：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret  # 用于验证 webhook 请求
```

## Webhook 配置

在 Stripe Dashboard 中配置 webhook：

1. 进入 Stripe Dashboard > Developers > Webhooks
2. 添加端点：`https://your-domain.com/api/webhooks/stripe`
3. 选择以下事件：
   - `checkout.session.completed` - 支付完成
   - `checkout.session.async_payment_succeeded` - 异步支付成功
   - `checkout.session.async_payment_failed` - 异步支付失败
   - `checkout.session.expired` - Session 过期/取消
   - `payment_intent.succeeded` - 支付意图成功
4. 复制 webhook signing secret 到 `STRIPE_WEBHOOK_SECRET` 环境变量

## 订单状态流程

1. **pending**: 订单已创建，等待支付
2. **paid**: 支付成功
3. **failed**: 支付失败
4. **cancelled**: 订单已取消（用户取消付款或 session 过期）
5. **refunded**: 已退款

### 取消订单处理

当客户取消付款时，系统会通过以下方式更新订单状态：

1. **取消页面同步** (`app/checkout/cancelled/page.tsx`)
   - 用户访问取消页面时，自动调用 `/api/order/sync` API
   - 强制将订单状态设置为 `cancelled`

2. **Webhook 事件** (`app/api/webhooks/stripe/route.ts`)
   - 处理 `checkout.session.expired` 事件
   - 自动将过期 session 的订单状态更新为 `cancelled`

3. **状态映射逻辑**
   - Session 状态为 `expired` → `cancelled`
   - Session 未完成且支付状态为 `unpaid` → `cancelled`

## 代码文件

- `lib/types/order.ts`: 订单类型定义
- `lib/orders.ts`: 订单数据库操作函数
- `app/api/checkout/route.ts`: 创建订单 API
- `app/api/webhooks/stripe/route.ts`: Webhook 处理（包含取消事件）
- `app/api/order/sync/route.ts`: 订单同步 API（支持强制状态）
- `app/checkout/success/page.tsx`: 支付成功页面（已更新）
- `app/checkout/cancelled/page.tsx`: 支付取消页面（已更新，自动同步订单状态）

## 使用示例

### 创建订单
```typescript
// 在 checkout API 中自动创建
const order = await createOrder({
  stripe_session_id: session.id,
  ticket_tier: 'explore',
  amount_subtotal: 10000,
  amount_total: 10000,
  amount_tax: 0,
  amount_discount: 0,
  currency: 'usd',
});
```

### 更新订单状态
```typescript
const updatedOrder = await updateOrder(sessionId, {
  status: 'paid',
  stripe_payment_intent_id: paymentIntent.id,
  customer_email: 'customer@example.com',
});
```

## 注意事项

1. 金额字段以分为单位存储（Stripe 的标准格式）
2. 订单状态通过 webhook 和 success 页面双重更新，确保数据一致性
3. 如果 webhook 失败，success 页面会尝试同步订单状态
4. 所有数据库操作都有错误处理，不会影响 Stripe checkout 流程

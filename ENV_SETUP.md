# 环境变量配置说明

## 新增功能所需的环境变量

### 1. reCAPTCHA Enterprise 配置（订单查询功能）

为了启用订单查询的 reCAPTCHA Enterprise 验证，需要配置以下环境变量：

```bash
# reCAPTCHA Enterprise Site Key (前端使用)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Lcu81gsAAAAAIrVoGK7urIEt9_w7gOoUSjzC5Uv

# reCAPTCHA Enterprise API Key (后端验证使用)
RECAPTCHA_API_KEY=your_recaptcha_api_key

# reCAPTCHA Project ID (后端验证使用)
RECAPTCHA_PROJECT_ID=tdna-1769599168858
```

**获取 reCAPTCHA Enterprise 密钥：**
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择或创建项目（Project ID: `tdna-1769599168858`）
3. 启用 reCAPTCHA Enterprise API
4. 在 reCAPTCHA Enterprise 中创建网站密钥
5. 获取 API Key（在 API 和服务 > 凭据中）
6. 获取 Site Key（在 reCAPTCHA Enterprise > 密钥中）

**注意：** 如果未配置 reCAPTCHA，订单查询功能仍可使用，但不会进行验证。

### 2. 邮件服务配置（Mailgun）

为了启用邮件发送功能，需要配置以下环境变量：

```bash
# Mailgun API Key
MAILGUN_API_KEY=your_mailgun_api_key

# Mailgun 域名（必须是在 Mailgun 中验证的域名）
MAILGUN_DOMAIN=yourdomain.com

# 发件人邮箱地址（必须使用验证过的域名）
EMAIL_FROM=noreply@yourdomain.com

# 网站基础 URL（用于生成订单详情链接和取消订阅链接）
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# 取消订阅 Token 密钥（用于生成和验证取消订阅链接，建议使用随机字符串）
UNSUBSCRIBE_SECRET=your_random_secret_key_here
```

**设置 Mailgun：**
1. 访问 [Mailgun](https://www.mailgun.com) 并注册账号
2. 在 Dashboard 中添加并验证你的域名
3. 在 Settings > API Keys 中获取 Private API Key
4. 使用验证过的域名作为 `MAILGUN_DOMAIN`
5. 使用验证过的域名作为 `EMAIL_FROM`（例如：`noreply@yourdomain.com`）

**注意：** 如果未配置 Mailgun，邮件发送功能将被禁用，但不会影响其他功能。

### 3. 现有 Stripe 配置

确保以下 Stripe 环境变量已配置：

```bash
STRIPE_SECRET_KEY=sk_xxxxxxxxxxxxx
STRIPE_PRICE_EXPLORE=price_xxxxxxxxxxxxx
STRIPE_PRICE_CONTRIBUTE=price_xxxxxxxxxxxxx
STRIPE_PRICE_BACKER=price_xxxxxxxxxxxxx
```

## 安装依赖

在配置环境变量之前，请先安装新增的依赖包：

```bash
npm install mailgun.js form-data
```

## 功能说明

### 订单查询功能
- 访问 `/order/query` 页面
- 输入订单编号（Stripe Checkout Session ID 或 Payment Intent ID）
- 完成 reCAPTCHA 验证（如果已配置）
- 查看订单详情

### 邮件通知功能
- 付款成功或取消后，系统会自动发送邮件通知
- 邮件包含订单详情和订单详情页面链接
- 邮件发送失败不会影响用户体验（仅在控制台记录错误）

### 电子报订阅功能
- 用户订阅电子报后，系统会自动发送感谢邮件
- 感谢邮件包含取消订阅链接
- 用户可以通过邮件中的链接取消订阅
- 取消订阅页面：`/newsletter/unsubscribe?token=...`
- 取消订阅 API：`/api/newsletter/unsubscribe`

### 订单详情页面
- 访问 `/order/[id]` 查看订单详情
- 显示完整的订单信息、付款状态、商品明细等

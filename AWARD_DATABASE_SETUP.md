# Nomad Award 数据库设置

本文档说明 Nomad Award 功能所需的数据库表结构。

## 需要的数据库表

### 1. `award_posts` 表

存储 Instagram 贴文信息，包含从 API 获取的所有字段。

```sql
CREATE TABLE award_posts (
  -- 基础字段（向后兼容）
  id TEXT PRIMARY KEY,
  permalink TEXT,
  media_url TEXT,
  caption TEXT,
  username TEXT,
  timestamp TIMESTAMPTZ,
  
  -- API 返回的主要字段
  input_url TEXT,
  post_type TEXT,  -- 'Sidecar', 'Video', 'Image', 'Clips' 等
  short_code TEXT,
  url TEXT,
  
  -- 媒体信息
  display_url TEXT,
  video_url TEXT,
  dimensions_height INTEGER,
  dimensions_width INTEGER,
  
  -- 互动数据
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  video_play_count INTEGER DEFAULT 0,
  ig_play_count INTEGER DEFAULT 0,
  fb_like_count INTEGER DEFAULT 0,
  fb_play_count INTEGER DEFAULT 0,
  video_duration NUMERIC,
  
  -- 用户信息
  owner_full_name TEXT,
  owner_username TEXT,
  owner_id TEXT,
  
  -- 其他信息
  first_comment TEXT,
  location_name TEXT,
  product_type TEXT,  -- 'carousel_container', 'carousel_item', 'clips' 等
  
  -- 数组和复杂对象存储在 JSONB 中
  hashtags JSONB,  -- 字符串数组
  mentions JSONB,  -- 字符串数组
  images JSONB,  -- 字符串数组
  latest_comments JSONB,  -- 对象数组
  child_posts JSONB,  -- 复杂对象数组
  tagged_users JSONB,  -- 对象数组
  music_info JSONB,  -- 复杂对象
  coauthor_producers JSONB,  -- 对象数组
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_award_posts_created_at ON award_posts(created_at DESC);
CREATE INDEX idx_award_posts_timestamp ON award_posts(timestamp DESC);
CREATE INDEX idx_award_posts_type ON award_posts(post_type);
CREATE INDEX idx_award_posts_owner_username ON award_posts(owner_username);
CREATE INDEX idx_award_posts_hashtags ON award_posts USING GIN (hashtags);
CREATE INDEX idx_award_posts_tagged_users ON award_posts USING GIN (tagged_users);
```

**注意**：如果表已存在，需要执行以下迁移脚本：

```sql
-- 添加新字段
ALTER TABLE award_posts 
  ADD COLUMN IF NOT EXISTS input_url TEXT,
  ADD COLUMN IF NOT EXISTS post_type TEXT,
  ADD COLUMN IF NOT EXISTS short_code TEXT,
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS display_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS dimensions_height INTEGER,
  ADD COLUMN IF NOT EXISTS dimensions_width INTEGER,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_play_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ig_play_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fb_like_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fb_play_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_duration NUMERIC,
  ADD COLUMN IF NOT EXISTS owner_full_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_username TEXT,
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS first_comment TEXT,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS hashtags JSONB,
  ADD COLUMN IF NOT EXISTS mentions JSONB,
  ADD COLUMN IF NOT EXISTS images JSONB,
  ADD COLUMN IF NOT EXISTS latest_comments JSONB,
  ADD COLUMN IF NOT EXISTS child_posts JSONB,
  ADD COLUMN IF NOT EXISTS tagged_users JSONB,
  ADD COLUMN IF NOT EXISTS music_info JSONB,
  ADD COLUMN IF NOT EXISTS coauthor_producers JSONB;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_award_posts_timestamp ON award_posts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_award_posts_type ON award_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_award_posts_owner_username ON award_posts(owner_username);
CREATE INDEX IF NOT EXISTS idx_award_posts_hashtags ON award_posts USING GIN (hashtags);
CREATE INDEX IF NOT EXISTS idx_award_posts_tagged_users ON award_posts USING GIN (tagged_users);
```

### 2. `award_votes` 表

存储投票记录。

```sql
CREATE TABLE award_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL,
  email TEXT NOT NULL,
  confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  FOREIGN KEY (post_id) REFERENCES ig_posts(id) ON DELETE CASCADE
);

CREATE INDEX idx_award_votes_post_id ON award_votes(post_id);
CREATE INDEX idx_award_votes_email ON award_votes(email);
CREATE INDEX idx_award_votes_confirmed ON award_votes(confirmed);
CREATE INDEX idx_award_votes_created_at ON award_votes(created_at);
CREATE INDEX idx_award_votes_confirmed_at ON award_votes(confirmed_at);
CREATE UNIQUE INDEX idx_award_votes_unique_unconfirmed ON award_votes(post_id, email) WHERE confirmed = FALSE;
```

### 3. `award_fetch_log` 表

存储 Instagram Reels 抓取日志和最后抓取时间。

```sql
CREATE TABLE award_fetch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_fetch_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_award_fetch_log_last_fetch_at ON award_fetch_log(last_fetch_at DESC);
```

## 环境变量

需要在 `.env` 或环境配置中添加以下变量：

```env
# 投票确认 token 密钥（用于生成和验证投票确认链接）
VOTE_SECRET=your-secret-key-here-change-in-production

# Instagram API 配置（可选，如果需要自动获取 Instagram 贴文和 Reels）
INSTAGRAM_ACCESS_TOKEN=your-instagram-access-token
INSTAGRAM_USER_ID=your-instagram-user-id
INSTAGRAM_HASHTAG_ID=your-instagram-hashtag-id  # 可选的 hashtag ID（用于直接通过 hashtag 获取 Reels）
```

## Instagram 贴文和 Reels 获取

目前代码提供了两种方式获取 Instagram 贴文和 Reels：

1. **从数据库获取**：手动或通过脚本将贴文数据插入到 `award_posts` 表中
2. **从 Instagram API 获取**：配置 Instagram Graph API 后，系统会自动获取带有特定标签的贴文和 Reels

### 自动抓取 Reels

当用户访问 award 页面时，系统会自动调用 `/api/award/fetch-reels` API 来：
- 从 Instagram Graph API 抓取带有 `#taiwandigitalfest` 或 `#taiwandigitalfest` 标签的 Reels
- 将抓取到的 Reels 保存到 `award_posts` 表中
- 更新 `award_fetch_log` 表中的最后抓取时间

抓取逻辑会：
- 优先使用 Hashtag API（如果配置了 `INSTAGRAM_HASHTAG_ID`）
- 如果没有配置 Hashtag ID，则从用户媒体中过滤出包含相关标签的 Reels
- 自动去重，避免重复保存相同的 Reel

### 手动添加贴文示例

**基础字段插入**（向后兼容）：
```sql
INSERT INTO award_posts (id, permalink, media_url, caption, username, timestamp)
VALUES (
  'instagram_post_id_123',
  'https://www.instagram.com/p/ABC123/',
  'https://instagram.com/image.jpg',
  'Post caption with #taiwandigitalfest',
  'username',
  NOW()
);
```

**完整字段插入**（包含所有 API 数据）：
```sql
INSERT INTO award_posts (
  id, permalink, media_url, caption, username, timestamp,
  input_url, post_type, short_code, url,
  display_url, video_url, dimensions_height, dimensions_width,
  likes_count, comments_count, video_play_count,
  owner_full_name, owner_username, owner_id,
  location_name, product_type,
  hashtags, mentions, images, tagged_users, music_info
)
VALUES (
  '3731527653880231081',
  'https://www.instagram.com/p/DPJDKF3E_Sp/',
  'https://scontent-lax3-1.cdninstagram.com/v/t51.82787-15/...',
  'From big city energy to mountain calm...',
  'thenomadry',
  '2025-09-28T09:46:22.000Z',
  'https://www.instagram.com/taiwandigitalfest',
  'Sidecar',
  'DPJDKF3E_Sp',
  'https://www.instagram.com/p/DPJDKF3E_Sp/',
  'https://scontent-lax3-1.cdninstagram.com/v/t51.82787-15/...',
  NULL,
  1346,
  1080,
  39,
  7,
  0,
  'Nomadry',
  'thenomadry',
  '76628816048',
  'Taipei, Taiwan',
  'carousel_container',
  '["visitTaiwan", "taipei", "jiufen"]'::jsonb,
  '[]'::jsonb,
  '["https://...", "https://..."]'::jsonb,
  '[{"full_name": "...", "username": "..."}]'::jsonb,
  '{"audio_canonical_id": "...", ...}'::jsonb
);
```

**字段说明**：
- **基础字段**：id, permalink, media_url, caption, username, timestamp（向后兼容）
- **API 主要字段**：input_url, post_type, short_code, url
- **媒体信息**：display_url, video_url, dimensions_height, dimensions_width
- **互动数据**：likes_count, comments_count, video_play_count, ig_play_count, fb_like_count, fb_play_count, video_duration
- **用户信息**：owner_full_name, owner_username, owner_id
- **其他信息**：first_comment, location_name, product_type
- **数组字段（JSONB）**：hashtags, mentions, images, latest_comments, child_posts, tagged_users, coauthor_producers
- **复杂对象（JSONB）**：music_info

## 注意事项

1. **投票截止时间**：代码中硬编码为 2026年4月30日 12:00 (台湾时间)，如需修改请更新 `app/api/award/vote/route.ts` 和 `app/api/award/confirm-vote/route.ts` 中的 `VOTING_DEADLINE` 常量。

2. **投票限制**：每个邮箱每天只能投票一次，通过 `confirmed_at` 字段的时间戳来判断。

3. **reCAPTCHA 保护**：所有投票请求都需要通过 reCAPTCHA Enterprise 验证。

4. **邮件确认**：投票后需要点击邮件中的确认链接才能完成投票。

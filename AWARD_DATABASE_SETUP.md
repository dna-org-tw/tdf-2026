# Nomad Award 資料庫設定

本文件說明 Nomad Award 功能所需的資料庫表結構。

## 需要的資料庫表

### 1. `award_posts` 表

儲存 Instagram 貼文資訊，包含從 API 獲取的所有欄位。

```sql
CREATE TABLE award_posts (
  -- 基礎欄位（向後相容）
  id TEXT PRIMARY KEY,
  permalink TEXT,
  media_url TEXT,
  caption TEXT,
  username TEXT,
  timestamp TIMESTAMPTZ,
  
  -- API 回傳的主要欄位
  input_url TEXT,
  post_type TEXT,  -- 'Sidecar', 'Video', 'Image', 'Clips' 等
  short_code TEXT,
  url TEXT,
  
  -- 媒體資訊
  display_url TEXT,
  video_url TEXT,
  dimensions_height INTEGER,
  dimensions_width INTEGER,
  
  -- 互動數據
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  video_play_count INTEGER DEFAULT 0,
  ig_play_count INTEGER DEFAULT 0,
  fb_like_count INTEGER DEFAULT 0,
  fb_play_count INTEGER DEFAULT 0,
  video_duration NUMERIC,
  
  -- 用戶資訊
  owner_full_name TEXT,
  owner_username TEXT,
  owner_id TEXT,
  
  -- 其他資訊
  first_comment TEXT,
  location_name TEXT,
  product_type TEXT,  -- 'carousel_container', 'carousel_item', 'clips' 等
  
  -- 陣列和複雜物件儲存在 JSONB 中
  hashtags JSONB,  -- 字串陣列
  mentions JSONB,  -- 字串陣列
  images JSONB,  -- 字串陣列
  latest_comments JSONB,  -- 物件陣列
  child_posts JSONB,  -- 複雜物件陣列
  tagged_users JSONB,  -- 物件陣列
  music_info JSONB,  -- 複雜物件
  coauthor_producers JSONB,  -- 物件陣列
  
  -- 元數據
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

**注意**：如果表已存在，需要執行以下遷移腳本：

```sql
-- 添加新欄位
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

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_award_posts_timestamp ON award_posts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_award_posts_type ON award_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_award_posts_owner_username ON award_posts(owner_username);
CREATE INDEX IF NOT EXISTS idx_award_posts_hashtags ON award_posts USING GIN (hashtags);
CREATE INDEX IF NOT EXISTS idx_award_posts_tagged_users ON award_posts USING GIN (tagged_users);
```

### 2. `award_votes` 表

儲存投票記錄。

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

儲存 Instagram Reels 抓取日誌和最後抓取時間。

```sql
CREATE TABLE award_fetch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_fetch_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_award_fetch_log_last_fetch_at ON award_fetch_log(last_fetch_at DESC);
```

## 環境變數

需要在 `.env` 或環境配置中添加以下變數：

```env
# 投票確認 token 金鑰（用於產生和驗證投票確認連結）
VOTE_SECRET=your-secret-key-here-change-in-production

# Instagram API 配置（可選，如果需要自動獲取 Instagram 貼文和 Reels）
INSTAGRAM_ACCESS_TOKEN=your-instagram-access-token
INSTAGRAM_USER_ID=your-instagram-user-id
INSTAGRAM_HASHTAG_ID=your-instagram-hashtag-id  # 可選的 hashtag ID（用於直接透過 hashtag 獲取 Reels）
```

## Instagram 貼文和 Reels 獲取

目前程式碼提供了兩種方式獲取 Instagram 貼文和 Reels：

1. **從資料庫獲取**：手動或透過腳本將貼文數據插入到 `award_posts` 表中
2. **從 Instagram API 獲取**：配置 Instagram Graph API 後，系統會自動獲取帶有特定標籤的貼文和 Reels

### 自動抓取 Reels

當用戶存取 award 頁面時，系統會自動呼叫 `/api/award/fetch-reels` API 來：
- 從 Instagram Graph API 抓取帶有 `#taiwandigitalfest` 或 `#taiwandigitalfest` 標籤的 Reels
- 將抓取到的 Reels 儲存到 `award_posts` 表中
- 更新 `award_fetch_log` 表中的最後抓取時間

抓取邏輯會：
- 優先使用 Hashtag API（如果配置了 `INSTAGRAM_HASHTAG_ID`）
- 若未設定 Hashtag ID，則從使用者媒體中過濾出包含相關標籤的 Reels
- 自動去重，避免重複儲存相同的 Reel

### 手動添加貼文範例

**基礎欄位插入**（向後相容）：
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

**完整欄位插入**（包含所有 API 數據）：
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

**欄位說明**：
- **基礎欄位**：id, permalink, media_url, caption, username, timestamp（向後相容）
- **API 主要欄位**：input_url, post_type, short_code, url
- **媒體資訊**：display_url, video_url, dimensions_height, dimensions_width
- **互動數據**：likes_count, comments_count, video_play_count, ig_play_count, fb_like_count, fb_play_count, video_duration
- **用戶資訊**：owner_full_name, owner_username, owner_id
- **其他資訊**：first_comment, location_name, product_type
- **陣列欄位（JSONB）**：hashtags, mentions, images, latest_comments, child_posts, tagged_users, coauthor_producers
- **複雜物件（JSONB）**：music_info

## 注意事項

1. **投票截止時間**：程式碼中硬編碼為 2026年4月30日 12:00（台灣時間），如需修改請更新 `app/api/award/vote/route.ts` 和 `app/api/award/confirm-vote/route.ts` 中的 `VOTING_DEADLINE` 常數。

2. **投票限制**：每個郵箱每天只能投票一次，透過 `confirmed_at` 欄位的時間戳來判斷。

3. **reCAPTCHA 保護**：所有投票請求都需要透過 reCAPTCHA Enterprise 驗證。

4. **郵件確認**：投票後需要點擊郵件中的確認連結才能完成投票。

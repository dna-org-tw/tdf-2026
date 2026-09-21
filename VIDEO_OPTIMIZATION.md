# 影片優化指南

## 當前影片檔案狀態

**注意**：目前專案中沒有本地影片檔案。所有影片內容都是透過 YouTube 嵌入（使用 `LazyYouTubeEmbed` 元件）來實作的。

若未來需要新增本地影片檔案，可參考以下優化建議。

## 優化建議

### 1. 轉換為 WebM 格式

WebM 格式通常比 MP4/MOV 小 30-50%，且現代瀏覽器支援良好。

```bash
# 使用 ffmpeg 轉換
# 針對背景影片（較低品質要求）
ffmpeg -i hualien_view.mp4 -c:v libvpx-vp9 -crf 35 -b:v 0 -c:a libopus -b:a 96k hualien_view.webm
ffmpeg -i taiwan_view.mp4 -c:v libvpx-vp9 -crf 35 -b:v 0 -c:a libopus -b:a 96k taiwan_view.webm
ffmpeg -i taitung_view.mp4 -c:v libvpx-vp9 -crf 35 -b:v 0 -c:a libopus -b:a 96k taitung_view.webm
```

### 2. 產生 Poster 圖片

為每個影片產生 poster 圖片（第一幀），用於延遲載入時顯示：

```bash
# 從影片第一幀擷取圖片
ffmpeg -i hualien_view.mp4 -ss 00:00:01 -vframes 1 -q:v 2 hualien_view_poster.webp
ffmpeg -i taiwan_view.mp4 -ss 00:00:01 -vframes 1 -q:v 2 taiwan_view_poster.webp
ffmpeg -i taitung_view.mp4 -ss 00:00:01 -vframes 1 -q:v 2 taitung_view_poster.webp
```

### 3. 優化目標大小

建議目標：
- 背景影片（hualien/taiwan/taitung）: < 2MB each

### 4. 更新元件使用

若新增本地影片，建議建立 `LazyVideo` 元件，功能包括：
- 使用 Intersection Observer 延遲載入
- 顯示 poster 圖片直到影片載入
- 只在進入視窗時才開始載入影片

**注意**：目前專案使用 `LazyYouTubeEmbed` 元件處理 YouTube 影片嵌入。

### 5. 多格式支援

建議在元件中同時提供 WebM 和 MP4 格式：

```tsx
<video>
  <source src="/videos/video.webm" type="video/webm" />
  <source src="/videos/video.mp4" type="video/mp4" />
</video>
```

## 預期效果

若新增本地影片並進行優化，預期：
- 初始頁面載入減少 **30-40MB**（取決於影片大小）
- 首屏載入時間減少 **2-4秒**（在慢速網路環境）
- 改善 LCP (Largest Contentful Paint) 指標
- 減少頻寬使用，特別適合遠端伺服器

## 注意事項

1. 確保 WebM 格式在目標瀏覽器中測試
2. 保留原始檔案作為備份
3. 考慮使用 CDN 加速影片傳輸
4. 對於自動播放的背景影片，確保已設定 `muted` 和 `playsInline` 屬性

# Facebook 自動匯入設定指南

本功能的網站端可以先部署與測試，但真正讀取粉專需要 Meta Developer App。設定完成前，後台顯示「尚未連線」是正常狀態，不影響現有文章與手動 Facebook 備份匯入。

## 完成狀態的定義

- 程式、資料表、Webhook、匯入嘗試紀錄、重試與後台控制台：可由專案測試驗證。
- 真實粉專連線：必須完成本文件的 Meta App 與 Token 設定後才能驗證。
- 自動匯入只建立草稿，絕不自動發布。

## 1. 先更新 Supabase

1. 登入 Supabase Dashboard。
2. 開啟專案的 **SQL Editor**。
3. 複製並執行 `supabase/migrations/015_facebook_auto_import.sql` 全部內容。
4. 確認 Table Editor 出現：
   - `facebook_sync_settings`
   - `facebook_imports`
   - `facebook_import_attempts`
   - `facebook_import_events`
   - `facebook_removed_media`
5. 到 **Project Settings → API Keys** 取得伺服器端 Secret/Service Role key。它只能放在 Vercel 環境變數，不能放進 `NEXT_PUBLIC_` 變數或貼到前端程式。

## 2. 建立 Meta Developer App

1. 前往 [Meta for Developers](https://developers.facebook.com/) 並以可管理「天天寶寶旅行趣」粉專的 Facebook 帳號登入。
2. 建立 App，依 Meta 當時提供的選項選擇適合管理 Facebook Page 的 Business 類型／使用案例。
3. 記下 **App ID** 與 **App Secret**。網站只需要 App Secret；App Secret 不可公開。
4. 在 App Dashboard 加入 **Webhooks** 產品，選擇 **Page** 物件。

Meta 介面與審查項目可能更新；設定時應以 [Meta Webhooks 官方說明](https://developers.facebook.com/docs/graph-api/webhooks/) 與 [Meta Pages API 官方說明](https://developers.facebook.com/docs/pages-api/) 的當前版本為準。

## 3. 建立 Page Access Token

此功能通常需要能列出管理中粉專、讀取粉專內容及管理 Webhook 訂閱的權限。規格採用：

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_metadata`

1. 使用 Meta Graph API Explorer 為剛建立的 App 取得 User Access Token，勾選上述權限。
2. 查詢 `/me/accounts?fields=id,name,access_token`。
3. 找到「天天寶寶旅行趣」，記下 Page ID 與 Page Access Token。
4. 使用 Access Token Debugger 確認 Token 所屬 App、粉專與到期時間。
5. 正式環境應依 Meta 當前規則使用可長期維護的 Page Token／System User Token；短效測試 Token 到期後，後台會顯示「同步已中斷」。

若 Meta 要求 App Review、Business Verification 或不同權限名稱，必須先完成其當前要求，不能用程式繞過。

## 4. 在 Vercel 設定環境變數

到 Vercel 專案的 **Settings → Environment Variables**，新增下列 Production 變數：

| 名稱 | 內容 |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Supabase 伺服器端 Secret/Service Role key |
| `FACEBOOK_PAGE_ID` | 天天寶寶旅行趣 Page ID |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Page Access Token |
| `FACEBOOK_APP_SECRET` | Meta App Secret |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | 自己產生的長隨機字串，稍後在 Meta 填同一值 |
| `FACEBOOK_GRAPH_API_VERSION` | `v24.0`；升版前先重新驗證欄位與權限 |
| `CRON_SECRET` | 另一組長隨機字串，用來保護每日補漏 API |

儲存後必須重新部署一次，新的環境變數才會進入 Production Deployment。

## 5. 設定 Webhook

在 Meta App Dashboard 的 Page Webhook 填入：

- Callback URL：`https://travel-stories-neon.vercel.app/api/facebook-webhook`
- Verify Token：與 Vercel 的 `FACEBOOK_WEBHOOK_VERIFY_TOKEN` 完全相同
- 訂閱欄位：`feed`

接著把 App 訂閱到指定 Page。可依 Meta Dashboard 的操作完成，或依官方 `/{PAGE_ID}/subscribed_apps` 說明以 Page Access Token 訂閱 `feed`。Meta 官方要求 Webhook endpoint 以 HTTPS 接收通知並快速回覆成功；本站會先保存事件，圖片下載則在回覆後處理。

## 6. 先做兩階段測試

1. 在 Graph API Explorer 查詢 `/{PAGE_ID}/posts?fields=id,permalink_url&limit=5`，取得一篇你準備用來測試的完整 Post ID，格式通常是 `PAGE_ID_POST_ID`。
2. 登入網站後台，進入 **Facebook 同步**。
3. 將 Post ID 貼入「連線測試」，按 **建立測試草稿**。
4. 到「草稿與文章」檢查文字、原始日期、圖片、暫定標題及分類建議。
5. 回到 Facebook 同步頁，確認狀態是「測試完成，等待啟用」。
6. 按 **啟用自動匯入**。系統會從這個啟用時間開始補漏，不會自動抓更舊文章。

## 7. 驗證新貼文

1. 在粉專發布一篇含文字與一張測試圖片的新貼文。
2. 等待數分鐘後重新整理 Facebook 同步頁。
3. 應看到一筆 `成功` 的 Facebook 匯入紀錄與成功的匯入嘗試紀錄。
4. 草稿管理應出現未發布文章；前台不應出現它。
5. 修改標題、選擇分類並儲存後，才可人工發布。
6. 若沒收到，按 **立即檢查新貼文**。仍失敗時查看 Facebook 匯入嘗試的階段、錯誤代碼與原因。

## 8. 本機與自動化驗證

不需要 Meta App 即可執行核心與簽章測試：

```powershell
npm run test:facebook
```

完整專案驗證：

```powershell
npm test
npm run lint
npm run build
```

## 常見問題

### 顯示尚未建立資料表

尚未執行 migration 015，或 SQL 執行失敗。重新查看 Supabase SQL Editor 的錯誤訊息，不要重複建立自訂的同名表。

### 顯示尚未設定 FACEBOOK_PAGE_ID

Vercel 環境變數不完整，或設定後沒有重新部署。

### 顯示同步已中斷

通常是 Page Access Token 到期、權限被撤銷或 Meta App 狀態改變。重新授權後更新 Vercel Token 並重新部署，再使用「立即檢查新貼文」。

### 圖片失敗但草稿存在

這是預期的部分成功行為。草稿會標示「需人工處理」，匯入嘗試紀錄會顯示失敗原因；修正問題後可按「重新嘗試」。

### 影片沒有自動搬過來

第一版不下載影片、Reels、直播或分享貼文媒體，會保留文字與 Facebook 原文連結並標示需人工處理。

# Travel Stories

Travel Stories 是由少數作者共同維護的旅行與生活文章網站。

## Language

**作者**：已登入且 Email 存在於 Author Allowlist 的 Supabase 使用者；作者可以管理文章、媒體與後台內容。
_Avoid_: 管理員帳號、白名單 Email

**Author Allowlist**：Supabase 內定義作者身分的 Email 清單，是作者資格的唯一來源。
_Avoid_: 前端作者名單、程式內 Email 清單

**Facebook 匯入草稿**：Facebook 粉絲專頁發布新貼文後，由系統建立、但不自動發布的網站文章草稿；作者完成標題、分類與內容檢查後，才可人工發布。
_Avoid_: Facebook 同步文章、自動發布文章

**Facebook 匯入紀錄**：一篇 Facebook 貼文在網站端的目前匯入狀態，並連結其網站草稿及最後同步結果；同一篇來源貼文只會有一筆。
_Avoid_: Facebook Log、同步 Log

**Facebook 匯入嘗試**：系統每次處理 Facebook 貼文所留下的不可覆蓋結果，成功與失敗皆記錄，用來追蹤重試與診斷問題。
_Avoid_: 一般 Log、目前同步狀態

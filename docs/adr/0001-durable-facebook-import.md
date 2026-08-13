# Facebook 匯入採 durable queue 與定期補漏

Facebook Webhook 必須快速回應，而圖片搬移可能超過單次請求時間且 Webhook 可能遺漏。系統因此先將已驗證事件持久化，再於回應後嘗試處理，並以每日補漏與最多三次 queue 重試確保一致性；不採用只靠即時背景執行或只靠定時輪詢的方案。

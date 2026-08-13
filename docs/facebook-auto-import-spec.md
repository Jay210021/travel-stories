# Facebook 自動匯入草稿規格

狀態：已確認
確認日期：2026-08-13

## Problem Statement

作者目前必須先從 Facebook 匯出備份，再透過網站既有工具手動建立草稿與搬移媒體。新貼文無法即時進入網站，匯入失敗也缺少集中、可重試且可追查的處理紀錄。作者希望 Facebook 粉絲專頁發布新貼文後，網站能安全地自動建立草稿，同時保留人工編輯與發布的控制權。

## Solution

網站連接單一「天天寶寶旅行趣」Facebook 粉絲專頁。Meta Webhook 通知新貼文或貼文異動後，系統先持久保存待處理事件，再由 Facebook 匯入處理器讀取貼文內容、建立或更新 Facebook 匯入草稿、複製支援的圖片至 Supabase Storage，並記錄每一次成功或失敗的匯入嘗試。

自動匯入永遠只建立草稿，絕不自動發布。系統可提供標題與分類建議，但作者必須確認標題、分類與內容後，才能使用既有發布流程公開文章。作者一旦在網站儲存草稿，Facebook 後續異動不得自動覆蓋作者內容。

## User Stories

1. As an author, I want a new Facebook Page post to become a website draft automatically, so that I do not need to export and import it manually.
2. As an author, I want imported content to remain a draft, so that nothing becomes public before editorial review.
3. As an author, I want only posts created after automatic import is enabled to be synchronized, so that historical archive imports are not duplicated.
4. As an author, I want Facebook text, line breaks, Emoji, hashtags, and ordinary links preserved, so that the draft retains the original writing.
5. As an author, I want comments, reactions, share counts, and reader data excluded, so that visitor information is not copied into the website.
6. As an author, I want a provisional title generated from the first useful sentence, so that every imported draft is identifiable.
7. As an author, I want drafts with generated titles marked as requiring title confirmation, so that placeholder text cannot be published accidentally.
8. As an author, I want a date-based fallback title when a post has no useful sentence, so that textless posts still have a recognizable draft.
9. As an author, I want the Facebook post's original creation time used as the story date, so that website chronology matches the source.
10. As an author, I want import time and website publication time recorded separately, so that operational history does not alter the story date.
11. As an author, I want Facebook photos copied to Supabase Storage, so that the website does not depend on expiring Facebook media URLs.
12. As an author, I want a text draft created even when one photo fails, so that partial media failure does not lose the post.
13. As an author, I want unsupported videos, Reels, live videos, and shared posts marked for manual handling, so that unsupported content is visible rather than silently skipped.
14. As an author, I want the Facebook permalink retained, so that I can compare the draft with the original post.
15. As an author, I want classification suggestions based on hashtags, text, and existing taxonomy aliases, so that organizing imported drafts is faster.
16. As an author, I want classification suggestions to remain unconfirmed until I approve them, so that heuristics cannot misclassify public content.
17. As an author, I want publishing blocked until title and classification are confirmed, so that incomplete imports cannot bypass editorial review.
18. As an author, I want repeated webhook notifications for the same Page post to reuse the same import record and story, so that duplicate drafts are not created.
19. As an author, I want possible duplicate website content shown as a warning rather than merged automatically, so that existing writing is never overwritten by similarity matching.
20. As an author, I want to link an imported post to an existing website story manually, so that intentional cross-posting does not create a second article.
21. As an author, I want an untouched import draft to follow Facebook edits automatically, so that it stays current before I begin editing.
22. As an author, I want any draft I have saved to stop receiving automatic content overwrites, so that my editorial work is protected.
23. As an author, I want published stories protected from Facebook edits, so that public website content cannot change unexpectedly.
24. As an author, I want a Facebook update conflict displayed as awaiting confirmation, so that I can choose whether to apply the source version.
25. As an author, I want to apply the latest Facebook version through a confirmation action, so that replacing editorial content is explicit.
26. As an author, I want Facebook-deleted posts retained on the website and marked as source removed, so that deleting the source does not destroy the archive.
27. As an author, I want photos removed from an untouched Facebook post detached into recoverable media trash, so that source updates are reflected without immediate permanent deletion.
28. As an author, I want media on edited or published website stories left untouched, so that Facebook changes cannot disturb curated layouts.
29. As an author, I want webhook events acknowledged quickly and processed asynchronously, so that Meta does not repeatedly resend events during image downloads.
30. As an author, I want a daily reconciliation check, so that posts missed by Webhooks can still be discovered.
31. As an author, I want a manual “立即檢查新貼文” action, so that I can reconcile without waiting for the daily schedule.
32. As an author, I want failed imports retried automatically up to three attempts, so that temporary external failures recover without intervention.
33. As an author, I want a manual retry action, so that I can recover a specific failed import after fixing its cause.
34. As an author, I want the current state of each Facebook import recorded separately from its attempt history, so that the dashboard can show both current truth and diagnostic history.
35. As an author, I want every successful and failed attempt recorded, so that intermittent problems remain traceable.
36. As an author, I want attempt history retained for 180 days, so that recent incidents can be investigated without indefinite growth.
37. As an author, I want credentials, tokens, request headers, and full external payloads excluded from import-attempt records, so that diagnostics do not leak secrets or unnecessary personal data.
38. As an author, I want to see the latest successful synchronization time and state totals, so that I know whether automation is healthy.
39. As an author, I want to filter attempt history by result, date, and post, so that I can investigate a problem efficiently.
40. As an author, I want precise failure stages, error codes, and sanitized reasons, so that I know what needs attention.
41. As an author, I want imports classified as pending, successful, needs manual handling, failed, update awaiting confirmation, or source removed, so that partial work is not mislabeled as success.
42. As an author, I want automatic import to remain enabled unless authorization is invalid, so that it cannot be disabled accidentally in routine editing.
43. As an author, I want an authorization failure displayed as synchronization interrupted, so that silent long-term data loss is avoided.
44. As an author, I want a connection test that imports one selected test post before activation, so that the complete path can be verified safely.
45. As an author, I want automatic import activated only after I confirm the connection test, so that configuration errors cannot start a production import.
46. As an author, I want the activation time stored, so that daily reconciliation does not pull older posts.
47. As an author, I want the first release limited to one Facebook Page, so that setup and permission management remain understandable.
48. As an author, I want setup instructions for Meta App, Webhook, permissions, Vercel secrets, and scheduled reconciliation, so that I can finish the external connection without programming knowledge.
49. As a maintainer, I want the website side testable with simulated Meta responses, so that implementation can be verified before a Meta App exists.
50. As a maintainer, I want one public Facebook import processor seam, so that source parsing, idempotency, editorial protection, media outcomes, and import attempts are verified without coupling tests to internals.

## Implementation Decisions

- `Facebook 匯入草稿` is a website story with source `facebook` and draft status. Automatic import never invokes publication.
- A Facebook source identity consists of Page ID and Page post ID. This pair is the idempotency key; text similarity is advisory only.
- Existing archive imports and automatic imports are separate ingestion paths. Automatic reconciliation applies only at or after the recorded activation time.
- The first release connects exactly one configured Page while retaining Page ID in persistent records for future extension.
- Meta Webhook reception verifies the verification token for subscription setup and verifies signed event payloads before accepting work.
- Webhook reception persists a pending import and returns promptly. Fetching posts, downloading images, and changing stories happen outside the acknowledgement path.
- A durable import record stores the current state for each Page post, its corresponding story, source timestamps and permalink, attempt count, last result, and editorial-conflict flags.
- An append-only import-attempt record stores each processing result, including successes, processing stage, sanitized error code/reason, start/end time, and attempt number.
- Attempt records are retained for 180 days. Import records live as long as the source/story relationship is relevant.
- No import-attempt record may contain access tokens, app secrets, full HTTP headers, or an unbounded raw Meta response. Diagnostic payloads use an explicit sanitized allowlist.
- The processor exposes one use-case-oriented interface: process a verified Facebook Page post change and return an import result. Meta, persistence, media, and time are system-boundary dependencies.
- The processor states are pending, processing, succeeded, needs attention, failed, update pending, and source removed. Only complete text plus all supported photos is succeeded.
- Automatic retries stop after three failed attempts. Authors may explicitly request a later retry.
- Text preserves author-authored formatting, Emoji, hashtags, and ordinary links. Comments, engagement metrics, shares' audience data, and tracking parameters are excluded.
- A provisional title uses the first useful non-URL, non-hashtag-only sentence and is length-limited. A dated fallback is used when no useful sentence exists.
- Imported titles remain unconfirmed until an author saves or confirms them. Publication is rejected unless required editorial checks are complete.
- Classification suggestions use the same content taxonomy as Navbar and article classification. Suggestions never create an assignment automatically.
- Untouched imported drafts may be updated from Facebook. The first author save marks editorial ownership and prevents further automatic overwrites.
- Changes to author-edited drafts or published stories create an update-pending state and a source snapshot suitable for an explicit apply-latest action.
- A Facebook deletion never deletes a website story. It marks the import as source removed.
- Supported photos are copied immediately to Supabase Storage through the existing media policy. Failed media produces needs-attention rather than rolling back the text draft.
- Source-removed photos from untouched drafts are detached through recoverable media trash. Media on author-edited or published stories is not changed automatically.
- Video, Reels, live content, and shared-post media are not downloaded in the first release. The text draft and permalink remain available with a needs-attention reason.
- The author interface displays synchronization health, last success, state totals, import rows, attempt history, source links, exact sanitized errors, immediate reconciliation, and retry actions.
- Automatic import has no routine off switch. Invalid authorization is represented as an interrupted health state requiring configuration repair.
- Activation is two-stage: validate Page access and import one selected test post, then explicitly activate future synchronization.
- The website implementation and simulated acceptance tests may be completed without a Meta Developer App. Live completion remains an external setup step.
- Existing Author Access is required for every administration, retry, test, reconciliation, linking, and apply-latest operation.
- Vercel environment variables hold Meta secrets and identifiers. Secrets never enter client components or public Supabase tables.

## Testing Decisions

- Tests verify observable import behavior through the single Facebook import processor interface, not private parsing functions or collaborator call order.
- Meta Graph API, Supabase persistence/storage, and time are external boundaries and may use deterministic substitutes. Application-owned modules are not mocked individually.
- Each TDD slice starts with one failing behavior test, adds the minimum implementation to pass, and then proceeds to the next behavior.
- Processor tests cover creation, title/date preservation, idempotency, photo outcomes, unsupported media, classification suggestions, author-edit protection, Facebook edits/deletion, retries, sanitized attempts, and status derivation.
- Boundary tests cover Webhook verification/signature rejection and author protection for manual operations without duplicating all processor cases.
- Migration verification covers unique Page/post identity, valid state constraints, author-only reads/actions, restricted anonymous writes, and attempt-retention cleanup.
- Existing Node test conventions are reused. Full lint, test, taxonomy verification, and production build run after implementation.
- Live Meta acceptance remains pending until a Meta Developer App and Page access token are configured. A documented simulated Webhook verifies the website path beforehand.

## Out of Scope

- Automatically publishing imported drafts.
- Importing Facebook posts created before activation through the automatic pipeline.
- Replacing the existing historical Facebook archive import workflow.
- Downloading Facebook videos, Reels, live videos, or shared-post media in the first release.
- Importing comments, reactions, share counts, follower information, or other reader data.
- AI-generated titles or classifications that require a paid external model.
- Automatic fuzzy merging of similar website and Facebook articles.
- Multiple Facebook Pages or a general social-network connector framework.
- Email, SMS, or push notifications for import results.
- A routine author-facing switch that disables automatic synchronization.
- Declaring live Facebook integration complete before Meta App setup and permission verification.

## Further Notes

- The current project already contains a manual Facebook archive preview/import flow and source identifiers. The automatic path should coexist without interpreting sequential archive draft IDs as live Page post IDs.
- The project currently has no configured issue tracker integration. This accepted specification is stored with the application source and should be the implementation source of truth.
- The author can manage the Facebook Page but has not yet created a Meta Developer App. Website implementation will therefore include a setup guide and simulated verification path.
- Meta permissions and API fields can change. Setup documentation must name the tested Graph API version and instruct maintainers to revalidate permissions before upgrading it.

# Test Plan

## Automated And Static Checks

### Archive Wheel Regression (2026-10-22)

Run `npm test` with Node 22.13+ (verified locally on Node 24.14.1; the harness
uses `node:module.stripTypeScriptTypes`).
It executes the component's actual inline script and selection store with a
bounded DOM fixture and deterministic animation frames/timers, without a browser.

- [x] Small forward/reverse wheel events accumulate before a single RAF
- [x] Scroll remains within the list bounds
- [x] Collapse cancels pending RAF and the delayed selection snap
- [x] Collapse before/after RAF keeps selection cleared after the settle delay
- [x] Active pointer release/cancel settles; a canceled drag cannot reselect after collapse
- [x] Previous/Next, arrows, item click, and filter selection clearing retain their state behavior

These results cover handler/state behavior. Native keyboard, touch, pointer
capture, visual rendering, and audio acceptance items below remain separate.
Historical HTML counts below describe the July dataset; today's build is recorded
in `WORKLOG.md`.

### Wheel Delta Follow-up (2026-10-22)

The same `npm test` command now runs 29 deterministic cases including the seven
original cases. The follow-up adds these source-bound checks:

- [x] Equal signed pixel totals have equal effects for one event or 100 tiny events
- [x] Cumulative intent survives no RAF, one RAF per event, or one per ten events
- [x] Opposite overscroll cancels at both list ends across RAFs while preview stays bounded
- [x] Positive/negative 100px and 120px notches agree in pixel, line, and page modes
- [x] The settle timer remains 170ms
- [x] Collapse before/after RAF discards cumulative intent and reopen starts fresh

These checks do not establish physical trackpad behavior or replace the limits
recorded for the frozen candidate's partial browser acceptance.

### Half-step Rounding Follow-up (2026-10-22)

`npm test` now runs 47 cases. The additional eighteen cases check +55px from
entry 2 and -55px from entry 9 as one event or 100 fragments, under all three
RAF schedules. Each tests the exact tie and 0.000001px below/above it, verifies
preview and final selection, and checks that continuous visual offset is retained.
All prior normalization, endpoint cancellation, settle and collapse cases remain.

### Compensated Pixel Accumulation (2026-10-23)

`npm test` runs 68 cases, retaining the prior 47. It adds the reported 500/1,000
fragment ties and a bounded 10,000-fragment case under all three RAF schedules,
with adjacent threshold controls and unchanged continuous visual offsets. Numeric
overscroll/reversal fixtures verify that small signed input survives cancellation.
Explicit cases verify that pixel parts and gesture anchor reset on settle and
collapse before/after RAF. These bounded tests do not impose a maximum event count
on the compensated accumulator or establish physical wheel performance.

### Historical Build Snapshot (2026-07-16)

- [x] `npm run build`
- [x] `git diff --check`
- [x] 生成HTMLに共有Tooltipが1個だけ存在する
- [x] 初期HTMLのimg要素が1個だけ存在する
- [x] `null / null` のWheel項目が0件
- [x] 有効作品とWheel項目が各82件
- [x] 生成HTMLが約138KB
- [ ] `waveform-scope` と `map-lissajous` が各1個だけ存在する
- [ ] 音量バーに永続的な `scale-x-0` が残っていない

## Startup

- [x] 起動操作がbuttonとして読み上げられる
- [ ] クリックでオーバーレイが閉じる
- [ ] Enterでオーバーレイが閉じる
- [ ] Spaceでオーバーレイが閉じる
- [ ] 音声が開始する
- [ ] 音声取得失敗時もサイト操作を継続できる

## Works Map

- [x] 生成HTMLの全作品ノードに `data-point-float` が存在する
- [ ] 全ポイントが約6秒周期で常時ゆっくり揺れる
- [ ] ポイントごとの開始位相が分散している
- [ ] ホバー・フォーカス中だけ対象ポイントの揺れが停止する
- [ ] 選択・フィルターの外側transformと内側の揺れが競合しない
- [ ] ホバーで共有Tooltipが表示される
- [ ] ホバーで `selectedWorkId` が変わらない
- [ ] フォーカスで共有Tooltipが表示される
- [ ] TooltipがMap外へはみ出さない
- [ ] サムネイルは最初のホバー時にだけ読み込まれる
- [ ] 作品リンクが新しいタブで開く

## Filters

- [ ] Tagフィルターで非一致作品がinactiveになる
- [ ] Yearフィルターで非一致作品がinactiveになる
- [ ] Wheelの表示対象がフィルターと同期する
- [ ] 選択対象が非表示になった場合に選択を解除する

## Archive Wheel

- [ ] 展開・折り畳み
- [ ] Previous / Nextボタン
- [ ] 矢印キー
- [ ] マウスホイール
- [ ] ドラッグ
- [ ] タッチ操作
- [ ] 中央付近以外の項目がhiddenである
- [ ] 折り畳み中に全件レイアウトしない

## Audio

- [ ] 音声開始後にHUD波形が動く
- [ ] 音声開始後に音量レベルバーが伸縮する
- [ ] Works Map中央にリサージュが表示される
- [ ] リサージュがL=X、R=Y、Y軸反転、回転なしである
- [ ] リサージュCanvasが作品ポイントのクリック・ホバーを妨げない
- [ ] Canvas描画が最大24fps・最大512点である
- [ ] Master Gain
- [ ] Relativistic Shift
- [ ] Distortion
- [ ] Delay
- [ ] Reverb初回操作
- [ ] Pause / Resume
- [ ] Pause中にメーターが停止する
- [ ] Pause中にHUD波形とリサージュが停止する
- [ ] 非表示タブ復帰後にメーターが再開する
- [ ] 非表示タブ復帰後にHUD波形とリサージュが再開する

## Accessibility And Environment

- [ ] `prefers-reduced-motion: reduce` でポイントの常時浮遊が停止する
- [ ] 760px以下のレイアウト
- [ ] Windows Chromium
- [ ] macOS Safari
- [ ] スマートフォン実機

## Current Limits

- Codex内ブラウザ接続が途中で失われることがあり、長時間の連続操作確認は未完了。
- BGMファイル自体は約7.67MBのままで、低速回線の実測は未実施。

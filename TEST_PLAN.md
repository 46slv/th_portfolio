# Test Plan

## Automated And Static Checks

- [x] `npm run build`
- [x] `git diff --check`
- [x] 生成HTMLに共有Tooltipが1個だけ存在する
- [x] 初期HTMLのimg要素が1個だけ存在する
- [x] `null / null` のWheel項目が0件
- [x] 有効作品とWheel項目が各82件
- [x] 生成HTMLが約138KB

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

- [ ] Master Gain
- [ ] Relativistic Shift
- [ ] Distortion
- [ ] Delay
- [ ] Reverb初回操作
- [ ] Pause / Resume
- [ ] Pause中にメーターが停止する
- [ ] 非表示タブ復帰後にメーターが再開する

## Accessibility And Environment

- [ ] `prefers-reduced-motion: reduce` でポイントの常時浮遊が停止する
- [ ] 760px以下のレイアウト
- [ ] Windows Chromium
- [ ] macOS Safari
- [ ] スマートフォン実機

## Current Limits

- Codex内ブラウザ接続が途中で失われることがあり、長時間の連続操作確認は未完了。
- BGMファイル自体は約7.67MBのままで、低速回線の実測は未実施。

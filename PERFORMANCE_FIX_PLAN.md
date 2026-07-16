# TH Portfolio Performance Fix Plan

Last updated: 2026-07-16

## Purpose

操作時の引っ掛かり、常時発生する微細なカクつき、開始直後の待ち時間を減らす。
サイトの視覚コンセプト、作品配置、フィルター、Archive Wheel、音声エフェクトは維持する。

## Target Users And Environment

- PC・タブレット・スマートフォンから作品を探索する閲覧者
- Chromium、Safari、Firefox系の現行ブラウザ
- マウス、タッチ、キーボード操作
- 低性能端末、バッテリー駆動、`prefers-reduced-motion` 環境

## Baseline Findings

- 作品ノード: 105件
- Tooltip: 105件
- DOM要素: 2,666件
- 初期画面で読み込み済みのYouTubeサムネイル: 72枚
- 生成HTML: 約284KB
- BGM: 約7.67MB
- 空データ由来の `null / null` 項目: 23件
- 地図ホバーだけで地図・Archive Wheel双方の全項目が更新される
- Archive Wheelが閉じていても全項目へインラインスタイルが書き込まれる
- サイト全体へのCSS `filter` が毎フレーム更新される

## Assumptions

- 地図ポイントの常時浮遊は必須の視覚要件として維持する。性能改善は、外側ノードではなく内側マーカーだけを動かす方法で行う。
- 常時変化する全画面の色演出は、滑らかな操作を優先して標準速度では停止する。
- 地図ホバーは一時的なTooltip表示に限定し、永続選択はクリックまたはArchive Wheel操作で行う。
- 完全に空のSpreadsheet行は作品ではなく、描画対象外としてよい。
- 見た目の再設計、保存形式変更、新規依存追加は行わない。

## Candidate Fixes

### Rendering And Animation

1. 再生速度が標準値のときはVisual Shiftの全画面フィルターを解除する。
2. Visual Shiftを毎フレーム更新せず、値変更時または低頻度更新にする。
3. `innerText` の毎フレーム更新を停止する。
4. 非表示タブではVisual Shiftとメーターを停止する。
5. `prefers-reduced-motion` では浮遊アニメーションと大きな遷移を停止する。
6. 全作品の常時浮遊を維持しつつ、座標・選択用ノードではなく16pxの内側マーカーだけをCSSで動かす。
7. 全画面blurやfilterの対象範囲を縮小する。
8. `transition-all` を用途別プロパティへ限定する。

### Map Selection

9. 地図ホバーから `setSelectedWork()` を外し、CSS-only hoverへ戻す。
10. 選択更新時に全ノードを走査せず、前回と次回の2ノードだけ更新する。
11. フィルター対象ノードを初期化時にキャッシュする。
12. Tooltip表示と永続選択を別状態として扱う。

### Archive Wheel

13. 折り畳み中はレイアウト更新を行わない。
14. `visibleItems()` の反復生成をやめてキャッシュする。
15. `list.indexOf(item)` の二重ループを解消する。
16. wheel/pointermoveを1フレーム1更新へまとめる。
17. ドラッグ中は重いCSS transitionを停止する。
18. 各項目の `filter: blur()` をopacityとscaleへ置換する。
19. 中央前後の必要項目だけを描画対象にする。
20. フィルター変更時のmap node検索をIDマップへ置換する。

### Tooltip And Images

21. 作品ごとの105 Tooltipを1個の共有Tooltipへ統合する。
22. サムネイルURLはホバー・フォーカス時にだけ設定する。
23. Tooltip非表示時は画像を通信・デコードしない。
24. YouTube以外や不正URLでは画像領域を表示しない。
25. Tooltip位置計算を1回の更新へまとめる。

### Audio

26. Reverb impulseを開始時に作らず、Reverbを初めて上げた時に生成する。
27. 音量メーターを60fpsから20〜30fpsへ下げる。
28. メーターの `width` 更新を `transform: scaleX()` へ変更する。
29. 値が変わらないフレームではDOMを書き換えない。
30. 一時停止中はメーターループを停止または低頻度化する。
31. 将来はAudioBuffer全量decodeからストリーミング再生へ移行する。
32. BGMの配信用圧縮版を用意する。

### Data And Accessibility

33. 完全に空のSpreadsheet行を描画前に除外する。
34. `null / null` をArchive Wheelへ出さない。
35. 起動オーバーレイをキーボード操作可能にする。
36. フォーカス表示を主要操作へ追加する。
37. 動きの削減設定を尊重する。
38. 小さすぎる文字と低コントラスト表示を将来調整する。

### Verification And Maintenance

39. DOM数、Tooltip数、初期画像数を回帰確認する。
40. ホバー時に `selectedWorkId` が変わらないことをテストする。
41. 折り畳み中にArchive Wheel全件のスタイルが更新されないことを確認する。
42. build、キーボード、タッチ、フィルター、音声、外部リンクを確認する。
43. 性能上の設計判断をWORKLOGとBUGFIX_LOGへ残す。

## Implementation Order

1. P0: Visual Shiftと地図ホバー同期
2. P1: Archive Wheel更新量
3. P1: 単一Tooltipと画像遅延ロード
4. P1: 音声初期化とメーター
5. P2: 空データ、低モーション、キーボード
6. 最終ビルド・ブラウザ確認・記録

## Compatibility

- Spreadsheetの列構造は変更しない。
- 作品URL、タグ、年フィルターの意味は変更しない。
- Archive Wheelのクリック、矢印キー、ドラッグ操作を維持する。
- 音声エフェクトのコントロール種類と値域を維持する。

## Non-goals

- サイト全体のビジュアル再設計
- 新しいページやルートの追加
- CMSや外部APIの置換
- BGMファイル自体の再エンコード
- 対応ブラウザの大幅な変更

## Risks

- Tooltip統合時に位置や外部リンク操作が変わる可能性がある。
- Archive Wheelの間引きで端の項目が一瞬遅れて見える可能性がある。
- Visual Shiftを低頻度化すると従来より色変化が穏やかになる。
- 音声初期化の遅延化により、Reverb初回操作時だけ小さな準備時間が発生する可能性がある。

## Verification

- `npm run build`
- 起動オーバーレイのクリック・Enter・Space
- 地図ホバーでTooltip表示、選択状態は不変
- Archive Wheelの展開、クリック、矢印キー、ドラッグ、ホイール
- Tag/YearフィルターとWheel同期
- 音声開始、一時停止、各スライダー
- `prefers-reduced-motion` と非表示タブ復帰
- DOM数、Tooltip数、初期画像数の比較

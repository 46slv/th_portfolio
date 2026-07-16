# Design Decisions

## 2026-07-16: 地図ポイントの常時浮遊を必須要件として維持する

### Background

性能改善時に、全ポイントの常時浮遊を装飾的な負荷として削除した。しかし正式仕様では、ゆっくり揺れる地図ポイントがサイトの視覚コンセプトとして定義されている。

### Options

- 常時浮遊を削除したままにする。
- 座標・選択用の外側ノード全体を従来どおり動かす。
- 外側ノードを静止させ、内側の小さなマーカーだけを動かす。

### Decision

全ポイントの常時浮遊を必須要件として復元する。外側ノードではなく16pxの内側マーカーだけを、CSS transformで約6秒周期に動かす。

### Reason

視覚要件を保ちながら、Tooltip位置、選択scale、フィルターtransformとの競合と再計算範囲を抑えられるため。

### Impact

ポイントは常時ゆっくり揺れ、ホバー・フォーカス中は停止する。`prefers-reduced-motion: reduce` の場合だけアクセシビリティを優先して停止する。

### Rollback

問題がある場合も常時浮遊自体は削除せず、移動量、周期、対象要素を調整する。

## 2026-07-16: Hover previewと永続選択を分離する

### Background

地図ホバーが `selectedWorkId` を更新し、地図とArchive Wheel双方の全項目を再計算していた。

### Options

- ホバー選択を維持し、処理だけ高速化する。
- ホバーは一時Tooltip、永続選択はArchive Wheel操作に限定する。

### Decision

ホバーは一時Tooltip表示だけにし、永続選択を変更しない。

### Reason

カーソル移動中の連続同期をなくし、WORKLOGに記録済みの操作ルールへ戻せるため。

### Impact

ホバーが軽くなり、Archive Wheelが意図せず回転しない。作品選択はWheelのクリック・キー・ドラッグ・ホイールで行う。

### Rollback

`WorksMap.astro` のpointer/focusイベントから `setSelectedWork()` を再導入する。ただし性能回帰を伴う。

## 2026-07-16: Tooltipを共有する

### Background

105作品それぞれがTooltipとサムネイルを保持し、初期DOMと画像デコードを増やしていた。

### Decision

地図内に1個の `SharedWorkTooltip` を置き、対象作品のdata属性から内容を差し替える。

### Reason

外観と情報量を保ったまま、Tooltip DOMと初期画像読み込みを大幅に減らせるため。

### Impact

サムネイルはホバー・フォーカス時に初めて読み込まれる。

### Rollback

各 `WorkNode` 内で個別Tooltipを描画する旧構造へ戻す。

## 2026-07-16: Archive Wheelは中央付近だけ更新する

### Background

入力イベントごとに全項目へblur・transform・opacityを書き込んでいた。

### Decision

中央前後4件だけ表示・更新し、blur filterを使用しない。入力更新は1フレーム1回へまとめる。

### Reason

操作感を維持しつつ、DOM書き込みとpaint範囲を作品総数から切り離せるため。

### Impact

遠方項目はvisibility hiddenとなり、中央へ近づいた時だけ表示される。

### Rollback

`renderRadius` と `layoutWheel()` の全件ループを旧方式へ戻す。

## 2026-07-16: 標準速度ではVisual Shiftを無効にする

### Background

再生速度1.0でも全画面filter文字列を毎フレーム更新していた。

### Decision

1.0ではfilterを解除する。速度変更中のみ最大15fpsで更新し、低モーション環境では静止表示にする。

### Reason

通常閲覧中の常時再合成をなくすため。

### Impact

標準速度では色が常時漂わない。速度変更時の演出は維持される。

### Rollback

常時requestAnimationFrameへ戻せるが、全画面再描画の再発を伴う。

## 2026-07-16: 色指定だけの行を空作品として扱う

### Background

Spreadsheet末尾の23行は作品情報が空でも `color=blue` のため取得結果に残っていた。

### Decision

title、artist、release、year、x、y、url、tagsのすべてが空なら描画しない。

### Reason

表示されない装飾列だけで作品項目を生成しないため。

### Impact

`Untitled / Unknown` の重複項目が消える。Spreadsheet列構造は変わらない。

### Rollback

`fetchWorks.ts` の `populatedRows` フィルターを削除する。

# Design Decisions

## 2026-11-23: Archive Wheelを右下90°arc + radial labelsへ訂正する

### Decision

- Archive Wheelは右下に配置する
- 表示する円は90°のquarter arcのみ
- 円中心は画面外または右下端近傍
- 画面内にはその円のupper-left quadrantだけが侵入する
- 作品ラベルのベースラインは半径方向
- したがって文字列は円周/接線に対して垂直
- 円周方向へ文字を沿わせない
- selected/focus位置を固定し、作品ラベル側がarc上を移動する

### Supersession

同日途中案の「左下Wheel」は撤回し、旧扱いとする。過去の右側大円盤/半円panelも引き続きlegacyであり、現在有効なのは右下quarter-arcだけ。

---

## 2026-11-23: Graph-centered UIを現行レイアウト正本とし、矛盾する旧仕様をlegacy化する

### Background

複数回のvisual spikeで、旧「Map + persistent side HUD + right Archive Wheel」構成と、新しい画面中心の意図が混在し、Agentがdashboard的なレイアウトへ回帰した。

### Decision

`docs/spec/TH_PORTFOLIO_GRAPH_CENTERED_UI_SPEC.md` をUI / layout / visual interactionの現行正本とする。

- 中央Graphをサイトの主役とする
- Graphはviewport中央、1:1の等方スケール
- stereo Lissajousは強い連続線ではなくparticle fieldとして描く
- Graph以外の主要UIはdrawer / overlay化し、Graphを押し動かさない
- Audio controlsは左drawer
- Archive Wheelは右下、表示は90° quarter arcのみ
- Tag / Yearは別概念として維持し、配置は当面top overlayを試すが未確定
- Work detailはoverlay drawerへ移し、near-point表示はmicro previewに限定可能

### Supersession

このDecisionおよびcanonical specと矛盾する古いUI/layout記述はlegacyとして扱う。

特に以下は旧仕様:

- boxed Works Map
- right persistent Audio HUD
- right-side Archive Wheel
- full/half circular Wheel panel
- multi-row filter button grid
- strong continuous Lissajous line as the visual center
- Map hover → persistent selectedWorkId

非矛盾なdata/audio/input technical factsは引き続き有効。

### Impact

今後のAgent handoffは古い仕様を合成せず、canonical graph-centered specを先に読む。実装はdesktop visual structureを先に成立させ、その後に追加HUD density / motionを判断する。

---


## 2026-07-16: HUD波形とWorks Mapリサージュを同じ音声解析経路から描画する

### Background

音量レベルバーがCSS scaleの競合で見えなくなっていた。また、Works Mapには音響と地図を直接結びつける視覚表示がなかった。

### Options

- 音量バーだけを復旧する。
- モノラル波形をHUDと地図の両方へ表示する。
- HUDはミックス波形、地図はステレオraw-XYリサージュとして役割を分ける。

### Decision

Gain後段のAnalyserNodeからHUD波形を取得し、ChannelSplitter後段の左右AnalyserNodeから地図リサージュを描画する。リサージュはL=X、R=Y、Canvas Y反転、回転なしとする。

### Reason

HUDでは時間変化を読みやすくし、地図では左右の位相と広がりを視覚化できる。既存の24fpsメーターループを共有すれば、追加の常時requestAnimationFrameを増やさずに済むため。

### Impact

音声開始中は2つのCanvasと音量バーが更新される。描画は最大24fps・最大512点で、地図Canvasはpointer-eventsを受け取らない。

### Rollback

不具合時はCanvas描画だけを停止し、音声グラフと音量バーを残す。raw-XYの軸定義は変更しない。

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

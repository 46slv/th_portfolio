# TH Portfolio / DEV-29 実装資料の入口

これは索引と受入チェック。仕様の追加でも完了宣言でもない。初めて担当する場合は **正本 → 該当行 → 実装・テスト → 該当する検証記録** の順に読む。

## 1. 何を正とするか

現行の本人用候補を編集する場合は[担当・公開契約・変更防止テスト](EDITING-JA.md)から対象ファイルを選ぶ。以下は仕様と歴代候補の索引であり、無関係なコンポーネントの外観変更を許可するものではない。

1. 本人の最新の明示判断。相違があれば、日付と対象を明記して正本へ反映。古いNotion本文・モックに合わせて戻さない。
2. [現行Graph-Centered UI仕様](../spec/TH_PORTFOLIO_GRAPH_CENTERED_UI_SPEC.md) と DEV-29の確定判断（Notion）。Notion実装Brief「TH Portfolio — Agent Implementation Brief / vNext Rebuild」 は目的・不変条件・未決事項を確認する場所。初回handoffのbranch/main/PR記述は現行HEADを保証しない。
3. [Graph Reset実行資料](TH_GRAPH_CENTERED_RESET.md) は最初の移植時の範囲。 [Preview引継ぎ](TH_GRAPH_PREVIEW_HANDOFF.md) は候補・試験・残件。実際の挙動は対象SHAのコードと試験を照合し、候補の挙動を勝手に製品仕様へ昇格しない。
4. [判断履歴](../spec/TH_PORTFOLIO_UI_REQUIREMENTS_HISTORY.md)、[HTML参照](../visual/TH_GRAPH_CENTERED_REFERENCE.html)、旧Design Spike、v8/v9、旧「TH Portfolio サイト仕様書」「Archive Wheel × Works Map 連動機能 仕様書」は経緯・比較用。v8/v9の右下1/4弧やサンプルの作品名・件数・静止音表現、旧版の左下配置や恒久的なタイトル表示を現行の根拠にしない。

### 現行の操作仕様 / 2026-11-25

[Archiveのタスクと受入条件](TH_ARCHIVE_INTERACTION_TASKS.md) を参照。正本はGraph-Centered UI仕様の §3.5（作品分布）、§10.2–10.4（半円のスクロール判定・始動・慣性・着地）、§12.1（一本線とラベル）。

### 以前の本人判断 / 2026-11-24 06:04–06:05 UTC

**Audioは左端・Graphの水平中央、背景blurは当面OFF、カードには実データのthumbnailと欠損時のfallback。** Audio／Filter／Detail由来の既存dimは取り除かず、暗さは候補の実装値（製品確定値ではない）。Wheel単独展開は従来どおりdimもblurもなし。左中央・brightnessのみはローカルpreviewで320／390／1440幅を確認済み。thumbnailはPointからの小カードと選択後の詳細で確認済み（既存YouTube画像URLを使う作品83／全96。Chromeで画像の応答を模擬し、表示・欠損・失敗・すばやい切替を検証。外部配信の可用性は未確認）。fallbackの具体的な意匠は別判断とし、製品全体の受入・公開は未確認。

## 2. 領域別の実装と受入

| 領域 | 確定／現在の扱い | 実装入口・最低限の受入 |
|---|---|---|
| 入口 | 明示操作で音楽開始を試み、音楽と一緒に入る。操作前に音声取得・再生しない。失敗時の最終方針とPause/Muteの製品判断は未確定。 | `src/pages/archive-rebuild.astro`／`src/components/startup/StartOverlay.astro`／`src/components/WorksMap.astro`。実ブラウザで未操作・入場・遅延読込・失敗・明示再試行を区別。 |
| 中央Graph | 画面中央の探索空間。左Electro・右Acoustic・下Popular・上Maniacと実作品の座標を維持。操作UIは重ね、Graphを押し退けない。奥から疑似粒子→Lissajous→軸・中央印→Point→選択・preview→操作層。 | `WorksMap.astro`／`src/components/works/MapLissajous.astro`／`src/lib/ambientParticles.ts`。drawer開閉・フィルター前後の座標と中心を比較。Pointの穏やかな浮遊は固定のヒット位置と分け、hover/focusおよびReduced Motionを確認。 |
| Point／小カード | 偶発的な探索の入口。hover/focusは一時preview、明示選択は確定。カードへポインターが移っても消えず、タイトル等は実作品データのみ。実thumbnailがあれば表示。欠損時の具体的な見た目は未決で、壊れた画像／架空画像を出さない。 | `src/components/works/PointPreview.astro`／`WorkNode.astro`／`src/lib/workSelectionStore.ts`。実作品のカード内リンクまでポインター・Tabで到達、タッチでも選択できる。previewだけで持続選択・Wheel位置を変えない。 |
| 詳細・共通drawer | 詳細は既存データ（タイトル・artist・year・tags・画像・利用可能なリンク）を読む別のoverlay。Audio・Filter・Detailは現プレビューでdimのみ。外側・控えめなclose・Escapeで閉じ、内側操作で誤閉鎖しない。 | `archive-rebuild.astro`／`WorksMap.astro`／`src/types/work.ts`。Wheelから選択→詳細を開閉→Wheelの閲覧位置や選択が保持。画像なし・リンクなしでも見た目と操作を壊さない。 |
| Audio | 左端中央からoverlay。既存のPlay/Pause・Master Gain・速度・Distortion・Delay・Reverbを維持し、独立EQは追加しない。粒子は現候補で実測の全体音量＋微小driftのみ。帯域別は実信号と性能の裏付けがある場合の改善候補。 | `src/components/audio/`／`src/lib/audio/audioEngine.ts`／`WorksMap.astro`。遅延ロード中にGainを0にしてから再生、UIと実Gainの一致、再試行・停止・復帰、既存の単一再生経路と可視化を検証。`fd802ca` は確認したローカル修正の識別子（公開状態は別途確認）。 |
| Archive Wheel | 開時は右端中央から内側に広がる半円全体でスクロール開始。文字・目盛りへの初回ヒットは不要。閉時は文字だけの `Wheel` と控えめな目盛り。半円外や前面の操作要素には干渉しない。畳んでも選択・フィルターを保持。 | `src/components/works/ArchiveWheel.astro`／`workSelectionStore.ts`。上・中央・下の余白から初回入力し、半円外・閉時と比較。直接ラベル操作、swipe／矢印、PointやCardのクリック、開閉後の選択・focus保持も確認。 |
| Tag／Year | Tag/Yearは作品絞り込み、Mapは座標維持、Wheelは同じ結果集合。Tagは時間演出なし。Yearのみ新旧方向が逆の軽い遷移、Reduced Motionは同じ結果。最終配置は未決。 | `src/components/filters/`／`src/lib/filterStore.ts`／`WorksMap.astro`。Tag・Year・組合せ・該当なし・解除を確認。Year演出の有無で対象・座標が変わらない。 |

作品の正本は既存のGoogle Sheetと取得経路（`src/data/fetchWorks.ts`／`works.ts`、キーは`src/lib/workIds.ts`）。日付精度・役割・クレジット等を推測で増やさない。既存Contact/creditsを保つ。初期正式選択、hoverのWheel連動、Contactのアクション、狭幅カード、欠損画像の意匠は未決。Relativistic Shiftの表現／Three.js採否も未決で、可読性のある現行のDOM操作を保護する。

## 3. 候補を検証し、公開と混同しない

- Notion記載の `handoff/graph-centered-reset-20261123` は引継ぎ基点。 `preview/archive-rebuild-20261123` は既存のプレビュー系、 `hermes/th-dev29-graph-c2-20261124` は今回の作業候補。変更前に対象のbranch/HEADを読む。 `src/pages/index.astro` / main / 公開先は別。公開・統合の証拠はこの索引にない。
- ローカル確認入口: `http://127.0.0.1:4287/archive-rebuild/`。他のPCやスマホから開ける共有URLではない。previewを同じSHAから配信していることを照合。中間成果は閉じた状態・Audio・Wheel・詳細を最低4状態比較。開いたdrawerがGraphに及ぼす影響を静止画の印象だけで判定しない。
- `npm test`・`npm run build`。焦点は `tests/audio-startup.test.mjs`、`audio-deployment.test.mjs`、`archive-wheel.test.mjs`、`ambient-particles.test.mjs`。実ブラウザは `tests/point-preview.browser.cjs`、`wheel-point.browser.cjs`、`overlap-access.browser.cjs`、`ambient-motion.browser.cjs`。環境変数・再実行方法は[Preview引継ぎ](TH_GRAPH_PREVIEW_HANDOFF.md)。旧 `cdfdd12` の成功数を後続候補の合格として転記しない。実機スマホ・Safari/Firefox・最終意匠は、実際に確認した範囲と分けて記録。

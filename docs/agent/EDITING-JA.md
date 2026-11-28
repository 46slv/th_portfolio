# TH Portfolio の編集担当と変更範囲

同じ作品を見せることと、同じコードで全部を制御することは別。**共有するのは作品ID・選択・公開状態。ホイールの形状や音声の内部状態は共有しない。** この文書はソースの編集ガイド。プロダクト仕様は[実装索引](TH_IMPLEMENTATION_INDEX.md)を参照。

| 依頼／担当 | 最初に開く場所（`src/` 以下） | 境界と受入 |
|---|---|---|
| ページ構成・中央配置 | `pages/{index,archive-trial,archive-rebuild}.astro`、`styles/archive-rebuild.css`、`styles/archive-portrait.css` | `/` は従来版、`/archive-trial/` は比較、`/archive-rebuild/` は本人用候補。レイアウトは開閉状態と占有幅を読んで地図・カードの場所を決める。ホイール内部のセレクタ・装飾・座標を書かない。 |
| 作品データ・座標 | `data/fetchWorks.ts` → `data/works.ts`、`types/work.ts`、`lib/workIds.ts`、`components/works/WorkNode.astro` | ビルド時の行順からIDを一度定義。マップとWheel間で配列を並べ替えたり、絞り込み後の連番をIDにしない。全件のID・リンク・点の座標で比較。 |
| マップ操作・絞り込み | `components/WorksMap.astro`、`components/works/map/mapInteractions.ts`、`components/filters/`、`lib/filterStore.ts` | 点とラベルはマップ担当。点は選択通知を受けて強調。年・タグは表示集合を変え、元座標は変えない。結線は `components/works/map/bootWorksMap.ts`。 |
| 選択・小カード・詳細 | `lib/archiveSelection{,Browser}.ts`、`lib/workSelectionStore.ts`、`lib/archiveNavigation{,Browser}.ts`、`components/works/{PointPreview,SharedWorkTooltip}.astro`、`lib/workThumbnail.ts` | 一時プレビューと確定選択を区別。永続選択は単一のID。カードへ渡すのは作品IDと起点で、音声を起動しない。詳細は[操作契約](ARCHIVE_NAVIGATION.md)。 |
| Wheel／縦Browse | `components/works/ArchiveWheel.astro`、同階層 `wheelGeometry.ts`、`lib/archiveWheel{Input,Delta,Speed,Coast}.ts`、`lib/archivePortrait.ts` | 幾何は符号付きの作品位置、半径、表示モードを受ける純粋関数。音楽時計を渡さない。デスクトップの半円・ラベル角度・入力と、縦ドックの1作品表示は別契約。 |
| Wheelの外観 | `styles/archive/wheel-desktop.css`、`wheel-portrait-dock.css`、`wheel-disclosure.css` | コンポーネント内の基本スタイルと、これらの専用CSSだけが内部を描画。ページは公開された寸法を**読むだけ**。地図位置やPauseのチケットで半径・目盛り・文字組を変えない。 |
| 音・波形・背景 | `lib/audio/audioEngine.ts`、`components/audio/{AudioHud,AudioControls,VolumeMeter,WaveformScope}.astro`、`components/audio/audioHudBrowser.ts`、`components/effects/{sceneVisuals,VisualShift}.ts`、`lib/ambientParticles.ts`、`lib/archiveClock.ts`、`components/works/MapLissajous.astro` | エンジンは再生/HUDから操作。`Stop` は音・背景・波形を止め、`Pause` は音だけ。どちらも作品閲覧を止めない。起動前のページや閉じたレールの `inert` は保つ。 |
| 入場・共通表示 | `components/startup/StartOverlay.astro`、`components/layout/`、`components/ui/DrawerTrigger.astro`、`styles/{global,line-actions}.css` | 共通部品にページ固有のWheel規則を足さない。`boot`・キーボード入場・フォーカス・Contactを保つ。 |
| ビルド・配信 | `astro.config.mjs`、`public/`、`.github/workflows/`、`tests/` | ビルド・レビュー・配信は統合担当のみ。実装完了と配信完了を分け、本人用プレビューの承認を公開やmainの許可に転用しない。 |

## 1件の依頼を実装する手順
1. Leadが「変える振る舞い／変えない見た目／担当ファイル／合格条件」を記録。たとえば **地図だけを中央へ** なら、地図のCSSで直し、Wheelの角度・閉開の輪郭が変わっていないことを確認する。
2. 1ファイル1担当。同時に変える必要のある契約は先に合意し、別担当の変更を取り消さない。Piへは目的・範囲・合格条件だけを渡す。返ってきた説明だけでなく、実diffと実行結果をLeadが確認する。
3. クリーンな作業木で開始SHAと対象パスを決める。リポジトリ直下で `node scripts/check-edit-scope.mjs <開始SHA> <許可ファイル> ...` を実行。未追跡を含む未許可パス・改名元・改名先は停止理由。`PATH` のGitが起動制限を受ける場合は `GIT_EXECUTABLE` に許可済みGitの絶対パスを指定。許可リストを事後にdiffから生成しない。既存の未コミット作業は事前に分離・保全する。
4. `npm test` で依存境界・実Wheelの曲率・選択・音声起動を検査。`npm run build` 後、共有コードなら3ルート、外観変更なら同寸法の閉／開画像、Stop/Pauseなら音源時計を止めたままのマウス・タッチ選択を別々に確認。境界テストだけでは表示合格にならない。

# TH Portfolio

Talich Helfenの作品を、座標マップ・フィルター・Archive Wheel・音声演出から探索するAstro製ポートフォリオサイトです。

## Environment

- Node.js 22.12以上
- Astro 6
- Tailwind CSS 4
- TypeScript
- Static output / GitHub Pages

## Setup

```powershell
npm install
npm run dev
```

本番ビルドと確認:

```powershell
npm run build
npm run preview -- --host 127.0.0.1
```

## Main Features

- Tag・Yearフィルター
- 二次元座標上のWorks Map
- 共有Tooltipとホバー時サムネイル読み込み
- 作品選択と同期するArchive Wheel
- BGM、音量、再生速度、Distortion、Delay、Reverb
- 実音声へ連動するHUD波形、音量メーター、Works Mapリサージュ
- `prefers-reduced-motion` 対応
- マウス、タッチ、キーボード操作

## Project Structure

```text
src/
  components/
    audio/
    effects/
    filters/
    layout/
    startup/
    works/
  data/
  lib/
  pages/
  styles/
public/
  SITE_th.mp3
```

## Data

作品データはGoogle SpreadsheetをOpenSheet経由でビルド時に取得します。
完全に空の行や、色指定しか存在しない行は描画対象から除外します。

## Performance Rules

- 地図ポイントの常時浮遊は必須の視覚要件として維持し、性能改善で削除しない。
- 浮遊は外側の座標ノードではなく内側の小さなマーカーだけへ適用する。
- 地図ホバーで永続選択を変更しない。
- Tooltipとサムネイルを作品数分生成しない。
- Archive Wheelは中央付近の項目だけを描画更新する。
- 折り畳み中のArchive Wheelを再レイアウトしない。
- 標準再生速度ではサイト全体へCSS filterを適用しない。
- 非表示タブでは継続的な描画ループを停止する。
- 音声ビジュアライザーは最大24fps・最大512点で描画し、地図操作を妨げない。
- Reverb impulseは必要になるまで生成しない。

詳細は [PERFORMANCE_FIX_PLAN.md](./PERFORMANCE_FIX_PLAN.md)、[WORKLOG.md](./WORKLOG.md)、[TEST_PLAN.md](./TEST_PLAN.md) を参照してください。

## Deployment

`main` へのpushで `.github/workflows/deploy.yml` がAstroをビルドし、GitHub Pagesへデプロイします。

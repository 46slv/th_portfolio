# TH Portfolio サイト仕様書

## 概要

本サイトは、作品を一覧表示する一般的なポートフォリオではなく、作品群を2次元マップ上に配置し、視覚演出と音響演出を伴って探索するインタラクティブ・ポートフォリオである。

技術構成は Astro + Tailwind CSS v4 をベースとし、作品データは Google Spreadsheet から取得する。

---

# 技術構成

## フレームワーク

* Astro 6
* Tailwind CSS v4
* TypeScript
* Cloudflare対応構成

---

## ディレクトリ構成

```text
src/
├─ pages/
│  └─ index.astro
│
├─ components/
│  └─ WorksMap.astro
│
├─ data/
│  ├─ fetchWorks.ts
│  └─ works.ts
│
└─ styles/
   └─ global.css

public/
├─ SITE_th.mp3
├─ favicon.ico
└─ favicon.svg
```

---

# データ管理仕様

## データソース

Google Spreadsheetを利用する。

### シート構成

```text
Works
Schema
```

---

## Worksシート

作品データ本体を保持する。

### 想定カラム

| カラム    | 型      |
| ------ | ------ |
| title  | string |
| artist | string |
| year   | string |
| tags   | array  |
| x      | number |
| y      | number |
| url    | string |

### 例

```csv
title,artist,year,tags,x,y,url
SongA,TH,2025,"Game,Rock",-30,40,https://youtube.com/...
```

---

## Schemaシート

Worksシートの型定義を保持する。

### 例

```csv
field,type

title,string
artist,string
year,string
tags,array
x,number
y,number
```

---

## 型変換仕様

### number

```text
123
↓
123
```

---

### boolean

```text
true
↓
true
```

---

### array

```text
Rock,Game,OST
↓
["Rock","Game","OST"]
```

---

### string

文字列として保持する。

---

## フォールバック

### x

数値でない場合

```text
0
```

---

### y

数値でない場合

```text
0
```

---

### year

未設定の場合

```text
Unknown
```

---

### tags

未設定の場合

```text
[]
```

---

# サイトレイアウト

```text
┌─────────────────────────────┐
│ Contact Bar                 │
├─────────────────────────────┤
│ Tag Filter                  │
│ Year Filter                 │
├──────────────┬──────────────┤
│              │              │
│ Works Map    │ Audio HUD    │
│              │              │
├──────────────┴──────────────┤
│ Footer                      │
└─────────────────────────────┘
```

---

# 起動演出

## 初期状態

画面全体をブラー状態で表示する。

### 表示内容

```text
Initialize System
Click Anywhere to Begin
```

---

## クリック時

startExperience() を実行する。

### 処理内容

* オーバーレイ非表示
* blur解除
* AudioContext生成
* BGMロード
* HUD有効化
* Visual Shift開始

---

# Contact Bar

画面上部に表示する。

## 現在の内容

```text
info@corecreative.jp
```

---

## 動作

クリック時

```javascript
navigator.clipboard.writeText()
```

を実行し、メールアドレスをコピーする。

---

# フィルタシステム

## Tag Filter

作品のタグ一覧から自動生成する。

### 例

```text
All Tags
Game
Rock
Anime
Commercial
```

---

## Year Filter

作品年度一覧から自動生成する。

### 例

```text
2026
2025
2024
```

---

## フィルタ条件

### 状態保持

```typescript
currentTag
currentYear
```

---

### 判定条件

```typescript
tagMatch && yearMatch
```

---

### 一致

```css
is-active
```

付与

#### 効果

```text
opacity: 1
translateZ(120px)
scale(1.2)
```

---

### 不一致

```css
is-inactive
```

付与

#### 効果

```text
opacity: 0.1
translateZ(-300px)
scale(0.7)
```

---

# Works Map

## コンセプト

作品を以下の独自座標系へ配置する。

```text
           Maniac
              ↑
              │
Electro ←─────┼─────→ Acoustic
              │
              ↓
           Popular
```

---

## 座標範囲

### データ側

```text
-100 ～ 100
```

---

### 画面側

```text
0 ～ 100%
```

---

## 座標変換式

```typescript
left =
((x + 100) / 200) * 100

bottom =
((y + 100) / 200) * 100
```

---

# 作品ノード

## 表示形状

```text
+
```

型のクロスマーカー

### 構成

* 横線
* 縦線
* 中央ドット

---

## アニメーション

全ノードに浮遊アニメーションを適用する。

これはサイトの視覚コンセプトを構成する必須要件であり、性能改善を理由に削除してはいけない。
座標・選択・Tooltip位置を管理する外側ノードは静止させ、16pxの内側マーカーだけをCSS transformで動かす。

### 特徴

* 約6秒周期で常時ゆっくり揺れる
* 各ノードは決定的な疑似ランダムディレイで位相をずらす
* ホバー・フォーカス中は停止
* `prefers-reduced-motion: reduce` ではアクセシビリティを優先して停止
* JavaScriptのフレームループは使用しない

---

# 作品詳細カード

作品ホバー時に表示する。

---

## 表示内容

* YouTubeサムネイル
* Artist
* Year
* Title
* Tags
* Access Data

---

## YouTubeサムネイル生成

URLから動画IDを抽出する。

### 対応URL

```text
youtu.be
youtube.com/watch?v=
```

---

### サムネイルURL

```text
https://img.youtube.com/vi/{VIDEO_ID}/mqdefault.jpg
```

---

# Audio HUD

右側に常時表示する。

---

## Master Gain

### 制御対象

```javascript
gainNode.gain
```

---

## Temporal Velocity

### 制御対象

```javascript
source.playbackRate
```

### 効果

* BGM速度変更
* Visual Shift強度変更

---

## Distortion

### 制御対象

```javascript
WaveShaperNode
```

---

## Delay

### 制御対象

```javascript
DelayNode
```

---

## Reverb

### 制御対象

```javascript
ConvolverNode
```

---

# オーディオ構成

```text
AudioSource
    │
    ▼
Distortion
    │
 ┌──┴───────┐
 │          │
 ▼          ▼
Delay     Reverb
 │          │
 └────┬─────┘
      ▼
    Gain
      ▼
Destination
```

---

# Visual Shift

再生速度に応じてサイト全体へ色変化演出を適用する。

---

## 制御パラメータ

```css
hue-rotate
saturate
brightness
contrast
invert
```

---

## ステータス表示

### 停止

```text
Shift: Time Frozen
```

### 通常

```text
Shift: Stable
```

### 加速

```text
Shift: Blue (Warping)
```

### 減速

```text
Shift: Red (Distant)
```

### 極端な加速

```text
Shift: Critical Singularity
```

---

# ボリュームメーター

## 現状

実際の音量解析は行っていない。

---

## 現在の実装

```javascript
Math.random()
```

による疑似表示。

---

# BGM

## ファイル

```text
/public/SITE_th.mp3
```

---

## 再生仕様

* ループ再生
* 自動再生禁止対策としてユーザー操作後に開始
* PlaybackRate変更対応

---

# 現在の制約

## YouTube専用サムネイル

以下のみ対応。

```text
youtube.com
youtu.be
```

---

## Contact固定

メールアドレスがハードコードされている。

---

## TypeScript型未整備

多くの箇所で any を使用している。

---

## スプレッドシート依存

Google Spreadsheet障害時は作品データ取得不可。

---

## Audio Meter未実装

AnalyserNode未使用。

実際の音量とは連動していない。

---

# サイトの設計思想

本サイトは一般的な作品一覧ポートフォリオではなく、

「作品群を座標空間上へ配置し、音響・視覚演出とともに探索するインタラクティブ・アーカイブ」

として設計されている。

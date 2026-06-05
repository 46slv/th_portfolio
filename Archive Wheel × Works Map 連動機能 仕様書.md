# Archive Wheel × Works Map 連動機能 仕様書

## 目的

現在の作品マップは作品同士の関係性を可視化することに優れているが、全作品を一覧的に閲覧する導線が存在しない。

そのため、新たに Archive Wheel（半円ホイールUI）を実装し、Works Map と双方向連動させる。

ユーザーは、

* マップから作品を探す
* ホイールから作品を探す

どちらの操作を行っても同一の作品選択状態が共有される。

---

# 設計思想

Works Map と Archive Wheel は別UIではなく、

```text
1つの作品選択システム
```

を異なる視点で表現するものとする。

---

## Works Map

作品間の関係性を見る。

```text
どの位置に存在する作品なのか
```

を理解するためのUI。

---

## Archive Wheel

作品一覧を見る。

```text
どんな作品が存在するのか
```

を理解するためのUI。

---

# 選択状態の統一

サイト全体で

```typescript
selectedWorkId
```

を保持する。

---

## 管理場所

```text
src/lib/workSelectionStore.ts
```

---

### API

```typescript
setSelectedWork(id)

getSelectedWork()

subscribe(callback)
```

---

# Works Map → Archive Wheel

## 動作

ユーザーが作品ポイントへカーソルを合わせた場合

```text
hover
```

を作品選択として扱う。

---

### 発生イベント

```typescript
setSelectedWork(work.id)
```

---

### 結果

Archive Wheel が自動回転する。

---

## アニメーション

現在選択中作品が

ホイール中央へ移動する。

---

### 条件

瞬間移動は禁止。

---

### 要件

```text
0.4〜0.8秒
```

程度の慣性アニメーション。

---

### イメージ

```text
現在
A
B
C
D
E

↓

Dをホバー

↓

B
C
D ←中央
E
F
```

---

# Archive Wheel → Works Map

## 動作

ユーザーが

* ホイールスクロール
* ドラッグ
* スワイプ

を行う。

---

### 発生イベント

```typescript
setSelectedWork(work.id)
```

---

### 結果

Works Map 側の該当作品を強調表示する。

---

# Works Mapでの強調状態

ホイールで選択された作品は

現在の hover と同等の表示を行う。

---

## 適用内容

```css
is-active
```

を付与。

---

### 効果

```text
scale
translateZ
glow
```

を適用。

---

### Tooltip

作品カードも自動表示する。

---

## 重要

ユーザーがカーソルを置いていなくても

選択中作品は常に詳細カードを表示する。

---

# Hover優先順位

## 優先順位

```text
1. 実カーソルHover
2. Wheel選択
3. 通常状態
```

---

## 例

ホイールでAを選択中

↓

マウスをBへ乗せる

↓

Bを表示

↓

カーソルを離す

↓

Aへ戻る

---

# Archive Wheel仕様

## 表示形式

右側に配置する。

---

### 構造

```text
     A

   B

 C

D ←選択

 E

   F

     G
```

---

円周上に作品を配置する。

---

## 表示数

常時

```text
前後3作品
```

程度表示。

---

## 選択作品

中央に配置。

---

### 状態

```css
opacity: 1
blur: 0
scale: 1
```

---

## 非選択作品

距離に応じて減衰。

---

### 1段

```css
opacity: 0.7
blur: 2px
scale: 0.95
```

---

### 2段

```css
opacity: 0.4
blur: 5px
scale: 0.85
```

---

### 3段

```css
opacity: 0.15
blur: 10px
scale: 0.75
```

---

# ホイール操作

## 対応入力

### PC

* マウスホイール
* ドラッグ

---

### モバイル

* スワイプ

---

### キーボード

* ↑
* ↓

---

# 自動スクロール

Map側から選択された場合

ホイールは自動で回転する。

---

### 要件

現在位置から最短距離で移動。

---

### NG

```text
先頭まで戻る
```

ような挙動。

---

# URL連携

将来的な詳細ページ対応を考慮する。

---

## 選択変更時

URL更新可能な構造とする。

---

### 例

```text
/work/mononoaware
```

---

または

```text
/?work=mononoaware
```

---

# 実装構成

## 新規コンポーネント

```text
components/

works/
├─ WorksMap.astro
├─ ArchiveWheel.astro
├─ WorkNode.astro
├─ WorkTooltip.astro
└─ WorkSelectionProvider.ts
```

---

# 完了条件

* Works Map と Archive Wheel が双方向同期する
* マップHoverでホイールが回転する
* ホイール操作でマップの選択作品が切り替わる
* 選択作品のTooltipが表示される
* 選択状態を selectedWorkId で一元管理する
* PC・タブレット・スマートフォンで操作可能
* 現在のフィルタ機能と共存する
* フィルタ後の作品群のみホイールへ表示される

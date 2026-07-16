# Changelog

## Unreleased

### Changed

- 標準再生速度でVisual Shiftの全画面filter更新を停止。
- Visual Shiftを最大15fpsへ制限し、非表示タブと低モーション設定に対応。
- 地図ホバーをCSS-only previewへ戻し、Archive Wheelの永続選択と分離。
- 選択変更時の地図全件走査を、前回・次回ノードだけの更新へ変更。
- Archive Wheelを中央前後4件だけ更新する構造へ変更。
- Archive Wheelの入力更新をrequestAnimationFrameでまとめ、ドラッグ中のtransitionを停止。
- 作品ごとのTooltipを単一の共有Tooltipへ統合。
- YouTubeサムネイルをホバー・フォーカス時にだけ読み込むよう変更。
- 全作品の常時浮遊アニメーションを、外側ノードから16pxの内側マーカーへ移して維持。
- Reverb impulseをReverb初回使用時まで遅延。
- 音量メーターを24fps、`scaleX()`、値変更時のみの描画へ変更。
- 完全な空行と色指定しかないSpreadsheet行を描画対象から除外。
- 起動オーバーレイをキーボード操作可能なbuttonへ変更。

### Performance

- 生成HTML: 約284KBから約138KBへ削減。
- 描画作品数: 105件から有効な82件へ整理。
- Tooltip: 105個から1個へ削減。
- 初期img要素: 72個から1個へ削減し、srcは必要時のみ設定。

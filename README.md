# 🍇 Mask-Cut

Mask-Cut は、LLM へテキストを送信する前に人名や組織名などをマスキングするツール群です。CLI / Electron / VS Code / Chrome 拡張など複数クライアントから共通コアライブラリを呼び出す構成になっています。

## リポジトリ構成

| パス                                              | 説明                                                           |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `packages/text-llm-core`                          | マスキングユースケースや LLM 抽象のコアライブラリ              |
| `apps/cli`                                        | CLI クライアント。コマンドラインからマスキングを実行           |
| `apps/electron-app`                               | デスクトップ UI。貼り付け → 実行 → コピーのワークフローを提供  |
| `apps/chrome-extension` / `apps/vscode-extension` | 将来のクライアント（現在は雛形）                               |
| `.kiro/`                                          | AI-DLC / Spec-Driven Development のステアリング & スペック情報 |

## 共通セットアップ

```bash
pnpm install           # 依存関係を一括インストール
pnpm lint              # 型チェック
pnpm --filter @mask-cut/text-llm-core build
```

各アプリの詳細な手順やオプションは、それぞれの README を参照してください。

- `apps/cli/README.md` … CLI のインストール方法・コマンドリファレンス
- `apps/electron-app/README.md` … デスクトップアプリの起動手順・UI 仕様
- その他のクライアント（Chrome/VS Code）は準備中のため、更新が入り次第 README を追加します。

## ライセンス / 貢献

ライセンスは `LICENSE` を参照してください。コントリビュートする場合は、該当アプリの README と `.kiro/steering` の開発ガイドラインに従ってください。

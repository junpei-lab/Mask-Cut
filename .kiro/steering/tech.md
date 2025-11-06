# Technology Stack

## Architecture

モノレポ (pnpm) 構成で、共通ロジックを `packages/` に集約し、各クライアントアプリ (`apps/`) から共有する構造。コアパッケージはヘッドレスな TypeScript ライブラリとして実装し、ブラウザ・デスクトップ・CLI から共通 API を利用できるようにしている。

## Core Technologies

- **Language**: TypeScript 5.x (strict モード)
- **Framework**: フレームワーク非依存のヘッドレスライブラリ (将来的に各クライアントで UI フレームワークを組み合わせ)
- **Runtime**: Node.js / Web runtime を想定 (Fetch API ベース)

## Key Libraries

- `cross-fetch`: ブラウザ・Node 両対応の Fetch 実装で OpenAI 互換 API 呼び出しを抽象化
- `tsup`: CJS と ESM を同時に生成するビルドツール (型定義も出力)

## Development Standards

### Type Safety
- TypeScript strict 設定を必須 (`strict: true`, `noEmit` lint)
- ドメイン型 (`MaskingOptions`, `MaskingResult`) をパッケージ公開 API として明示

### Code Quality
- `pnpm run lint` で型チェックを実施
- `pnpm run build` で CJS/ESM/型定義を生成、sourcemap も提供

### Testing
- まだ本格的なテストスイートは未整備 (`test` はプレースホルダ)
- マスキングロジックは LLM 依存のため、将来的にモックベースの回帰テストを追加予定

## Development Environment

### Required Tools
- Node.js 18+ (Fetch API をサポート)
- pnpm 8.x (モノレポ管理)

### Common Commands
```bash
# 依存関係インストール
pnpm install

# コアライブラリのビルド
pnpm --filter @mask-cut/text-llm-core build

# 型チェック (モノレポ全体)
pnpm lint
```

## Key Technical Decisions

- LLM 呼び出しは `LLMClient` インターフェースで抽象化し、OpenAI 互換クライアントをリファレンス実装とする。
- マスキングオプションは拡張しやすいユニオン型で管理し、デフォルトは日本語ドメイン (マスクトークンや回答形式も日本語基準)。
- `packages/` で生成した型定義をクライアントアプリに輸出し、アプリ側は独自の LLM 実装を差し替え可能にしている。

---
_主要な技術と意思決定のみを記録し、依存一覧にはしない_

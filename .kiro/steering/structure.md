# Project Structure

## Organization Philosophy

共通ロジックは `packages/` に、UI やプラットフォーム固有処理は `apps/` に配置する「コアライブラリ + 薄いクライアント」構成。ライブラリ内はドメインごとにディレクトリを分け、公開 API は `src/index.ts` から集約エクスポートする。

## Directory Patterns

### Core Packages
**Location**: `/packages/*/src/`
**Purpose**: LLM 呼び出しやマスキングロジックなど、プラットフォーム非依存コードを実装
**Example**: `packages/text-llm-core/src/usecases/masking.ts` でマスキングユースケースを提供

### Client Apps
**Location**: `/apps/`
**Purpose**: Chrome 拡張、CLI、Electron、VSCode など各プラットフォーム向けシェルを配置 (現状はブートストラップ状態)
**Example**: `apps/chrome-extension/` などがコアライブラリを参照して UI/UX を提供する予定

### Domain Modules
**Location**: `/packages/text-llm-core/src/{llm,usecases}`
**Purpose**: LLM アクセス層 (`llm/`) とアプリケーションユースケース (`usecases/`) を分離し、責務を明確化
**Example**: `llm/openaiCompatibleClient.ts` が外部 API をラップし、`usecases/masking.ts` がビジネスロジックを表現

## Naming Conventions

- **Files**: キャメルケース + ドメイン名 (`maskingPrompts.ts`, `openaiCompatibleClient.ts`)
- **クラス**: PascalCase (`OpenAICompatibleClient`)
- **関数 / 変数**: camelCase (`maskSensitiveInfo`, `buildMaskToken`)
- **型エイリアス / インターフェース**: PascalCase (`MaskingOptions`, `LLMRequest`)

## Import Organization

```typescript
// 相対パスでドメイン間依存を明示
import type { LLMClient } from '../llm/types';
import { MASKING_SYSTEM_PROMPT } from './maskingPrompts';
```

**Path Aliases**:
- 現状なし (モジュール境界を明示するため相対インポートを維持)

## Code Organization Principles

- `src/index.ts` で公開 API を再エクスポートし、クライアント側はパッケージ名から参照。
- LLM アクセス層とドメインユースケースを分離し、副作用のある処理はクライアント (`LLMClient`) に委譲。
- マスキングルールは日本語ドメイン前提で記述し、オプション拡張に備えて enum/union 型で制約。

---
_パターンを記述し、ディレクトリ全体の羅列は避ける_

# Project Structure

_updated_at: 2025-11-12_

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

### Desktop App (`apps/electron-app`)
**Main (`src/main/`)**: `appBootstrap.ts` がアプリを起動し、`WindowManager` がメイン/設定ウィンドウを生成。`registerIpcChannels.ts` では `MaskingService` + `MaskingCache` + `MaskingJobQueue` を組み合わせた `masking:*` と、`SettingsService` + `SecureStoreAdapter` + `FetchConnectivityTester` を使う `settings:*`、`clipboard:copy` を一括で公開する。

**Preload (`src/preload/`)**: `registerApis.ts` が `maskingAPI`/`settingsAPI`/`clipboardAPI` を `contextBridge` で露出し、各 API (例: `apis/masking.ts`, `apis/settings.ts`, `apis/clipboard.ts`) は入力検証と IPC の `invoke/on/removeListener` のみを扱う。

**Renderer (`src/renderer/`)**: `renderer.ts` と `state/appState.ts` がドラフト入力・`INPUT_TEXT_MAX_LENGTH=1000`・`locked`・`copyFeedback` を管理し、`settings.ts` が設定フォーム+エラー表示+`settingsAPI.onUpdate` 同期を提供。テンプレート HTML は `renderer/index.html` と `renderer/settings.html` に分割される。

**Scripts / Assets**: `scripts/fixRendererImports.mjs` が `tsc` 出力後に相対 import へ `.js` 拡張子を付け、`assets/icon.png` と `windows/appIcon.ts` が複数の探索パスでアイコンを解決する。

### IPC / Status Streams
**Location**: `apps/electron-app/src/main/ipc`, `src/main/masking`, `src/renderer/state`
**Purpose**: `MaskingJobQueue` が `masking:status` に `jobId/state/locked/errorCode` を載せ、renderer の `AppStateStore` がバナー・ボタン活性・コピー可否を制御。`settings:update` は `SettingsService.onChange` から全ウィンドウへ通知され、`clipboard:copy` は Preload でテキスト検証後にメインプロセスの `clipboard` API へ委譲する。
**Example**: `registerIpcChannels.ts` で `ipcMain.handle('masking:run', ...)` を束ね、`renderer.ts` が `maskingAPI.onStatus` でステート更新する。

### Domain Modules
**Location**: `/packages/text-llm-core/src/{llm,usecases}`
**Purpose**: LLM アクセス層 (`llm/`) とアプリケーションユースケース (`usecases/`) を分離し、責務を明確化
**Example**: `llm/openaiCompatibleClient.ts` が外部 API をラップし、`usecases/masking.ts` がビジネスロジックを表現

### CLI (`apps/cli/src/`)
**Command Layer**: `commands/` にコマンドごとの descriptor + handler を配置し、`CommandRouter` が `Map` ベースで登録/dispatch。各 handler は CLI 固有の引数パーサー (例: `parseMaskCommandArgs`) を持ち、`CommandResult` を返す。

**Config Layer**: `config/` 配下で `ConfigStore` (JSON ファイル I/O)・`ConfigService` (profiles / defaults / vault lookup)・`credentialVault` (keytar or in-memory) を分離。`resolveConfigFilePath` は OS ごとのホームディレクトリ規約をカプセル化しつつ `MASK_CUT_CONFIG_PATH` を優先し、`createCredentialVault` は `MASK_CUT_VAULT_SERVICE` で keytar サービス名を切り替えられる。

**Infrastructure Utilities**: ルート直下に `cliApplication.ts` (global options, telemetry, audit logging), `commandRouter.ts`, `inputResolver.ts`, `outputFormatter.ts`, `errorDomainMapper.ts`, `processIo.ts`, `types.ts` を配置し、CLI の I/O・エラー・テレメトリを横断的に扱う。

**Tests**: 各ユーティリティ/command と同じディレクトリに `*.test.ts` を隣接させ、Node Test Runner + `ts-node` ローダーで直接実行できるようにしている。

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
- `@mask-cut/text-llm-core` → `packages/text-llm-core/src/index.ts` を `tsconfig.base.json` で解決。CLI などアプリ側はこの別名でコア API を参照しつつ、ビルド時は `tsup` の `noExternal` で同梱する。
- それ以外の境界は相対 import を維持し、階層が深くなり過ぎないようディレクトリをドメイン単位に分割する。

## Code Organization Principles

- `src/index.ts` で公開 API を再エクスポートし、クライアント側はパッケージ名から参照。
- LLM アクセス層とドメインユースケースを分離し、副作用のある処理はクライアント (`LLMClient`) に委譲。
- マスキングルールは日本語ドメイン前提で記述し、オプション拡張に備えて enum/union 型で制約。
- `CliApplication` → `CommandRouter` → command handler → `maskSensitiveInfo` という直線的な依存方向を守り、CLI でも「上位が下位を DI する」原則を徹底する。
- `InputResolver` → `CommandResult.telemetry` → `AuditLogger` の流れで入力バイト数/Masked バイト数を算出し、オプションの `logFile` (プロファイル設定または `--log-file`) に JSON Lines を追記する。

## Configuration Footprint

- **CLI config.json**: `ConfigStore.ensureInitialized()` が `%APPDATA%/MaskCut/config.json` または `$XDG_CONFIG_HOME/mask-cut/config.json` (fallback `~/.config`) にファイルを作成。`MASK_CUT_CONFIG_PATH` を指定すると強制的にそのパスを使える。
- **Profiles + vault**: 各プロファイルは `endpoint/model/logFile/vaultKeyId` を持ち、API キーは `credentialVault` (keytar, サービス名は `MASK_CUT_VAULT_SERVICE` で変更可) に保存。`logFile` は `CommandResult.logFile` に伝播して監査ログへ反映される。
- **Desktop settings**: Electron は `app.getPath('userData')/settings.json` を `SettingsRepository` 経由で管理し、`SettingsService` が `MASK_CUT_ENDPOINT_URL/MODEL_NAME/API_KEY/TIMEOUT_MS/VAULT_ID` を初期値として使用。シークレットは `SecureStoreAdapter` (keytar or in-memory fallback) に隔離される。
- **Connectivity defaults**: `SettingsService.save` は `FetchConnectivityTester` による `/models` GET → ベース URL HEAD を通過しない限り設定を反映しないため、GUI からの誤設定がそのままクライアントに波及しない。

---
_パターンを記述し、ディレクトリ全体の羅列は避ける_

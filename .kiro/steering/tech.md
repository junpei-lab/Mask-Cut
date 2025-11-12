# Technology Stack

_updated_at: 2025-11-12_

## Architecture

モノレポ (pnpm) 構成で、共通ロジックを `packages/` に集約し、各クライアントアプリ (`apps/`) から共有する構造。コアパッケージはヘッドレスな TypeScript ライブラリとして実装し、ブラウザ・デスクトップ・CLI から共通 API を利用できるようにしている。

### CLI ランタイム層

- CLI は Node.js 18+ をターゲットに `type: module` で記述し、`tsup` で ESM バンドル + shebang 付きの単一 `dist/index.js` に圧縮している。
- エントリポイントでは `CommandRouter` / `CliApplication` / `ProcessIO` を組み合わせ、グローバルフラグ解析 → コマンド毎の引数解析 → 共通エラーハンドリング → 監査ログ出力までを一気通貫で処理する。
- LLM 呼び出しは `OpenAICompatibleClient` を `llmFactory` から DI し、`maskSensitiveInfo` などコアライブラリのユースケースに委譲することで CLI 層を純粋な I/O + orchestration に留めている。

### Electron ランタイム層

- `apps/electron-app/src/main/appBootstrap.ts` が `WindowManager` を起動し、アプリ準備完了時にメインウィンドウを表示。`registerProcessObservers` が uncaughtException / unhandledRejection / render-process-gone を標準エラーへフックする。
- `registerIpcChannels` (main/ipc) は `MaskingService` + `MaskingCache` + `MaskingJobQueue` を束ねた `masking:run`/`masking:status`、`SettingsService` + `SecureStoreAdapter` + `FetchConnectivityTester` を使う `settings:*`、および `clipboard:copy` を単一の登録ポイントから提供する ([apps/electron-app/src/main/ipc/registerIpcChannels.ts](apps/electron-app/src/main/ipc/registerIpcChannels.ts:22)).
- `MaskingService` は OpenAI 互換クライアントを DI しつつ、ネットワーク/タイムアウト/usage/LLM 失敗を `E_NETWORK/E_TIMEOUT/E_USAGE/E_MASK_FAILED` にマッピングして renderer 側が状態に応じたメッセージを描画できるようにしている ([apps/electron-app/src/main/masking/maskingService.ts](apps/electron-app/src/main/masking/maskingService.ts:1)).

## Core Technologies

- **Language**: TypeScript 5.x (strict モード)
- **Framework**: フレームワーク非依存のヘッドレスライブラリ (将来的に各クライアントで UI フレームワークを組み合わせ)
- **Runtime**: Node.js / Web runtime を想定 (Fetch API ベース)
- **CLI ツールチェーン**: `tsup` + `tsx` + Node.js Test Runner (`node --loader ts-node/esm --test`) でトランスパイル / dev 実行 / テストを回す。`tsconfig.base.json` では `@mask-cut/text-llm-core` へのパスエイリアスを定義し、CLI 側でもソースを直接参照できる。
- **Desktop runtime**: Electron 28.x (CJS main + ESM preload/renderer)。`contextIsolation: true` を守るため `tsc` 出力後に [scripts/fixRendererImports.mjs](apps/electron-app/scripts/fixRendererImports.mjs) で相対 import に `.js` 拡張子を付与し、Preload で `contextBridge` 限定 API を公開する。

## Desktop Runtime Stack

### Main Process

- `bootstrapApplication` → `WindowManager` がメイン/設定ウィンドウを生成し、開発時は自動で DevTools を分離表示する ([apps/electron-app/src/main/appBootstrap.ts](apps/electron-app/src/main/appBootstrap.ts:1) / [apps/electron-app/src/main/windows/windowManager.ts](apps/electron-app/src/main/windows/windowManager.ts:13)).
- `SettingsService` は `settings.json` を `app.getPath('userData')` に保存し、`MASK_CUT_ENDPOINT_URL/MODEL_NAME/API_KEY/TIMEOUT_MS/VAULT_ID` を既定値として吸い上げた後、保存時に `FetchConnectivityTester` で `/models`→ベース URL の HEAD を実行して疎通チェックする ([apps/electron-app/src/main/settings/settingsService.ts](apps/electron-app/src/main/settings/settingsService.ts:19) / [apps/electron-app/src/main/settings/connectivityTester.ts](apps/electron-app/src/main/settings/connectivityTester.ts:1)).
- `MaskingService` は `MaskingCache` と `MaskingJobQueue` を抱えて最後の入力/結果スナップショットを保持しながら、ジョブ状態を `masking:status` で各ウィンドウに送信する ([apps/electron-app/src/main/masking/maskingCache.ts](apps/electron-app/src/main/masking/maskingCache.ts:1) / [apps/electron-app/src/main/masking/maskingJobQueue.ts](apps/electron-app/src/main/masking/maskingJobQueue.ts:1)).

### Preload Bridge

- `registerPreloadApis` が `maskingAPI` / `settingsAPI` / `clipboardAPI` を `contextBridge.exposeInMainWorld` で公開し、IPC の `invoke`/`on`/`removeListener` だけを渡す ([apps/electron-app/src/preload/registerApis.ts](apps/electron-app/src/preload/registerApis.ts:1)).
- 各 API は renderer へ渡す前に引数検証を行い (例: `buildMaskingAPI` はテキスト必須、`buildSettingsAPI` は URL 妥当性検査、`buildClipboardAPI` は空文字拒否)、UI レイヤーを安全に保つ ([apps/electron-app/src/preload/apis/masking.ts](apps/electron-app/src/preload/apis/masking.ts:1) / [apps/electron-app/src/preload/apis/settings.ts](apps/electron-app/src/preload/apis/settings.ts:1) / [apps/electron-app/src/preload/apis/clipboard.ts](apps/electron-app/src/preload/apis/clipboard.ts:1)).

### Renderer

- `renderer.ts` は `AppStateStore` を使って draft/locked/banner/result/copyFeedback を一括管理し、`INPUT_TEXT_MAX_LENGTH = 1000` の制限やエラーコード付きバナー、接続先表示、コピー成功トーストなどを DOM に同期する ([apps/electron-app/src/renderer/renderer.ts](apps/electron-app/src/renderer/renderer.ts:52) / [apps/electron-app/src/renderer/state/appState.ts](apps/electron-app/src/renderer/state/appState.ts:1)).
- `settings.ts` は入力フィールド毎のエラー表示・接続テスト結果・最終更新時刻を描画し、`settingsAPI.onUpdate` で別ウィンドウの更新も即時反映する ([apps/electron-app/src/renderer/settings.ts](apps/electron-app/src/renderer/settings.ts:1)).

## Key Libraries

- `Fetch API (globalThis.fetch)`: Node.js 18+ / ブラウザで共通の Fetch 実装を利用し、OpenAI 互換 API 呼び出しを行う
- `tsup`: CJS と ESM を同時に生成するビルドツール (型定義も出力)
- `keytar`: CLI で API キーを OS 共通の資格情報ストアに保存する際に動的 import される optional dependency
- `ts-node` / `tsx`: ESM ベースの開発サーバーと Node 標準テストを TypeScript ソースのまま実行するユーティリティ

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
- CLI では Node.js Test Runner (`node --loader ts-node/esm --test`) を採用し、`*.test.ts` を隣接配置して I/O 抽象 (InputResolver/AuditLogger など) をスタブ可能にしている。

### CLI レジリエンス
- グローバル引数の手動パーシングで依存を最小化しつつ、未知オプション/不足値を `CliUsageError` 経由で `E_USAGE` に束ねる。
- コマンド実行結果は `OutputFormatter` が JSON / text / dry-run / error を統一的に描画し、`AuditLogger` が JSON Lines 形式でオプションのログファイルへ追記する。
- ネットワーク・タイムアウト・LLM 応答不備は `CliNetworkError`/`CliTimeoutError`/`MaskingOperationError` に正規化してエラードメイン毎の exit code を固定している。

## Configuration & Secrets

- **CLI 側**: `ConfigStore` が初期 JSON (`schemaVersion=1`) を生成し、`ConfigService` が `mask-cut config init/list/use` を提供。`MASK_CUT_CONFIG_PATH` で保存先を指定でき、`CredentialVault` が `MASK_CUT_VAULT_SERVICE` で keytar サービス名を切り替えて API キーを OS の資格情報ストアへ保存する ([apps/cli/src/config/configStore.ts](apps/cli/src/config/configStore.ts:1) / [apps/cli/src/config/configService.ts](apps/cli/src/config/configService.ts:17) / [apps/cli/src/config/credentialVault.ts](apps/cli/src/config/credentialVault.ts:1) / [apps/cli/src/config/configPaths.ts](apps/cli/src/config/configPaths.ts:4)).
- **Desktop 側**: `SettingsRepository` が `app.getPath('userData')/settings.json` を扱い、`SecureStoreAdapter` が keytar (未導入時は in-memory fallback) に API キーのみを保存。`SettingsService` は環境変数シード + JSON をキャッシュしつつ、保存前に `FetchConnectivityTester` で疎通検証する ([apps/electron-app/src/main/settings/settingsStore.ts](apps/electron-app/src/main/settings/settingsStore.ts:13) / [apps/electron-app/src/main/settings/secureStoreAdapter.ts](apps/electron-app/src/main/settings/secureStoreAdapter.ts:1) / [apps/electron-app/src/main/settings/settingsService.ts](apps/electron-app/src/main/settings/settingsService.ts:19)).
- **入力ソースの安全性**: `InputResolver` は inline/file/stdin を統一インターフェースに変換し、空 stdin や未対応の interactive ソースは `InputResolveError` を投げて `E_USAGE` に正規化する設計 ([apps/cli/src/inputResolver.ts](apps/cli/src/inputResolver.ts:1)).

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

# CLI 開発用ホットリロード
pnpm --filter @mask-cut/cli dev

# CLI の単体テスト
pnpm --filter @mask-cut/cli test
```

## Observability & Telemetry

- CLI は `cliApplication` が `ExecutionTelemetry` を組み立て、`AuditLogger` が JSON Lines を `logFile` (プロファイル既定 or `--log-file`) に追記。`ErrorDomainMapper` は `CliUsageError`/`CliNetworkError`/`CliTimeoutError`/`MaskingOperationError` を exit code + `ErrorOutput` にマッピングして運用ログに現れるコード体系を固定する ([apps/cli/src/cliApplication.ts](apps/cli/src/cliApplication.ts:124) / [apps/cli/src/auditLogger.ts](apps/cli/src/auditLogger.ts:1) / [apps/cli/src/errorDomainMapper.ts](apps/cli/src/errorDomainMapper.ts:1)).
- Electron では `MaskingJobQueue` が `masking:status` イベントへ `locked`/`errorCode`/`endpoint` を含めて配信し、`AppStateStore` が UI ハイライトを司る。メインプロセスは `registerProcessObservers` でクラッシュ/未処理拒否を STDERR へ集約し、`settingsAPI.onUpdate` で複数ウィンドウの設定差分を同期する ([apps/electron-app/src/main/masking/maskingJobQueue.ts](apps/electron-app/src/main/masking/maskingJobQueue.ts:1) / [apps/electron-app/src/renderer/state/appState.ts](apps/electron-app/src/renderer/state/appState.ts:37) / [apps/electron-app/src/main/observability/registerProcessObservers.ts](apps/electron-app/src/main/observability/registerProcessObservers.ts:1) / [apps/electron-app/src/renderer/renderer.ts](apps/electron-app/src/renderer/renderer.ts:237)).

## Key Technical Decisions

- LLM 呼び出しは `LLMClient` インターフェースで抽象化し、OpenAI 互換クライアントをリファレンス実装とする。
- マスキングオプションは拡張しやすいユニオン型で管理し、デフォルトは日本語ドメイン (マスクトークンや回答形式も日本語基準)。
- `packages/` で生成した型定義をクライアントアプリに輸出し、アプリ側は独自の LLM 実装を差し替え可能にしている。
- CLI の設定ファイルは OS ごとの既定フォルダに JSON で保存し、API キーは `vaultKeyId` + `keytar` に委譲することで平文保存を避ける。
- `ExecutionTelemetry` を各コマンドで生成し、プロファイル名・入力バイト数・Masked バイト数を JSON Lines として残す。`logFile` はプロファイル定義または `--log-file` で注入する。
- path alias (`@mask-cut/text-llm-core`) を `tsconfig.base.json` で宣言し、CLI からはワークスペースソースを直接 import→`tsup` の `noExternal` で同梱する。
- Electron 側の `MaskingJobQueue` で LLM 呼び出しを逐次実行しつつ、ジョブ状態 + `locked` フラグを renderer にストリームして UX を同期させる。
- `FetchConnectivityTester` は `/models` GET → ベース URL HEAD の二段構えでエンドポイント健全性を検証し、失敗時のメッセージを設定 UI へそのまま返す。
- `scripts/fixRendererImports.mjs` をビルド後に走らせ、tsc が生成した ESM へ `.js` 拡張子を後付けして Electron + contextIsolation 下でも import 解決を安定させる。

---
_主要な技術と意思決定のみを記録し、依存一覧にはしない_

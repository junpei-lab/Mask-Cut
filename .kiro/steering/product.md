# Product Overview

_updated_at: 2025-11-12_

Mask-Cut は、LLM との連携前にテキストから人名や組織名などの固有名詞を安全にマスキングするための開発者向けツール群です。複数のクライアント (CLI, Chrome 拡張, VS Code 拡張, Electron アプリ) から同じコアロジックを呼び出せるよう設計されています。

## Core Capabilities

1. 固有名詞マスキング: LLM を利用して人名・社名・組織名を自動マスキング。
2. 形式維持: 原文の構成や形式を保ったままマスクトークンのみを置換。
3. マルチクライアント共有: 共通ライブラリ (@mask-cut/text-llm-core) を複数アプリで再利用。
4. LLM プロバイダー抽象化: OpenAI 互換 API へ統一的にアクセスできるクライアントを提供。

## Target Use Cases

- チャットログや文章を LLM に渡す前の個人情報マスキング
- コールセンター記録や議事録など、固有名詞を含むテキストの匿名化
- ブラウザ拡張・デスクトップアプリでの一括マスキングワークフロー

## Value Proposition

- マスクスタイルや言語設定を切り替えられる柔軟なオプション
- LLM 依存の動作詳細をライブラリ内部に閉じ込め、クライアント実装を軽量化
- コアロジックを単一パッケージに集約し、機能拡張や品質保証を集中させやすいアーキテクチャ

## デスクトップ (Electron) 体験

- **ペースト→実行→コピーの高速ループ**: `renderer` は `INPUT_TEXT_MAX_LENGTH = 1000` を共有ステートで強制し、入力メーター / バナー / 接続先表示を一括更新することで、貼り付け → ワンクリック実行 → 結果コピーまで UI 上で迷子にならない ([apps/electron-app/src/renderer/renderer.ts](apps/electron-app/src/renderer/renderer.ts:52) / [apps/electron-app/src/renderer/state/appState.ts](apps/electron-app/src/renderer/state/appState.ts:1)).
- **ジョブキュー駆動の進捗配信**: メインプロセス側で `MaskingService` + `MaskingJobQueue` が単一ワーカーとして順番に LLM 呼び出しを処理し、`masking:status` チャンネルでキュー状態 / 失敗コード / 結果メタを全ウィンドウへブロードキャストする ([apps/electron-app/src/main/masking/maskingService.ts](apps/electron-app/src/main/masking/maskingService.ts:1) / [apps/electron-app/src/main/masking/maskingJobQueue.ts](apps/electron-app/src/main/masking/maskingJobQueue.ts:1)).
- **設定ウィンドウと接続健全性**: `WindowManager` がメイン + モーダル設定ウィンドウを管理し、設定保存時は `FetchConnectivityTester` で `/models` → `/` に対して GET/HEAD を投げて接続性を検証、成功時のみ `settings:update` を配信する ([apps/electron-app/src/main/windows/windowManager.ts](apps/electron-app/src/main/windows/windowManager.ts:13) / [apps/electron-app/src/main/ipc/registerIpcChannels.ts](apps/electron-app/src/main/ipc/registerIpcChannels.ts:22) / [apps/electron-app/src/main/settings/connectivityTester.ts](apps/electron-app/src/main/settings/connectivityTester.ts:1)).
- **クリップボードと安全なブリッジ**: Preload 層は `maskingAPI`/`settingsAPI`/`clipboardAPI` だけを `contextBridge` で公開し、renderer からはテキスト検証済みの `clipboard:copy` 呼び出しや設定オープンのみを許可するため、Node API を直接露出させずに UX に必要な操作だけを提供する ([apps/electron-app/src/preload/registerApis.ts](apps/electron-app/src/preload/registerApis.ts:1) / [apps/electron-app/src/preload/apis/clipboard.ts](apps/electron-app/src/preload/apis/clipboard.ts:1)).

## 設定とオペレーション

- **CLI プロファイル運用**: `mask-cut config init/list/use` で JSON プロファイルを管理し、`ConfigService` が `vaultKeyId` と `logFile` をプロファイルにひも付けて API キーを keytar へ退避する。`MASK_CUT_CONFIG_PATH` で保存先を強制できるため CI / 封鎖環境でも同じステアリングを適用できる ([apps/cli/src/config/configService.ts](apps/cli/src/config/configService.ts:17) / [apps/cli/src/config/configStore.ts](apps/cli/src/config/configStore.ts:1) / [apps/cli/src/config/configPaths.ts](apps/cli/src/config/configPaths.ts:4)).
- **監査ログと実行テレメトリ**: `cliApplication` は各コマンドの開始/終了時刻・入出力バイト・エラーコードを `ExecutionTelemetry` にまとめ、`logFile` (プロファイル既定 or `--log-file`) へ JSON Lines で追記することで、CLI 実行をそのまま運用監査に活用できる ([apps/cli/src/cliApplication.ts](apps/cli/src/cliApplication.ts:124) / [apps/cli/src/auditLogger.ts](apps/cli/src/auditLogger.ts:1)).
- **環境変数シード**: Electron 側の `SettingsService` は `MASK_CUT_ENDPOINT_URL/MASK_CUT_MODEL_NAME/MASK_CUT_API_KEY/MASK_CUT_TIMEOUT_MS/MASK_CUT_VAULT_ID` を初期値として吸い上げ、CLI 側は `MASK_CUT_VAULT_SERVICE` で credential vault 名を切り替える設計で、環境ごとに安全な既定値を用意できる ([apps/electron-app/src/main/settings/settingsService.ts](apps/electron-app/src/main/settings/settingsService.ts:19) / [apps/cli/src/config/credentialVault.ts](apps/cli/src/config/credentialVault.ts:1)).
- **ローカル設定ストアの責務分離**: Electron は `settings.json` を `app.getPath('userData')` 配下に保管し、API キーだけは `SecureStoreAdapter` 経由で keytar (なければメモリ) へ保存することで、設定 UI と秘密データ保護を分離している ([apps/electron-app/src/main/settings/settingsStore.ts](apps/electron-app/src/main/settings/settingsStore.ts:13) / [apps/electron-app/src/main/settings/secureStoreAdapter.ts](apps/electron-app/src/main/settings/secureStoreAdapter.ts:1)).

## リファレンス CLI ワークフロー

- **接続プロファイル + 監査ログ**: `config init/list/use` で OS 標準パス (`%APPDATA%` / `$XDG_CONFIG_HOME`) の `config.json` を育て、API キーは `keytar` 経由で vault に退避。プロファイルには `logFile` を紐づけ、各コマンド実行から JSON Lines 監査ログを追記する。
- **入力多態性**: `InputResolver` が inline / ファイル / stdin を同一 `TextSource` で扱い、後段が入力経路を意識せずに済む。stdin 無入力時には早期エラーにマップする。
- **運用フレンドリーな実行モード**: `--dry-run` は LLM 呼び出しをスキップした構成確認専用の `dry-run` 出力を返し、`--format json` はマスク結果 + metrics を API へ転送しやすい構造化データで提供する。
- **フェイルセーフ CLI 体験**: `CommandRouter` と `ErrorDomainMapper` でコマンド/エラーを集中管理し、使用ミスは `E_USAGE`, ネットワーク系は `E_NETWORK/E_TIMEOUT`, LLM 応答不備は `E_MASK_FAILED` へ収束させる。グローバルオプション (`--quiet`, `--log-file` 等) は `CliApplication` で先に解決し、各コマンドはドメインロジックに集中できる。
- **コアライブラリ再利用パス**: `mask` コマンドは `@mask-cut/text-llm-core` の `maskSensitiveInfo` にオプションごとの引数を橋渡しし、CLI 側では I/O と実行体験だけを責務とする。ほかのクライアント (Chrome 拡張等) もこの接続面を共有する想定。

---
_フォーカスはパターンとプロダクトの方向性であり、機能一覧ではありません_

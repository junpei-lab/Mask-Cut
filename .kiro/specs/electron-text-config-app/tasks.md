# Implementation Plan

- [x] 1. Electron プロセス基盤を contextBridge 構成へ再編成する
  - BrowserWindow 生成処理をメイン/設定の 2 ウィンドウ前提で整理し、再利用できるライフサイクル管理フックを用意する
  - contextIsolation と sandbox 設定を有効化した上で preload エントリをバンドルし、IPC チャネル登録を集中管理する
  - main 側でマスキング・設定・クリップボード系のチャンネルを予約し、エラーロギングやクラッシュ復旧ハンドラも初期化する
  - _Requirements: R1.1-R1.5, R2.1-R2.5, R3.1-R3.5 (共通基盤)_

- [x] 1.1 Preload ブリッジを実装し renderer から必要な操作だけを公開する
  - maskingAPI / settingsAPI / clipboardAPI の 3 つを contextBridge で公開し、入力検証とレスポンス正規化を担当させる
  - IPC の疎通状態を監視し、メインプロセス障害時に renderer 側へフェイルメッセージを伝播する
  - _Requirements: R1.2-R1.4, R2.1-R2.5, R3.1-R3.5_

- [x] 2. マスキング実行バックエンドを逐次実行と再送キャッシュ対応で構築する
  - MaskingJobQueue を導入し、FIFO 制御・進行中フラグ・キャンセル API を備えた非同期ジョブ管理を実装する
  - MaskingCache で最後の入力と結果スナップショットを保持し、再送要求時に取り出せるようにする
  - _Requirements: R1.1, R1.3-R1.5_

- [x] 2.1 MaskingService を実装して text-llm-core へのブリッジとステータス配信を行う
  - SettingsService から接続情報と資格情報を取得し、OpenAICompatibleClient を都度初期化して maskSensitiveInfo を実行する
  - ジョブごとに requestId を付与し、queued→running→succeeded/failed の状態イベントを renderer へ発火する
  - エラー種別ごとに `E_USAGE` `E_NETWORK` `E_TIMEOUT` などのコードを付与して UI が適切に表示できるよう整形する
  - _Requirements: R1.1-R1.4, R2.3_

- [x] 2.2 Masking 再試行とジョブ待機 UI 連携のためのイベントチャネルを整備する
  - `masking:retry-last` チャネルを作成し、MaskingCache 内容で即座に再送できるようにする
  - 進行中ジョブがある際には renderer へロック状態を push し、新規投入が完了まで待機する旨を通知する
  - _Requirements: R1.3-R1.5, R2.3_

- [x] 3. Renderer メインビューで入力制御と進行表示を実装する
  - 入力欄・送信ボタン・状態テキストを束ねる ViewState Store を整備し、UI からのイベントと IPC ステータスを同期させる
  - 空入力や 0 バイトのテキストを送信しようとした場合に即座にフィールドエラーを表示し送信操作をキャンセルする
  - 実行中は入力欄とボタンを無効化し、待機メッセージとスピナーを表示する
  - _Requirements: R1.1-R1.4_

- [x] 3.1 結果パネルとコピー操作を実装しマスキング成果を提示する
  - マスク済みテキスト、使用モデル、エンドポイントラベルを表示する結果エリアを構築する
  - クリップボードコピーと保存済み入力の再利用アクションを提供し、成功/失敗トーストを表示する
  - _Requirements: R2.1, R2.2, R2.4, R1.5_

- [x] 3.2 エラーバナーと設定画面導線を備えたステータスコンポーネントを追加する
  - 失敗コードごとに色分けされたバナーを描画し、再試行ボタンと詳細メッセージを表示する
  - エラー発生時には設定画面を開くリンクを表示し、ユーザーが設定を見直せるようにする
  - _Requirements: R2.3, R2.5, R3.3_

- [x] 4. 設定管理ワークフローを実装し接続先・モデルを編集できるようにする
  - electron-store を利用した SettingsRepository で endpointUrl, modelName, vaultKeyId, timeoutMs, lastUpdatedAt を永続化する
  - keytar をラップした SecureStoreAdapter で vaultKeyId に紐づく資格情報を取得/検証する
  - _Requirements: R3.1, R3.5_

- [x] 4.1 設定保存パイプラインで検証と接続テストを行い、失敗時にロールバックする
  - 保存リクエストを schema validate → 接続テスト → commit の順で処理し、不備があればバリデーション結果を renderer に返す
  - 接続テスト失敗時には前回有効設定を保持し、ユーザーへエラー理由と再試行手段を通知する
  - _Requirements: R3.2, R3.3, R3.4_

- [x] 4.2 設定ウィンドウ UI を構築し、メイン画面とも双方向に状態を同期させる
  - 設定フォームに現在値と最終更新日時を表示し、保存処理中は進行状況を提示する
  - 保存に成功した際はメイン画面へ更新イベントを配信し、結果パネルのモデル/エンドポイント表示を即時更新する
  - _Requirements: R2.2, R3.3, R3.5_

- [x] 5. 品質担保のための自動テストと観測ポイントを整備する
  - MaskingJobQueue・SettingsValidator・MaskingCache 向けにユニットテストを追加し、逐次処理や検証ロジックを検証する
  - IPC の happy path / 失敗パス / 再試行パスを通す統合テストを用意し、renderer とのイベント連携を確認する
  - Playwright などでメイン画面・設定画面 E2E シナリオ (空入力エラー、成功結果、設定変更反映) を自動化する
  - _Requirements: R1.1-R1.5, R2.1-R2.5, R3.1-R3.5_

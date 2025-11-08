# Requirements Document

## Introduction
Mask-Cut CLIは、開発者がLLMに渡す前のテキストを素早く匿名化するためのコマンドラインインターフェースであり、マルチクライアント構成の中でコアライブラリを再利用する薄いシェルとして機能する。

## Requirements

### Requirement 1: マスキング実行フロー
**Objective:** As a セキュリティ志向の開発者, I want テキストをコマンドでマスキングしたい, so that 誤送信リスクを最小化できる

#### Acceptance Criteria
1. When ユーザーが`mask-cut mask`コマンドで標準入力からテキストを提供すると, the Mask-Cut CLI shall 固有名詞をマスクトークンへ置換したテキストを標準出力に返す。
2. When ユーザーがテキストファイルパスを引数として指定すると, the Mask-Cut CLI shall 指定ファイルを読み取りマスク済みテキストを出力する。
3. When ユーザーが`--style`オプションで既定以外のマスクスタイルを要求すると, the Mask-Cut CLI shall 指定スタイルを適用したマスク結果を生成する。
4. When ユーザーが`--format json`を指定すると, the Mask-Cut CLI shall 入力とマスク結果を含むJSONレスポンスを標準出力に整形する。
5. While マスキング対象テキストに改行や空行が含まれる, the Mask-Cut CLI shall 出力テキストのレイアウトと段落構造を維持する。

### Requirement 2: 接続設定と認証管理
**Objective:** As a プラットフォーム運用者, I want LLM接続情報をCLIから管理したい, so that 依存サービスの切替や鍵更新を安全に行える

#### Acceptance Criteria
1. When ユーザーが`mask-cut config set --api-key`を実行すると, the Mask-Cut CLI shall 指定されたAPIキーを安全に保存する。
2. When ユーザーが`mask-cut config set --endpoint`を実行すると, the Mask-Cut CLI shall LLMエンドポイントURLを検証して保存する。
3. If マスキング実行時に有効なAPIキーが保存されていない, then the Mask-Cut CLI shall エラー終了し再設定手順を指示する。
4. When ユーザーが`mask-cut config show`を実行すると, the Mask-Cut CLI shall マスクされた形式で現在の設定を表示する。
5. Where 複数プロファイルが構成されている, the Mask-Cut CLI shall 指定プロファイルを優先して接続設定を解決する。

### Requirement 3: 出力制御と終了コード
**Objective:** As a オペレーション担当者, I want CLIの出力と終了結果を信頼したい, so that 自動化パイプラインに組み込める

#### Acceptance Criteria
1. When マスキングが正常に完了すると, the Mask-Cut CLI shall 終了コード0を返す。
2. If マスキング処理が失敗する, then the Mask-Cut CLI shall 非0の終了コードと理由を標準エラーに出力する。
3. When ユーザーが`--quiet`フラグを指定すると, the Mask-Cut CLI shall マスク結果以外のログ出力を抑制する。
4. While CLIが対話モードで実行されている, the Mask-Cut CLI shall 進行状況とプロンプトを標準出力に段階的に表示する。
5. When ユーザーが`--dry-run`フラグを指定すると, the Mask-Cut CLI shall API呼び出しを行わずに予定アクションを標準出力へ報告する。

### Requirement 4: エラー処理と監査性
**Objective:** As a 信頼性エンジニア, I want 失敗時の情報を把握したい, so that 問題原因を迅速に突き止められる

#### Acceptance Criteria
1. If LLM応答がタイムアウトする, then the Mask-Cut CLI shall タイムアウトを記録して再実行手順を案内する。
2. When 入力検証でサポートされないオプションが検出されると, the Mask-Cut CLI shall エラー詳細と有効なオプション一覧を表示する。
3. If CLIがネットワーク到達不能を検知する, then the Mask-Cut CLI shall 再試行せずに失敗理由と推奨復旧手順を提示する。
4. When ユーザーが`--log-file`パラメータでパスを指定すると, the Mask-Cut CLI shall 実行ログを指定ファイルへ追記する。
5. When CLI実行が完了すると, the Mask-Cut CLI shall 実行開始時刻・終了時刻・処理対象件数をログに含める。


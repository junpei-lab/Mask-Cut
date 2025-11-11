# Mask-Cut CLI

Mask-Cut CLI は、LLM にテキストを送信する前に人名や社名などの固有表現をマスキングするためのコマンドラインツールです。OpenAI 互換 API（OpenAI, Azure OpenAI, llama.cpp, Ollama など）を呼び出し、結果をプレーンテキストまたは JSON で取得できます。

## 主な特徴
- 固有名詞を block / asterisk / maskTag の 3 スタイルでマスキング
- `--language` や `--mask-unknown` で検出強度を調整
- stdin / 直接入力 / ファイル入力の 3 通りをサポート
- Dry-run, quiet, JSON Lines 監査ログなど運用向けのオプションを同梱

## 動作要件
- Node.js 18 以降
- pnpm 8 以降
- OpenAI 互換のエンドポイント（自前サーバーまたはクラウド）
- Windows / macOS / Linux で動作確認済み

## インストールとビルド
1. リポジトリを取得し、ルートで `pnpm install`
2. CLI をビルド: `pnpm --filter @mask-cut/cli build`
3. 実行: 開発中は `pnpm --filter @mask-cut/cli dev -- --help`、ビルド済みを使う場合は `node apps/cli/dist/index.js mask --help` または `pnpm --filter @mask-cut/cli start`
4. 任意: `pnpm --filter @mask-cut/cli link --global` で `mask-cut` コマンドを PATH に登録

## クイックスタート
1. 接続先の LLM を用意（例: `ollama serve`）。
2. ヘルプを確認:
   ```
   mask-cut --help
   mask-cut mask --help
   ```
3. テキストをマスク:
   ```
   mask-cut mask \
     --base-url http://localhost:1234/v1 \
     --model llama3 \
     --api-key dummy \
     --text "田中太郎は東京本社で働いています。"
   ```
4. ファイル / stdin を使った例:
   ```
   mask-cut mask --file ./input.txt > masked.txt
   cat memo.txt | mask-cut mask --language auto --format json
   ```

## グローバルオプション
- `--help` CLI 全体または直後のコマンドのヘルプを表示
- `--quiet` 正常系の案内メッセージを抑制
- `--dry-run` LLM 呼び出しを行わず実行内容のみを確認
- `--log-file <path>` 実行ごとのテレメトリを JSON Lines で追記

## mask コマンド
```
mask-cut mask [options] (--text "..." | --file path | stdin)
```

| オプション | 説明 |
| --- | --- |
| `--base-url <url>` | OpenAI 互換 API のベース URL（プロファイル設定があればそちらを優先、未設定時は `http://localhost:1234/v1`） |
| `--api-key <key>` | API キー。不要な環境では省略可 |
| `--model <name>` | 呼び出すモデル名（デフォルト `llama3`） |
| `--style block|asterisk|maskTag` | マスクの表示方法 |
| `--keep-length` | 元テキストと同じ文字数を維持 |
| `--language ja|en|auto` | マスキング対象テキストの言語ヒント |
| `--mask-unknown` / `--no-mask-unknown` | 未知語の積極マスクを ON/OFF |
| `--format text|json` | 出力フォーマット。`json` は結果+メトリクスを返す |
| `--text <text>` / `--file <path>` | 入力の指定。未指定時は stdin |
| `--profile <name>` | 監査ログ上でのプロファイル名（設定ファイルの default を推奨） |
| `--help` | mask コマンド固有のヘルプ |

JSON で受け取りたい場合:
```
mask-cut mask --format json --text "..." | jq .
```

## config コマンド
```
mask-cut config init   # config.json を既定パスに生成
mask-cut config list   # プロファイル一覧と default の確認
mask-cut config use qa # default プロファイルの切り替え
```

出力例:
```
Configured profiles:
* default   https://api.openai.com/v1  model=gpt-4o-mini  updated=2025-11-08T03:15:21.100Z
  local     http://localhost:1234/v1  model=llama3       updated=2025-11-05T12:00:00.000Z

'*' indicates the default profile.
```

## 設定ファイルとプロファイル
- Windows: `%APPDATA%\MaskCut\config.json`
- macOS / Linux: `$XDG_CONFIG_HOME/mask-cut/config.json`（未設定の場合は `~/.config/mask-cut/config.json`）
- 環境変数 `MASK_CUT_CONFIG_PATH` で保存場所を上書き可能

サンプル:
```json
{
  "schemaVersion": 1,
  "defaultProfile": "prod",
  "profiles": {
    "prod": {
      "endpoint": "https://api.openai.com/v1",
      "model": "gpt-4o-mini",
      "logFile": "C:/logs/mask-cut/prod.log",
      "updatedAt": "2025-11-08T00:00:00.000Z"
    },
    "local": {
      "endpoint": "http://localhost:1234/v1",
      "model": "llama3",
      "updatedAt": "2025-11-05T12:00:00.000Z"
    }
  },
  "log": {
    "defaultLogFile": "C:/logs/mask-cut/audit.log",
    "append": true
  }
}
```

項目の意味:
- `profiles.<name>.endpoint` LLM ベース URL
- `profiles.<name>.model` 既定モデル名
- `profiles.<name>.logFile` そのプロファイル専用の監査ログ出力先（任意）
- `log.defaultLogFile` グローバルな監査ログ出力先（`--log-file` より低い優先度）
- `log.append` 追記モードを制御（常に `true` 推奨）
- `defaultProfile` config コマンド `use` で切り替わる既定プロファイル

初回セットアップでは `mask-cut config init` を実行すると既定パスに `config.json` が生成されます（既に存在する場合は上書きされません）。

現行バージョン (0.1.0) では `mask` コマンド実行時に、config.json の既定プロファイルからエンドポイント / モデル / API キーを自動読み込みます。コマンドラインで `--base-url` や `--model`、`--api-key` を指定した場合はプロファイル値より優先され、設定ファイルを更新しなくても一時的に上書きできます。プロファイル名は監査ログの識別子としても記録されます。

## 監査ログの活用
`--log-file` もしくは設定ファイルに記述したパスには、1 実行 1 行の JSON が追記されます:
```
{"command":"mask","status":"success","profile":"prod","inputBytes":1204,"maskedBytes":1092,"startedAt":"2025-11-08T03:30:12.181Z","finishedAt":"2025-11-08T03:30:13.004Z"}
```
このファイルを SIEM / Fluent Bit などに取り込むことで、誰がどのプロファイルでマスキングしたかを把握できます。

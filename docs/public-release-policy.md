# Public Release Policy

このリポジトリは開発用です。公開用リポジトリ `Motoki1994/mosquito-panic-public` には `dist/` の中身だけを入れます。

公開用に入れてよいもの:

- `dist/index.html`
- `dist/assets/`
- `dist/robots.txt`
- 配信用の短い README

公開用に入れないもの:

- `.claude/`
- `.git/`
- `src/`
- `node_modules/`
- `assets/` の元データ
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`
- `*.map`
- `*.ts`

ローカルで配信用フォルダを作る手順:

```bash
npm run release:prepare
```

出力先:

```text
release/mosquito-panic-public/
```

このフォルダを確認してから、公開用の別リポジトリへ手動でコピーします。

注意:

- この開発リポジトリから直接 push しない
- `.claude/` を公開用リポジトリに入れない
- `src/` を公開用リポジトリに入れない
- 公開用リポジトリ側でGitHub Pagesを有効にするかどうかは、内容確認後に手動で決める

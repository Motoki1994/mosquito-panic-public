const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const releaseRoot = path.join(root, 'release')
const releaseDir = path.join(releaseRoot, 'mosquito-panic-public')

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status || 1)
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dst = path.join(to, entry.name)
    if (entry.isDirectory()) {
      copyDir(src, dst)
    } else {
      fs.copyFileSync(src, dst)
    }
  }
}

if (!fs.existsSync(distDir)) {
  console.error('[release:prepare] dist/ がありません。先に npm run build を実行してください。')
  process.exit(1)
}

run('node', [path.join('scripts', 'check-public-dist.cjs')])

fs.rmSync(releaseDir, { recursive: true, force: true })
copyDir(distDir, releaseDir)

fs.writeFileSync(
  path.join(releaseDir, 'README.txt'),
  [
    'Mosquito Panic public build',
    '',
    'このフォルダは配信用です。',
    '想定する配信用リポジトリ: https://github.com/Motoki1994/mosquito-panic-public',
    '開発用の src/、.claude/、node_modules/、Git履歴は入れないでください。',
    'このフォルダの中身だけを配信用リポジトリへ入れてください。',
    '公開操作と push は手動で行ってください。',
    '',
  ].join('\n'),
  'utf8',
)

console.log(`[release:prepare] OK: ${path.relative(root, releaseDir)} を作成しました。`)

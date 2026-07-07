const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const targetDir = process.argv[2]
  ? path.resolve(root, process.argv[2])
  : path.join(root, 'dist')

const forbiddenPathParts = new Set([
  '.claude',
  '.git',
  'node_modules',
  'src',
])

const forbiddenExtensions = new Set([
  '.map',
  '.ts',
  '.tsx',
])

const requiredFiles = [
  'index.html',
  'robots.txt',
  path.join('assets', 'ui', 'skin', 'skin.png'),
  path.join('assets', 'sprites', 'mosquito', 'mosquito_body_back_empty.png'),
]

function fail(message) {
  console.error(`[release:check] ${message}`)
  process.exitCode = 1
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
    } else {
      files.push(fullPath)
    }
  }

  return files
}

if (!fs.existsSync(targetDir)) {
  fail(`${path.relative(root, targetDir)}/ がありません。先に npm run build を実行してください。`)
  process.exit()
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(targetDir, file))) {
    fail(`${path.relative(root, targetDir)}/${file} がありません。`)
  }
}

const distFiles = walk(targetDir)
for (const file of distFiles) {
  const rel = path.relative(targetDir, file)
  const parts = rel.split(path.sep)
  const ext = path.extname(file)

  if (parts.some(part => forbiddenPathParts.has(part))) {
    fail(`公開禁止パスが混入しています: ${rel}`)
  }

  if (forbiddenExtensions.has(ext)) {
    fail(`公開禁止拡張子が混入しています: ${rel}`)
  }
}

const html = fs.readFileSync(path.join(targetDir, 'index.html'), 'utf8')
if (!html.includes('noindex')) {
  fail('dist/index.html に noindex がありません。')
}

if (process.exitCode) process.exit()
console.log(`[release:check] OK: ${path.relative(root, targetDir)}/ は公開用ファイルだけです。`)

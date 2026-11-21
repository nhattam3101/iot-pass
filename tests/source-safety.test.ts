import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const SECRET = /(^|\/)(credentials|token|client_secret[^/]*)\.json$|\.env($|\.)/i

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

describe('sensitive files stay out of public assets', () => {
  it('public/ (served and copied into dist) has no OAuth or env files', () => {
    const files = walk(join(root, 'public')).map((path) => path.slice(root.length + 1))
    expect(files.filter((path) => SECRET.test(path))).toEqual([])
  })

  it('a production build, if present, has no OAuth or env files', () => {
    const dist = join(root, 'dist')
    if (!existsSync(dist)) return
    const files = walk(dist).map((path) => path.slice(root.length + 1))
    expect(files.filter((path) => SECRET.test(path))).toEqual([])
  })

  it('git ignores and does not track credentials.json / token.json', () => {
    const ignore = readFileSync(join(root, '.gitignore'), 'utf8')
    expect(ignore).toMatch(/^credentials\.json$/m)
    expect(ignore).toMatch(/^token\.json$/m)
    const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n')
    expect(tracked.filter((path) => SECRET.test(path))).toEqual([])
  })
})

describe('source data is untouched by the redesign', () => {
  // Pinned at the pre-redesign checkpoint (d9b9326). Update only for an intentional data rebuild.
  const pinned: Record<string, string> = {
    'data/questions.json': '410d80f63f1d6b0571ec9172323d56ba274cd8a36e0dcd0adbeb04cfbf02bf29',
    'data/topics.json': '974b939d2bfac5dee0eba19618cc1d96cc3c9f2bcbd1aea80b560fe82cf6f2cd',
    'data/topic_mapping.json': 'a13429b7484ca84e46924447bb0e58638c9023a9d11d75e2e60ab5830d13314e',
    'data/ocr_raw.json': 'f5d2bd1c05259a013782a0c4f4f0787a864eacb9b069583044b27c2e53921049',
    'data/speaker_notes.json': '7538f231b03498a0a3c77a7478ab5f7d05f997e1287b969ecdf9f01e292dfb55',
    'data/manual_overrides.json': '33272dba1a3b98b53522713e9caa72857201f211cc16aa8f7d9ef7f83896501f',
  }
  it.each(Object.entries(pinned))('%s matches its checkpoint hash', (path, sha) => {
    expect(createHash('sha256').update(readFileSync(join(root, path))).digest('hex')).toBe(sha)
  })
})

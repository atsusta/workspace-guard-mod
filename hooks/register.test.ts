import { test, expect } from 'claude-code/testing'

const WS = '/Users/x/Documents/claude-code'

const setup = (on: any) => {
  on('session.root', () => ({ value: WS }))
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok' }))
  on('tool.call', { tool: 'Write' }, () => ({ result: 'ok' }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
}

const denied = async ($: any, call: Record<string, unknown>) => {
  const r = await $.tool.call(call)
  return typeof r.deny === "string"
}

test('denies reading .gitignore', async ($, on) => {
  setup(on)
  expect(await denied($, { tool: 'Read', file_path: `${WS}/.gitignore` })).toBe(true)
  expect(await denied($, { tool: 'Bash', command: 'cat .gitignore' })).toBe(true)
  expect(await denied($, { tool: 'Read', file_path: `${WS}/CLAUDE.md` })).toBe(false)
})

test('denies venvs and heavy media inside the workspace', async ($, on) => {
  setup(on)
  expect(await denied($, { tool: 'Bash', command: 'python3 -m venv .venv' })).toBe(true)
  expect(await denied($, { tool: 'Bash', command: 'uv venv' })).toBe(true)
  expect(await denied($, { tool: 'Bash', command: 'yt-dlp -o clip.mp4 URL' })).toBe(true)
  expect(await denied($, { tool: 'Write', file_path: `${WS}/creative/a.psd` })).toBe(true)
})

test('allows venvs and media outside, and batch dirs', async ($, on) => {
  setup(on)
  expect(await denied($, { tool: 'Bash', command: 'python3 -m venv ~/.venvs/ocr' })).toBe(false)
  expect(await denied($, { tool: 'Bash', command: 'ffmpeg -i in.mov /tmp/scratch/out.mp4' })).toBe(false)
  expect(await denied($, { tool: 'Bash', command: 'cp a.mp4 batch/inputs/a.mp4' })).toBe(false)
  expect(await denied($, { tool: 'Write', file_path: `${WS}/batch/outputs/final.zip` })).toBe(false)
})

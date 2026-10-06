import type { Register } from 'claude-code'

const GITIGNORE = /(^|[\s"'/=])\.gitignore(\s|$|["'])/
const READ_VERBS = /(^|[\s;&|(])(cat|head|tail|less|more|bat|sed|awk|grep|rg|nl|wc|cut|sort|strings|xxd|open)\s/
const HEAVY_EXT = /\.(mp4|mov|mkv|avi|webm|wav|flac|psd|clip|safetensors|ckpt|gguf|iso|zip|7z|tar|tgz)$/i
const HEAVY_WRITERS = /(^|[\s;&|(])(yt-dlp|wget|curl|ffmpeg|cp|mv)\s/
const VENV = /(python3?\s+-m\s+venv|virtualenv|uv\s+venv)(\s+(\S+))?/
const ALLOWED_DIRS = ['batch/inputs/', 'batch/outputs/']

const isWorkspace = (cwd: string) => cwd.endsWith('/claude-code')

// Path relative to the workspace root, or undefined when the path is outside it.
const inside = (p: string, cwd: string): string | undefined => {
  if (p.startsWith('~') || p.startsWith('../')) return undefined
  if (p.startsWith('/')) return p.startsWith(cwd + '/') ? p.slice(cwd.length + 1) : undefined
  return p.replace(/^\.\//, '')
}

const heavyNote = (name: string, what: string) =>
  `${name}: ${what} would sit inside the Syncthing-synced workspace. Keep venvs in ~/.venvs/<name> and raw media or bulk intermediates in a scratch dir; only final deliverables go in batch/outputs/.`

export const register: Register = on => {
  on('tool.call', { tool: 'Read' }, ($, e, next) =>
    /(^|\/)\.gitignore$/.test(e.file_path)
      ? { deny: `${$.plugin.name}: reading .gitignore is off limits in this workspace.` }
      : next(e),
  ).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const cwd = await $.session.root()
    const rel = isWorkspace(cwd) ? inside(e.file_path, cwd) : undefined
    if (rel && HEAVY_EXT.test(rel) && !ALLOWED_DIRS.some(d => rel.startsWith(d)))
      return { deny: heavyNote($.plugin.name, rel) }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const cmd = e.command
    if (GITIGNORE.test(cmd) && READ_VERBS.test(cmd))
      return { deny: `${$.plugin.name}: reading .gitignore is off limits in this workspace.` }

    const cwd = await $.session.root()
    if (!isWorkspace(cwd)) return next(e)

    const venv = VENV.exec(cmd)
    if (venv) {
      const target = venv[3] && !venv[3].startsWith('-') ? venv[3] : '.venv'
      if (inside(target, cwd) !== undefined) return { deny: heavyNote($.plugin.name, `a venv at ${target}`) }
    }

    const writer = HEAVY_WRITERS.exec(cmd)
    if (writer) {
      // ffmpeg, cp and mv read their inputs first; only the last argument is the destination.
      const tokens = cmd.trim().split(/\s+/)
      const targets = ['ffmpeg', 'cp', 'mv'].includes(writer[2]) ? tokens.slice(-1) : tokens
      for (const token of targets) {
        const path = token.replace(/^["']|["']$/g, '')
        if (!HEAVY_EXT.test(path)) continue
        const rel = inside(path, cwd)
        if (rel && !ALLOWED_DIRS.some(d => rel.startsWith(d)))
          return { deny: heavyNote($.plugin.name, rel) }
      }
    }
    return next(e)
  }).catch(($, e, next) => next(e))
}

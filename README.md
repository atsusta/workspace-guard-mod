# workspace-guard

Claude Code mod for the Syncthing-synced `claude-code` workspace. Applies only when the session root ends in `/claude-code`.

- Denies reading `.gitignore` (Read tool and shell read commands).
- Denies creating venvs or heavy media (mp4, mov, psd, safetensors, zip, ...) inside the workspace; `batch/inputs/` and `batch/outputs/` are allowed.
- Fails open: if the mod errors, the call goes through.

## Install

```
/plugin install workspace-guard --marketplace atsusta/workspace-guard-mod
```

Answer `y` to add the marketplace, then pick the user scope.

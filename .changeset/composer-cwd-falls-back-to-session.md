---
"@vincenthanxiaodu/pi-web": patch
---

Typing `/` offers commands again in a session whose workspace has not resolved. The composer looked up slash commands against the selected workspace's directory alone, and the lookup is guarded on a non-empty directory — so a session reached before its workspace landed (a quick-switcher pick into another project, a route restored session-first) silently offered no completions while the rest of the composer kept working. The composer now falls back to the session's own directory, which is what it is composing into.

Also repairs the release gate: the package smoke test still asserted the pre-layout-split terminal service path (`dist/server/terminals/...`), so it failed on a package that was in fact correct.

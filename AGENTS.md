## Approach

- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

## Dependency bumps

- A dependency bump also bumps the `version` field in `package.json`, in the
  same commit as the updated `package.json` and lockfile. Patch level unless
  the bump itself is breaking.
- Tag that commit with the same semver, `v`-prefixed: `v0.1.1` for version
  `0.1.1`. Push the tag along with the commit.

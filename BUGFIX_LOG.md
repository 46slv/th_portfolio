# Bugfix Log

## 2026-07-13: GitHub Pages deployment stopped

### Symptoms

The public GitHub Pages URL returned `404 Site not found`. GitHub Actions deployments had also been failing.

### Cause

`.github/workflows/deploy.yml` contained unresolved Git merge conflict markers and duplicate, malformed job content. GitHub Actions could not run a valid deployment workflow.

### Fix

Removed the conflict markers and retained the known-good Astro build job: checkout, `withastro/action@v3`, and Node.js 22. The existing deployment job is unchanged.

### Prevention

Resolve Git merge conflicts before committing and ensure workflow files remain valid YAML before pushing.

### Verification

- `npm.cmd run build` completes successfully.
- GitHub Actions deployment is dispatched from `main` after this fix is pushed.
- The Pages URL is checked for HTTP 200 after deployment completes.

### Unverified

The production deployment remains unverified until GitHub Actions completes.

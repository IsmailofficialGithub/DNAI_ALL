# Revert Workflow Setup & Usage Guide

## 📋 Prerequisites

### Required Secrets (Optional but Recommended)

For **force push** operations, you may need a Personal Access Token (PAT) with write permissions:

1. **Create a Personal Access Token (PAT)**:
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Give it a name (e.g., "GitHub Actions Revert")
   - Select scopes: `repo` (full control of private repositories)
   - Generate and copy the token

2. **Add PAT to Repository Secrets** (Optional):
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `PAT_TOKEN`
   - Value: Paste your PAT token
   - Click "Add secret"

> **Note**: If you don't add `PAT_TOKEN`, the workflow will use the default `GITHUB_TOKEN` which should work for most cases, but may have limitations with force pushes on protected branches.

### Environment Setup (Production Only)

The production workflow uses the `production` environment which requires approval:

1. Go to your repository → Settings → Environments
2. If "production" environment doesn't exist, create it
3. Configure protection rules (optional):
   - Required reviewers
   - Wait timer
   - Deployment branches

## 🚀 How to Run

### Method 1: Via GitHub Web Interface

1. **Navigate to Actions**:
   - Go to your GitHub repository
   - Click on the **"Actions"** tab

2. **Select Workflow**:
   - In the left sidebar, select:
     - **"Revert Production Code"** for production
     - **"Revert Staging Code"** for staging

3. **Run Workflow**:
   - Click **"Run workflow"** button (top right)
   - Select the branch (usually `main` or `master`)
   - Fill in the options:
     - **Commit SHA** (optional): 
       - Leave empty to revert the last commit
       - Or enter a specific commit SHA (e.g., `abc123def456`)
       - Or enter a tag name (e.g., `v1.0.0`)
     - **Create revert commit**: 
       - `true` (default): Creates a new commit that undoes changes (safer, preserves history)
       - `false`: Performs a hard reset (rewrites history, use with caution)
   - Click **"Run workflow"**

4. **For Production**: 
   - The workflow will wait for manual approval
   - Go to the running workflow → Click "Review deployments" → Approve

### Method 2: Via GitHub CLI

```bash
# Revert staging (last commit)
gh workflow run revert-staging.yml

# Revert production (specific commit)
gh workflow run revert-production.yml \
  -f commit_sha=abc123def456 \
  -f create_revert_commit=true
```

## 📝 Workflow Options Explained

### Commit SHA
- **Empty**: Reverts the last commit
- **Commit SHA**: Reverts to a specific commit (e.g., `abc123def456`)
- **Tag**: Reverts to a specific tag (e.g., `v1.0.0`)

### Create Revert Commit
- **`true`** (Recommended): 
  - Creates a new commit that undoes the changes
  - Preserves git history
  - Safe for shared branches
  - Can be easily undone
  
- **`false`** (Use with caution):
  - Performs a hard reset
  - Rewrites git history
  - Requires force push
  - Can cause issues if others have pulled the branch

## 🔍 Monitoring Workflow Execution

1. Go to **Actions** tab
2. Click on the running workflow
3. Click on the job (e.g., "Revert Production Code")
4. View logs and summary

## ⚠️ Important Notes

- **Production workflow** requires manual approval before execution
- **Force push** operations can be dangerous on protected branches
- Always verify the commit SHA before reverting
- Consider creating a backup branch before reverting
- The workflow validates that the target commit exists and is in branch history

## 🐛 Troubleshooting

### Error: "Permission denied" or "Authentication failed"
- Solution: Add `PAT_TOKEN` secret with a Personal Access Token that has `repo` permissions

### Error: "Target commit is not in current branch history"
- Solution: Make sure the commit SHA exists in the target branch

### Error: "Could not revert commit (might have conflicts)"
- Solution: The revert has merge conflicts. You'll need to resolve them manually or use hard reset

### Production workflow stuck on "Waiting for approval"
- Solution: Go to the workflow run → Click "Review deployments" → Approve the deployment

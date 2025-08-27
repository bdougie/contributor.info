# Windows Setup Guide for contributor.info

This guide covers setting up the contributor.info project on Windows, including both native Windows and WSL2 approaches.

## Table of Contents
- [Recommended Approach: WSL2](#recommended-approach-wsl2)
- [Native Windows Setup](#native-windows-setup)
- [Common Issues and Solutions](#common-issues-and-solutions)
- [Testing Your Setup](#testing-your-setup)

## Recommended Approach: WSL2

WSL2 (Windows Subsystem for Linux 2) provides the best development experience for this project on Windows.

### Prerequisites

1. **Windows 10 version 2004+ or Windows 11**
2. **Enable WSL2**:
   ```powershell
   # Run in PowerShell as Administrator
   wsl --install
   ```
3. **Install Ubuntu from Microsoft Store** (or your preferred Linux distribution)
4. **Docker Desktop for Windows** with WSL2 backend enabled

### WSL2 Setup Steps

1. **Open Ubuntu/WSL2 terminal**

2. **Install Node.js 20+**:
   ```bash
   # Using Node Version Manager (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   source ~/.bashrc
   nvm install 20
   nvm use 20
   ```

3. **Clone the repository**:
   ```bash
   git clone https://github.com/bdougie/contributor.info.git
   cd contributor.info
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Set up environment**:
   ```bash
   cp .env.example .env.local
   # For local development with Supabase
   npm run env:local
   ```

6. **Start local Supabase** (Docker must be running):
   ```bash
   npm run supabase:start
   ```

7. **Run the development server**:
   ```bash
   npm run dev
   ```

### WSL2 Tips

- Access your code from Windows: `\\wsl$\Ubuntu\home\your-username\contributor.info`
- Use VS Code with WSL extension for best experience
- Keep Docker Desktop running in Windows for Supabase
- Files perform better when stored in WSL filesystem rather than `/mnt/c/`

## Native Windows Setup

If you prefer or need to use native Windows without WSL2:

### Prerequisites

1. **Node.js 20+**: Download from [nodejs.org](https://nodejs.org/)
2. **Git for Windows**: Download from [git-scm.com](https://git-scm.com/)
3. **Docker Desktop for Windows**: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
4. **PowerShell 7+** (recommended) or use Command Prompt

### Native Windows Setup Steps

1. **Open PowerShell or Command Prompt**

2. **Clone the repository**:
   ```powershell
   git clone https://github.com/bdougie/contributor.info.git
   cd contributor.info
   ```

3. **Configure Git for line endings**:
   ```powershell
   git config core.autocrlf true
   ```

4. **Install dependencies**:
   ```powershell
   npm install
   ```

5. **Set up environment**:
   ```powershell
   copy .env.example .env.local
   # For local development
   npm run env:local
   ```

6. **Start local Supabase**:
   ```powershell
   # Make sure Docker Desktop is running
   npm run supabase:start
   ```

7. **Run the development server**:
   ```powershell
   npm run dev
   ```

### Windows-Specific npm Scripts

All npm scripts are designed to work cross-platform using `npx`:

```powershell
# Supabase commands (no global install needed)
npm run supabase:start     # Start local Supabase
npm run supabase:stop      # Stop local Supabase
npm run supabase:reset     # Reset database
npm run supabase:status    # Check status

# Environment switching
npm run env:local          # Switch to local Supabase
npm run env:production     # Switch to production (be careful!)

# Development
npm run dev                # Start Vite dev server
npm run build             # Build for production
npm run test              # Run tests
```

## Common Issues and Solutions

### Issue: "supabase: command not found"

**Solution**: The project uses `npx` to avoid global installs. Always use the npm scripts:
```powershell
# ❌ Don't use:
supabase start

# ✅ Use:
npm run supabase:start
```

### Issue: Docker not running

**Error**: "Cannot connect to the Docker daemon"

**Solution**:
1. Start Docker Desktop
2. Wait for it to fully initialize (system tray icon turns green)
3. Try the command again

### Issue: Port conflicts

**Error**: "Port 54321 is already in use"

**Solution**:
```powershell
# Check what's using the port
netstat -ano | findstr :54321

# Stop local Supabase if running
npm run supabase:stop

# Or kill the process using the port
taskkill /PID <process-id> /F
```

### Issue: Line ending problems (CRLF vs LF)

**Solution**:
```powershell
# Configure Git globally
git config --global core.autocrlf true

# Or just for this repo
git config core.autocrlf true

# If you see ESLint errors about line endings
npm run lint -- --fix
```

### Issue: Permission denied errors

**Solution for PowerShell**:
```powershell
# Run PowerShell as Administrator
# Or set execution policy for current user
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue: Long path errors

**Solution**:
```powershell
# Enable long path support in Windows (requires restart)
# Run in PowerShell as Administrator
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

## Testing Your Setup

After setup, verify everything works:

1. **Check Node and npm versions**:
   ```powershell
   node --version  # Should be 20.x or higher
   npm --version   # Should be 10.x or higher
   ```

2. **Check Docker**:
   ```powershell
   docker --version
   docker ps  # Should not error
   ```

3. **Check Supabase status** (after starting):
   ```powershell
   npm run supabase:status
   ```

4. **Access local services**:
   - App: http://localhost:5173 or http://localhost:5174
   - Supabase Studio: http://localhost:54323
   - Supabase API: http://localhost:54321

5. **Run tests**:
   ```powershell
   npm test
   ```

## Environment Variables

The project includes an environment switcher that works on Windows:

```powershell
# Switch to local development (uses local Supabase)
npm run env:local

# Switch to production (uses production Supabase) - BE CAREFUL!
npm run env:production
```

The switcher will:
- Backup your current `.env.local`
- Update URLs and keys automatically
- Show you the current configuration
- Check if Docker is running (for local mode)

## VS Code Recommendations

For the best development experience on Windows:

1. **Install extensions**:
   - WSL (if using WSL2)
   - ESLint
   - Prettier
   - GitLens
   - Docker

2. **Settings for Windows** (`.vscode/settings.json`):
   ```json
   {
     "files.eol": "\n",
     "editor.formatOnSave": true,
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     }
   }
   ```

## Getting Help

If you encounter issues not covered here:

1. Check the [main README](../../README.md)
2. Search [existing issues](https://github.com/bdougie/contributor.info/issues)
3. Ask in discussions or create a new issue
4. For Windows-specific issues, mention your setup (WSL2 or native Windows)

## Next Steps

Once your environment is set up:

1. Read the [Local Development Guide](./LOCAL_DEVELOPMENT.md)
2. Check the [Contributing Guidelines](../../CONTRIBUTING.md)
3. Explore the [Supabase Documentation](../supabase/README.md)
4. Start developing! 🚀
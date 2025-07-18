# Kill all node.exe processes cleanly
Write-Host "🛑 Stopping all Node.js servers..." -ForegroundColor Yellow

try {
    # Get all node processes
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    
    if ($nodeProcesses) {
        Write-Host "Found $($nodeProcesses.Count) Node.js processes:" -ForegroundColor Cyan
        
        foreach ($process in $nodeProcesses) {
            Write-Host "  PID $($process.Id): $($process.ProcessName)" -ForegroundColor Gray
        }
        
        # Try graceful shutdown first
        Write-Host "Attempting graceful shutdown..." -ForegroundColor Green
        $nodeProcesses | ForEach-Object { 
            try {
                $_.CloseMainWindow() | Out-Null
            } catch {
                # Ignore errors for processes without main window
            }
        }
        
        # Wait 2 seconds for graceful shutdown
        Start-Sleep -Seconds 2
        
        # Force kill any remaining processes
        $remainingProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
        if ($remainingProcesses) {
            Write-Host "Force killing remaining processes..." -ForegroundColor Red
            $remainingProcesses | Stop-Process -Force
            Write-Host "✅ Killed $($remainingProcesses.Count) processes" -ForegroundColor Green
        } else {
            Write-Host "✅ All processes stopped gracefully" -ForegroundColor Green
        }
    } else {
        Write-Host "✅ No Node.js processes found" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Error stopping processes: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Server cleanup complete!" -ForegroundColor Green 
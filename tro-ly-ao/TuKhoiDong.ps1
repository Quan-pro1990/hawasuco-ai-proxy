# Cho Trợ lý ảo tự chạy mỗi khi bật máy chủ (Task Scheduler, tài khoản SYSTEM) và mở tường lửa cho cổng của trợ lý.
#   TuKhoiDong.bat          cài / cập nhật tác vụ tự chạy rồi chạy ngay
#   TuKhoiDong.bat -GoBo    gỡ tác vụ tự chạy và quy tắc tường lửa
param([switch]$GoBo)
$ErrorActionPreference = 'Stop'
$tenTacVu = 'TroLyAoGiongNoi'
$thuMuc = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($GoBo) {
    Stop-ScheduledTask -TaskName $tenTacVu -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $tenTacVu -Confirm:$false -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName 'Tro ly ao giong noi' -ErrorAction SilentlyContinue
    Write-Host 'Đã gỡ tác vụ tự chạy và quy tắc tường lửa.'
    return
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Chưa cài Node.js (https://nodejs.org).' }
if (-not (Test-Path (Join-Path $thuMuc 'node_modules\@anthropic-ai\sdk'))) { throw 'Chưa cài thư viện — chạy CaiDat.bat trước.' }
if (-not (Test-Path (Join-Path $thuMuc '.env'))) { throw 'Chưa có file .env — chạy CaiDat.bat trước.' }

# Cổng trong .env (mặc định 8090)
$cong = 8090
$dongCong = Get-Content (Join-Path $thuMuc '.env') -Encoding UTF8 | Where-Object { $_ -match '^\s*CONG\s*=\s*(\d+)' } | Select-Object -Last 1
if ($dongCong -match '(\d+)\s*$') { $cong = [int]$Matches[1] }

$nhatKy = Join-Path $thuMuc 'nhat-ky.log'
$hanhDong = New-ScheduledTaskAction -Execute 'cmd.exe' -WorkingDirectory $thuMuc `
    -Argument "/c `"`"$node`" server.js >> `"$nhatKy`" 2>&1`""
$kichHoat = New-ScheduledTaskTrigger -AtStartup
$caiDat = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$nguoiChay = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Stop-ScheduledTask -TaskName $tenTacVu -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $tenTacVu -Action $hanhDong -Trigger $kichHoat -Settings $caiDat -Principal $nguoiChay -Force | Out-Null

Remove-NetFirewallRule -DisplayName 'Tro ly ao giong noi' -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName 'Tro ly ao giong noi' -Direction Inbound -Protocol TCP -LocalPort $cong -Action Allow | Out-Null

Start-ScheduledTask -TaskName $tenTacVu
Write-Host "Đã cài tác vụ tự chạy '$tenTacVu' (chạy ngay và mỗi khi bật máy), mở tường lửa cổng $cong."
Write-Host "Nhật ký: $nhatKy"
Write-Host 'Sửa .env xong thì khởi động lại: Task Scheduler → TroLyAoGiongNoi → End rồi Run (hoặc chạy lại file này).'

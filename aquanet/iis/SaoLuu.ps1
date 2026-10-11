# Sao lưu AquaNet GIS: CSDL (pg_dump) + ảnh hiện trường. Chạy hằng đêm bằng Task Scheduler
# (CaiDat-IIS.ps1 tự tạo tác vụ "AquaNet GIS - Sao luu"). Chạy tay:  powershell -File SaoLuu.ps1
#
# Bản sao lưu nằm trong <thư mục dữ liệu>\SaoLuu. NÊN chép định kỳ thư mục này sang máy / ổ đĩa khác.
# Khôi phục (cmd, quyền quản trị):
#   "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" -h localhost -U postgres -d capnuoc --clean --if-exists <tệp>.dump
param(
    [string]$DuLieu = "$env:SystemDrive\AquaNetData",
    [string]$PgBin = '',
    [int]$GiuNgay = 30
)
$ErrorActionPreference = 'Stop'
$thuMuc = Join-Path $DuLieu 'SaoLuu'
$nhatKy = Join-Path (Join-Path $DuLieu 'NhatKy') 'saoluu.log'
New-Item -ItemType Directory -Force $thuMuc, (Split-Path $nhatKy) | Out-Null
function Ghi([string]$s) { Add-Content -Path $nhatKy -Value ("{0:yyyy-MM-dd HH:mm:ss} {1}" -f (Get-Date), $s) -Encoding UTF8; Write-Host $s }

try {
    if (-not $PgBin) {
        $PgBin = Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
            Sort-Object { $v = 0; [void][int]::TryParse($_.Directory.Parent.Name, [ref]$v); $v } -Descending |
            Select-Object -First 1 | ForEach-Object { $_.DirectoryName }
    }
    $pgDump = Join-Path $PgBin 'pg_dump.exe'
    if (-not (Test-Path $pgDump)) { throw "Không thấy pg_dump.exe (tham số -PgBin)" }

    # pgpass.conf: host:cổng:csdl:tài khoản:mật khẩu (CaiDat-IIS.ps1 tạo, chỉ quản trị và SYSTEM đọc được)
    $pgpass = Join-Path $DuLieu 'pgpass.conf'
    $dong = Get-Content $pgpass -Encoding UTF8 | Where-Object { $_ -and -not $_.StartsWith('#') } | Select-Object -First 1
    $p = $dong.Split(':')
    $env:PGPASSFILE = $pgpass

    $tep = Join-Path $thuMuc ("{0}_{1:yyyy-MM-dd_HHmm}.dump" -f $p[2], (Get-Date))
    & $pgDump -h $p[0] -p $p[1] -U $p[3] -d $p[2] -Fc --no-password -f $tep
    if ($LASTEXITCODE -ne 0) { throw "pg_dump lỗi (mã $LASTEXITCODE)" }
    Ghi ("Đã sao lưu CSDL: {0} ({1:N1} MB)" -f $tep, ((Get-Item $tep).Length / 1MB))

    # ảnh hiện trường: chép thêm phần mới (không xóa ảnh trong bản sao lưu)
    $anh = Join-Path $DuLieu 'anh'
    if (Test-Path $anh) {
        & robocopy.exe $anh (Join-Path $thuMuc 'anh') /E /XO /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "robocopy ảnh lỗi (mã $LASTEXITCODE)" }
    }

    $cu = @(Get-ChildItem $thuMuc -Filter '*.dump' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$GiuNgay) })
    $cu | Remove-Item
    if ($cu.Count) { Ghi "Đã xóa $($cu.Count) bản sao lưu cũ hơn $GiuNgay ngày" }
    exit 0
}
catch {
    Ghi "LỖI sao lưu: $($_.Exception.Message)"
    exit 1
}
finally {
    Remove-Item Env:\PGPASSFILE -ErrorAction SilentlyContinue
}

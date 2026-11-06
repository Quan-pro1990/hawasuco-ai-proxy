# Đóng gói lại ứng dụng Lưu Vị Trí trên Windows:
#   1) build APK release từ mã nguồn (cần Android Studio, hoặc JDK 17 + Android SDK);
#   2) chép APK + máy chủ vào thư mục CaiDat;
#   3) nén thành LuuViTri-CaiDat.zip (giải nén ra là có CaiDat-DienThoai.bat, CaiDat-MayChu.bat...).
#
# Chạy bằng DongGoi.bat. Tham số: -BoQuaBuild  (chỉ đóng gói lại, dùng CaiDat\LuuViTri.apk đang có)
param([switch]$BoQuaBuild)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$goc = Split-Path -Parent $MyInvocation.MyCommand.Path
$goi = Join-Path $goc 'CaiDat'

function Buoc([string]$s) { Write-Host ''; Write-Host "== $s" -ForegroundColor Cyan }
function Dung([string]$s) { Write-Host ''; Write-Host "LỖI: $s" -ForegroundColor Red; exit 1 }

function TimJdk {
    $ds = @($env:JAVA_HOME,
        "$env:ProgramFiles\Android\Android Studio\jbr",
        "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
        "$env:ProgramFiles\Android\Android Studio\jre")
    foreach ($d in $ds) { if ($d -and (Test-Path (Join-Path $d 'bin\java.exe'))) { return $d } }
    return $null
}

function TimSdk {
    $ds = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk")
    foreach ($d in $ds) { if ($d -and (Test-Path (Join-Path $d 'platforms'))) { return $d } }
    return $null
}

if (-not $BoQuaBuild) {
    Buoc '1. Tìm JDK và Android SDK'
    $jdk = TimJdk
    if (-not $jdk) { Dung 'Không thấy JDK. Cài Android Studio (https://developer.android.com/studio) rồi chạy lại.' }
    $sdk = TimSdk
    if (-not $sdk) { Dung 'Không thấy Android SDK. Mở Android Studio một lần để tải SDK (Android 15 / API 35) rồi chạy lại.' }
    Write-Host "JDK: $jdk"
    Write-Host "SDK: $sdk"
    $lp = Join-Path $goc 'local.properties'
    $sdkDir = ($sdk -replace '\\', '\\') -replace ':', '\:'
    [IO.File]::WriteAllText($lp, "sdk.dir=$sdkDir`r`n", (New-Object Text.UTF8Encoding($false)))
    $env:JAVA_HOME = $jdk

    Buoc '2. Build APK release (lần đầu tải thư viện, mất vài phút)'
    & (Join-Path $goc 'gradlew.bat') --no-daemon assembleRelease
    if ($LASTEXITCODE -ne 0) { Dung 'Build thất bại (xem lỗi ở trên).' }
    Copy-Item (Join-Path $goc 'app\build\outputs\apk\release\app-release.apk') (Join-Path $goi 'LuuViTri.apk') -Force
}

if (-not (Test-Path (Join-Path $goi 'LuuViTri.apk'))) { Dung "Thiếu $goi\LuuViTri.apk" }

Buoc '3. Chép máy chủ vào CaiDat\MayChu'
$mayChu = Join-Path $goi 'MayChu'
New-Item -ItemType Directory -Force -Path $mayChu | Out-Null
foreach ($f in @('live-server.js', 'viewer.html', 'README.md')) {
    Copy-Item (Join-Path $goc "server\$f") $mayChu -Force
}

Buoc '4. Tạo LuuViTri-CaiDat.zip'
$tam = Join-Path $env:TEMP 'LuuViTri-CaiDat'
if (Test-Path $tam) { Remove-Item $tam -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tam | Out-Null
Get-ChildItem $goi | Where-Object { $_.Name -ne 'platform-tools' } | Copy-Item -Destination $tam -Recurse -Force
$zip = Join-Path $goc 'LuuViTri-CaiDat.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $tam -DestinationPath $zip
Remove-Item $tam -Recurse -Force
$kb = [math]::Round((Get-Item $zip).Length / 1KB)
Write-Host ''
Write-Host "Xong: $zip ($kb KB)" -ForegroundColor Green
Write-Host 'Gửi file zip này cho người cài; giải nén rồi nhấp đúp CaiDat-DienThoai.bat.'

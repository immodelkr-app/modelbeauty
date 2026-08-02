$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\myday\.gemini\antigravity\brain\d5a02c20-4fe2-4c20-953a-4607fd558127\official_app_icon_1784467956145.jpg"
$baseRes = Join-Path (Get-Location).Path "android-app\app\src\main\res"

$densities = [ordered]@{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

$srcImage = [System.Drawing.Image]::FromFile($srcPath)

foreach ($dir in $densities.Keys) {
    $size = $densities[$dir]
    $targetDir = [System.IO.Path]::Combine($baseRes, $dir)
    if (-not [System.IO.Directory]::Exists($targetDir)) {
        [System.IO.Directory]::CreateDirectory($targetDir) | Out-Null
    }

    $destBmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcImage, 0, 0, $size, $size)
    $g.Dispose()

    $iconPath = [System.IO.Path]::Combine($targetDir, "ic_launcher.png")
    $roundIconPath = [System.IO.Path]::Combine($targetDir, "ic_launcher_round.png")

    $destBmp.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Save($roundIconPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()

    Write-Host "Generated icons for $dir ($size x $size)"
}

$srcImage.Dispose()
Write-Host "SUCCESSFULLY_GENERATED_ALL_ICONS"

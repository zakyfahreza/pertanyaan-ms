Add-Type -AssemblyName System.Drawing

$src = 'E:\Tanya MS\img\muslimsolo.png'
$dst = 'E:\Tanya MS\img\muslimsolo-transparent.png'

# Muat gambar dan salin ke kanvas 32bpp ARGB
$orig = [System.Drawing.Image]::FromFile($src)
$bmp  = New-Object System.Drawing.Bitmap $orig.Width, $orig.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($orig, 0, 0, $orig.Width, $orig.Height)
$g.Dispose()
$orig.Dispose()

$w = $bmp.Width; $h = $bmp.Height
$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ptr = $data.Scan0
$len = $w * $h * 4
$buf = New-Object byte[] $len
[System.Runtime.InteropServices.Marshal]::Copy($ptr, $buf, 0, $len)

# Format byte: B, G, R, A
for ($i = 0; $i -lt $len; $i += 4) {
  $b = $buf[$i]; $gr = $buf[$i+1]; $r = $buf[$i+2]
  $max = [Math]::Max($r, [Math]::Max($gr, $b))
  $min = [Math]::Min($r, [Math]::Min($gr, $b))
  # Piksel abu/hitam/putih (low saturation) -> alpha mengikuti kecerahan,
  # sehingga hitam jadi transparan & tepi putih ter-feather halus.
  # Piksel berwarna (mis. navy) -> tetap opaque, warna asli terjaga.
  if (($max - $min) -lt 30) {
    $buf[$i+3] = [byte]$max
  } else {
    $buf[$i+3] = 255
  }
}

[System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $ptr, $len)
$bmp.UnlockBits($data)
$bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output ("OK: {0} ({1}x{2})" -f $dst, $w, $h)

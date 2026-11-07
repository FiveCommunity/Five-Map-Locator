$ErrorActionPreference = "Stop"

$releaseDir = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\release")
$exePath = Join-Path $releaseDir "Five Map Locator.exe"
$unpackedExe = Join-Path $releaseDir "win-unpacked\Five Map Locator.exe"

# 1. Reuse or create RSA-2048 / SHA-256 Code Signing Certificate in CurrentUser\My (non-interactive!)
$subject = "CN=FiveCommunity, O=Five Map Locator"
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -eq $subject } | Select-Object -First 1

if (-not $cert) {
    Write-Output "[Sign] Creating RSA-2048 / SHA-256 Code Signing Certificate..."
    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $subject `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm SHA256 `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -NotAfter (Get-Date).AddYears(5)
}

# Export public certificate (.cer) so any PC can trust the publisher if desired
$cerPath = Join-Path $releaseDir "FiveCommunity-Certificado.cer"
Export-Certificate -Cert $cert -FilePath $cerPath -Force | Out-Null

# 2. Apply SHA-256 Authenticode Signature directly to executables
if (Test-Path $unpackedExe) {
    try {
        Set-AuthenticodeSignature -FilePath $unpackedExe -Certificate $cert -HashAlgorithm SHA256 | Out-Null
    } catch {
        Write-Output "[Sign] Skipped win-unpacked (currently running)."
    }
}

if (Test-Path $exePath) {
    $sig = Set-AuthenticodeSignature -FilePath $exePath -Certificate $cert -HashAlgorithm SHA256
    Write-Output "[Sign] Signed Five Map Locator.exe | HashAlgorithm: SHA256 | Subject: $($sig.SignerCertificate.Subject) | Thumbprint: $($sig.SignerCertificate.Thumbprint)"

    # 3. Generate official .sha256 checksum file
    $hash = (Get-FileHash -Path $exePath -Algorithm SHA256).Hash.ToLower()
    $shaFile = "$exePath.sha256"
    "$hash *Five Map Locator.exe" | Set-Content -Path $shaFile -Encoding UTF8
    Write-Output "[SHA256] $hash  Five Map Locator.exe"
} else {
    throw "Executable not found at $exePath"
}

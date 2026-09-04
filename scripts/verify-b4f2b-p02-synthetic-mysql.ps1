param()

$scriptArguments = @($args)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$gateSha = '44deadc0e89616b31524efed6f70faa2c89e838c'
$acceptedContractSha = '33b29ddd80e198725605a85892fb6855437ab061'
$imageDigest = 'sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb'
$imageReference = "mysql@$imageDigest"
$imageId = $imageDigest
$proofLabel = 'com.crewframe.proof=CF-P1-B4F2B-P02'
$proofLabelValue = 'CF-P1-B4F2B-P02'
$containerPrefix = 'crewframe-b4f2b-p02-'
$dockerCommandTimeoutMilliseconds = 30000
$dockerTerminationTimeoutMilliseconds = 5000
$dockerExecutable = $null
$activeDockerProcessCount = 0
$repositoryRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$fixturePath = 'tests/fixtures/mysql/b4f2b-p02-synthetic-schema.sql'
$b4dPath = 'docs/execution/sql/CF-P1-B4D-logical-subscription-plan-expand.sql'
$b4f1Path = 'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql'
$manifestPath = 'docs/architecture/CF-P1-B4F2B-boundary-p-manifest.json'
$outputPath = 'docs/evidence/CF-P1-B4F2B-P02-synthetic-mysql.json'

$forbiddenEnvironmentKeys = @(
  'DATABASE_URL',
  'DIRECT_URL',
  'DOCKER_CERT_PATH',
  'DOCKER_CONTEXT',
  'DOCKER_HOST',
  'DOCKER_TLS_VERIFY',
  'MYSQL_DATABASE',
  'MYSQL_HOST',
  'MYSQL_PWD',
  'MYSQL_ROOT_PASSWORD',
  'MYSQL_TCP_PORT',
  'PLANETSCALE_SERVICE_TOKEN'
)

$expectedNormalizedHashes = [ordered]@{
  'docs/architecture/CF-P1-B4F2B-boundary-p-manifest.json' = '6f7cf321bdd9706065549d6889fee4ce9e6dbb091df36398924708d1b9495855'
  'docs/architecture/schemas/CF-P1-B4F2B-boundary-p.schema.json' = 'ca44a93606eba430a3b19a78e24669942367e81cdfbc7cf6f69787d6c607f804'
  'docs/templates/CF-P1-B4F2B-boundary-r-authorization.json' = 'c06999c748cb71918b72e53fb3bc5e7af9016a2845b9f04f7f9e8295b60f3134'
  'docs/templates/CF-P1-B4F2B-boundary-r-evidence.json' = '6cc24d5114e054cdd1a4514f9ac8a1aca4dc5854f7285c21ea003aab4aa7d5b0'
  'docs/issues/CF-P1-B4F2B-P02-disposable-synthetic-mysql-proof.md' = '2e0928f6ad5f63f5305a9be241eeecfa42e863042dcc0f70163c906907666c4f'
  'scripts/verify-b4f2b-boundary-p.ts' = '72398ac72247b08f22640c9bc4305cf8575e5268f4650b814e8b5ffb0f34fd1e'
  'tests/fixtures/mysql/b4f2b-p02-synthetic-schema.sql' = '196913a510fc2165c2f4d1ed649a6b6a94124150a8a8f3d09654c913a291d52e'
  'docs/execution/sql/CF-P1-B4D-logical-subscription-plan-expand.sql' = '986397f506dcf9f9d1d163ddda6e403abdcec98da3edfb5dc172a2f279eb6fe7'
  'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql' = '66195477220c545cc75efad4d269443ff0cc0492e2631e6a113cbee6f0f9621d'
}

function Assert-InsideRepository {
  param([Parameter(Mandatory = $true)][string]$Candidate)

  $rootWithSeparator = $repositoryRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  $fullCandidate = [IO.Path]::GetFullPath($Candidate)
  if (-not $fullCandidate.StartsWith($rootWithSeparator, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'PATH_ESCAPE'
  }
}

function Assert-NoReparsePathComponents {
  param(
    [Parameter(Mandatory = $true)][string]$Candidate,
    [switch]$AllowMissingLeaf
  )

  $fullCandidate = [IO.Path]::GetFullPath($Candidate)
  Assert-InsideRepository -Candidate $fullCandidate
  $rootItem = Get-Item -Force -LiteralPath $repositoryRoot
  if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'REPOSITORY_ROOT_REPARSE_FORBIDDEN'
  }
  $relativePath = [IO.Path]::GetRelativePath($repositoryRoot, $fullCandidate)
  if ($relativePath -eq '.') { return }
  $components = @($relativePath -split '[\\/]')
  $currentPath = $repositoryRoot
  for ($index = 0; $index -lt $components.Count; $index++) {
    $currentPath = Join-Path $currentPath $components[$index]
    $item = Get-Item -Force -LiteralPath $currentPath -ErrorAction SilentlyContinue
    if (-not $item) {
      if ($AllowMissingLeaf -and $index -eq ($components.Count - 1)) { return }
      throw 'PATH_COMPONENT_MISSING'
    }
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'PATH_COMPONENT_REPARSE_FORBIDDEN'
    }
    if ($index -lt ($components.Count - 1) -and -not $item.PSIsContainer) {
      throw 'PATH_COMPONENT_NOT_DIRECTORY'
    }
  }
}

function Get-FixedFile {
  param([Parameter(Mandatory = $true)][string]$RelativePath)

  $candidate = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $RelativePath))
  Assert-InsideRepository -Candidate $candidate
  Assert-NoReparsePathComponents -Candidate $candidate
  $item = Get-Item -Force -LiteralPath $candidate
  if ($item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw 'FIXED_INPUT_NOT_REGULAR'
  }
  Assert-InsideRepository -Candidate $item.FullName
  return $item.FullName
}

function Get-NormalizedText {
  param([Parameter(Mandatory = $true)][string]$RelativePath)

  $fullPath = Get-FixedFile -RelativePath $RelativePath
  $text = [IO.File]::ReadAllText($fullPath, [Text.UTF8Encoding]::new($false, $true))
  return $text.Replace("`r`n", "`n").TrimEnd() + "`n"
}

function Get-Sha256Hex {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)

  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    return ([Convert]::ToHexString($algorithm.ComputeHash($Bytes))).ToLowerInvariant()
  }
  finally {
    $algorithm.Dispose()
  }
}

function Get-NormalizedSha256 {
  param([Parameter(Mandatory = $true)][string]$RelativePath)

  $bytes = [Text.UTF8Encoding]::new($false).GetBytes((Get-NormalizedText -RelativePath $RelativePath))
  return Get-Sha256Hex -Bytes $bytes
}

function Get-GitBlobSha1 {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][bool]$Binary
  )

  $fullPath = Get-FixedFile -RelativePath $RelativePath
  if ($Binary) {
    [byte[]]$content = [IO.File]::ReadAllBytes($fullPath)
  }
  else {
    $text = [IO.File]::ReadAllText($fullPath, [Text.UTF8Encoding]::new($false, $true)).Replace("`r`n", "`n")
    [byte[]]$content = [Text.UTF8Encoding]::new($false).GetBytes($text)
  }
  [byte[]]$header = [Text.Encoding]::ASCII.GetBytes("blob $($content.Length)`0")
  [byte[]]$combined = [byte[]]::new($header.Length + $content.Length)
  [Array]::Copy($header, 0, $combined, 0, $header.Length)
  [Array]::Copy($content, 0, $combined, $header.Length, $content.Length)
  $algorithm = [Security.Cryptography.SHA1]::Create()
  try {
    return ([Convert]::ToHexString($algorithm.ComputeHash($combined))).ToLowerInvariant()
  }
  finally {
    $algorithm.Dispose()
  }
}

function Assert-FixedInputs {
  foreach ($entry in $expectedNormalizedHashes.GetEnumerator()) {
    if ((Get-NormalizedSha256 -RelativePath $entry.Key) -ne $entry.Value) {
      throw 'NORMALIZED_INPUT_DRIFT'
    }
  }

  $manifest = Get-NormalizedText -RelativePath $manifestPath | ConvertFrom-Json
  if ($manifest.gateSha -ne 'ab10c304d0a94b26ccfa460c6cb2dff8c4fe1f93') {
    throw 'MANIFEST_GATE_DRIFT'
  }
  foreach ($surface in $manifest.protectedSurfaces) {
    $isBinary = $surface.path -eq 'bun.lockb'
    if ((Get-GitBlobSha1 -RelativePath $surface.path -Binary $isBinary) -ne $surface.gateBlobSha1) {
      throw 'PROTECTED_SURFACE_DRIFT'
    }
  }

  $fixture = Get-NormalizedText -RelativePath $fixturePath
  if ($fixture -match '(?i)\b(ALTER|CREATE|DROP|TRUNCATE)\s+(TABLE\s+)?`?Permissions`?') {
    throw 'PERMISSION_DDL_FORBIDDEN'
  }
}

function Invoke-DockerCapture {
  param(
    [Parameter(Mandatory = $true)][string[]]$DockerArguments,
    [string]$InputText,
    [switch]$AllowFailure
  )

  if (-not $script:dockerExecutable) { throw 'DOCKER_EXECUTABLE_UNRESOLVED' }
  $startInfo = [Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $script:dockerExecutable
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.RedirectStandardInput = $PSBoundParameters.ContainsKey('InputText')
  foreach ($argument in $DockerArguments) {
    $startInfo.ArgumentList.Add($argument)
  }
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  $processStarted = $false
  $timedOut = $false
  try {
    if (-not $process.Start()) { throw 'DOCKER_PROCESS_START_FAILED' }
    $processStarted = $true
    $script:activeDockerProcessCount = $script:activeDockerProcessCount + 1
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if ($PSBoundParameters.ContainsKey('InputText')) {
      $stdinTask = $process.StandardInput.WriteAsync($InputText)
      if (-not $stdinTask.Wait($dockerCommandTimeoutMilliseconds)) {
        $timedOut = $true
      }
      else {
        $null = $stdinTask.GetAwaiter().GetResult()
        $process.StandardInput.Close()
      }
    }
    if (-not $timedOut -and -not $process.WaitForExit($dockerCommandTimeoutMilliseconds)) {
      $timedOut = $true
    }
    if ($timedOut) {
      try { $process.Kill($true) } catch { }
      if (-not $process.WaitForExit($dockerTerminationTimeoutMilliseconds)) {
        throw 'DOCKER_PROCESS_TERMINATION_FAILED'
      }
    }
    if (-not $stdoutTask.Wait($dockerTerminationTimeoutMilliseconds)) {
      throw 'DOCKER_STDOUT_TIMEOUT'
    }
    if (-not $stderrTask.Wait($dockerTerminationTimeoutMilliseconds)) {
      throw 'DOCKER_STDERR_TIMEOUT'
    }
    $stdout = $stdoutTask.GetAwaiter().GetResult().Replace("`r`n", "`n").TrimEnd([char[]]"`n")
    $null = $stderrTask.GetAwaiter().GetResult()
    if ($timedOut) { throw 'DOCKER_COMMAND_TIMEOUT' }
    $exitCode = $process.ExitCode
    $captured = if ($stdout.Length -eq 0) { @() } else { @($stdout -split "`n") }
  }
  finally {
    $cleanupTerminationFailed = $false
    if ($processStarted -and -not $process.HasExited) {
      try { $process.Kill($true) } catch { }
      if (-not $process.WaitForExit($dockerTerminationTimeoutMilliseconds)) {
        $cleanupTerminationFailed = $true
      }
    }
    $process.Dispose()
    if ($processStarted) {
      $script:activeDockerProcessCount = $script:activeDockerProcessCount - 1
    }
    if ($cleanupTerminationFailed) { throw 'DOCKER_PROCESS_CLEANUP_FAILED' }
  }
  $lines = [Collections.Generic.List[string]]::new()
  foreach ($line in $captured) { $lines.Add([string]$line) }
  if (-not $AllowFailure -and $exitCode -ne 0) {
    throw 'DOCKER_COMMAND_FAILED'
  }
  return [pscustomobject]@{
    ExitCode = $exitCode
    Lines = $lines
  }
}

function Assert-LocalDockerAndImage {
  $context = Invoke-DockerCapture -DockerArguments @('context', 'show')
  if ($context.Lines.Count -ne 1) { throw 'DOCKER_CONTEXT_AMBIGUOUS' }
  $endpoint = Invoke-DockerCapture -DockerArguments @(
    'context', 'inspect', $context.Lines[0],
    '--format', '{{(index .Endpoints "docker").Host}}'
  )
  if ($endpoint.Lines.Count -ne 1 -or -not $endpoint.Lines[0].StartsWith('npipe://', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'DOCKER_ENDPOINT_NOT_LOCAL'
  }

  $image = Invoke-DockerCapture -DockerArguments @(
    'image', 'inspect', $imageReference,
    '--format', '{{.Id}}|{{.Os}}|{{.Architecture}}|{{json .RepoDigests}}|{{json .Config.Volumes}}'
  )
  if ($image.Lines.Count -ne 1) { throw 'IMAGE_IDENTITY_AMBIGUOUS' }
  $identity = $image.Lines[0]
  if (
    -not $identity.StartsWith("$imageId|linux|amd64|", [StringComparison]::Ordinal) -or
    -not $identity.Contains("mysql@$imageDigest", [StringComparison]::Ordinal) -or
    -not $identity.Contains('"/var/lib/mysql"', [StringComparison]::Ordinal)
  ) {
    throw 'IMAGE_IDENTITY_MISMATCH'
  }
}

function Invoke-MySql {
  param(
    [Parameter(Mandatory = $true)][string]$ContainerName,
    [Parameter(Mandatory = $true)][string]$Sql,
    [string]$Database,
    [switch]$AllowFailure
  )

  $arguments = @(
    'exec', '--interactive', $ContainerName,
    'mysql', '--protocol=SOCKET', '--user=root',
    '--batch', '--raw', '--skip-column-names'
  )
  if ($Database) { $arguments += "--database=$Database" }
  return Invoke-DockerCapture -DockerArguments $arguments -InputText $Sql -AllowFailure:$AllowFailure
}

function Wait-ForMySql {
  param([Parameter(Mandatory = $true)][string]$ContainerName)

  for ($attempt = 0; $attempt -lt 90; $attempt++) {
    $probe = Invoke-DockerCapture -DockerArguments @(
      'exec', $ContainerName,
      'mysqladmin', '--protocol=SOCKET', '--user=root', '--silent', 'ping'
    ) -AllowFailure
    if ($probe.ExitCode -eq 0) {
      Start-Sleep -Seconds 5
      $stable = Invoke-MySql -ContainerName $ContainerName -Sql 'SELECT 1;' -AllowFailure
      if ($stable.ExitCode -eq 0 -and $stable.Lines.Count -eq 1 -and $stable.Lines[0] -eq '1') {
        return
      }
    }
    Start-Sleep -Seconds 1
  }
  throw 'MYSQL_NOT_READY'
}

function Assert-Scalar {
  param(
    [Parameter(Mandatory = $true)][pscustomobject]$Result,
    [Parameter(Mandatory = $true)][string]$Expected
  )

  if ($Result.ExitCode -ne 0 -or $Result.Lines.Count -ne 1 -or $Result.Lines[0] -cne $Expected) {
    throw 'MYSQL_SCALAR_MISMATCH'
  }
}

function Assert-ExactSet {
  param(
    [Parameter(Mandatory = $true)][string[]]$Actual,
    [Parameter(Mandatory = $true)][string[]]$Expected
  )

  $actualSorted = @($Actual | Sort-Object)
  $expectedSorted = @($Expected | Sort-Object)
  if ($actualSorted.Count -ne $expectedSorted.Count) { throw 'MYSQL_SET_SIZE_MISMATCH' }
  for ($index = 0; $index -lt $expectedSorted.Count; $index++) {
    if ($actualSorted[$index] -cne $expectedSorted[$index]) {
      throw 'MYSQL_SET_VALUE_MISMATCH'
    }
  }
}

function Assert-ContainerIsolation {
  param([Parameter(Mandatory = $true)][string]$ContainerName)

  Assert-Scalar -Result (Invoke-DockerCapture -DockerArguments @(
    'inspect', '--format', '{{.HostConfig.NetworkMode}}', $ContainerName
  )) -Expected 'none'
  $ports = Invoke-DockerCapture -DockerArguments @(
    'inspect', '--format', '{{json .HostConfig.PortBindings}}', $ContainerName
  )
  if ($ports.Lines.Count -ne 1 -or $ports.Lines[0] -notin @('{}', 'null')) {
    throw 'PUBLISHED_PORT_FORBIDDEN'
  }
  $binds = Invoke-DockerCapture -DockerArguments @(
    'inspect', '--format', '{{json .HostConfig.Binds}}', $ContainerName
  )
  if ($binds.Lines.Count -ne 1 -or $binds.Lines[0] -ne 'null') {
    throw 'BIND_MOUNT_FORBIDDEN'
  }
}

function Get-AnonymousDataVolume {
  param([Parameter(Mandatory = $true)][string]$ContainerName)

  $mounts = Invoke-DockerCapture -DockerArguments @(
    'inspect', '--format', '{{range .Mounts}}{{println .Type .Destination .Name}}{{end}}', $ContainerName
  )
  $lines = @($mounts.Lines | Where-Object { $_ -and $_.Trim().Length -gt 0 })
  if ($lines.Count -ne 1) { throw 'UNEXPECTED_MOUNT_SET' }
  $parts = @($lines[0] -split '\s+')
  if (
    $parts.Count -ne 3 -or
    $parts[0] -ne 'volume' -or
    $parts[1] -ne '/var/lib/mysql' -or
    $parts[2] -notmatch '^[a-f0-9]{64}$'
  ) {
    throw 'UNEXPECTED_DATA_VOLUME'
  }
  return $parts[2]
}

function Assert-ZeroProofContainers {
  $remaining = Invoke-DockerCapture -DockerArguments @(
    'ps', '--all', '--quiet', '--filter', "label=$proofLabel"
  ) -AllowFailure
  if ($remaining.ExitCode -ne 0) {
    Start-Sleep -Milliseconds 250
    $remaining = Invoke-DockerCapture -DockerArguments @(
      'ps', '--all', '--quiet', '--filter', "label=$proofLabel"
    ) -AllowFailure
  }
  if ($remaining.ExitCode -ne 0) { throw 'PROOF_CONTAINER_QUERY_FAILED' }
  if ($remaining.Lines.Count -ne 0) { throw 'PROOF_CONTAINER_REMAINS' }
}

function Test-ExactProofContainerPresent {
  param([Parameter(Mandatory = $true)][string]$ContainerName)

  $result = Invoke-DockerCapture -DockerArguments @(
    'ps', '--all',
    '--filter', "name=^/$ContainerName$",
    '--format', '{{.Names}}|{{.Label "com.crewframe.proof"}}'
  )
  if ($result.Lines.Count -eq 0) { return $false }
  if ($result.Lines.Count -ne 1 -or $result.Lines[0] -cne "$ContainerName|$proofLabelValue") {
    throw 'EXACT_CONTAINER_IDENTITY_MISMATCH'
  }
  $image = Invoke-DockerCapture -DockerArguments @(
    'container', 'inspect', '--format', '{{.Image}}', $ContainerName
  )
  if ($image.Lines.Count -ne 1 -or $image.Lines[0] -cne $imageId) {
    throw 'EXACT_CONTAINER_IMAGE_MISMATCH'
  }
  return $true
}

function Find-ExactProofContainerAfterRun {
  param([Parameter(Mandatory = $true)][string]$ContainerName)

  $queryFailed = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
      if (Test-ExactProofContainerPresent -ContainerName $ContainerName) {
        return $true
      }
    }
    catch {
      $queryFailed = $true
    }
    Start-Sleep -Milliseconds 250
  }
  if ($queryFailed) { throw 'AMBIGUOUS_CONTAINER_RECONCILIATION' }
  return $false
}

function Assert-ExactVolumeAbsent {
  param([Parameter(Mandatory = $true)][string]$VolumeName)

  $result = Invoke-DockerCapture -DockerArguments @(
    'volume', 'ls', '--quiet', '--filter', "name=^$VolumeName$"
  )
  if ($result.Lines.Count -ne 0) { throw 'EXACT_VOLUME_REMAINS' }
}

function Invoke-LogicalPlanProof {
  param([Parameter(Mandatory = $true)][string]$ContainerName)

  $b4d = Get-NormalizedText -RelativePath $b4dPath
  $applied = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_logical_good' -Sql $b4d
  if ($applied.ExitCode -ne 0) { throw 'LOGICAL_DDL_FAILED' }
  Assert-Scalar -Result (Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_logical_good' -Sql @'
SELECT CONCAT(DATA_TYPE, '|', COLUMN_TYPE, '|', IS_NULLABLE)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Subscription'
  AND COLUMN_NAME = 'logicalPlan';
'@) -Expected "enum|enum('BASIC','UNLIMITED')|YES"

  $backfill = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_logical_good' -Sql @'
UPDATE `Subscription`
SET `logicalPlan` = 'UNLIMITED'
WHERE `id` = 'record_e';

UPDATE `Subscription`
SET `logicalPlan` = CASE
  WHEN `plan` = 'LEGACY_BASIC' THEN 'BASIC'
  WHEN `plan` = 'LEGACY_UNLIMITED' THEN 'UNLIMITED'
  ELSE NULL
END
WHERE `logicalPlan` IS NULL;
'@
  if ($backfill.ExitCode -ne 0) { throw 'SYNTHETIC_BACKFILL_FAILED' }
  Assert-Scalar -Result (Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_logical_good' -Sql @'
SELECT CONCAT(
  COUNT(*), '|',
  SUM(`plan` IS NOT NULL), '|',
  SUM(`price` IS NOT NULL), '|',
  SUM(`plan` = 'LEGACY_BASIC' AND `logicalPlan` = 'BASIC'), '|',
  SUM(`plan` = 'LEGACY_UNLIMITED' AND `logicalPlan` = 'UNLIMITED'), '|',
  SUM(`logicalPlan` IS NULL), '|',
  SUM(`plan` = 'LEGACY_BASIC' AND `logicalPlan` = 'UNLIMITED')
)
FROM `Subscription`;
'@) -Expected '5|4|5|1|1|2|1'

  $repeat = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_logical_good' -Sql $b4d -AllowFailure
  if ($repeat.ExitCode -eq 0) { throw 'REPEATED_LOGICAL_DDL_NOT_REJECTED' }
  $incompatible = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_logical_bad' -Sql $b4d -AllowFailure
  if ($incompatible.ExitCode -eq 0) { throw 'INCOMPATIBLE_LOGICAL_DDL_NOT_REJECTED' }
  Assert-Scalar -Result (Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_logical_bad' -Sql @'
SELECT CONCAT(DATA_TYPE, '|', COLUMN_TYPE, '|', IS_NULLABLE)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Subscription'
  AND COLUMN_NAME = 'logicalPlan';
'@) -Expected 'varchar|varchar(32)|YES'
}

function Invoke-WebhookProof {
  param([Parameter(Mandatory = $true)][string]$ContainerName)

  $b4f1 = Get-NormalizedText -RelativePath $b4f1Path
  $applied = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_webhook_good' -Sql $b4f1
  if ($applied.ExitCode -ne 0) { throw 'WEBHOOK_DDL_FAILED' }

  $expectedColumns = @(
    'StripeWebhookObjectLease|1|id|varchar(191)|NO',
    "StripeWebhookObjectLease|2|mode|enum('TEST','LIVE')|NO",
    'StripeWebhookObjectLease|3|accountScopeKey|varchar(255)|NO',
    'StripeWebhookObjectLease|4|objectType|varchar(64)|NO',
    'StripeWebhookObjectLease|5|objectId|varchar(255)|NO',
    'StripeWebhookObjectLease|6|leaseToken|varchar(64)|NO',
    'StripeWebhookObjectLease|7|leaseExpiresAt|datetime(3)|NO',
    'StripeWebhookObjectLease|8|createdAt|datetime(3)|NO',
    'StripeWebhookObjectLease|9|updatedAt|datetime(3)|NO',
    'StripeWebhookReceipt|1|id|varchar(191)|NO',
    "StripeWebhookReceipt|2|mode|enum('TEST','LIVE')|NO",
    'StripeWebhookReceipt|3|accountScopeKey|varchar(255)|NO',
    'StripeWebhookReceipt|4|eventId|varchar(255)|NO',
    'StripeWebhookReceipt|5|eventType|varchar(255)|NO',
    'StripeWebhookReceipt|6|providerCreatedAt|datetime(3)|NO',
    'StripeWebhookReceipt|7|objectId|varchar(255)|YES',
    'StripeWebhookReceipt|8|subscriptionId|varchar(255)|YES',
    'StripeWebhookReceipt|9|customerId|varchar(255)|YES',
    'StripeWebhookReceipt|10|payloadHash|char(64)|NO',
    "StripeWebhookReceipt|11|status|enum('RECEIVED','PROCESSING','RETRY_PENDING','SUCCEEDED','IGNORED','DEAD_LETTER')|NO",
    'StripeWebhookReceipt|12|attempts|int|NO',
    'StripeWebhookReceipt|13|leaseToken|varchar(64)|YES',
    'StripeWebhookReceipt|14|leaseExpiresAt|datetime(3)|YES',
    'StripeWebhookReceipt|15|nextRetryAt|datetime(3)|YES',
    'StripeWebhookReceipt|16|lastErrorCode|varchar(64)|YES',
    'StripeWebhookReceipt|17|lastErrorMessage|varchar(240)|YES',
    'StripeWebhookReceipt|18|retentionExpiresAt|datetime(3)|NO',
    'StripeWebhookReceipt|19|completedAt|datetime(3)|YES',
    'StripeWebhookReceipt|20|createdAt|datetime(3)|NO',
    'StripeWebhookReceipt|21|updatedAt|datetime(3)|NO',
    'StripeWebhookReplayAudit|1|id|varchar(191)|NO',
    'StripeWebhookReplayAudit|2|receiptId|varchar(191)|NO',
    'StripeWebhookReplayAudit|3|actorId|varchar(191)|NO',
    'StripeWebhookReplayAudit|4|reason|varchar(240)|NO',
    'StripeWebhookReplayAudit|5|dryRun|tinyint(1)|NO',
    "StripeWebhookReplayAudit|6|outcome|enum('REQUESTED','DRY_RUN_READY','ENQUEUED','REJECTED','FAILED')|NO",
    'StripeWebhookReplayAudit|7|safeErrorCode|varchar(64)|YES',
    'StripeWebhookReplayAudit|8|safeErrorMessage|varchar(240)|YES',
    'StripeWebhookReplayAudit|9|requestedAt|datetime(3)|NO',
    'StripeWebhookReplayAudit|10|completedAt|datetime(3)|YES'
  )
  $columns = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_webhook_good' -Sql @'
SELECT CONCAT(TABLE_NAME, '|', ORDINAL_POSITION, '|', COLUMN_NAME, '|', COLUMN_TYPE, '|', IS_NULLABLE)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('StripeWebhookReceipt', 'StripeWebhookObjectLease', 'StripeWebhookReplayAudit');
'@
  if ($columns.ExitCode -ne 0) { throw 'WEBHOOK_COLUMN_QUERY_FAILED' }
  Assert-ExactSet -Actual $columns.Lines -Expected $expectedColumns

  $expectedIndexes = @(
    'StripeWebhookObjectLease|PRIMARY|0|1|id',
    'StripeWebhookObjectLease|StripeWebhookObjectLease_leaseExpiresAt_idx|1|1|leaseExpiresAt',
    'StripeWebhookObjectLease|stripe_webhook_object_identity|0|1|mode',
    'StripeWebhookObjectLease|stripe_webhook_object_identity|0|2|accountScopeKey',
    'StripeWebhookObjectLease|stripe_webhook_object_identity|0|3|objectType',
    'StripeWebhookObjectLease|stripe_webhook_object_identity|0|4|objectId',
    'StripeWebhookReceipt|PRIMARY|0|1|id',
    'StripeWebhookReceipt|StripeWebhookReceipt_leaseExpiresAt_idx|1|1|leaseExpiresAt',
    'StripeWebhookReceipt|StripeWebhookReceipt_retentionExpiresAt_idx|1|1|retentionExpiresAt',
    'StripeWebhookReceipt|StripeWebhookReceipt_status_nextRetryAt_idx|1|1|status',
    'StripeWebhookReceipt|StripeWebhookReceipt_status_nextRetryAt_idx|1|2|nextRetryAt',
    'StripeWebhookReceipt|StripeWebhookReceipt_subscriptionId_idx|1|1|subscriptionId',
    'StripeWebhookReceipt|stripe_webhook_identity|0|1|mode',
    'StripeWebhookReceipt|stripe_webhook_identity|0|2|accountScopeKey',
    'StripeWebhookReceipt|stripe_webhook_identity|0|3|eventId',
    'StripeWebhookReplayAudit|PRIMARY|0|1|id',
    'StripeWebhookReplayAudit|StripeWebhookReplayAudit_actorId_requestedAt_idx|1|1|actorId',
    'StripeWebhookReplayAudit|StripeWebhookReplayAudit_actorId_requestedAt_idx|1|2|requestedAt',
    'StripeWebhookReplayAudit|StripeWebhookReplayAudit_receiptId_requestedAt_idx|1|1|receiptId',
    'StripeWebhookReplayAudit|StripeWebhookReplayAudit_receiptId_requestedAt_idx|1|2|requestedAt'
  )
  $indexes = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_webhook_good' -Sql @'
SELECT CONCAT(TABLE_NAME, '|', INDEX_NAME, '|', NON_UNIQUE, '|', SEQ_IN_INDEX, '|', COLUMN_NAME)
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('StripeWebhookReceipt', 'StripeWebhookObjectLease', 'StripeWebhookReplayAudit');
'@
  if ($indexes.ExitCode -ne 0) { throw 'WEBHOOK_INDEX_QUERY_FAILED' }
  Assert-ExactSet -Actual $indexes.Lines -Expected $expectedIndexes

  $expectedDefaults = @(
    'StripeWebhookObjectLease|createdAt|CURRENT_TIMESTAMP(3)',
    'StripeWebhookReceipt|attempts|0',
    'StripeWebhookReceipt|createdAt|CURRENT_TIMESTAMP(3)',
    'StripeWebhookReceipt|status|RECEIVED',
    'StripeWebhookReplayAudit|dryRun|1',
    'StripeWebhookReplayAudit|outcome|REQUESTED',
    'StripeWebhookReplayAudit|requestedAt|CURRENT_TIMESTAMP(3)'
  )
  $defaults = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_webhook_good' -Sql @'
SELECT CONCAT(TABLE_NAME, '|', COLUMN_NAME, '|', UPPER(CAST(COLUMN_DEFAULT AS CHAR)))
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('StripeWebhookReceipt', 'StripeWebhookObjectLease', 'StripeWebhookReplayAudit')
  AND COLUMN_DEFAULT IS NOT NULL;
'@
  if ($defaults.ExitCode -ne 0) { throw 'WEBHOOK_DEFAULT_QUERY_FAILED' }
  Assert-ExactSet -Actual $defaults.Lines -Expected $expectedDefaults
  Assert-Scalar -Result (Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_webhook_good' -Sql @'
SELECT CONCAT(
  COUNT(DISTINCT TABLE_NAME), '|',
  COUNT(*), '|',
  SUM(CHARACTER_SET_NAME IS NOT NULL AND COLLATION_NAME <> 'utf8mb4_unicode_ci'), '|',
  SUM(COLUMN_NAME = 'payload'), '|',
  SUM(COLUMN_NAME = 'payloadHash')
)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('StripeWebhookReceipt', 'StripeWebhookObjectLease', 'StripeWebhookReplayAudit');
'@) -Expected '3|40|0|0|1'

  $firstReceipt = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_webhook_good' -Sql @'
INSERT INTO `StripeWebhookReceipt` (
  `id`, `mode`, `accountScopeKey`, `eventId`, `eventType`, `providerCreatedAt`,
  `payloadHash`, `retentionExpiresAt`, `updatedAt`
) VALUES (
  'receipt_a', 'TEST', 'scope_a', 'event_a', 'event.synthetic',
  '2030-01-01 00:00:00.000', REPEAT('a', 64),
  '2030-02-01 00:00:00.000', '2030-01-01 00:00:00.000'
);
'@
  if ($firstReceipt.ExitCode -ne 0) { throw 'WEBHOOK_SYNTHETIC_INSERT_FAILED' }
  $duplicateReceipt = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_webhook_good' -Sql @'
INSERT INTO `StripeWebhookReceipt` (
  `id`, `mode`, `accountScopeKey`, `eventId`, `eventType`, `providerCreatedAt`,
  `payloadHash`, `retentionExpiresAt`, `updatedAt`
) VALUES (
  'receipt_b', 'TEST', 'scope_a', 'event_a', 'event.synthetic',
  '2030-01-01 00:00:00.000', REPEAT('b', 64),
  '2030-02-01 00:00:00.000', '2030-01-01 00:00:00.000'
);
'@ -AllowFailure
  if ($duplicateReceipt.ExitCode -eq 0) { throw 'WEBHOOK_RECEIPT_UNIQUENESS_MISSING' }

  $firstLease = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_webhook_good' -Sql @'
INSERT INTO `StripeWebhookObjectLease` (
  `id`, `mode`, `accountScopeKey`, `objectType`, `objectId`, `leaseToken`,
  `leaseExpiresAt`, `updatedAt`
) VALUES (
  'lease_a', 'TEST', 'scope_a', 'subscription', 'object_a', 'token_a',
  '2030-01-01 00:01:00.000', '2030-01-01 00:00:00.000'
);
'@
  if ($firstLease.ExitCode -ne 0) { throw 'WEBHOOK_SYNTHETIC_LEASE_FAILED' }
  $duplicateLease = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_webhook_good' -Sql @'
INSERT INTO `StripeWebhookObjectLease` (
  `id`, `mode`, `accountScopeKey`, `objectType`, `objectId`, `leaseToken`,
  `leaseExpiresAt`, `updatedAt`
) VALUES (
  'lease_b', 'TEST', 'scope_a', 'subscription', 'object_a', 'token_b',
  '2030-01-01 00:01:00.000', '2030-01-01 00:00:00.000'
);
'@ -AllowFailure
  if ($duplicateLease.ExitCode -eq 0) { throw 'WEBHOOK_OBJECT_UNIQUENESS_MISSING' }

  $badApply = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_webhook_bad' -Sql $b4f1
  if ($badApply.ExitCode -ne 0) { throw 'WEBHOOK_CONDITIONAL_CREATE_BEHAVIOR_CHANGED' }
  $badStructure = Invoke-MySql -ContainerName $ContainerName -Database 'crewframe_p02_webhook_bad' -Sql @'
SELECT CONCAT(COUNT(*), '|', SUM(COLUMN_NAME = 'id' AND COLUMN_TYPE = 'bigint'))
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'StripeWebhookReceipt';
'@
  Assert-Scalar -Result $badStructure -Expected '1|1'
}

function Invoke-ContainerScenario {
  param([Parameter(Mandatory = $true)][ValidateSet('success', 'injected')][string]$Scenario)

  $containerName = "$containerPrefix$Scenario-$([Guid]::NewGuid().ToString('N').Substring(0, 12))"
  $cleanupAuthorized = $false
  $containerWasObserved = $false
  $anonymousVolume = $null
  $cleanupFailed = $false
  if (Test-ExactProofContainerPresent -ContainerName $containerName) {
    throw 'PREEXISTING_CONTAINER_NAME_COLLISION'
  }
  $cleanupAuthorized = $true
  try {
    $started = Invoke-DockerCapture -DockerArguments @(
      'run', '--detach', '--pull=never',
      '--name', $containerName,
      '--label', $proofLabel,
      '--network=none',
      '--env', 'MYSQL_ALLOW_EMPTY_PASSWORD=yes',
      $imageReference
    ) -AllowFailure
    if (-not (Find-ExactProofContainerAfterRun -ContainerName $containerName)) {
      throw 'CREATED_CONTAINER_NOT_OBSERVED'
    }
    $containerWasObserved = $true
    $anonymousVolume = Get-AnonymousDataVolume -ContainerName $containerName
    if ($Scenario -eq 'injected') { throw 'EXPECTED_INJECTED_FAILURE' }
    if ($started.ExitCode -ne 0 -or $started.Lines.Count -ne 1) {
      throw 'CONTAINER_START_FAILED'
    }
    Assert-ContainerIsolation -ContainerName $containerName
    Wait-ForMySql -ContainerName $containerName

    $fixture = Get-NormalizedText -RelativePath $fixturePath
    $fixtureApply = Invoke-MySql -ContainerName $containerName -Sql $fixture
    if ($fixtureApply.ExitCode -ne 0) { throw 'SYNTHETIC_FIXTURE_FAILED' }
    Invoke-LogicalPlanProof -ContainerName $containerName
    Invoke-WebhookProof -ContainerName $containerName
  }
  finally {
    if ($cleanupAuthorized) {
      try {
        $containerPresent = Find-ExactProofContainerAfterRun -ContainerName $containerName
        if ($containerPresent) {
          $containerWasObserved = $true
          if (-not $anonymousVolume) {
            try {
              $anonymousVolume = Get-AnonymousDataVolume -ContainerName $containerName
            }
            catch {
              $cleanupFailed = $true
            }
          }
          $removed = Invoke-DockerCapture -DockerArguments @(
            'rm', '--force', '--volumes', $containerName
          ) -AllowFailure
          if ($removed.ExitCode -ne 0) { $cleanupFailed = $true }
        }
      }
      catch {
        $cleanupFailed = $true
      }
      if ($containerWasObserved -and -not $anonymousVolume) {
        $cleanupFailed = $true
      }
      try {
        if (Test-ExactProofContainerPresent -ContainerName $containerName) {
          $cleanupFailed = $true
        }
      }
      catch {
        $cleanupFailed = $true
      }
      if ($anonymousVolume) {
        try {
          Assert-ExactVolumeAbsent -VolumeName $anonymousVolume
        }
        catch {
          $cleanupFailed = $true
        }
      }
    }
    try {
      Assert-ZeroProofContainers
    }
    catch {
      $cleanupFailed = $true
    }
    if ($cleanupFailed) { throw 'EXACT_CLEANUP_FAILED' }
  }
}

function Assert-SafeOutputTarget {
  param([Parameter(Mandatory = $true)][string]$FullPath)

  Assert-InsideRepository -Candidate $FullPath
  $directory = [IO.Path]::GetDirectoryName($FullPath)
  Assert-NoReparsePathComponents -Candidate $directory
  Assert-NoReparsePathComponents -Candidate $FullPath -AllowMissingLeaf
  $item = Get-Item -Force -LiteralPath $FullPath -ErrorAction SilentlyContinue
  if ($item) {
    if ($item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
      throw 'OUTPUT_TARGET_NOT_REGULAR'
    }
    Assert-InsideRepository -Candidate $item.FullName
  }
}

function Write-AtomicEvidence {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $fullOutput = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $RelativePath))
  Assert-SafeOutputTarget -FullPath $fullOutput
  $directory = [IO.Path]::GetDirectoryName($fullOutput)
  Assert-NoReparsePathComponents -Candidate $directory
  $directoryItem = Get-Item -Force -LiteralPath $directory
  if (($directoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'OUTPUT_DIRECTORY_REPARSE_FORBIDDEN'
  }
  Assert-InsideRepository -Candidate $directoryItem.FullName
  $temporaryPath = Join-Path $directory ".CF-P1-B4F2B-P02-$([Guid]::NewGuid().ToString('N')).tmp"
  Assert-InsideRepository -Candidate $temporaryPath
  $stream = $null
  try {
    $stream = [IO.FileStream]::new(
      $temporaryPath,
      [IO.FileMode]::CreateNew,
      [IO.FileAccess]::Write,
      [IO.FileShare]::None,
      4096,
      [IO.FileOptions]::WriteThrough
    )
    [byte[]]$bytes = [Text.UTF8Encoding]::new($false).GetBytes($Content)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush($true)
    $stream.Dispose()
    $stream = $null
    Assert-NoReparsePathComponents -Candidate $temporaryPath
    Assert-SafeOutputTarget -FullPath $fullOutput
    [IO.File]::Move($temporaryPath, $fullOutput, $true)
  }
  finally {
    if ($stream) { $stream.Dispose() }
    if (Test-Path -LiteralPath $temporaryPath) {
      Remove-Item -Force -LiteralPath $temporaryPath
    }
  }
}

function Invoke-Proof {
  if ($scriptArguments.Count -ne 0) { throw 'ARGUMENTS_FORBIDDEN' }
  foreach ($key in $forbiddenEnvironmentKeys) {
    if (Test-Path -LiteralPath "Env:$key") { throw 'AMBIENT_CONFIGURATION_FORBIDDEN' }
  }
  $fullOutput = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $outputPath))
  Assert-SafeOutputTarget -FullPath $fullOutput
  Assert-FixedInputs
  $dockerCommand = Get-Command docker.exe -CommandType Application -ErrorAction Stop
  $script:dockerExecutable = $dockerCommand.Source
  Assert-LocalDockerAndImage
  Assert-ZeroProofContainers

  Invoke-ContainerScenario -Scenario 'success'
  Assert-ZeroProofContainers
  $injectedFailureObserved = $false
  try {
    Invoke-ContainerScenario -Scenario 'injected'
  }
  catch {
    if ($_.Exception.Message -ne 'EXPECTED_INJECTED_FAILURE') { throw }
    $injectedFailureObserved = $true
  }
  if (-not $injectedFailureObserved) { throw 'INJECTED_FAILURE_NOT_OBSERVED' }
  Assert-ZeroProofContainers

  $temporaryEvidence = @(Get-ChildItem -Force -LiteralPath (Join-Path $repositoryRoot 'docs/evidence') -Filter '.CF-P1-B4F2B-P02-*.tmp')
  if ($temporaryEvidence.Count -ne 0) { throw 'TEMPORARY_EVIDENCE_REMAINS' }
  if ($activeDockerProcessCount -ne 0) { throw 'DOCKER_PROCESS_HANDLE_REMAINS' }

  $evidence = [ordered]@{
    format = 'Crewframe B4F2B P-02 synthetic MySQL proof v1'
    gateSha = $gateSha
    acceptedContractSha = $acceptedContractSha
    boundary = 'P'
    boundaryR = 'BLOCKED'
    representativeState = 'NOT_ACCESSED'
    image = [ordered]@{
      digest = $imageDigest
      platform = 'linux/amd64'
      pull = 'NEVER'
      network = 'NONE'
      publishedPorts = 0
      requestedMounts = 0
      retainedVolumes = 0
    }
    inputArtifacts = @(
      [ordered]@{ id = 'P02_WORK_ITEM'; sha256 = $expectedNormalizedHashes['docs/issues/CF-P1-B4F2B-P02-disposable-synthetic-mysql-proof.md'] },
      [ordered]@{ id = 'BOUNDARY_P_MANIFEST'; sha256 = $expectedNormalizedHashes[$manifestPath] },
      [ordered]@{ id = 'SYNTHETIC_FIXTURE'; sha256 = $expectedNormalizedHashes[$fixturePath] },
      [ordered]@{ id = 'B4D_SQL'; sha256 = $expectedNormalizedHashes[$b4dPath] },
      [ordered]@{ id = 'B4F1_SQL'; sha256 = $expectedNormalizedHashes[$b4f1Path] }
    )
    permissionStage = 'DESIGN_REQUIRED'
    logicalPlan = [ordered]@{
      rows = 5
      legacyPlanValues = 4
      legacyPriceValues = 5
      mappedBasic = 1
      mappedUnlimited = 1
      unmapped = 2
      conflictPreserved = 1
      repeatRejected = $true
      incompatibleColumnRejected = $true
    }
    webhook = [ordered]@{
      tables = 3
      columns = 40
      indexEntries = 20
      explicitDefaults = 7
      collationMismatches = 0
      rawPayloadColumns = 0
      receiptDuplicateRejected = $true
      objectDuplicateRejected = $true
      incompatibleExistingTableDetected = $true
    }
    cleanup = [ordered]@{
      successContainers = 0
      successRetainedVolumes = 0
      injectedFailureContainers = 0
      injectedFailureRetainedVolumes = 0
      dumps = 0
      temporaryFiles = 0
      openHandles = 0
    }
    audit = 'STALE_UNREVALIDATED'
    advisories = 'UNKNOWN'
    readiness = 'FAIL'
    openHardGate = 'CF-P1-AUDIT-FRESH-01'
  }
  $json = $evidence | ConvertTo-Json -Depth 8
  Write-AtomicEvidence -RelativePath $outputPath -Content ($json.Replace("`r`n", "`n").TrimEnd() + "`n")
  [Console]::Out.WriteLine('PASS B4F2B P-02 disposable synthetic MySQL proof')
}

try {
  Invoke-Proof
}
catch {
  [Console]::Error.WriteLine('Boundary P-02 synthetic MySQL proof failed.')
  exit 1
}

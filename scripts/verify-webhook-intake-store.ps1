param()

$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$ddlPath = Join-Path $repositoryRoot 'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql'
$legacyFixturePath = Join-Path $repositoryRoot 'tests/fixtures/mysql/legacy-subscription-schema.sql'
$databaseName = 'crewframe_b4f2a1'
$containerPrefix = 'crewframe-b4f2a1-'

function Invoke-MySql {
  param(
    [Parameter(Mandatory = $true)][string]$ContainerName,
    [Parameter(Mandatory = $true)][string]$Password,
    [Parameter(Mandatory = $true)][string]$Sql
  )

  $Sql | docker exec --env "MYSQL_PWD=$Password" -i $ContainerName `
    mysql --host=127.0.0.1 --user=root $databaseName
  if ($LASTEXITCODE -ne 0) { throw "MySQL command failed in $ContainerName" }
}

function Wait-MySql {
  param([Parameter(Mandatory = $true)][string]$ContainerName)

  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    $health = docker inspect --format='{{.State.Health.Status}}' $ContainerName 2>$null
    if ($health -eq 'healthy') { return }
    Start-Sleep -Seconds 2
  }
  throw "$ContainerName did not become healthy"
}

function Invoke-BunScenario {
  param(
    [Parameter(Mandatory = $true)][string]$DatabaseUrl,
    [Parameter(Mandatory = $true)][ValidateSet('legacy', 'missing', 'outage', 'success')][string]$Scenario
  )

  $previousDatabaseUrl = $env:DATABASE_URL
  try {
    $env:DATABASE_URL = $DatabaseUrl
    bun scripts/verify-webhook-intake-store.ts $Scenario
    if ($LASTEXITCODE -ne 0) { throw "Bun $Scenario scenario failed" }
  }
  finally {
    if ($null -eq $previousDatabaseUrl) {
      Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    } else {
      $env:DATABASE_URL = $previousDatabaseUrl
    }
  }
}

function Invoke-DatabaseScenario {
  param([Parameter(Mandatory = $true)][ValidateSet('empty', 'legacy')][string]$Scenario)

  $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 10)
  $containerName = "$containerPrefix$Scenario-$suffix"
  $password = [Guid]::NewGuid().ToString('N')

  try {
    docker run --detach --rm --name $containerName `
      --publish 127.0.0.1::3306 `
      --env "MYSQL_ROOT_PASSWORD=$password" `
      --env "MYSQL_DATABASE=$databaseName" `
      --health-cmd="mysqladmin ping --silent --host=127.0.0.1 --user=root --password=$password" `
      --health-interval=2s --health-timeout=2s --health-retries=30 `
      mysql:8.4 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not start $containerName" }
    Wait-MySql -ContainerName $containerName

    $published = docker port $containerName 3306/tcp
    if ($LASTEXITCODE -ne 0 -or $published -notmatch ':(\d+)$') {
      throw "Could not resolve the published port for $containerName"
    }
    $port = $Matches[1]
    $databaseUrl = "mysql://root:$password@127.0.0.1:$port/$databaseName`?connection_limit=20&connect_timeout=3"

    if ($Scenario -eq 'empty') {
      Invoke-BunScenario -DatabaseUrl $databaseUrl -Scenario missing
    } else {
      Invoke-MySql -ContainerName $containerName -Password $password `
        -Sql (Get-Content -Raw -LiteralPath $legacyFixturePath)
    }

    Invoke-MySql -ContainerName $containerName -Password $password `
      -Sql (Get-Content -Raw -LiteralPath $ddlPath)
    Invoke-BunScenario -DatabaseUrl $databaseUrl `
      -Scenario $(if ($Scenario -eq 'empty') { 'success' } else { 'legacy' })
  }
  finally {
    docker rm --force $containerName 2>$null | Out-Null
  }
}

function Invoke-CleanupFailureProof {
  $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 10)
  $containerName = "$containerPrefix" + "cleanup-$suffix"
  $password = [Guid]::NewGuid().ToString('N')
  try {
    docker run --detach --rm --name $containerName `
      --env "MYSQL_ROOT_PASSWORD=$password" `
      --env "MYSQL_DATABASE=$databaseName" mysql:8.4 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not start $containerName" }
    throw 'expected_cleanup_failure'
  }
  finally {
    docker rm --force $containerName 2>$null | Out-Null
  }
}

Invoke-DatabaseScenario -Scenario empty
Invoke-DatabaseScenario -Scenario legacy
Invoke-BunScenario `
  -DatabaseUrl "mysql://root:unavailable@127.0.0.1:1/$databaseName`?connect_timeout=2" `
  -Scenario outage

$cleanupFailureObserved = $false
try {
  Invoke-CleanupFailureProof
} catch {
  if ($_.Exception.Message -ne 'expected_cleanup_failure') { throw }
  $cleanupFailureObserved = $true
}
if (-not $cleanupFailureObserved) { throw 'Cleanup failure proof did not execute' }

$remaining = @(docker ps --all --filter "name=$containerPrefix" --format '{{.Names}}')
if ($remaining.Count -ne 0) {
  throw "Disposable B4F2A1 containers remain: $($remaining -join ', ')"
}
Write-Output 'PASS cleanup: success and injected-failure paths left zero containers'

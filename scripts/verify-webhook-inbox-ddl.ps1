param()

$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$ddlPath = Join-Path $repositoryRoot 'docs/execution/sql/CF-P1-B4F1-webhook-inbox-foundation.sql'
$legacyFixturePath = Join-Path $repositoryRoot 'tests/fixtures/mysql/legacy-subscription-schema.sql'
$databaseName = 'crewframe_b4f1'
$expectedTables = @(
  'StripeWebhookObjectLease',
  'StripeWebhookReceipt',
  'StripeWebhookReplayAudit'
)

function Invoke-MySql {
  param(
    [Parameter(Mandatory = $true)][string]$ContainerName,
    [Parameter(Mandatory = $true)][string]$Password,
    [Parameter(Mandatory = $true)][string]$Sql
  )

  $Sql | docker exec --env "MYSQL_PWD=$Password" -i $ContainerName `
    mysql --host=127.0.0.1 --user=root $databaseName
  if ($LASTEXITCODE -ne 0) {
    throw "MySQL command failed in $ContainerName"
  }
}

function Invoke-Scenario {
  param([Parameter(Mandatory = $true)][ValidateSet('empty', 'legacy')][string]$Scenario)

  $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 10)
  $containerName = "crewframe-b4f1-$Scenario-$suffix"
  $password = [Guid]::NewGuid().ToString('N')

  try {
    $containerId = docker run --detach --rm --name $containerName `
      --env "MYSQL_ROOT_PASSWORD=$password" `
      --env "MYSQL_DATABASE=$databaseName" `
      --health-cmd="mysqladmin ping --silent --host=127.0.0.1 --user=root --password=$password" `
      --health-interval=2s --health-timeout=2s --health-retries=30 `
      mysql:8.4
    if ($LASTEXITCODE -ne 0) { throw "Could not start $containerName" }

    $healthy = $false
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
      $health = docker inspect --format='{{.State.Health.Status}}' $containerName 2>$null
      if ($health -eq 'healthy') {
        $healthy = $true
        break
      }
      Start-Sleep -Seconds 2
    }
    if (-not $healthy) { throw "$containerName did not become healthy" }

    if ($Scenario -eq 'legacy') {
      Invoke-MySql -ContainerName $containerName -Password $password `
        -Sql (Get-Content -Raw -LiteralPath $legacyFixturePath)
    }

    Invoke-MySql -ContainerName $containerName -Password $password `
      -Sql (Get-Content -Raw -LiteralPath $ddlPath)

    $tableQuery = "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$databaseName' AND TABLE_NAME LIKE 'StripeWebhook%' ORDER BY TABLE_NAME;"
    $tables = docker exec --env "MYSQL_PWD=$password" $containerName `
      mysql --host=127.0.0.1 --batch --skip-column-names `
      --user=root $databaseName --execute=$tableQuery
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect tables in $containerName" }
    if ((Compare-Object $expectedTables @($tables))) {
      throw "Unexpected webhook table set in $Scenario scenario: $($tables -join ', ')"
    }

    if ($Scenario -eq 'legacy') {
      $legacyQuery = "SELECT COUNT(*) FROM ``Subscription`` WHERE ``id`` = 'subscription_legacy' AND ``agencyId`` = 'agency_legacy';"
      $legacyCount = docker exec --env "MYSQL_PWD=$password" $containerName `
        mysql --host=127.0.0.1 --batch --skip-column-names `
        --user=root $databaseName `
        "--execute=$legacyQuery"
      if ($LASTEXITCODE -ne 0 -or $legacyCount -ne '1') {
        throw 'Synthetic legacy subscription did not remain readable'
      }
    }

    Write-Output "PASS ${Scenario}: additive webhook DDL applied and compatibility checks passed"
  }
  finally {
    docker rm --force $containerName 2>$null | Out-Null
  }
}

Invoke-Scenario -Scenario empty
Invoke-Scenario -Scenario legacy

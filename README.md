# Orchard Integrity Monitor

## Overview

Orchard Integrity Monitor is a public dashboard tracking Zcash value-pool accounting and post-patch Orchard metrics.

The dashboard is static and GitHub Pages ready. No server or build step is required.

## Data Source

Primary source: [ZcashInfo API](https://api.zcashinfo.com/docs).

The generated dataset includes current value pools, supply integrity, Orchard post-patch metrics, adoption metrics, historical pool shares, and historical Orchard balance snapshots.

## Refresh Schedule

The dataset is scheduled to refresh hourly through GitHub Actions.

No server required.

The workflow runs `scripts/update.py`, updates `data/data.json`, and commits only when the dataset changed. GitHub Actions scheduled workflows are not guaranteed to run at the exact scheduled minute.

## GitHub Pages

The dashboard is served as a static website through GitHub Pages.

Use root deployment from the default branch. The site works directly from:

```text
index.html
style.css
app.js
data/data.json
```

## Methodology

Supply Integrity compares emitted ZEC supply with the sum of Transparent, Orchard, Sapling, Sprout, and Lockbox pools.

Orchard Balance is read from public value-pool accounting and displayed in ZEC after converting from zatoshis.

Orchard Share is calculated as Orchard balance divided by total emitted supply.

Post-Patch Tracking compares current Orchard balance with the Orchard balance at patch block `3,363,426`.

Historical Pool Metrics use ZcashInfo value-pool history to chart Orchard, Sapling, and Transparent share over time.

## Orchard Timeline

This mode fetches only:

- NU5 activation block `1,687,104`
- Patch block `3,363,426`
- Current Orchard balance from ZcashInfo current pools

NU5 and patch snapshots use Blockchair raw block `decoded_raw_block.valuePools[]`.

## Limitations

Private Orchard notes are not publicly visible. This dashboard focuses on publicly observable value-pool accounting and post-patch movement.

## Local Update

Run:

```bash
python3 scripts/update.py
```

The script writes `data/data.json`, which is the only dataset file read by the browser.

const ZATOSHIS = 100_000_000n;

const ids = {
  syncStatus: "sync-status",
  updatedAt: "updated-at",
  summaryIntegrity: "summary-integrity",
  summaryDifference: "summary-difference",
  summaryRemaining: "summary-remaining",
  summaryCurrentOrchard: "summary-current-orchard",
  integrityStatus: "integrity-status",
  supplyEmitted: "supply-emitted",
  sumPools: "sum-pools",
  difference: "difference",
  orchardShare: "orchard-share",
  shieldedShare: "shielded-share",
  transparentShare: "transparent-share",
  orchardDominance: "orchard-dominance",
  healthIntegrity: "health-integrity",
  patchBlock: "patch-block",
  patchDate: "patch-date",
  patchOrchard: "patch-orchard",
  currentOrchard: "current-orchard",
  movedSincePatch: "moved-since-patch",
  remainingSincePatch: "remaining-since-patch",
  percentRemaining: "percent-remaining",
  patchNetChange: "patch-net-change",
  patchNetChangePct: "patch-net-change-pct",
  patchDailyChange: "patch-daily-change",
  patchWeeklyChange: "patch-weekly-change",
  snapshotNu5: "snapshot-nu5",
  snapshotPatch: "snapshot-patch",
  snapshotNow: "snapshot-now",
  snapshotGrowth: "snapshot-growth",
  snapshotChange: "snapshot-change",
  shareHistoryCount: "share-history-count",
  shareHistoryRange: "share-history-range",
  historyCount: "history-count",
  historyRange: "history-range",
  tipHeight: "tip-height",
  generatedAt: "generated-at",
  footerUpdatedAt: "footer-updated-at",
  chart: "orchard-chart",
  shareChart: "share-chart",
};

const el = Object.fromEntries(
  Object.entries(ids).map(([key, id]) => [key, document.getElementById(id)])
);

function zecFromZats(value) {
  const zats = BigInt(value || 0);
  const sign = zats < 0n ? "-" : "";
  const abs = zats < 0n ? -zats : zats;
  const whole = abs / ZATOSHIS;
  const frac = String(abs % ZATOSHIS).padStart(8, "0").replace(/0+$/, "");
  const number = Number(whole);
  const formattedWhole = Number.isSafeInteger(number)
    ? number.toLocaleString("en-US")
    : whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${formattedWhole}${frac ? `.${frac}` : ""} ZEC`;
}

function compactZecFromZats(value) {
  const zec = Number(value || 0) / 100_000_000;
  const abs = Math.abs(zec);
  const sign = zec < 0 ? "-" : "";

  if (abs >= 1_000_000) return `${sign}${formatCompact(abs / 1_000_000)}M ZEC`;
  if (abs >= 1_000) return `${sign}${formatCompact(abs / 1_000)}K ZEC`;
  return `${sign}${formatCompact(abs)} ZEC`;
}

function compactZecFromZatsFixed(value, digits) {
  const zec = Number(value || 0) / 100_000_000;
  const abs = Math.abs(zec);
  const sign = zec < 0 ? "-" : "";

  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(digits)}M ZEC`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(digits)}K ZEC`;
  return `${sign}${abs.toFixed(digits)} ZEC`;
}

function formatCompact(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value < 10 ? 2 : 1,
    maximumFractionDigits: value < 10 ? 2 : 1,
  }).format(value);
}

function setMetric(node, value) {
  if (!node) return;
  const full = zecFromZats(value);
  node.textContent = compactZecFromZats(value);
  node.title = full;

  const container = node.closest(".metric");
  if (!container) return;

  let detail = container.querySelector(".metric-full");
  if (!detail) {
    detail = document.createElement("small");
    detail.className = "metric-full";
    node.after(detail);
  }
  detail.textContent = full;
}

function compactDate(timestamp) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(Number(timestamp) * 1000));
}

function fullDateTime(value) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function setStatus(node, status, label) {
  if (!node) return;
  node.className = `status-pill status-${status.toLowerCase()}`;
  node.textContent = label;
}

function formatPct(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function setText(node, value) {
  if (node) node.textContent = value;
}

function setHealthText(node, status) {
  if (!node) return;
  node.textContent = status;
  node.className = `health-value health-${status.toLowerCase()}`;
}

function renderMetrics(data) {
  const pools = data.current.pools;
  const patch = data.patch || {};
  const patchOrchard = BigInt(patch.orchard_balance_zatoshis || 0);
  const currentOrchard = BigInt(patch.current_orchard_balance_zatoshis || pools.orchard_zatoshis || 0);
  const percentRemaining = patchOrchard > 0n
    ? (Number(currentOrchard) / Number(patchOrchard)) * 100
    : 0;

  setHealthText(el.summaryIntegrity, data.integrity.status);
  setText(el.summaryDifference, zecFromZats(data.integrity.difference_zatoshis));
  setText(el.summaryRemaining, formatPct(percentRemaining));
  setText(el.summaryCurrentOrchard, compactZecFromZats(currentOrchard));

  setText(el.supplyEmitted, zecFromZats(data.integrity.supply_emitted_zatoshis));
  setText(el.sumPools, zecFromZats(data.integrity.sum_of_pools_zatoshis));
  setText(el.difference, zecFromZats(data.integrity.difference_zatoshis));
  setStatus(el.integrityStatus, data.integrity.status, data.integrity.status);
  setHealthText(el.healthIntegrity, data.integrity.status);

  if (data.adoption) {
    setText(el.orchardShare, formatPct(data.adoption.orchard_share_of_supply_pct));
    setText(el.shieldedShare, formatPct(data.adoption.total_shielded_share_pct));
    setText(el.transparentShare, formatPct(data.adoption.transparent_share_pct));
    setText(el.orchardDominance, formatPct(data.adoption.orchard_dominance_pct));
  }

  setStatus(el.syncStatus, data.integrity.status, data.current.info?.status || data.integrity.status);
  setText(el.updatedAt, `Updated ${fullDateTime(data.generated_at)}`);
  setText(el.generatedAt, fullDateTime(data.generated_at));
  setText(el.footerUpdatedAt, fullDateTime(data.generated_at));
  setText(el.tipHeight, data.current.info?.chain_tip?.toLocaleString("en-US") || "-");

  if (data.patch) {
    setText(el.patchBlock, data.patch.block.toLocaleString("en-US"));
    setText(el.patchDate, fullDateTime(Number(data.patch.timestamp) * 1000));
    setText(el.patchOrchard, zecFromZats(data.patch.orchard_balance_zatoshis));
    setText(el.currentOrchard, zecFromZats(data.patch.current_orchard_balance_zatoshis));
    setText(el.movedSincePatch, zecFromZats(data.patch.moved_since_patch_zatoshis));
    setText(el.remainingSincePatch, zecFromZats(data.patch.current_orchard_balance_zatoshis));
    setText(el.percentRemaining, formatPct(percentRemaining));
    setText(el.patchNetChange, zecFromZats(data.patch.net_change_zatoshis));
    setText(el.patchNetChangePct, formatPct(data.patch.net_change_pct));
    setText(el.patchDailyChange, zecFromZats(data.patch.daily_change_zatoshis));
    setText(el.patchWeeklyChange, zecFromZats(data.patch.weekly_change_zatoshis));
  }

  if (data.historical_snapshots) {
    const snapshots = data.historical_snapshots;
    setText(el.snapshotNu5, zecFromZats(snapshots.nu5.orchard_balance_zatoshis));
    setText(el.snapshotPatch, zecFromZats(snapshots.patch.orchard_balance_zatoshis));
    setText(el.snapshotNow, zecFromZats(snapshots.current.orchard_balance_zatoshis));
    setText(el.snapshotGrowth, zecFromZats(snapshots.growth_since_nu5_zatoshis));
    setText(el.snapshotChange, zecFromZats(snapshots.change_since_patch_zatoshis));
  }
}

function renderShareChart(history) {
  const svg = el.shareChart;
  svg.textContent = "";

  const points = history
    .filter((point) => Number(point.timestamp) > 0)
    .map((point) => ({
      x: Number(point.timestamp),
      orchard: Number(point.orchard_pct || 0),
      sapling: Number(point.sapling_pct || 0),
      transparent: Number(point.transparent_pct || 0),
    }));

  el.shareHistoryCount.textContent = `${points.length.toLocaleString("en-US")} points`;
  if (!points.length) {
    el.shareHistoryRange.textContent = "No history";
    return;
  }

  el.shareHistoryRange.textContent = `${compactDate(points[0].x)} - ${compactDate(points[points.length - 1].x)}`;

  const width = 1100;
  const height = 420;
  const margin = { top: 24, right: 28, bottom: 56, left: 64 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const scaleX = (x) => margin.left + ((x - minX) / Math.max(1, maxX - minX)) * innerW;
  const scaleY = (y) => margin.top + innerH - (y / 100) * innerH;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");

  for (let i = 0; i <= 4; i += 1) {
    const yValue = i * 25;
    const y = scaleY(yValue);
    addLine(svg, margin.left, y, width - margin.right, y, "grid-line");
    addText(svg, margin.left - 12, y + 4, `${yValue}%`, "axis-text", "end");
  }

  for (let i = 0; i <= 3; i += 1) {
    const xValue = minX + ((maxX - minX) / 3) * i;
    const x = scaleX(xValue);
    addText(svg, x, height - 20, compactDate(xValue), "axis-text", "middle");
  }

  addPath(svg, lineFor(points, "transparent", scaleX, scaleY), "share-line transparent-line");
  addPath(svg, lineFor(points, "orchard", scaleX, scaleY), "share-line orchard-line");
  addPath(svg, lineFor(points, "sapling", scaleX, scaleY), "share-line sapling-line");
  addLegend(svg, 760, 28, "Transparent", "transparent-dot");
  addLegend(svg, 880, 28, "Orchard", "orchard-dot");
  addLegend(svg, 976, 28, "Sapling", "sapling-dot");
}

function lineFor(points, key, scaleX, scaleY) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.x).toFixed(2)} ${scaleY(point[key]).toFixed(2)}`)
    .join(" ");
}

function renderChart(history) {
  const svg = el.chart;
  svg.textContent = "";

  const points = history
    .filter((point) => Number(point.orchard_zatoshis) > 0)
    .map((point) => ({
      x: Number(point.timestamp),
      y: Number(point.orchard_zatoshis) / 100_000_000,
      height: point.height,
    }));

  el.historyCount.textContent = `${points.length.toLocaleString("en-US")} points`;
  if (!points.length) {
    el.historyRange.textContent = "No Orchard history";
    return;
  }

  el.historyRange.textContent = `${compactDate(points[0].x)} - ${compactDate(points[points.length - 1].x)}`;

  const width = 1100;
  const height = 420;
  const margin = { top: 24, right: 28, bottom: 42, left: 82 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const minY = 0;
  const maxY = Math.max(...points.map((point) => point.y));
  const yPad = maxY * 0.06;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const scaleX = (x) => margin.left + ((x - minX) / Math.max(1, maxX - minX)) * innerW;
  const scaleY = (y) => margin.top + innerH - ((y - minY) / Math.max(1, maxY + yPad - minY)) * innerH;

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.x).toFixed(2)} ${scaleY(point.y).toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${scaleX(points[points.length - 1].x).toFixed(2)} ${scaleY(0).toFixed(2)} L ${scaleX(points[0].x).toFixed(2)} ${scaleY(0).toFixed(2)} Z`;

  for (let i = 0; i <= 4; i += 1) {
    const yValue = (maxY / 4) * i;
    const y = scaleY(yValue);
    addLine(svg, margin.left, y, width - margin.right, y, "grid-line");
    addText(svg, margin.left - 12, y + 4, `${Math.round(yValue).toLocaleString("en-US")}`, "axis-text", "end");
  }

  for (let i = 0; i <= 3; i += 1) {
    const xValue = minX + ((maxX - minX) / 3) * i;
    const x = scaleX(xValue);
    addText(svg, x, height - 14, compactDate(xValue), "axis-text", "middle");
  }

  addPath(svg, areaPath, "chart-area");
  addPath(svg, linePath, "chart-line");
}

function addPath(svg, d, className) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("class", className);
  svg.appendChild(path);
}

function addLine(svg, x1, y1, x2, y2, className) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("class", className);
  svg.appendChild(line);
}

function addText(svg, x, y, text, className, anchor) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
  node.setAttribute("x", x);
  node.setAttribute("y", y);
  node.setAttribute("class", className);
  node.setAttribute("text-anchor", anchor);
  node.textContent = text;
  svg.appendChild(node);
}

function addLegend(svg, x, y, label, dotClass) {
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", x);
  circle.setAttribute("cy", y - 4);
  circle.setAttribute("r", 5);
  circle.setAttribute("class", dotClass);
  svg.appendChild(circle);
  addText(svg, x + 10, y, label, "axis-text", "start");
}

async function init() {
  try {
    const response = await fetch("data/data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load data/data.json: ${response.status}`);
    const data = await response.json();
    renderMetrics(data);
    renderShareChart(data.share_history || []);
    renderChart(data.history || []);
  } catch (error) {
    console.error(error);
    setStatus(el.syncStatus, "alert", "Error");
    setStatus(el.integrityStatus, "alert", "Error");
    el.updatedAt.textContent = "Unable to load dataset";
  }
}

init();

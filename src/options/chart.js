const SVG_NS = 'http://www.w3.org/2000/svg';

export function calculateChartLayout({
  itemCount,
  minWidth = 520,
  height = 320,
  plotTop = 32,
  plotRight = 24,
  plotBottom = 78,
  plotLeft = 24,
  barWidth = 44,
  itemGap = 31,
} = {}) {
  const normalizedItemCount = Math.max(0, Number(itemCount) || 0);
  const step = barWidth + itemGap;
  const width = Math.max(minWidth, normalizedItemCount * step);

  return {
    width,
    height,
    plotTop,
    plotRight,
    plotBottom,
    plotLeft,
    barWidth,
    itemGap,
    step,
    plotHeight: height - plotTop - plotBottom,
  };
}

export function renderBarChart({
  items,
  maxValue,
  minValue,
  groupMaxValue,
  valueFormatter = (value) => String(value),
} = {}) {
  const chartItems = Array.isArray(items) ? items : [];
  const layout = calculateChartLayout({ itemCount: chartItems.length });
  const baselineY = layout.plotTop + layout.plotHeight;
  const scaleMax = Number(groupMaxValue) > 0 ? Number(groupMaxValue) : 0;
  const groupMin = Number(minValue);
  const groupMax = Number(maxValue);

  return `
    <div class="chart-scroll" tabindex="0" aria-label="Scrollable comparison chart">
      <svg
        class="chart-svg"
        width="${layout.width}"
        height="${layout.height}"
        viewBox="0 0 ${layout.width} ${layout.height}"
        role="img"
        xmlns="${SVG_NS}"
      >
        <line class="chart-axis" x1="0" y1="${baselineY}" x2="${layout.width}" y2="${baselineY}"></line>
        ${chartItems.map((item, index) => renderBar({ item, index, layout, baselineY, scaleMax, groupMin, groupMax, valueFormatter, itemCount: chartItems.length })).join('')}
      </svg>
    </div>
  `;
}

function renderBar({ item, index, layout, baselineY, scaleMax, groupMin, groupMax, valueFormatter, itemCount }) {
  const rawValue = Number(item.value) || 0;
  const visibleHeight = scaleMax > 0 ? Math.max(4, (rawValue / scaleMax) * layout.plotHeight) : 4;
  const x = (index + 0.5) * layout.step - layout.barWidth / 2;
  const y = baselineY - visibleHeight;
  const isMin = itemCount > 1 && rawValue === groupMin;
  const isMax = itemCount > 1 && rawValue === groupMax;
  const label = String(item.label ?? '');
  const shortLabel = truncateLabel(label);
  const value = valueFormatter(rawValue);

  return `
    <g class="chart-item">
      <rect
        class="chart-bar-rect ${isMin ? 'bar-min' : ''} ${isMax ? 'bar-max' : ''}"
        x="${x}"
        y="${y}"
        width="${layout.barWidth}"
        height="${visibleHeight}"
        rx="6"
      >
        <title>${escapeHtml(`${label}: ${value}`)}</title>
      </rect>
      <text class="chart-bar-value" x="${x + layout.barWidth / 2}" y="${y - 10}" text-anchor="middle">${escapeHtml(value)}</text>
      <rect
        class="chart-label-hitbox"
        x="${index * layout.step}"
        y="${baselineY + 4}"
        width="${layout.step}"
        height="${layout.plotBottom - 8}"
        data-chart-tooltip="${escapeHtml(label)}"
        aria-label="${escapeHtml(label)}"
      ></rect>
      <text
        class="chart-bar-label"
        x="${x + layout.barWidth / 2}"
        y="${baselineY + 24}"
        text-anchor="end"
        transform="rotate(-38 ${x + layout.barWidth / 2} ${baselineY + 24})"
        data-chart-tooltip="${escapeHtml(label)}"
        aria-label="${escapeHtml(label)}"
      >
        ${escapeHtml(shortLabel)}
      </text>
    </g>
  `;
}

function truncateLabel(label, maxLength = 24) {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}...`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

import { db } from '../db.js';

let assetChartInstance = null;
let maintChartInstance = null;
let deptChartInstance = null;

export function renderReports(container, user) {
  // Reset previous chart references to prevent canvas memory leaks
  if (assetChartInstance) { assetChartInstance.destroy(); assetChartInstance = null; }
  if (maintChartInstance) { maintChartInstance.destroy(); maintChartInstance = null; }
  if (deptChartInstance) { deptChartInstance.destroy(); deptChartInstance = null; }

  const dbData = db.getDB();
  const assets = dbData.assets;
  const categories = dbData.categories;
  const maintenance = dbData.maintenanceRequests;
  const depts = dbData.departments;
  const allocations = dbData.allocations;
  const bookings = dbData.bookings;

  // 1. Calculations for Asset States Chart
  const states = { Available: 0, Allocated: 0, Reserved: 0, 'Under Maintenance': 0, Lost: 0, Retired: 0, Disposed: 0 };
  assets.forEach(a => { if (states[a.status] !== undefined) states[a.status]++; });

  // 2. Calculations for Maintenance frequency by Category
  const categoryMaintFreq = {};
  categories.forEach(c => { categoryMaintFreq[c.name] = 0; });
  maintenance.forEach(m => {
    const asset = assets.find(a => a.id === m.assetId);
    if (asset) {
      const catName = categories.find(c => c.id === asset.categoryId)?.name;
      if (catName && categoryMaintFreq[catName] !== undefined) {
        categoryMaintFreq[catName]++;
      }
    }
  });

  // 3. Calculations for Department-wise Allocations
  const deptAllocSummary = {};
  depts.forEach(d => { deptAllocSummary[d.name] = 0; });
  allocations.forEach(al => {
    if (al.status === 'active' && al.assigneeType === 'department') {
      const deptName = depts.find(d => d.id === al.assigneeId)?.name;
      if (deptName && deptAllocSummary[deptName] !== undefined) deptAllocSummary[deptName]++;
    } else if (al.status === 'active' && al.assigneeType === 'employee') {
      const emp = dbData.employees.find(e => e.id === al.assigneeId);
      if (emp) {
        const deptName = depts.find(d => d.id === emp.departmentId)?.name;
        if (deptName && deptAllocSummary[deptName] !== undefined) deptAllocSummary[deptName]++;
      }
    }
  });

  // 4. Booking Heatmap slots (Hourly: 08:00 to 18:00 for each resource)
  const bookableResources = assets.filter(a => a.isBookable && a.status !== 'Retired' && a.status !== 'Disposed');
  const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM

  const heatmapRowsHTML = bookableResources.map(res => {
    const resBookings = bookings.filter(b => b.assetId === res.id && b.status !== 'Cancelled');
    
    const cellsHTML = hours.map(hr => {
      // Check how many bookings overlap with this hour (e.g. today or generally)
      const isBooked = resBookings.some(b => {
        const bStart = new Date(b.startDate);
        const bEnd = new Date(b.endDate);
        const cellTimeStart = new Date(b.startDate); // Use booking date anchor
        cellTimeStart.setHours(hr, 0, 0, 0);
        const cellTimeEnd = new Date(b.startDate);
        cellTimeEnd.setHours(hr + 1, 0, 0, 0);

        return bStart < cellTimeEnd && bEnd > cellTimeStart;
      });

      return `<div class="heatmap-cell ${isBooked ? 'level-3' : ''}" title="${res.name} at ${String(hr).padStart(2, '0')}:00 - ${isBooked ? 'Booked' : 'Available'}"></div>`;
    }).join('');

    return `
      <div class="heatmap-row">
        <span class="heatmap-row-label">${res.name}</span>
        ${cellsHTML}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <!-- Action Export bar -->
    <div class="glass-card">
      <div class="card-header" style="margin-bottom:0; padding:0;">
        <h2 class="card-title">Reports Dashboard</h2>
        <div style="display:flex; gap:0.75rem;">
          <button class="btn btn-secondary btn-sm" id="btn-export-assets">Export Inventory (CSV)</button>
          <button class="btn btn-secondary btn-sm" id="btn-export-maint">Export Maintenance (CSV)</button>
        </div>
      </div>
    </div>

    <!-- Charts Layout Grid -->
    <div class="charts-grid">
      
      <!-- Chart 1: Inventory Lifecycle States -->
      <div class="glass-card">
        <h3 class="card-title" style="margin-bottom:1rem;">Asset States</h3>
        <div class="chart-container">
          <canvas id="canvas-asset-states"></canvas>
        </div>
      </div>

      <!-- Chart 2: Maintenance Incidents -->
      <div class="glass-card">
        <h3 class="card-title" style="margin-bottom:1rem;">Maintenance by Category</h3>
        <div class="chart-container">
          <canvas id="canvas-maint-freq"></canvas>
        </div>
      </div>

      <!-- Chart 3: Department Allocations -->
      <div class="glass-card">
        <h3 class="card-title" style="margin-bottom:1rem;">Department Allocations</h3>
        <div class="chart-container">
          <canvas id="canvas-dept-alloc"></canvas>
        </div>
      </div>

      <!-- Heatmap Block -->
      <div class="glass-card">
        <h3 class="card-title" style="margin-bottom:1rem;">Resource Bookings Peak Heatmap</h3>
        <div class="heatmap-wrapper">
          <div style="overflow-x:auto;">
            <div style="min-width:450px;">
              ${heatmapRowsHTML}
              
              <!-- Timeline slot indicators -->
              <div class="heatmap-time-labels">
                <span class="heatmap-row-label" style="opacity:0;"></span>
                ${hours.map(hr => `<span class="heatmap-time-label">${String(hr).padStart(2, '0')}h</span>`).join('')}
              </div>
            </div>
          </div>
          
          <div class="heatmap-legend">
            <div class="legend-item"><span class="legend-box" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05);"></span><span>Free</span></div>
            <div class="legend-item"><span class="legend-box" style="background:var(--accent-color);"></span><span>Reserved</span></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render ChartJS Charts
  setTimeout(() => {
    renderAssetChart(states);
    renderMaintChart(categoryMaintFreq);
    renderDeptChart(deptAllocSummary);
  }, 100);

  // Bind Export Listeners
  document.getElementById('btn-export-assets').onclick = () => exportAssetsToCSV(assets, categories);
  document.getElementById('btn-export-maint').onclick = () => exportMaintenanceToCSV(maintenance, assets);
}

function renderAssetChart(statesData) {
  const ctx = document.getElementById('canvas-asset-states').getContext('2d');
  assetChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(statesData),
      datasets: [{
        data: Object.values(statesData),
        backgroundColor: [
          '#10b981', // Available
          '#3b82f6', // Allocated
          '#8b5cf6', // Reserved
          '#f59e0b', // Under Maintenance
          '#ef4444', // Lost
          '#6b7280', // Retired
          '#374151'  // Disposed
        ],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#1b253b', font: { family: 'Inter', size: 10 } }
        }
      }
    }
  });
}

function renderMaintChart(maintData) {
  const ctx = document.getElementById('canvas-maint-freq').getContext('2d');
  maintChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(maintData),
      datasets: [{
        label: 'Maintenance Tickets',
        data: Object.values(maintData),
        backgroundColor: 'rgba(27, 37, 59, 0.6)',
        borderColor: '#1b253b',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(27, 37, 59, 0.05)' }, ticks: { color: '#64748b', font: { family: 'Inter' } } },
        y: { grid: { color: 'rgba(27, 37, 59, 0.05)' }, ticks: { color: '#64748b', font: { family: 'Inter' } }, beginAtZero: true }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderDeptChart(deptData) {
  const ctx = document.getElementById('canvas-dept-alloc').getContext('2d');
  deptChartInstance = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: Object.keys(deptData),
      datasets: [{
        data: Object.values(deptData),
        backgroundColor: [
          'rgba(27, 37, 59, 0.6)',
          'rgba(16, 185, 129, 0.6)',
          'rgba(249, 115, 22, 0.6)',
          'rgba(100, 116, 139, 0.6)'
        ],
        borderColor: 'rgba(27, 37, 59, 0.1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          grid: { color: 'rgba(27, 37, 59, 0.05)' },
          angleLines: { color: 'rgba(27, 37, 59, 0.05)' },
          pointLabels: { color: '#64748b' },
          ticks: { color: '#64748b', backdropColor: 'transparent' }
        }
      },
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#1b253b', font: { family: 'Inter', size: 10 } }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// CSV EXPORT LOGIC
// -------------------------------------------------------------
function exportAssetsToCSV(assets, categories) {
  const headers = ['Asset Tag', 'Asset Name', 'Category', 'Serial Number', 'Acquisition Date', 'Cost', 'Condition', 'Location', 'Status'];
  const rows = assets.map(a => {
    const cat = categories.find(c => c.id === a.categoryId)?.name || 'Unknown';
    return [
      a.tag,
      `"${a.name.replace(/"/g, '""')}"`,
      cat,
      a.serialNumber,
      a.acquisitionDate,
      a.acquisitionCost,
      a.condition,
      `"${a.location.replace(/"/g, '""')}"`,
      a.status
    ];
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csvContent, 'AssetFlow_Inventory_Report.csv');
}

function exportMaintenanceToCSV(maintenance, assets) {
  const headers = ['Request ID', 'Asset Tag', 'Request Date', 'Description', 'Priority', 'Status', 'Technician', 'Resolution Notes'];
  const rows = maintenance.map(m => {
    const asset = assets.find(a => a.id === m.assetId);
    return [
      m.id,
      asset ? asset.tag : 'AF-????',
      m.requestDate,
      `"${m.description.replace(/"/g, '""')}"`,
      m.priority,
      m.status,
      `"${(m.technician || '').replace(/"/g, '""')}"`,
      `"${(m.resolutionNotes || '').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(csvContent, 'AssetFlow_Maintenance_Report.csv');
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (navigator.msSaveBlob) { // IE 10+
    navigator.msSaveBlob(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

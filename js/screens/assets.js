import { db } from '../db.js';
import { openModal, closeModal } from '../app.js';

export function renderAssets(container, user) {
  // Check if hash has query parameters
  const hash = window.location.hash;
  const showRegisterOnLoad = hash.includes('action=new') && (user.role === 'admin' || user.role === 'manager');

  renderAssetDirectory(container, user);

  if (showRegisterOnLoad) {
    // Clear action=new from hash to prevent looping on reload, but keep hash
    window.location.hash = '#assets';
    showRegisterModal();
  }
}

function renderAssetDirectory(container, user) {
  const dbData = db.getDB();
  const assets = dbData.assets;
  const categories = dbData.categories;
  const depts = dbData.departments;
  const allocations = dbData.allocations;
  const employees = dbData.employees;

  // Render Directory Layout
  container.innerHTML = `
    <div class="glass-card">
      <div class="actions-bar">
        <div class="search-input-wrapper" style="flex:2;">
          <input type="text" id="asset-search" class="form-control" placeholder="Search by Asset Tag, Name, Serial Number, Location..." style="padding-left:2.25rem;">
          <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        
        <select id="filter-category" class="form-control" style="flex:1;">
          <option value="">All Categories</option>
          ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
        
        <select id="filter-status" class="form-control" style="flex:1;">
          <option value="">All Statuses</option>
          <option value="Available">Available</option>
          <option value="Allocated">Allocated</option>
          <option value="Reserved">Reserved</option>
          <option value="Under Maintenance">Under Maintenance</option>
          <option value="Lost">Lost</option>
          <option value="Retired">Retired</option>
          <option value="Disposed">Disposed</option>
        </select>

        ${user.role === 'admin' || user.role === 'manager' ? `
          <button class="btn btn-primary" id="btn-register-asset">
            <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Register Asset
          </button>
        ` : ''}
      </div>

      <div class="table-wrapper">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Asset Tag</th>
              <th>Name</th>
              <th>Category</th>
              <th>Location</th>
              <th>Current Holder</th>
              <th>Condition</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="assets-table-body">
            <!-- Rendered dynamically -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind Actions
  const btnRegister = document.getElementById('btn-register-asset');
  if (btnRegister) btnRegister.onclick = () => showRegisterModal();

  const searchInput = document.getElementById('asset-search');
  const catFilter = document.getElementById('filter-category');
  const statusFilter = document.getElementById('filter-status');

  const filterAndRenderRows = () => {
    const query = searchInput.value.toLowerCase();
    const cat = catFilter.value;
    const stat = statusFilter.value;
    
    let filteredAssets = assets;

    // Standard User Limit: views assets allocated to them, Dept Head views assets allocated to department
    if (user.role === 'employee') {
      // Find asset IDs held by this employee
      const activeAllocAssetIds = allocations
        .filter(a => a.status === 'active' && a.assigneeType === 'employee' && a.assigneeId === user.id)
        .map(a => a.assetId);
      filteredAssets = assets.filter(a => activeAllocAssetIds.includes(a.id));
    } else if (user.role === 'dept-head') {
      // Find asset IDs held by employee's department or employees in department
      const deptEmpIds = employees.filter(e => e.departmentId === user.departmentId).map(e => e.id);
      const activeAllocAssetIds = allocations
        .filter(a => a.status === 'active' && (
          (a.assigneeType === 'department' && a.assigneeId === user.departmentId) ||
          (a.assigneeType === 'employee' && deptEmpIds.includes(a.assigneeId))
        ))
        .map(a => a.assetId);
      filteredAssets = assets.filter(a => activeAllocAssetIds.includes(a.id));
    }

    // Apply directory level searching/filtering
    const finalFiltered = filteredAssets.filter(a => {
      const matchText = a.tag.toLowerCase().includes(query) ||
                        a.name.toLowerCase().includes(query) ||
                        a.serialNumber.toLowerCase().includes(query) ||
                        a.location.toLowerCase().includes(query);
      const matchCat = cat === '' || a.categoryId === cat;
      const matchStat = stat === '' || a.status === stat;
      
      return matchText && matchCat && matchStat;
    });

    const tbody = document.getElementById('assets-table-body');
    if (finalFiltered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center;">No assets match current criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = finalFiltered.map(a => {
      const categoryName = categories.find(c => c.id === a.categoryId)?.name || 'Unknown';
      
      // Determine Current Holder
      let holderText = '<span class="text-muted">None (Available)</span>';
      if (a.status === 'Allocated') {
        const activeAlloc = allocations.find(al => al.assetId === a.id && al.status === 'active');
        if (activeAlloc) {
          if (activeAlloc.assigneeType === 'employee') {
            holderText = employees.find(e => e.id === activeAlloc.assigneeId)?.name || 'Employee';
          } else {
            holderText = depts.find(d => d.id === activeAlloc.assigneeId)?.name || 'Department';
          }
        }
      } else if (a.status === 'Reserved') {
        holderText = '<span class="text-muted">Reserved (Bookings)</span>';
      } else if (a.status === 'Under Maintenance') {
        holderText = '<span class="text-warning">In Workshop</span>';
      }

      const statusBadgeClass = `badge-${a.status.toLowerCase().replace(' ', '')}`;

      return `
        <tr>
          <td style="font-weight:700; color:var(--accent-color);">${a.tag}</td>
          <td style="font-weight:600;">${a.name}</td>
          <td>${categoryName}</td>
          <td>${a.location}</td>
          <td>${holderText}</td>
          <td>${a.condition}</td>
          <td>
            <span class="badge ${statusBadgeClass}">
              <span class="badge-dot"></span>
              ${a.status}
            </span>
          </td>
          <td>
            <button class="btn btn-sm btn-secondary btn-view-asset" data-id="${a.id}">Inspect</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-view-asset').forEach(btn => {
      btn.onclick = () => showAssetDetailModal(btn.dataset.id, user);
    });
  };

  filterAndRenderRows();
  searchInput.oninput = filterAndRenderRows;
  catFilter.onchange = filterAndRenderRows;
  statusFilter.onchange = filterAndRenderRows;
}

function showRegisterModal() {
  const dbData = db.getDB();
  const categories = dbData.categories.filter(c => c.status === 'active');

  const html = `
    <form id="modal-register-asset-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="ast-name">Asset Name</label>
          <input type="text" id="ast-name" class="form-control" placeholder="e.g. Dell XPS 15" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="ast-cat">Category</label>
          <select id="ast-cat" class="form-control" required>
            <option value="">-- Select Category --</option>
            ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="ast-serial">Serial Number</label>
          <input type="text" id="ast-serial" class="form-control" placeholder="e.g. SN-99827-X" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="ast-cost">Acquisition Cost ($)</label>
          <input type="number" id="ast-cost" class="form-control" placeholder="e.g. 1200" required min="0">
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="ast-date">Acquisition Date</label>
          <input type="date" id="ast-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="ast-condition">Condition</label>
          <select id="ast-condition" class="form-control">
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
            <option value="Poor">Poor</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="ast-loc">Location</label>
        <input type="text" id="ast-loc" class="form-control" placeholder="e.g. HQ - Room 302" required>
      </div>

      <div class="form-group">
        <label class="form-checkbox">
          <input type="checkbox" id="ast-bookable">
          <span>Mark as Shared Resource (Bookable by employees)</span>
        </label>
      </div>

      <!-- Container for dynamic category-specific fields -->
      <div id="dynamic-fields-wrapper"></div>
    </form>
  `;

  openModal(
    'Register New Physical Asset',
    html,
    [
      { text: 'Cancel', onClick: closeModal },
      {
        text: 'Register Asset',
        class: 'btn-primary',
        onClick: (e) => {
          const form = document.getElementById('modal-register-asset-form');
          if (!form.reportValidity()) return;

          const name = document.getElementById('ast-name').value;
          const categoryId = document.getElementById('ast-cat').value;
          const serialNumber = document.getElementById('ast-serial').value;
          const acquisitionCost = parseFloat(document.getElementById('ast-cost').value);
          const acquisitionDate = document.getElementById('ast-date').value;
          const condition = document.getElementById('ast-condition').value;
          const location = document.getElementById('ast-loc').value;
          const isBookable = document.getElementById('ast-bookable').checked;

          // Parse dynamic fields
          const category = categories.find(c => c.id === categoryId);
          const customFields = {};
          if (category && category.fields) {
            category.fields.forEach(f => {
              const inputEl = document.getElementById(`custom-f-${f.key}`);
              if (inputEl) {
                customFields[f.key] = f.type === 'number' ? parseFloat(inputEl.value) : inputEl.value;
              }
            });
          }

          // Auto-generate Asset Tag
          const assets = db.getAll('assets');
          const lastTagNum = assets.reduce((max, a) => {
            const num = parseInt(a.tag.split('-')[1]);
            return num > max ? num : max;
          }, 0);
          const nextTag = `AF-${String(lastTagNum + 1).padStart(4, '0')}`;

          const newAsset = {
            name,
            tag: nextTag,
            serialNumber,
            categoryId,
            acquisitionCost,
            acquisitionDate,
            condition,
            location,
            isBookable,
            status: 'Available',
            customFields,
            photoUrl: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=300' // seed image
          };

          db.save('assets', newAsset, localStorage.getItem('assetflow_session'));
          closeModal();

          // Refresh Directory screen
          const appShell = document.getElementById('content-pane');
          renderAssetDirectory(appShell, auth.getCurrentUser());
        }
      }
    ]
  );

  // Hook Category select change to load dynamic inputs
  const catSelect = document.getElementById('ast-cat');
  catSelect.onchange = (e) => {
    const categoryId = e.target.value;
    const wrapper = document.getElementById('dynamic-fields-wrapper');
    wrapper.innerHTML = '';

    const category = categories.find(c => c.id === categoryId);
    if (!category || !category.fields || category.fields.length === 0) return;

    wrapper.innerHTML = `
      <div class="category-specific-header">Category Specific Details</div>
      <div class="form-row" style="margin-top: 0.5rem;">
        ${category.fields.map(f => `
          <div class="form-group">
            <label class="form-label" for="custom-f-${f.key}">${f.name}</label>
            <input type="${f.type}" id="custom-f-${f.key}" class="form-control" required>
          </div>
        `).join('')}
      </div>
    `;
  };
}

function showAssetDetailModal(assetId, user) {
  const dbData = db.getDB();
  const asset = dbData.assets.find(a => a.id === assetId);
  if (!asset) return;

  const category = dbData.categories.find(c => c.id === asset.categoryId);
  const categoryName = category ? category.name : 'Unknown';

  // Load Allocation History
  const allocations = dbData.allocations.filter(al => al.assetId === assetId);
  const employees = dbData.employees;
  const depts = dbData.departments;
  
  let allocationHistoryHTML = allocations.length === 0 
    ? '<p class="text-muted" style="font-size:0.85rem;">No allocation history found.</p>'
    : `<div class="table-wrapper" style="margin-top:0.5rem; max-height: 180px; overflow-y:auto;">
        <table class="custom-table" style="font-size:0.75rem;">
          <thead>
            <tr>
              <th>Holder</th>
              <th>Assigned Date</th>
              <th>Returned Date</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${allocations.map(al => {
              let assigneeName = 'Unknown';
              if (al.assigneeType === 'employee') {
                assigneeName = employees.find(e => e.id === al.assigneeId)?.name || 'Employee';
              } else {
                assigneeName = depts.find(d => d.id === al.assigneeId)?.name || 'Department';
              }
              return `
                <tr>
                  <td style="font-weight:600;">${assigneeName}</td>
                  <td>${al.allocatedDate}</td>
                  <td>${al.actualReturnDate || '<span class="text-warning">Active</span>'}</td>
                  <td>${al.notes || '-'}</td>
                </tr>
              `;
            }).reverse().join('')}
          </tbody>
        </table>
       </div>`;

  // Load Maintenance History
  const maintenance = dbData.maintenanceRequests.filter(m => m.assetId === assetId);
  let maintenanceHistoryHTML = maintenance.length === 0
    ? '<p class="text-muted" style="font-size:0.85rem;">No maintenance records found.</p>'
    : `<div class="table-wrapper" style="margin-top:0.5rem; max-height: 180px; overflow-y:auto;">
        <table class="custom-table" style="font-size:0.75rem;">
          <thead>
            <tr>
              <th>Request Date</th>
              <th>Issue Description</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${maintenance.map(m => `
              <tr>
                <td>${m.requestDate}</td>
                <td>${m.description}</td>
                <td>
                  <span class="badge ${m.priority === 'High' ? 'badge-lost' : m.priority === 'Medium' ? 'badge-undermaintenance' : 'badge-available'}">
                    ${m.priority}
                  </span>
                </td>
                <td>${m.status}</td>
                <td>${m.resolutionNotes || '-'}</td>
              </tr>
            `).reverse().join('')}
          </tbody>
        </table>
       </div>`;

  // Dynamic Custom fields key/value render
  let customFieldsHTML = '';
  if (category && category.fields && category.fields.length > 0) {
    customFieldsHTML = `
      <div style="border-top:1px solid var(--border-color); padding-top: 1rem; margin-top: 1rem;">
        <h4 style="font-size:0.85rem; color:var(--accent-color); margin-bottom:0.5rem; font-weight:600; text-transform:uppercase;">Category Attributes</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.85rem;">
          ${category.fields.map(f => {
            const val = asset.customFields ? asset.customFields[f.key] : null;
            return `<div><span class="text-muted">${f.name}:</span> <strong style="color:var(--text-main);">${val !== undefined && val !== null ? val : 'N/A'}</strong></div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  const html = `
    <div style="display:flex; gap:1.5rem; margin-bottom:1.5rem; flex-wrap:wrap;">
      <div style="width:120px; height:120px; border-radius:var(--border-radius); overflow:hidden; border:1px solid var(--border-color); background:#05070a;">
        <img src="${asset.photoUrl || 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=150'}" style="width:100%; height:100%; object-fit:cover;">
      </div>
      <div style="flex:1; min-width:200px; display:flex; flex-direction:column; gap:0.35rem;">
        <div><span class="text-muted" style="font-size:0.8rem; font-weight:600;">ASSET TAG:</span> <strong style="font-size:1.1rem; color:var(--accent-color);">${asset.tag}</strong></div>
        <div style="font-size:1rem; font-weight:700;">${asset.name}</div>
        <div style="font-size:0.85rem;"><span class="text-muted">Serial Number:</span> <strong>${asset.serialNumber}</strong></div>
        <div style="font-size:0.85rem;"><span class="text-muted">Category:</span> <strong>${categoryName}</strong></div>
        <div style="font-size:0.85rem;"><span class="text-muted">Acquisition:</span> <strong>$${asset.acquisitionCost}</strong> on <strong>${asset.acquisitionDate}</strong></div>
        <div style="font-size:0.85rem;"><span class="text-muted">Location:</span> <strong>${asset.location}</strong></div>
        <div style="font-size:0.85rem;"><span class="text-muted">Condition:</span> <strong>${asset.condition}</strong></div>
        <div style="font-size:0.85rem;"><span class="text-muted">Shared Booking Flag:</span> <strong>${asset.isBookable ? 'Yes (Bookable)' : 'No (Direct Allocate Only)'}</strong></div>
      </div>
    </div>
    
    ${customFieldsHTML}

    <!-- Tabbed details for Histories -->
    <div style="margin-top:1.5rem; border-top:1px solid var(--border-color); padding-top:1rem;">
      <h3 style="font-size:0.95rem; font-weight:700; margin-bottom:0.5rem;">Allocation History</h3>
      ${allocationHistoryHTML}
    </div>
    
    <div style="margin-top:1.5rem; border-top:1px solid var(--border-color); padding-top:1rem;">
      <h3 style="font-size:0.95rem; font-weight:700; margin-bottom:0.5rem;">Maintenance History</h3>
      ${maintenanceHistoryHTML}
    </div>
  `;

  openModal(`Asset Details: ${asset.tag}`, html, [{ text: 'Close', onClick: closeModal }]);
}

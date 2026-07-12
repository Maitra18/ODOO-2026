import { db } from '../db.js';
import { openModal, closeModal } from '../app.js';

let currentTab = 'departments'; // 'departments', 'categories', 'employees'

export function renderOrgSetup(container, user) {
  renderLayout(container);
}

function renderLayout(container) {
  container.innerHTML = `
    <div class="glass-card">
      <div class="tabs-container">
        <button class="tab-btn ${currentTab === 'departments' ? 'active' : ''}" id="tab-btn-depts">Departments</button>
        <button class="tab-btn ${currentTab === 'categories' ? 'active' : ''}" id="tab-btn-categories">Asset Categories</button>
        <button class="tab-btn ${currentTab === 'employees' ? 'active' : ''}" id="tab-btn-employees">Employee Directory</button>
      </div>
      
      <div id="tab-content-container">
        <!-- Dynamic content goes here -->
      </div>
    </div>
  `;

  // Bind tabs
  document.getElementById('tab-btn-depts').onclick = () => { currentTab = 'departments'; renderLayout(container); };
  document.getElementById('tab-btn-categories').onclick = () => { currentTab = 'categories'; renderLayout(container); };
  document.getElementById('tab-btn-employees').onclick = () => { currentTab = 'employees'; renderLayout(container); };

  const tabContent = document.getElementById('tab-content-container');

  if (currentTab === 'departments') {
    renderDepartments(tabContent);
  } else if (currentTab === 'categories') {
    renderCategories(tabContent);
  } else if (currentTab === 'employees') {
    renderEmployees(tabContent);
  }
}

// Tab A: Departments
function renderDepartments(container) {
  const depts = db.getAll('departments');
  const employees = db.getAll('employees');

  container.innerHTML = `
    <div class="actions-bar">
      <button class="btn btn-primary" id="btn-add-dept">
        <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        Create Department
      </button>
    </div>
    
    <div class="table-wrapper">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Department Name</th>
            <th>Department Head</th>
            <th>Parent Department</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="dept-table-body">
          ${depts.map(d => {
            const head = employees.find(e => e.id === d.headId);
            const parent = depts.find(p => p.id === d.parentId);
            return `
              <tr>
                <td style="font-weight:600;">${d.name}</td>
                <td>${head ? head.name : '<span class="text-muted">Unassigned</span>'}</td>
                <td>${parent ? parent.name : '<span class="text-muted">None</span>'}</td>
                <td>
                  <span class="badge ${d.status === 'active' ? 'badge-available' : 'badge-retired'}">
                    <span class="badge-dot"></span>
                    ${d.status}
                  </span>
                </td>
                <td>
                  <button class="btn btn-sm btn-secondary btn-edit-dept" data-id="${d.id}">Edit</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-add-dept').onclick = () => showDeptModal();
  document.querySelectorAll('.btn-edit-dept').forEach(btn => {
    btn.onclick = () => showDeptModal(btn.dataset.id);
  });
}

function showDeptModal(deptId = null) {
  const depts = db.getAll('departments');
  const employees = db.getAll('employees');
  const dept = deptId ? depts.find(d => d.id === deptId) : null;

  const html = `
    <form id="modal-dept-form">
      <input type="hidden" id="dept-id" value="${dept ? dept.id : ''}">
      <div class="form-group">
        <label class="form-label" for="dept-name">Department Name</label>
        <input type="text" id="dept-name" class="form-control" value="${dept ? dept.name : ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="dept-head">Department Head</label>
        <select id="dept-head" class="form-control">
          <option value="">-- Select Head --</option>
          ${employees.map(e => `<option value="${e.id}" ${dept && dept.headId === e.id ? 'selected' : ''}>${e.name} (${e.email})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="dept-parent">Parent Department</label>
        <select id="dept-parent" class="form-control">
          <option value="">-- None --</option>
          ${depts.filter(d => d.id !== deptId).map(d => `<option value="${d.id}" ${dept && dept.parentId === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="dept-status">Status</label>
        <select id="dept-status" class="form-control">
          <option value="active" ${dept && dept.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${dept && dept.status === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
    </form>
  `;

  openModal(
    deptId ? 'Edit Department' : 'Create Department',
    html,
    [
      { text: 'Cancel', onClick: closeModal },
      {
        text: 'Save',
        class: 'btn-primary',
        onClick: (e) => {
          const name = document.getElementById('dept-name').value;
          const headId = document.getElementById('dept-head').value;
          const parentId = document.getElementById('dept-parent').value;
          const status = document.getElementById('dept-status').value;
          const id = document.getElementById('dept-id').value;

          if (!name) return alert('Department name is required');

          const updatedDept = { name, headId: headId || null, parentId: parentId || null, status };
          if (id) updatedDept.id = id;

          db.save('departments', updatedDept, localStorage.getItem('assetflow_session'));
          closeModal();
          
          // Re-render
          const appShell = document.getElementById('content-pane');
          renderOrgSetup(appShell);
        }
      }
    ]
  );
}

// Tab B: Categories
function renderCategories(container) {
  const categories = db.getAll('categories');

  container.innerHTML = `
    <div class="actions-bar">
      <button class="btn btn-primary" id="btn-add-cat">
        <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        Add Category
      </button>
    </div>
    
    <div class="table-wrapper">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Category Name</th>
            <th>Category Custom Fields</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${categories.map(c => `
            <tr>
              <td style="font-weight:600;">${c.name}</td>
              <td>
                ${c.fields.length === 0 ? '<span class="text-muted">None</span>' : c.fields.map(f => `<span class="badge badge-allocated">${f.name} (${f.type})</span>`).join(' ')}
              </td>
              <td>
                <span class="badge ${c.status === 'active' ? 'badge-available' : 'badge-retired'}">
                  <span class="badge-dot"></span>
                  ${c.status}
                </span>
              </td>
              <td>
                <button class="btn btn-sm btn-secondary btn-edit-cat" data-id="${c.id}">Edit</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-add-cat').onclick = () => showCategoryModal();
  document.querySelectorAll('.btn-edit-cat').forEach(btn => {
    btn.onclick = () => showCategoryModal(btn.dataset.id);
  });
}

function showCategoryModal(catId = null) {
  const categories = db.getAll('categories');
  const cat = catId ? categories.find(c => c.id === catId) : null;
  let localFields = cat ? [...cat.fields] : [];

  const renderFieldsForm = (wrapper) => {
    wrapper.innerHTML = `
      <label class="form-label">Category Custom Fields</label>
      <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.25rem;">
        ${localFields.map((f, i) => `
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <input type="text" class="form-control field-name-input" data-idx="${i}" value="${f.name}" placeholder="Field Name" style="flex:2;">
            <select class="form-control field-type-input" data-idx="${i}" style="flex:1;">
              <option value="text" ${f.type === 'text' ? 'selected' : ''}>Text</option>
              <option value="number" ${f.type === 'number' ? 'selected' : ''}>Number</option>
            </select>
            <button type="button" class="btn btn-danger btn-sm btn-remove-field" data-idx="${i}" style="padding:0.45rem;">
              ✕
            </button>
          </div>
        `).join('')}
        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-custom-field" style="align-self:flex-start; margin-top:0.25rem;">
          + Add Field
        </button>
      </div>
    `;

    // Bind inputs changes back to localFields
    wrapper.querySelectorAll('.field-name-input').forEach(input => {
      input.oninput = (e) => { localFields[input.dataset.idx].name = e.target.value; };
    });
    wrapper.querySelectorAll('.field-type-input').forEach(select => {
      select.onchange = (e) => { localFields[select.dataset.idx].type = e.target.value; };
    });
    wrapper.querySelectorAll('.btn-remove-field').forEach(btn => {
      btn.onclick = () => {
        localFields.splice(btn.dataset.idx, 1);
        renderFieldsForm(wrapper);
      };
    });
    wrapper.querySelector('#btn-add-custom-field').onclick = () => {
      localFields.push({ name: '', key: '', type: 'text' });
      renderFieldsForm(wrapper);
    };
  };

  const html = `
    <form id="modal-cat-form">
      <input type="hidden" id="cat-id" value="${cat ? cat.id : ''}">
      <div class="form-group">
        <label class="form-label" for="cat-name">Category Name</label>
        <input type="text" id="cat-name" class="form-control" value="${cat ? cat.name : ''}" required>
      </div>
      <div class="form-group" id="fields-list-wrapper"></div>
      <div class="form-group">
        <label class="form-label" for="cat-status">Status</label>
        <select id="cat-status" class="form-control">
          <option value="active" ${cat && cat.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${cat && cat.status === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
    </form>
  `;

  openModal(
    catId ? 'Edit Asset Category' : 'Create Asset Category',
    html,
    [
      { text: 'Cancel', onClick: closeModal },
      {
        text: 'Save',
        class: 'btn-primary',
        onClick: (e) => {
          const name = document.getElementById('cat-name').value;
          const status = document.getElementById('cat-status').value;
          const id = document.getElementById('cat-id').value;

          if (!name) return alert('Category name is required');

          // Clean empty field names
          const finalFields = localFields.filter(f => f.name.trim() !== '').map(f => ({
            name: f.name.trim(),
            key: f.name.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
            type: f.type
          }));

          const updatedCat = { name, fields: finalFields, status };
          if (id) updatedCat.id = id;

          db.save('categories', updatedCat, localStorage.getItem('assetflow_session'));
          closeModal();
          
          // Re-render
          const appShell = document.getElementById('content-pane');
          renderOrgSetup(appShell);
        }
      }
    ]
  );

  // Setup list elements immediately after injection
  renderFieldsForm(document.getElementById('fields-list-wrapper'));
}

// Tab C: Employee Directory (Promote and Status check)
function renderEmployees(container) {
  const employees = db.getAll('employees');
  const depts = db.getAll('departments');

  container.innerHTML = `
    <div class="actions-bar">
      <div class="search-input-wrapper">
        <input type="text" id="employee-search" class="form-control" placeholder="Search directory by name or email..." style="padding-left:2.25rem;">
        <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
    </div>
    
    <div class="table-wrapper">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Department</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="employee-table-body">
          <!-- Populated dynamically via renderEmployeeRows -->
        </tbody>
      </table>
    </div>
  `;

  const renderEmployeeRows = (filterText = '') => {
    const tbody = document.getElementById('employee-table-body');
    const query = filterText.toLowerCase();
    
    const filtered = employees.filter(e => 
      e.name.toLowerCase().includes(query) || 
      e.email.toLowerCase().includes(query)
    );

    tbody.innerHTML = filtered.map(e => {
      const dept = depts.find(d => d.id === e.departmentId);
      let roleLabel = e.role.toUpperCase().replace('-', ' ');
      
      return `
        <tr>
          <td style="font-weight:600;">${e.name}</td>
          <td>${e.email}</td>
          <td>${dept ? dept.name : '<span class="text-muted">Unassigned</span>'}</td>
          <td>
            <span class="badge ${e.role === 'admin' ? 'badge-reserved' : e.role === 'manager' ? 'badge-allocated' : e.role === 'dept-head' ? 'badge-available' : 'badge-retired'}">
              ${roleLabel}
            </span>
          </td>
          <td>
            <span class="badge ${e.status === 'active' ? 'badge-available' : 'badge-lost'}">
              <span class="badge-dot"></span>
              ${e.status}
            </span>
          </td>
          <td>
            <button class="btn btn-sm btn-secondary btn-edit-employee" data-id="${e.id}">Edit / Promote</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-edit-employee').forEach(btn => {
      btn.onclick = () => showEmployeeModal(btn.dataset.id);
    });
  };

  renderEmployeeRows();
  document.getElementById('employee-search').oninput = (e) => renderEmployeeRows(e.target.value);
}

function showEmployeeModal(empId) {
  const employees = db.getAll('employees');
  const depts = db.getAll('departments');
  const emp = employees.find(e => e.id === empId);

  const html = `
    <form id="modal-employee-form">
      <input type="hidden" id="emp-id" value="${emp.id}">
      <div class="form-group">
        <label class="form-label">Employee Name</label>
        <input type="text" class="form-control" value="${emp.name}" disabled>
      </div>
      <div class="form-group">
        <label class="form-label">Email Address</label>
        <input type="text" class="form-control" value="${emp.email}" disabled>
      </div>
      <div class="form-group">
        <label class="form-label" for="emp-dept">Department</label>
        <select id="emp-dept" class="form-control">
          <option value="">-- Unassigned --</option>
          ${depts.map(d => `<option value="${d.id}" ${emp.departmentId === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="emp-role">Role Promotion</label>
        <select id="emp-role" class="form-control">
          <option value="employee" ${emp.role === 'employee' ? 'selected' : ''}>Employee</option>
          <option value="dept-head" ${emp.role === 'dept-head' ? 'selected' : ''}>Department Head</option>
          <option value="manager" ${emp.role === 'manager' ? 'selected' : ''}>Asset Manager</option>
          <option value="admin" ${emp.role === 'admin' ? 'selected' : ''}>Administrator</option>
        </select>
        <p class="text-muted" style="font-size:0.75rem; margin-top:0.25rem;">Changing roles modifies application-wide access rights.</p>
      </div>
      <div class="form-group">
        <label class="form-label" for="emp-status">Directory Status</label>
        <select id="emp-status" class="form-control">
          <option value="active" ${emp.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${emp.status === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
    </form>
  `;

  openModal(
    'Promote & Assign Employee',
    html,
    [
      { text: 'Cancel', onClick: closeModal },
      {
        text: 'Save Changes',
        class: 'btn-primary',
        onClick: (e) => {
          const departmentId = document.getElementById('emp-dept').value;
          const role = document.getElementById('emp-role').value;
          const status = document.getElementById('emp-status').value;
          const id = document.getElementById('emp-id').value;

          const updatedEmp = { ...emp, departmentId, role, status };

          db.save('employees', updatedEmp, localStorage.getItem('assetflow_session'));
          closeModal();

          // Re-render
          const appShell = document.getElementById('content-pane');
          renderOrgSetup(appShell);
        }
      }
    ]
  );
}



const DB_KEY = 'assetflow_db_v1';


const DEFAULT_DEPARTMENTS = [
  { id: 'dept-it', name: 'Information Technology', headId: 'emp-head', parentId: null, status: 'active' },
  { id: 'dept-hr', name: 'Human Resources', headId: null, parentId: null, status: 'active' },
  { id: 'dept-ops', name: 'Operations', headId: null, parentId: null, status: 'active' },
  { id: 'dept-dev', name: 'Software Development', headId: null, parentId: 'dept-it', status: 'active' }
];

const DEFAULT_CATEGORIES = [
  { id: 'cat-elec', name: 'Electronics', fields: [{ name: 'Warranty Period (Months)', key: 'warranty', type: 'number' }, { name: 'Brand', key: 'brand', type: 'text' }], status: 'active' },
  { id: 'cat-furn', name: 'Furniture', fields: [{ name: 'Material', key: 'material', type: 'text' }], status: 'active' },
  { id: 'cat-veh', name: 'Vehicles', fields: [{ name: 'License Plate', key: 'licensePlate', type: 'text' }, { name: 'Fuel Type', key: 'fuelType', type: 'text' }], status: 'active' },
  { id: 'cat-room', name: 'Shared Rooms', fields: [{ name: 'Capacity', key: 'capacity', type: 'number' }], status: 'active' }
];

const DEFAULT_EMPLOYEES = [
  { id: 'emp-admin', name: 'Alice Admin', email: 'admin@assetflow.com', password: 'admin123', departmentId: 'dept-it', role: 'admin', status: 'active' },
  { id: 'emp-manager', name: 'Bob Manager', email: 'manager@assetflow.com', password: 'manager123', departmentId: 'dept-ops', role: 'manager', status: 'active' },
  { id: 'emp-head', name: 'Charlie Head', email: 'head@assetflow.com', password: 'head123', departmentId: 'dept-it', role: 'dept-head', status: 'active' },
  { id: 'emp-emp', name: 'Priya Patel', email: 'employee@assetflow.com', password: 'employee123', departmentId: 'dept-dev', role: 'employee', status: 'active' },
  { id: 'emp-raj', name: 'Raj Kumar', email: 'raj@assetflow.com', password: 'employee123', departmentId: 'dept-dev', role: 'employee', status: 'active' }
];


const DEFAULT_ASSETS = [
  {
    id: 'asset-0001',
    name: 'MacBook Pro 16"',
    tag: 'AF-0001',
    serialNumber: 'SN-MBP16-9921',
    categoryId: 'cat-elec',
    acquisitionDate: '2026-01-10',
    acquisitionCost: 2499,
    condition: 'Excellent',
    location: 'HQ - Floor 3',
    photoUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300',
    isBookable: false,
    status: 'Allocated',
    customFields: { warranty: 24, brand: 'Apple' }
  },
  {
    id: 'asset-0002',
    name: 'ThinkPad T14',
    tag: 'AF-0002',
    serialNumber: 'SN-TPAD-5512',
    categoryId: 'cat-elec',
    acquisitionDate: '2026-02-15',
    acquisitionCost: 1250,
    condition: 'Good',
    location: 'HQ - Floor 3',
    photoUrl: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=300',
    isBookable: false,
    status: 'Available',
    customFields: { warranty: 36, brand: 'Lenovo' }
  },
  {
    id: 'asset-0003',
    name: 'Executive Ergonomic Chair',
    tag: 'AF-0003',
    serialNumber: 'SN-CHAIR-1102',
    categoryId: 'cat-furn',
    acquisitionDate: '2025-11-20',
    acquisitionCost: 450,
    condition: 'Good',
    location: 'HQ - Floor 4',
    photoUrl: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=300',
    isBookable: false,
    status: 'Available',
    customFields: { material: 'Mesh & Leather' }
  },
  {
    id: 'asset-0004',
    name: 'Conference Room Alpha',
    tag: 'AF-0004',
    serialNumber: 'RM-ALPHA',
    categoryId: 'cat-room',
    acquisitionDate: '2024-05-01',
    acquisitionCost: 0,
    condition: 'Excellent',
    location: 'HQ - Floor 1',
    photoUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=300',
    isBookable: true,
    status: 'Available',
    customFields: { capacity: 12 }
  },
  {
    id: 'asset-0005',
    name: 'Company Tesla Model 3',
    tag: 'AF-0005',
    serialNumber: 'SN-TESLA-8812',
    categoryId: 'cat-veh',
    acquisitionDate: '2025-06-10',
    acquisitionCost: 39990,
    condition: 'Good',
    location: 'Garage Box 3',
    photoUrl: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=300',
    isBookable: true,
    status: 'Available',
    customFields: { licensePlate: 'AF-V-999', fuelType: 'Electric' }
  },
  {
    id: 'asset-0006',
    name: 'Projector Epson Pro',
    tag: 'AF-0006',
    serialNumber: 'SN-PROJ-3482',
    categoryId: 'cat-elec',
    acquisitionDate: '2026-03-01',
    acquisitionCost: 799,
    condition: 'Fair',
    location: 'HQ - Floor 1 Storage',
    photoUrl: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=300',
    isBookable: true,
    status: 'Under Maintenance',
    customFields: { warranty: 12, brand: 'Epson' }
  }
];

const DEFAULT_ALLOCATIONS = [
  {
    id: 'alloc-0001',
    assetId: 'asset-0001',
    assigneeType: 'employee',
    assigneeId: 'emp-emp', // Priya Patel
    allocatedDate: '2026-06-01',
    expectedReturnDate: '2026-07-10', // Overdue
    actualReturnDate: null,
    notes: 'Standard issue dev hardware',
    returnConditionNotes: null,
    status: 'active'
  }
];

const DEFAULT_MAINTENANCE = [
  {
    id: 'maint-0001',
    assetId: 'asset-0006',
    reportedBy: 'emp-emp',
    requestDate: '2026-07-08',
    description: 'Bulb flickers after 15 minutes of usage.',
    priority: 'Medium',
    status: 'In Progress',
    technician: 'Alex Technician',
    resolutionNotes: null,
    photoUrl: ''
  }
];

const DEFAULT_BOOKINGS = [
  {
    id: 'book-0001',
    assetId: 'asset-0004',
    employeeId: 'emp-head',
    startDate: '2026-07-12T09:00',
    endDate: '2026-07-12T10:00',
    status: 'Completed'
  },
  {
    id: 'book-0002',
    assetId: 'asset-0004',
    employeeId: 'emp-emp',
    startDate: '2026-07-12T14:00',
    endDate: '2026-07-12T15:30',
    status: 'Upcoming'
  }
];

const DEFAULT_AUDITS = [
  {
    id: 'audit-0001',
    name: 'Mid-Year Electronics Audit',
    departmentId: 'dept-it',
    location: 'HQ - Floor 3',
    startDate: '2026-07-01',
    endDate: '2026-07-15',
    auditorIds: ['emp-manager'],
    status: 'active',
    verifications: {
      'asset-0001': { status: 'Verified', notes: 'Checked, held by Priya.', verifiedAt: '2026-07-05', verifiedBy: 'emp-manager' }
    }
  }
];

const DEFAULT_LOGS = [
  { id: 'log-0001', userId: 'emp-admin', userName: 'Alice Admin', action: 'System Setup & Seeded Initial Mock Database', date: '2026-07-12T08:00:00.000Z' }
];

const DEFAULT_NOTIFICATIONS = [
  { id: 'notif-0001', userId: 'emp-emp', title: 'Asset Allocated', message: 'MacBook Pro 16" has been allocated to you.', date: '2026-06-01T10:00:00.000Z', read: false },
  { id: 'notif-0002', userId: 'emp-emp', title: 'Asset Overdue Alert', message: 'Your allocation of MacBook Pro 16" was expected back on 2026-07-10. Please return it or coordinate a transfer.', date: '2026-07-11T09:00:00.000Z', read: false }
];

class AssetFlowDB {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(DB_KEY)) {
      const db = {
        departments: DEFAULT_DEPARTMENTS,
        categories: DEFAULT_CATEGORIES,
        employees: DEFAULT_EMPLOYEES,
        assets: DEFAULT_ASSETS,
        allocations: DEFAULT_ALLOCATIONS,
        bookings: DEFAULT_BOOKINGS,
        maintenanceRequests: DEFAULT_MAINTENANCE,
        auditCycles: DEFAULT_AUDITS,
        notifications: DEFAULT_NOTIFICATIONS,
        logs: DEFAULT_LOGS,
        transferRequests: []
      };
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
  }


  getDB() {
    return JSON.parse(localStorage.getItem(DB_KEY));
  }

  saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  
  getAll(entity) {
    return this.getDB()[entity] || [];
  }

  getById(entity, id) {
    return this.getAll(entity).find(item => item.id === id);
  }

  save(entity, data, userId = 'system') {
    const db = this.getDB();
    if (!db[entity]) db[entity] = [];

    const user = db.employees.find(e => e.id === userId) || { name: 'System' };

    if (data.id) {
   
      const idx = db[entity].findIndex(item => item.id === data.id);
      if (idx !== -1) {
        db[entity][idx] = { ...db[entity][idx], ...data };
        this.addLog(db, userId, user.name, `Updated ${entity} item: ${data.name || data.id}`);
      } else {
        db[entity].push(data);
        this.addLog(db, userId, user.name, `Created ${entity} item: ${data.name || data.id}`);
      }
    } else {

      let prefix = entity.slice(0, 3).toUpperCase();
      data.id = `${entity.slice(0, 3)}-${Date.now()}`;
      db[entity].push(data);
      this.addLog(db, userId, user.name, `Created ${entity} item: ${data.name || data.id}`);
    }

    this.saveDB(db);
    return data;
  }

  delete(entity, id, userId = 'system') {
    const db = this.getDB();
    if (!db[entity]) return;

    const user = db.employees.find(e => e.id === userId) || { name: 'System' };
    const item = db[entity].find(x => x.id === id);
    db[entity] = db[entity].filter(x => x.id !== id);

    this.addLog(db, userId, user.name, `Deleted ${entity} item: ${item?.name || id}`);
    this.saveDB(db);
  }

  addLog(db, userId, userName, action) {
    const log = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      userName,
      action,
      date: new Date().toISOString()
    };
    db.logs.unshift(log);
  }

  logAction(userId, action) {
    const db = this.getDB();
    const user = db.employees.find(e => e.id === userId) || { name: 'System' };
    this.addLog(db, userId, user.name, action);
    this.saveDB(db);
  }


  notify(userId, title, message) {
    const db = this.getDB();
    const notif = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      title,
      message,
      date: new Date().toISOString(),
      read: false
    };
    db.notifications.unshift(notif);
    this.saveDB(db);
  }


  notifyRole(role, title, message) {
    const db = this.getDB();
    const targets = db.employees.filter(e => e.role === role);
    const time = new Date().toISOString();
    targets.forEach(e => {
      db.notifications.unshift({
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: e.id,
        title,
        message,
        date: time,
        read: false
      });
    });
    this.saveDB(db);
  }
}

export const db = new AssetFlowDB();

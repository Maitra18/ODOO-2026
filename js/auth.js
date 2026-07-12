import { db } from './db.js';

const SESSION_KEY = 'assetflow_session';

class AuthManager {
  getCurrentUser() {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) return null;
    
    // Get fresh data from database in case roles/details were updated
    const user = db.getById('employees', session);
    if (!user || user.status !== 'active') {
      this.logout();
      return null;
    }
    return user;
  }

  login(email, password) {
    const employees = db.getAll('employees');
    const user = employees.find(
      e => e.email.toLowerCase() === email.toLowerCase() && e.password === password
    );

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (user.status !== 'active') {
      throw new Error('This account has been deactivated. Please contact your administrator.');
    }

    localStorage.setItem(SESSION_KEY, user.id);
    db.logAction(user.id, `User logged in`);
    return user;
  }

  signup(name, email, password) {
    const dbData = db.getDB();
    const employees = dbData.employees;

    const emailExists = employees.some(
      e => e.email.toLowerCase() === email.toLowerCase()
    );

    if (emailExists) {
      throw new Error('Email is already registered.');
    }

    const newEmployee = {
      id: `emp-${Date.now()}`,
      name,
      email,
      password,
      departmentId: '', // initially empty, assigned by admin
      role: 'employee', // Always default to employee to prevent self-privilege escalation
      status: 'active'
    };

    db.save('employees', newEmployee, newEmployee.id);
    db.logAction(newEmployee.id, `Created new employee account`);

    // Notify administrators of new signup
    db.notifyRole('admin', 'New Employee Signup', `${name} (${email}) has registered and requires department assignment.`);

    // Auto-login after signup
    localStorage.setItem(SESSION_KEY, newEmployee.id);
    return newEmployee;
  }

  logout() {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      db.logAction(currentUser.id, `User logged out`);
    }
    localStorage.removeItem(SESSION_KEY);
  }

  // Role Checker
  hasRole(allowedRoles) {
    const user = this.getCurrentUser();
    if (!user) return false;
    return allowedRoles.includes(user.role);
  }

  isAdmin() {
    return this.hasRole(['admin']);
  }

  isManager() {
    return this.hasRole(['admin', 'manager']);
  }

  isDeptHead() {
    return this.hasRole(['admin', 'dept-head']);
  }
}

export const auth = new AuthManager();

// ═══════════════════════════════════════════════════════════════════════════
// ROLE HIERARCHY & DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Role hierarchy (from highest to lowest privilege):
 * 
 * SYSTEM_ADMIN (Level 5)
 *   ↓
 * ADMIN (Level 4)
 *   ↓
 * HR_MANAGER (Level 3) / TEAM_LEAD (Level 3)
 *   ↓
 * EMPLOYEE (Level 1)
 * 
 * Higher level roles inherit permissions from lower levels
 */

export enum ROLES {
  // ─── System Level (Level 5) ───
  SYSTEM_ADMIN = 'system_admin',    // Full system access, multi-company

  // ─── Company Level (Level 4) ───
  ADMIN = 'admin',                  // Company-wide access, all features

  // ─── Department Level (Level 3) ───
  HR_MANAGER = 'hr_manager',        // HR operations, employee lifecycle
  TEAM_LEAD = 'team_lead',          // Team management, approvals

  // ─── Employee Level (Level 1) ───
  EMPLOYEE = 'employee',            // Standard employee access
}

// Role levels for comparison
export const ROLE_LEVELS: Record<ROLES, number> = {
  [ROLES.SYSTEM_ADMIN]: 5,
  [ROLES.ADMIN]: 4,
  [ROLES.HR_MANAGER]: 3,
  [ROLES.TEAM_LEAD]: 3,
  [ROLES.EMPLOYEE]: 1,
}

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION REGISTRY
// Comprehensive permission definitions for all features
// ═══════════════════════════════════════════════════════════════════════════

export const PERMISSIONS = {

  // ───────────────────────────────────────────────────────────────────────
  // DASHBOARD PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  DASHBOARD: {
    VIEW_OWN: 'dashboard.view_own',              // Personal dashboard
    VIEW_TEAM: 'dashboard.view_team',            // Team overview
    VIEW_COMPANY: 'dashboard.view_company',      // Company-wide stats
    VIEW_ANALYTICS: 'dashboard.view_analytics',  // Advanced analytics
    EXPORT_DATA: 'dashboard.export_data',        // Export dashboard data
  },

  // ───────────────────────────────────────────────────────────────────────
  // 👥 EMPLOYEE MANAGEMENT PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  EMPLOYEES: {
    // View permissions
    VIEW_OWN: 'employees.view_own',              // View own profile
    VIEW_TEAM: 'employees.view_team',            // View team members
    VIEW_ALL: 'employees.view_all',              // View all employees
    VIEW_DIRECTORY: 'employees.view_directory',  // Access employee directory

    // Create permissions
    CREATE: 'employees.create',                  // Create new employees
    INVITE: 'employees.invite',                  // Send invitations
    BULK_IMPORT: 'employees.bulk_import',        // Import from CSV/Excel

    // Update permissions
    UPDATE_OWN: 'employees.update_own',          // Edit own profile
    UPDATE_TEAM: 'employees.update_team',        // Edit team members
    UPDATE_ALL: 'employees.update_all',          // Edit any employee
    UPDATE_SENSITIVE: 'employees.update_sensitive', // Edit salary, contracts

    // Delete permissions
    DEACTIVATE: 'employees.deactivate',          // Deactivate employees
    DELETE: 'employees.delete',                  // Permanently delete

    // Assignment permissions
    ASSIGN_ROLES: 'employees.assign_roles',      // Assign/remove roles
    ASSIGN_TEAMS: 'employees.assign_teams',      // Assign to teams
    ASSIGN_MANAGER: 'employees.assign_manager',  // Assign manager/approver
    ASSIGN_REGIONS: 'employees.assign_regions',  // Assign regions

    // Advanced permissions
    VIEW_AUDIT_LOG: 'employees.view_audit_log',  // View change history
    EXPORT: 'employees.export',                  // Export employee data
  },

  // ───────────────────────────────────────────────────────────────────────
  // ⏰ TIMESHEET PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  TIMESHEETS: {
    // View permissions
    VIEW_OWN: 'timesheets.view_own',             // View own timesheets
    VIEW_TEAM: 'timesheets.view_team',           // View team timesheets
    VIEW_ALL: 'timesheets.view_all',             // View all timesheets
    VIEW_HISTORY: 'timesheets.view_history',     // View historical data

    // Entry permissions
    CREATE_OWN: 'timesheets.create_own',         // Create own entries
    UPDATE_OWN: 'timesheets.update_own',         // Update own entries
    UPDATE_DRAFT: 'timesheets.update_draft',     // Update draft entries
    UPDATE_SUBMITTED: 'timesheets.update_submitted', // Update after submission
    DELETE_OWN: 'timesheets.delete_own',         // Delete own entries

    // Workflow permissions
    SUBMIT: 'timesheets.submit',                 // Submit for approval
    WITHDRAW: 'timesheets.withdraw',             // Withdraw submission
    RESUBMIT: 'timesheets.resubmit',            // Resubmit after rejection

    // Approval permissions
    APPROVE_TEAM: 'timesheets.approve_team',     // Approve team timesheets
    APPROVE_ALL: 'timesheets.approve_all',       // Approve any timesheet
    REJECT: 'timesheets.reject',                 // Reject timesheets
    UNLOCK: 'timesheets.unlock',                 // Unlock approved timesheets

    // Comment permissions
    COMMENT_OWN: 'timesheets.comment_own',       // Comment on own
    COMMENT_TEAM: 'timesheets.comment_team',     // Comment on team
    COMMENT_ALL: 'timesheets.comment_all',       // Comment on any
    DELETE_COMMENTS: 'timesheets.delete_comments', // Delete any comments

    // Advanced permissions
    VIEW_REPORTS: 'timesheets.view_reports',     // View timesheet reports
    EXPORT: 'timesheets.export',                 // Export timesheet data
    ADJUST_HOURS: 'timesheets.adjust_hours',     // Manually adjust hours
    OVERRIDE_VALIDATION: 'timesheets.override_validation', // Override validations
  },

  // ───────────────────────────────────────────────────────────────────────
  // 🏖️ LEAVE MANAGEMENT PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  LEAVES: {
    // View permissions
    VIEW_OWN: 'leaves.view_own',                 // View own leaves
    VIEW_TEAM: 'leaves.view_team',               // View team leaves
    VIEW_ALL: 'leaves.view_all',                 // View all leaves
    VIEW_BALANCES: 'leaves.view_balances',       // View leave balances
    VIEW_CALENDAR: 'leaves.view_calendar',       // View leave calendar

    // Request permissions
    REQUEST: 'leaves.request',                   // Request leave
    REQUEST_BACKDATE: 'leaves.request_backdate', // Request past dates
    REQUEST_ADVANCE: 'leaves.request_advance',   // Request future (>3 months)

    // Manage own requests
    CANCEL_OWN: 'leaves.cancel_own',             // Cancel own request
    UPDATE_OWN: 'leaves.update_own',             // Update own request

    // Approval permissions
    APPROVE_TEAM: 'leaves.approve_team',         // Approve team leaves
    APPROVE_ALL: 'leaves.approve_all',           // Approve any leave
    REJECT: 'leaves.reject',                     // Reject leave requests
    CANCEL_APPROVED: 'leaves.cancel_approved',   // Cancel approved leaves

    // Policy management
    MANAGE_POLICIES: 'leaves.manage_policies',   // Create/edit policies
    MANAGE_BALANCES: 'leaves.manage_balances',   // Adjust leave balances
    MANAGE_ACCRUALS: 'leaves.manage_accruals',   // Configure accrual rules

    // Advanced permissions
    VIEW_REPORTS: 'leaves.view_reports',         // View leave reports
    EXPORT: 'leaves.export',                     // Export leave data
    OVERRIDE_BALANCE: 'leaves.override_balance', // Override balance checks
  },

  // ───────────────────────────────────────────────────────────────────────
  // 👨‍👩‍👧‍👦 TEAM MANAGEMENT PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  TEAMS: {
    // View permissions
    VIEW_OWN: 'teams.view_own',                  // View own team
    VIEW_ALL: 'teams.view_all',                  // View all teams
    VIEW_HIERARCHY: 'teams.view_hierarchy',      // View org structure

    // Team CRUD
    CREATE: 'teams.create',                      // Create teams
    UPDATE: 'teams.update',                      // Update teams
    DELETE: 'teams.delete',                      // Delete teams
    ARCHIVE: 'teams.archive',                    // Archive teams

    // Member management
    ASSIGN_MEMBERS: 'teams.assign_members',      // Add members
    REMOVE_MEMBERS: 'teams.remove_members',      // Remove members
    TRANSFER_MEMBERS: 'teams.transfer_members',  // Move between teams

    // Leadership
    ASSIGN_LEAD: 'teams.assign_lead',            // Assign team lead
    REMOVE_LEAD: 'teams.remove_lead',            // Remove team lead

    // Advanced
    VIEW_STATS: 'teams.view_stats',              // View team statistics
    EXPORT: 'teams.export',                      // Export team data
  },

  // ───────────────────────────────────────────────────────────────────────
  // 🛡️ ROLE MANAGEMENT PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  ROLES: {
    VIEW: 'roles.view',                          // View roles
    CREATE: 'roles.create',                      // Create custom roles
    UPDATE: 'roles.update',                      // Update roles
    DELETE: 'roles.delete',                      // Delete roles
    ASSIGN: 'roles.assign',                      // Assign roles to employees
    REVOKE: 'roles.revoke',                      // Revoke roles
    MANAGE_PERMISSIONS: 'roles.manage_permissions', // Edit role permissions
  },

  // ───────────────────────────────────────────────────────────────────────
  // 📢 ANNOUNCEMENTS PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  ANNOUNCEMENTS: {
    VIEW: 'announcements.view',                  // View announcements
    VIEW_ARCHIVED: 'announcements.view_archived', // View archived

    CREATE: 'announcements.create',              // Create announcements
    UPDATE_OWN: 'announcements.update_own',      // Update own
    UPDATE_ALL: 'announcements.update_all',      // Update any

    DELETE_OWN: 'announcements.delete_own',      // Delete own
    DELETE_ALL: 'announcements.delete_all',      // Delete any

    PIN: 'announcements.pin',                    // Pin to top
    UNPIN: 'announcements.unpin',                // Unpin
    ARCHIVE: 'announcements.archive',            // Archive

    TARGET_AUDIENCE: 'announcements.target_audience', // Target specific groups
    SCHEDULE: 'announcements.schedule',          // Schedule publishing
  },

  // ───────────────────────────────────────────────────────────────────────
  // 📄 DOCUMENT MANAGEMENT PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  DOCUMENTS: {
    // View permissions
    VIEW_OWN: 'documents.view_own',              // View own documents
    VIEW_TEAM: 'documents.view_team',            // View team documents
    VIEW_ALL: 'documents.view_all',              // View all documents
    VIEW_COMPANY: 'documents.view_company',      // View company documents

    // Upload/Download
    UPLOAD: 'documents.upload',                  // Upload documents
    DOWNLOAD: 'documents.download',              // Download documents
    DOWNLOAD_ALL: 'documents.download_all',      // Download any document

    // Update permissions
    UPDATE_OWN: 'documents.update_own',          // Update own documents
    UPDATE_ALL: 'documents.update_all',          // Update any document

    // Delete permissions
    DELETE_OWN: 'documents.delete_own',          // Delete own documents
    DELETE_ALL: 'documents.delete_all',          // Delete any document

    // Organization
    CREATE_FOLDERS: 'documents.create_folders',  // Create folder structure
    MANAGE_FOLDERS: 'documents.manage_folders',  // Manage folders

    // Acknowledgments
    REQUIRE_ACKNOWLEDGMENT: 'documents.require_ack', // Require acknowledgment
    VIEW_ACKNOWLEDGMENTS: 'documents.view_acks', // View who acknowledged
    TRACK_DOWNLOADS: 'documents.track_downloads', // Track download history

    // Version control
    VIEW_VERSIONS: 'documents.view_versions',    // View version history
    RESTORE_VERSIONS: 'documents.restore_versions', // Restore old versions
  },

  // ───────────────────────────────────────────────────────────────────────
  // 📋 POLICY ACKNOWLEDGMENT PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  POLICIES: {
    VIEW: 'policies.view',                       // View policies
    ACKNOWLEDGE: 'policies.acknowledge',         // Acknowledge policies

    CREATE: 'policies.create',                   // Create policies
    UPDATE: 'policies.update',                   // Update policies
    DELETE: 'policies.delete',                   // Delete policies
    PUBLISH: 'policies.publish',                 // Publish policies

    REQUIRE_ACKNOWLEDGMENT: 'policies.require_ack', // Require acknowledgment
    VIEW_ACKNOWLEDGMENTS: 'policies.view_acks',  // View acknowledgment status
    TRACK_COMPLIANCE: 'policies.track_compliance', // Compliance tracking
    SEND_REMINDERS: 'policies.send_reminders',   // Send reminder emails

    EXEMPT_USERS: 'policies.exempt_users',       // Exempt specific users
  },

  // ───────────────────────────────────────────────────────────────────────
  // 🎉 CELEBRATIONS & ANNIVERSARIES PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  CELEBRATIONS: {
    VIEW_OWN: 'celebrations.view_own',           // View own celebrations
    VIEW_TEAM: 'celebrations.view_team',         // View team celebrations
    VIEW_ALL: 'celebrations.view_all',           // View all celebrations

    MANAGE: 'celebrations.manage',               // Manage celebrations
    SEND_WISHES: 'celebrations.send_wishes',     // Send congratulations

    CONFIGURE_TYPES: 'celebrations.configure_types', // Configure celebration types
    CONFIGURE_NOTIFICATIONS: 'celebrations.configure_notifications', // Email settings
  },

  // ───────────────────────────────────────────────────────────────────────
  // 🔍 AUDIT LOG PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  AUDIT: {
    VIEW_OWN: 'audit.view_own',                  // View own activity
    VIEW_TEAM: 'audit.view_team',                // View team activity
    VIEW_ALL: 'audit.view_all',                  // View all activity

    VIEW_SENSITIVE: 'audit.view_sensitive',      // View sensitive actions
    VIEW_SECURITY: 'audit.view_security',        // View security events

    EXPORT: 'audit.export',                      // Export audit logs
    CONFIGURE_RETENTION: 'audit.configure_retention', // Configure retention
  },

  // ───────────────────────────────────────────────────────────────────────
  // ⚙️ SETTINGS PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  SETTINGS: {
    // Company settings
    VIEW_COMPANY: 'settings.view_company',       // View company settings
    UPDATE_COMPANY: 'settings.update_company',   // Update company info

    // Regional settings
    MANAGE_HOLIDAYS: 'settings.manage_holidays', // Manage public holidays
    MANAGE_REGIONS: 'settings.manage_regions',   // Manage regions
    MANAGE_DEPARTMENTS: 'settings.manage_departments', // Manage departments
    MANAGE_LOCATIONS: 'settings.manage_locations', // Manage office locations

    // Integration settings
    VIEW_INTEGRATIONS: 'settings.view_integrations', // View integrations
    MANAGE_INTEGRATIONS: 'settings.manage_integrations', // Manage integrations
    MANAGE_API_KEYS: 'settings.manage_api_keys', // Manage API keys

    // Email settings
    MANAGE_EMAIL_TEMPLATES: 'settings.manage_email_templates', // Email templates
    CONFIGURE_SMTP: 'settings.configure_smtp',   // SMTP configuration

    // System settings
    MANAGE_PERMISSIONS: 'settings.manage_permissions', // Permission config
    VIEW_SYSTEM_HEALTH: 'settings.view_system_health', // System monitoring
    MANAGE_BACKUPS: 'settings.manage_backups',   // Backup management
  },

  // ───────────────────────────────────────────────────────────────────────
  // 👔 APPROVER MANAGEMENT PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  APPROVERS: {
    VIEW_DIRECTORY: 'approvers.view_directory',  // View employee directory
    VIEW_HIERARCHY: 'approvers.view_hierarchy',  // View reporting hierarchy
    VIEW_CHAIN: 'approvers.view_chain',          // View approval chain

    ASSIGN_APPROVER: 'approvers.assign_approver', // Assign approvers
    CHANGE_APPROVER: 'approvers.change_approver', // Change approvers
    REMOVE_APPROVER: 'approvers.remove_approver', // Remove approvers

    CONFIGURE_RULES: 'approvers.configure_rules', // Configure approval rules
    VIEW_STATS: 'approvers.view_stats',          // View approver statistics

    DELEGATE: 'approvers.delegate',              // Delegate approvals
  },

  // ───────────────────────────────────────────────────────────────────────
  // 🔔 NOTIFICATION PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  NOTIFICATIONS: {
    VIEW_OWN: 'notifications.view_own',          // View own notifications
    MANAGE_PREFERENCES: 'notifications.manage_preferences', // Manage preferences

    SEND_TEAM: 'notifications.send_team',        // Send to team
    SEND_COMPANY: 'notifications.send_company',  // Send company-wide
    SEND_TARGETED: 'notifications.send_targeted', // Send to specific groups

    CONFIGURE_CHANNELS: 'notifications.configure_channels', // Email/Slack/SMS
    VIEW_ANALYTICS: 'notifications.view_analytics', // View delivery stats
  },

  // ───────────────────────────────────────────────────────────────────────
  // 📊 REPORTS & ANALYTICS PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────
  REPORTS: {
    // View reports
    VIEW_OWN: 'reports.view_own',                // View own reports
    VIEW_TEAM: 'reports.view_team',              // View team reports
    VIEW_DEPARTMENT: 'reports.view_department',  // View department reports
    VIEW_COMPANY: 'reports.view_company',        // View company reports

    // Create reports
    CREATE_CUSTOM: 'reports.create_custom',      // Create custom reports
    SAVE_TEMPLATES: 'reports.save_templates',    // Save report templates

    // Export
    EXPORT: 'reports.export',                    // Export reports
    EXPORT_RAW_DATA: 'reports.export_raw_data',  // Export raw data

    // Automation
    SCHEDULE: 'reports.schedule',                // Schedule automated reports
    CONFIGURE_DELIVERY: 'reports.configure_delivery', // Configure email delivery

    // Advanced analytics
    VIEW_PREDICTIVE: 'reports.view_predictive',  // Predictive analytics
    VIEW_BENCHMARKS: 'reports.view_benchmarks',  // Industry benchmarks
  },

  // ───────────────────────────────────────────────────────────────────────
  // 💰 PAYROLL PERMISSIONS (Future-proofing)
  // ───────────────────────────────────────────────────────────────────────
  PAYROLL: {
    VIEW_OWN: 'payroll.view_own',                // View own payroll
    VIEW_TEAM: 'payroll.view_team',              // View team payroll
    VIEW_ALL: 'payroll.view_all',                // View all payroll

    PROCESS: 'payroll.process',                  // Process payroll
    APPROVE: 'payroll.approve',                  // Approve payroll

    MANAGE_COMPONENTS: 'payroll.manage_components', // Salary components
    MANAGE_DEDUCTIONS: 'payroll.manage_deductions', // Tax/deductions

    EXPORT: 'payroll.export',                    // Export payroll data
  },

  // ───────────────────────────────────────────────────────────────────────
  // 📚 TRAINING & DEVELOPMENT PERMISSIONS (Future-proofing)
  // ───────────────────────────────────────────────────────────────────────
  TRAINING: {
    VIEW_CATALOG: 'training.view_catalog',       // View course catalog
    ENROLL: 'training.enroll',                   // Enroll in courses
    VIEW_PROGRESS: 'training.view_progress',     // View progress

    CREATE_COURSES: 'training.create_courses',   // Create courses
    ASSIGN_COURSES: 'training.assign_courses',   // Assign to employees

    VIEW_REPORTS: 'training.view_reports',       // View training reports
    ISSUE_CERTIFICATES: 'training.issue_certificates', // Issue certificates
  },

} as const

// ═══════════════════════════════════════════════════════════════════════════
// ROLE-PERMISSION MAPPINGS
// Complete permission assignments for each role
// ═══════════════════════════════════════════════════════════════════════════

type Permission = string

export const ROLE_PERMISSIONS: Record<ROLES, Permission[]> = {

  // ─────────────────────────────────────────────────────────────────────────
  // 🔴 SYSTEM ADMIN - God Mode (ALL PERMISSIONS)
  // ─────────────────────────────────────────────────────────────────────────
  [ROLES.SYSTEM_ADMIN]: [
    ...Object.values(PERMISSIONS.DASHBOARD),
    ...Object.values(PERMISSIONS.EMPLOYEES),
    ...Object.values(PERMISSIONS.TIMESHEETS),
    ...Object.values(PERMISSIONS.LEAVES),
    ...Object.values(PERMISSIONS.TEAMS),
    ...Object.values(PERMISSIONS.ROLES),
    ...Object.values(PERMISSIONS.ANNOUNCEMENTS),
    ...Object.values(PERMISSIONS.DOCUMENTS),
    ...Object.values(PERMISSIONS.POLICIES),
    ...Object.values(PERMISSIONS.CELEBRATIONS),
    ...Object.values(PERMISSIONS.AUDIT),
    ...Object.values(PERMISSIONS.SETTINGS),
    ...Object.values(PERMISSIONS.APPROVERS),
    ...Object.values(PERMISSIONS.NOTIFICATIONS),
    ...Object.values(PERMISSIONS.REPORTS),
    ...Object.values(PERMISSIONS.PAYROLL),
    ...Object.values(PERMISSIONS.TRAINING),
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // 🔵 ADMIN - Company Administrator
  // ─────────────────────────────────────────────────────────────────────────
  [ROLES.ADMIN]: [
    // Dashboard - Full access
    PERMISSIONS.DASHBOARD.VIEW_OWN,
    PERMISSIONS.DASHBOARD.VIEW_TEAM,
    PERMISSIONS.DASHBOARD.VIEW_COMPANY,
    PERMISSIONS.DASHBOARD.VIEW_ANALYTICS,
    PERMISSIONS.DASHBOARD.EXPORT_DATA,

    // Employees - Full management
    PERMISSIONS.EMPLOYEES.VIEW_OWN,
    PERMISSIONS.EMPLOYEES.VIEW_TEAM,
    PERMISSIONS.EMPLOYEES.VIEW_ALL,
    PERMISSIONS.EMPLOYEES.VIEW_DIRECTORY,
    PERMISSIONS.EMPLOYEES.CREATE,
    PERMISSIONS.EMPLOYEES.INVITE,
    PERMISSIONS.EMPLOYEES.BULK_IMPORT,
    PERMISSIONS.EMPLOYEES.UPDATE_OWN,
    PERMISSIONS.EMPLOYEES.UPDATE_ALL,
    PERMISSIONS.EMPLOYEES.UPDATE_SENSITIVE,
    PERMISSIONS.EMPLOYEES.DEACTIVATE,
    PERMISSIONS.EMPLOYEES.DELETE,
    PERMISSIONS.EMPLOYEES.ASSIGN_ROLES,
    PERMISSIONS.EMPLOYEES.ASSIGN_TEAMS,
    PERMISSIONS.EMPLOYEES.ASSIGN_MANAGER,
    PERMISSIONS.EMPLOYEES.ASSIGN_REGIONS,
    PERMISSIONS.EMPLOYEES.VIEW_AUDIT_LOG,
    PERMISSIONS.EMPLOYEES.EXPORT,

    // Timesheets - Full control
    PERMISSIONS.TIMESHEETS.VIEW_ALL,
    PERMISSIONS.TIMESHEETS.VIEW_HISTORY,
    PERMISSIONS.TIMESHEETS.APPROVE_TEAM,
    PERMISSIONS.TIMESHEETS.APPROVE_ALL,
    PERMISSIONS.TIMESHEETS.REJECT,
    PERMISSIONS.TIMESHEETS.UNLOCK,
    PERMISSIONS.TIMESHEETS.COMMENT_ALL,
    PERMISSIONS.TIMESHEETS.DELETE_COMMENTS,
    PERMISSIONS.TIMESHEETS.VIEW_REPORTS,
    PERMISSIONS.TIMESHEETS.EXPORT,
    PERMISSIONS.TIMESHEETS.ADJUST_HOURS,
    PERMISSIONS.TIMESHEETS.OVERRIDE_VALIDATION,

    // Leaves - Full control
    PERMISSIONS.LEAVES.VIEW_ALL,
    PERMISSIONS.LEAVES.VIEW_BALANCES,
    PERMISSIONS.LEAVES.VIEW_CALENDAR,
    PERMISSIONS.LEAVES.REQUEST,
    PERMISSIONS.LEAVES.REQUEST_BACKDATE,
    PERMISSIONS.LEAVES.CANCEL_OWN,
    PERMISSIONS.LEAVES.APPROVE_TEAM,
    PERMISSIONS.LEAVES.APPROVE_ALL,
    PERMISSIONS.LEAVES.REJECT,
    PERMISSIONS.LEAVES.CANCEL_APPROVED,
    PERMISSIONS.LEAVES.MANAGE_POLICIES,
    PERMISSIONS.LEAVES.MANAGE_BALANCES,
    PERMISSIONS.LEAVES.MANAGE_ACCRUALS,
    PERMISSIONS.LEAVES.VIEW_REPORTS,
    PERMISSIONS.LEAVES.EXPORT,
    PERMISSIONS.LEAVES.OVERRIDE_BALANCE,

    // Teams - Full management
    PERMISSIONS.TEAMS.VIEW_ALL,
    PERMISSIONS.TEAMS.VIEW_HIERARCHY,
    PERMISSIONS.TEAMS.CREATE,
    PERMISSIONS.TEAMS.UPDATE,
    PERMISSIONS.TEAMS.DELETE,
    PERMISSIONS.TEAMS.ARCHIVE,
    PERMISSIONS.TEAMS.ASSIGN_MEMBERS,
    PERMISSIONS.TEAMS.REMOVE_MEMBERS,
    PERMISSIONS.TEAMS.TRANSFER_MEMBERS,
    PERMISSIONS.TEAMS.ASSIGN_LEAD,
    PERMISSIONS.TEAMS.REMOVE_LEAD,
    PERMISSIONS.TEAMS.VIEW_STATS,
    PERMISSIONS.TEAMS.EXPORT,

    // Roles - Full management
    PERMISSIONS.ROLES.VIEW,
    PERMISSIONS.ROLES.CREATE,
    PERMISSIONS.ROLES.UPDATE,
    PERMISSIONS.ROLES.DELETE,
    PERMISSIONS.ROLES.ASSIGN,
    PERMISSIONS.ROLES.REVOKE,
    PERMISSIONS.ROLES.MANAGE_PERMISSIONS,

    // Announcements - Full control
    PERMISSIONS.ANNOUNCEMENTS.VIEW,
    PERMISSIONS.ANNOUNCEMENTS.VIEW_ARCHIVED,
    PERMISSIONS.ANNOUNCEMENTS.CREATE,
    PERMISSIONS.ANNOUNCEMENTS.UPDATE_ALL,
    PERMISSIONS.ANNOUNCEMENTS.DELETE_ALL,
    PERMISSIONS.ANNOUNCEMENTS.PIN,
    PERMISSIONS.ANNOUNCEMENTS.UNPIN,
    PERMISSIONS.ANNOUNCEMENTS.ARCHIVE,
    PERMISSIONS.ANNOUNCEMENTS.TARGET_AUDIENCE,
    PERMISSIONS.ANNOUNCEMENTS.SCHEDULE,

    // Documents - Full control
    PERMISSIONS.DOCUMENTS.VIEW_ALL,
    PERMISSIONS.DOCUMENTS.VIEW_COMPANY,
    PERMISSIONS.DOCUMENTS.UPLOAD,
    PERMISSIONS.DOCUMENTS.DOWNLOAD_ALL,
    PERMISSIONS.DOCUMENTS.UPDATE_ALL,
    PERMISSIONS.DOCUMENTS.DELETE_ALL,
    PERMISSIONS.DOCUMENTS.CREATE_FOLDERS,
    PERMISSIONS.DOCUMENTS.MANAGE_FOLDERS,
    PERMISSIONS.DOCUMENTS.REQUIRE_ACKNOWLEDGMENT,
    PERMISSIONS.DOCUMENTS.VIEW_ACKNOWLEDGMENTS,
    PERMISSIONS.DOCUMENTS.TRACK_DOWNLOADS,
    PERMISSIONS.DOCUMENTS.VIEW_VERSIONS,
    PERMISSIONS.DOCUMENTS.RESTORE_VERSIONS,

    // Policies - Full control
    PERMISSIONS.POLICIES.VIEW,
    PERMISSIONS.POLICIES.ACKNOWLEDGE,
    PERMISSIONS.POLICIES.CREATE,
    PERMISSIONS.POLICIES.UPDATE,
    PERMISSIONS.POLICIES.DELETE,
    PERMISSIONS.POLICIES.PUBLISH,
    PERMISSIONS.POLICIES.REQUIRE_ACKNOWLEDGMENT,
    PERMISSIONS.POLICIES.VIEW_ACKNOWLEDGMENTS,
    PERMISSIONS.POLICIES.TRACK_COMPLIANCE,
    PERMISSIONS.POLICIES.SEND_REMINDERS,
    PERMISSIONS.POLICIES.EXEMPT_USERS,

    // Celebrations
    PERMISSIONS.CELEBRATIONS.VIEW_ALL,
    PERMISSIONS.CELEBRATIONS.MANAGE,
    PERMISSIONS.CELEBRATIONS.SEND_WISHES,
    PERMISSIONS.CELEBRATIONS.CONFIGURE_TYPES,
    PERMISSIONS.CELEBRATIONS.CONFIGURE_NOTIFICATIONS,

    // Audit
    PERMISSIONS.AUDIT.VIEW_ALL,
    PERMISSIONS.AUDIT.VIEW_SENSITIVE,
    PERMISSIONS.AUDIT.VIEW_SECURITY,
    PERMISSIONS.AUDIT.EXPORT,
    PERMISSIONS.AUDIT.CONFIGURE_RETENTION,

    // Settings - Full control
    PERMISSIONS.SETTINGS.VIEW_COMPANY,
    PERMISSIONS.SETTINGS.UPDATE_COMPANY,
    PERMISSIONS.SETTINGS.MANAGE_HOLIDAYS,
    PERMISSIONS.SETTINGS.MANAGE_REGIONS,
    PERMISSIONS.SETTINGS.MANAGE_DEPARTMENTS,
    PERMISSIONS.SETTINGS.MANAGE_LOCATIONS,
    PERMISSIONS.SETTINGS.VIEW_INTEGRATIONS,
    PERMISSIONS.SETTINGS.MANAGE_INTEGRATIONS,
    PERMISSIONS.SETTINGS.MANAGE_API_KEYS,
    PERMISSIONS.SETTINGS.MANAGE_EMAIL_TEMPLATES,
    PERMISSIONS.SETTINGS.CONFIGURE_SMTP,
    PERMISSIONS.SETTINGS.MANAGE_PERMISSIONS,
    PERMISSIONS.SETTINGS.VIEW_SYSTEM_HEALTH,
    PERMISSIONS.SETTINGS.MANAGE_BACKUPS,

    // Approvers
    PERMISSIONS.APPROVERS.VIEW_DIRECTORY,
    PERMISSIONS.APPROVERS.VIEW_HIERARCHY,
    PERMISSIONS.APPROVERS.VIEW_CHAIN,
    PERMISSIONS.APPROVERS.ASSIGN_APPROVER,
    PERMISSIONS.APPROVERS.CHANGE_APPROVER,
    PERMISSIONS.APPROVERS.REMOVE_APPROVER,
    PERMISSIONS.APPROVERS.CONFIGURE_RULES,
    PERMISSIONS.APPROVERS.VIEW_STATS,
    PERMISSIONS.APPROVERS.DELEGATE,

    // Notifications
    PERMISSIONS.NOTIFICATIONS.VIEW_OWN,
    PERMISSIONS.NOTIFICATIONS.MANAGE_PREFERENCES,
    PERMISSIONS.NOTIFICATIONS.SEND_COMPANY,
    PERMISSIONS.NOTIFICATIONS.SEND_TARGETED,
    PERMISSIONS.NOTIFICATIONS.CONFIGURE_CHANNELS,
    PERMISSIONS.NOTIFICATIONS.VIEW_ANALYTICS,

    // Reports
    PERMISSIONS.REPORTS.VIEW_COMPANY,
    PERMISSIONS.REPORTS.CREATE_CUSTOM,
    PERMISSIONS.REPORTS.SAVE_TEMPLATES,
    PERMISSIONS.REPORTS.EXPORT,
    PERMISSIONS.REPORTS.EXPORT_RAW_DATA,
    PERMISSIONS.REPORTS.SCHEDULE,
    PERMISSIONS.REPORTS.CONFIGURE_DELIVERY,
    PERMISSIONS.REPORTS.VIEW_PREDICTIVE,
    PERMISSIONS.REPORTS.VIEW_BENCHMARKS,

    // Payroll
    PERMISSIONS.PAYROLL.VIEW_ALL,
    PERMISSIONS.PAYROLL.PROCESS,
    PERMISSIONS.PAYROLL.APPROVE,
    PERMISSIONS.PAYROLL.MANAGE_COMPONENTS,
    PERMISSIONS.PAYROLL.MANAGE_DEDUCTIONS,
    PERMISSIONS.PAYROLL.EXPORT,

    // Training
    PERMISSIONS.TRAINING.VIEW_CATALOG,
    PERMISSIONS.TRAINING.ENROLL,
    PERMISSIONS.TRAINING.CREATE_COURSES,
    PERMISSIONS.TRAINING.ASSIGN_COURSES,
    PERMISSIONS.TRAINING.VIEW_REPORTS,
    PERMISSIONS.TRAINING.ISSUE_CERTIFICATES,
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // 🟢 TEAM LEAD - Team Management & Approvals
  // ─────────────────────────────────────────────────────────────────────────
  [ROLES.TEAM_LEAD]: [
    // Dashboard
    PERMISSIONS.DASHBOARD.VIEW_OWN,
    PERMISSIONS.DASHBOARD.VIEW_TEAM,
    PERMISSIONS.DASHBOARD.VIEW_ANALYTICS,

    // Employees
    PERMISSIONS.EMPLOYEES.VIEW_OWN,
    PERMISSIONS.EMPLOYEES.VIEW_TEAM,
    PERMISSIONS.EMPLOYEES.VIEW_DIRECTORY,
    PERMISSIONS.EMPLOYEES.UPDATE_OWN,

    // Timesheets
    PERMISSIONS.TIMESHEETS.VIEW_OWN,
    PERMISSIONS.TIMESHEETS.VIEW_TEAM,
    PERMISSIONS.TIMESHEETS.CREATE_OWN,
    PERMISSIONS.TIMESHEETS.UPDATE_OWN,
    PERMISSIONS.TIMESHEETS.UPDATE_DRAFT,
    PERMISSIONS.TIMESHEETS.DELETE_OWN,
    PERMISSIONS.TIMESHEETS.SUBMIT,
    PERMISSIONS.TIMESHEETS.WITHDRAW,
    PERMISSIONS.TIMESHEETS.RESUBMIT,
    PERMISSIONS.TIMESHEETS.APPROVE_TEAM,
    PERMISSIONS.TIMESHEETS.REJECT,
    PERMISSIONS.TIMESHEETS.COMMENT_OWN,
    PERMISSIONS.TIMESHEETS.COMMENT_TEAM,

    // Leaves
    PERMISSIONS.LEAVES.VIEW_OWN,
    PERMISSIONS.LEAVES.VIEW_TEAM,
    PERMISSIONS.LEAVES.VIEW_CALENDAR,
    PERMISSIONS.LEAVES.REQUEST,
    PERMISSIONS.LEAVES.CANCEL_OWN,
    PERMISSIONS.LEAVES.APPROVE_TEAM,
    PERMISSIONS.LEAVES.REJECT,

    // Teams
    PERMISSIONS.TEAMS.VIEW_OWN,
    PERMISSIONS.TEAMS.VIEW_STATS,

    // Announcements
    PERMISSIONS.ANNOUNCEMENTS.VIEW,
    PERMISSIONS.ANNOUNCEMENTS.CREATE,
    PERMISSIONS.ANNOUNCEMENTS.UPDATE_OWN,
    PERMISSIONS.ANNOUNCEMENTS.DELETE_OWN,

    // Documents
    PERMISSIONS.DOCUMENTS.VIEW_TEAM,
    PERMISSIONS.DOCUMENTS.VIEW_COMPANY,
    PERMISSIONS.DOCUMENTS.UPLOAD,
    PERMISSIONS.DOCUMENTS.DOWNLOAD,

    // Policies
    PERMISSIONS.POLICIES.VIEW,
    PERMISSIONS.POLICIES.ACKNOWLEDGE,

    // Celebrations
    PERMISSIONS.CELEBRATIONS.VIEW_TEAM,
    PERMISSIONS.CELEBRATIONS.SEND_WISHES,

    // Audit
    PERMISSIONS.AUDIT.VIEW_TEAM,

    // Approvers
    PERMISSIONS.APPROVERS.VIEW_DIRECTORY,
    PERMISSIONS.APPROVERS.VIEW_HIERARCHY,

    // Notifications
    PERMISSIONS.NOTIFICATIONS.VIEW_OWN,
    PERMISSIONS.NOTIFICATIONS.MANAGE_PREFERENCES,
    PERMISSIONS.NOTIFICATIONS.SEND_TEAM,

    // Reports
    PERMISSIONS.REPORTS.VIEW_OWN,
    PERMISSIONS.REPORTS.VIEW_TEAM,
    PERMISSIONS.REPORTS.EXPORT,

    // Training
    PERMISSIONS.TRAINING.VIEW_CATALOG,
    PERMISSIONS.TRAINING.ENROLL,
    PERMISSIONS.TRAINING.VIEW_PROGRESS,
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // 🟡 HR MANAGER - HR Operations & Employee Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  [ROLES.HR_MANAGER]: [
    // Dashboard
    PERMISSIONS.DASHBOARD.VIEW_OWN,
    PERMISSIONS.DASHBOARD.VIEW_COMPANY,
    PERMISSIONS.DASHBOARD.VIEW_ANALYTICS,

    // Employees - Full management
    PERMISSIONS.EMPLOYEES.VIEW_ALL,
    PERMISSIONS.EMPLOYEES.VIEW_DIRECTORY,
    PERMISSIONS.EMPLOYEES.CREATE,
    PERMISSIONS.EMPLOYEES.INVITE,
    PERMISSIONS.EMPLOYEES.BULK_IMPORT,
    PERMISSIONS.EMPLOYEES.UPDATE_ALL,
    PERMISSIONS.EMPLOYEES.UPDATE_SENSITIVE,
    PERMISSIONS.EMPLOYEES.DEACTIVATE,
    PERMISSIONS.EMPLOYEES.ASSIGN_TEAMS,
    PERMISSIONS.EMPLOYEES.ASSIGN_MANAGER,
    PERMISSIONS.EMPLOYEES.ASSIGN_REGIONS,
    PERMISSIONS.EMPLOYEES.VIEW_AUDIT_LOG,
    PERMISSIONS.EMPLOYEES.EXPORT,

    // Timesheets - View and export
    PERMISSIONS.TIMESHEETS.VIEW_ALL,
    PERMISSIONS.TIMESHEETS.APPROVE_TEAM,  // ← ADD
    PERMISSIONS.TIMESHEETS.APPROVE_ALL,   // ← ADD
    PERMISSIONS.TIMESHEETS.REJECT,        // ← ADD
    PERMISSIONS.TIMESHEETS.VIEW_REPORTS,
    PERMISSIONS.TIMESHEETS.EXPORT,

    // Leaves - Full management
    PERMISSIONS.LEAVES.VIEW_ALL,
    PERMISSIONS.LEAVES.VIEW_BALANCES,
    PERMISSIONS.LEAVES.VIEW_CALENDAR,
    PERMISSIONS.LEAVES.REQUEST,
    PERMISSIONS.LEAVES.CANCEL_OWN,
    PERMISSIONS.LEAVES.APPROVE_ALL,
    PERMISSIONS.LEAVES.REJECT,
    PERMISSIONS.LEAVES.MANAGE_POLICIES,
    PERMISSIONS.LEAVES.MANAGE_BALANCES,
    PERMISSIONS.LEAVES.MANAGE_ACCRUALS,
    PERMISSIONS.LEAVES.VIEW_REPORTS,
    PERMISSIONS.LEAVES.EXPORT,

    // Teams
    PERMISSIONS.TEAMS.VIEW_ALL,
    PERMISSIONS.TEAMS.VIEW_HIERARCHY,
    PERMISSIONS.TEAMS.ASSIGN_MEMBERS,

    // Documents
    PERMISSIONS.DOCUMENTS.VIEW_ALL,
    PERMISSIONS.DOCUMENTS.UPLOAD,
    PERMISSIONS.DOCUMENTS.DOWNLOAD_ALL,
    PERMISSIONS.DOCUMENTS.REQUIRE_ACKNOWLEDGMENT,
    PERMISSIONS.DOCUMENTS.VIEW_ACKNOWLEDGMENTS,
    PERMISSIONS.DOCUMENTS.TRACK_DOWNLOADS,

    // Policies
    PERMISSIONS.POLICIES.VIEW,
    PERMISSIONS.POLICIES.ACKNOWLEDGE,
    PERMISSIONS.POLICIES.CREATE,
    PERMISSIONS.POLICIES.UPDATE,
    PERMISSIONS.POLICIES.PUBLISH,
    PERMISSIONS.POLICIES.REQUIRE_ACKNOWLEDGMENT,
    PERMISSIONS.POLICIES.VIEW_ACKNOWLEDGMENTS,
    PERMISSIONS.POLICIES.TRACK_COMPLIANCE,
    PERMISSIONS.POLICIES.SEND_REMINDERS,

    // Celebrations
    PERMISSIONS.CELEBRATIONS.VIEW_ALL,
    PERMISSIONS.CELEBRATIONS.MANAGE,

    // Approvers
    PERMISSIONS.APPROVERS.VIEW_DIRECTORY,
    PERMISSIONS.APPROVERS.VIEW_HIERARCHY,
    PERMISSIONS.APPROVERS.ASSIGN_APPROVER,
    PERMISSIONS.APPROVERS.CHANGE_APPROVER,

    // Reports
    PERMISSIONS.REPORTS.VIEW_COMPANY,
    PERMISSIONS.REPORTS.CREATE_CUSTOM,
    PERMISSIONS.REPORTS.EXPORT,

    // Payroll
    PERMISSIONS.PAYROLL.VIEW_ALL,
    PERMISSIONS.PAYROLL.PROCESS,
    PERMISSIONS.PAYROLL.EXPORT,

    // Training
    PERMISSIONS.TRAINING.VIEW_CATALOG,
    PERMISSIONS.TRAINING.CREATE_COURSES,
    PERMISSIONS.TRAINING.ASSIGN_COURSES,
    PERMISSIONS.TRAINING.VIEW_REPORTS,
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // ⚪ EMPLOYEE - Standard Employee Access
  // ─────────────────────────────────────────────────────────────────────────
  [ROLES.EMPLOYEE]: [
    // Dashboard
    PERMISSIONS.DASHBOARD.VIEW_OWN,

    // Employees
    PERMISSIONS.EMPLOYEES.VIEW_OWN,
    PERMISSIONS.EMPLOYEES.VIEW_TEAM,
    PERMISSIONS.EMPLOYEES.VIEW_DIRECTORY,
    PERMISSIONS.EMPLOYEES.UPDATE_OWN,

    // Timesheets
    PERMISSIONS.TIMESHEETS.VIEW_OWN,
    PERMISSIONS.TIMESHEETS.CREATE_OWN,
    PERMISSIONS.TIMESHEETS.UPDATE_OWN,
    PERMISSIONS.TIMESHEETS.UPDATE_DRAFT,
    PERMISSIONS.TIMESHEETS.DELETE_OWN,
    PERMISSIONS.TIMESHEETS.SUBMIT,
    PERMISSIONS.TIMESHEETS.WITHDRAW,
    PERMISSIONS.TIMESHEETS.RESUBMIT,
    PERMISSIONS.TIMESHEETS.COMMENT_OWN,

    // Leaves
    PERMISSIONS.LEAVES.VIEW_OWN,
    PERMISSIONS.LEAVES.VIEW_CALENDAR,
    PERMISSIONS.LEAVES.REQUEST,
    PERMISSIONS.LEAVES.CANCEL_OWN,
    PERMISSIONS.LEAVES.UPDATE_OWN,

    // Teams
    PERMISSIONS.TEAMS.VIEW_OWN,

    // Announcements
    PERMISSIONS.ANNOUNCEMENTS.VIEW,

    // Documents
    PERMISSIONS.DOCUMENTS.VIEW_OWN,
    PERMISSIONS.DOCUMENTS.VIEW_COMPANY,
    PERMISSIONS.DOCUMENTS.DOWNLOAD,

    // Policies
    PERMISSIONS.POLICIES.VIEW,
    PERMISSIONS.POLICIES.ACKNOWLEDGE,

    // Celebrations
    PERMISSIONS.CELEBRATIONS.VIEW_OWN,
    PERMISSIONS.CELEBRATIONS.VIEW_TEAM,
    PERMISSIONS.CELEBRATIONS.SEND_WISHES,

    // Audit
    PERMISSIONS.AUDIT.VIEW_OWN,

    // Notifications
    PERMISSIONS.NOTIFICATIONS.VIEW_OWN,
    PERMISSIONS.NOTIFICATIONS.MANAGE_PREFERENCES,

    // Reports
    PERMISSIONS.REPORTS.VIEW_OWN,

    // Payroll
    PERMISSIONS.PAYROLL.VIEW_OWN,

    // Training
    PERMISSIONS.TRAINING.VIEW_CATALOG,
    PERMISSIONS.TRAINING.ENROLL,
    PERMISSIONS.TRAINING.VIEW_PROGRESS,
  ],
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// Utility functions for permission checking
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if user has a specific permission
 */
export function checkPermission(
  userRoles: string[],
  permission: Permission
): boolean {
  return userRoles.some(role => {
    const roleEnum = role as ROLES
    return ROLE_PERMISSIONS[roleEnum]?.includes(permission) || false
  })
}

/**
 * Check if user has ANY of the specified permissions
 */
export function checkAnyPermission(
  userRoles: string[],
  permissions: Permission[]
): boolean {
  return permissions.some(permission => checkPermission(userRoles, permission))
}

/**
 * Check if user has ALL of the specified permissions
 */
export function checkAllPermissions(
  userRoles: string[],
  permissions: Permission[]
): boolean {
  return permissions.every(permission => checkPermission(userRoles, permission))
}

/**
 * Check if user has a specific role
 */
export function hasRole(userRoles: string[], role: ROLES): boolean {
  return userRoles.includes(role)
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRoles: string[], roles: ROLES[]): boolean {
  return roles.some(role => userRoles.includes(role))
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(userRoles: string[], roles: ROLES[]): boolean {
  return roles.every(role => userRoles.includes(role))
}

/**
 * Get all permissions for a user based on their roles
 */
export function getUserPermissions(userRoles: string[]): Permission[] {
  const permissions = new Set<Permission>()

  userRoles.forEach(role => {
    const roleEnum = role as ROLES
    const rolePerms = ROLE_PERMISSIONS[roleEnum] || []
    rolePerms.forEach(perm => permissions.add(perm))
  })

  return Array.from(permissions)
}

/**
 * Get highest role level from user's roles
 */
export function getHighestRoleLevel(userRoles: string[]): number {
  return Math.max(
    ...userRoles.map(role => ROLE_LEVELS[role as ROLES] || 0)
  )
}

/**
 * Check if user is an admin (system_admin or admin)
 */
export function isAdmin(userRoles: string[]): boolean {
  return hasAnyRole(userRoles, [ROLES.SYSTEM_ADMIN, ROLES.ADMIN])
}

/**
 * Check if user is a manager (team_lead, hr_manager, or admin)
 */
export function isManager(userRoles: string[]): boolean {
  return hasAnyRole(userRoles, [
    ROLES.SYSTEM_ADMIN,
    ROLES.ADMIN,
    ROLES.TEAM_LEAD,
    ROLES.HR_MANAGER,
  ])
}

/**
 * Check if user can approve timesheets
 */
export function canApproveTimesheets(userRoles: string[]): boolean {
  return checkAnyPermission(userRoles, [
    PERMISSIONS.TIMESHEETS.APPROVE_TEAM,
    PERMISSIONS.TIMESHEETS.APPROVE_ALL,
  ])
}

/**
 * Check if user can approve leaves
 */
export function canApproveLeaves(userRoles: string[]): boolean {
  return checkAnyPermission(userRoles, [
    PERMISSIONS.LEAVES.APPROVE_TEAM,
    PERMISSIONS.LEAVES.APPROVE_ALL,
  ])
}

/**
 * Check if user can manage employees
 */
export function canManageEmployees(userRoles: string[]): boolean {
  return checkAnyPermission(userRoles, [
    PERMISSIONS.EMPLOYEES.CREATE,
    PERMISSIONS.EMPLOYEES.UPDATE_ALL,
    PERMISSIONS.EMPLOYEES.DELETE,
  ])
}

/**
 * Check if user can view sensitive data
 */
export function canViewSensitiveData(userRoles: string[]): boolean {
  return checkAnyPermission(userRoles, [
    PERMISSIONS.EMPLOYEES.UPDATE_SENSITIVE,
    PERMISSIONS.PAYROLL.VIEW_ALL,
  ])
}

/**
 * Check if user has higher or equal role level than target
 */
export function hasHigherOrEqualRole(
  userRoles: string[],
  targetRoles: string[]
): boolean {
  const userLevel = getHighestRoleLevel(userRoles)
  const targetLevel = getHighestRoleLevel(targetRoles)
  return userLevel >= targetLevel
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type { Permission }
export type UserRole = ROLES
export type UserPermissions = Permission[]
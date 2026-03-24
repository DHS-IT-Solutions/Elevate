-- =====================================================
-- DHS ELEVATE - ALL-IN-ONE DATABASE MIGRATION
-- Copy this ENTIRE file and paste into Supabase SQL Editor
-- Then click "Run"
-- Safe to run multiple times (idempotent)
-- =====================================================

-- =====================================================
-- PART 1: CORE SCHEMA FIXES
-- =====================================================

DO $$ 
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'PART 1: CORE SCHEMA FIXES';
    RAISE NOTICE '==================================================';
    
    -- has_comments column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'has_comments') THEN
        ALTER TABLE timesheets ADD COLUMN has_comments boolean DEFAULT false;
        RAISE NOTICE '✓ Added column: has_comments';
    ELSE
        RAISE NOTICE '- Column exists: has_comments';
    END IF;

    -- submitted_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'submitted_by') THEN
        ALTER TABLE timesheets ADD COLUMN submitted_by uuid REFERENCES employees(id);
        RAISE NOTICE '✓ Added column: submitted_by';
    ELSE
        RAISE NOTICE '- Column exists: submitted_by';
    END IF;

    -- withdrawn_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'withdrawn_at') THEN
        ALTER TABLE timesheets ADD COLUMN withdrawn_at timestamptz;
        RAISE NOTICE '✓ Added column: withdrawn_at';
    ELSE
        RAISE NOTICE '- Column exists: withdrawn_at';
    END IF;

    -- withdrawn_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'withdrawn_by') THEN
        ALTER TABLE timesheets ADD COLUMN withdrawn_by uuid REFERENCES employees(id);
        RAISE NOTICE '✓ Added column: withdrawn_by';
    ELSE
        RAISE NOTICE '- Column exists: withdrawn_by';
    END IF;

    -- rejected_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'rejected_at') THEN
        ALTER TABLE timesheets ADD COLUMN rejected_at timestamptz;
        RAISE NOTICE '✓ Added column: rejected_at';
    ELSE
        RAISE NOTICE '- Column exists: rejected_at';
    END IF;
    
    RAISE NOTICE 'Part 1 Complete';
    RAISE NOTICE '';
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_timesheets_has_comments ON timesheets(has_comments) WHERE has_comments = true;
CREATE INDEX IF NOT EXISTS idx_timesheets_submitted_by ON timesheets(submitted_by);
CREATE INDEX IF NOT EXISTS idx_timesheets_withdrawn_at ON timesheets(withdrawn_at) WHERE withdrawn_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_employee_date ON timesheets(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets(status);

-- =====================================================
-- PART 2: ENTERPRISE TABLES
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'PART 2: ENTERPRISE TABLES';
    RAISE NOTICE '==================================================';
END $$;

-- Create timesheet_comments table
CREATE TABLE IF NOT EXISTS timesheet_comments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    timesheet_id uuid NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES employees(id),
    comment_text text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid REFERENCES employees(id)
);

-- Create timesheet_change_log table
CREATE TABLE IF NOT EXISTS timesheet_change_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    timesheet_id uuid NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
    changed_by uuid NOT NULL REFERENCES employees(id),
    change_type text NOT NULL,
    field_name text,
    old_value text,
    new_value text,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

-- Create email_notifications table
CREATE TABLE IF NOT EXISTS email_notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id uuid NOT NULL REFERENCES employees(id),
    recipient_email text NOT NULL,
    notification_type text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    related_id uuid,
    sent_at timestamptz DEFAULT now(),
    status text DEFAULT 'pending'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_timesheet_comments_timesheet ON timesheet_comments(timesheet_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheet_comments_employee ON timesheet_comments(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_change_log_timesheet ON timesheet_change_log(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_change_log_type ON timesheet_change_log(change_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_recipient ON email_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status) WHERE status = 'pending';

-- =====================================================
-- PART 3: TRIGGERS AND AUTOMATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'PART 3: TRIGGERS AND AUTOMATION';
    RAISE NOTICE '==================================================';
END $$;

-- Function to update has_comments flag
CREATE OR REPLACE FUNCTION update_timesheet_has_comments()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE timesheets
    SET has_comments = EXISTS (
        SELECT 1 FROM timesheet_comments
        WHERE timesheet_id = COALESCE(NEW.timesheet_id, OLD.timesheet_id)
        AND deleted_at IS NULL
    )
    WHERE id = COALESCE(NEW.timesheet_id, OLD.timesheet_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_has_comments ON timesheet_comments;
CREATE TRIGGER trigger_update_has_comments
    AFTER INSERT OR UPDATE OR DELETE ON timesheet_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_timesheet_has_comments();

-- Function to log timesheet changes
CREATE OR REPLACE FUNCTION log_timesheet_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_change_type text;
    v_changed_by uuid;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_change_type := 'created';
        v_changed_by := NEW.employee_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            v_change_type := NEW.status;
        ELSE
            v_change_type := 'updated';
        END IF;
        v_changed_by := COALESCE(NEW.submitted_by, NEW.approved_by, NEW.withdrawn_by, NEW.employee_id);
    ELSE
        RETURN OLD;
    END IF;

    INSERT INTO timesheet_change_log (timesheet_id, changed_by, change_type, metadata)
    VALUES (
        NEW.id,
        v_changed_by,
        v_change_type,
        jsonb_build_object(
            'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
            'new_status', NEW.status,
            'old_hours', CASE WHEN TG_OP = 'UPDATE' THEN OLD.total_hours ELSE NULL END,
            'new_hours', NEW.total_hours
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_timesheet_changes ON timesheets;
CREATE TRIGGER trigger_log_timesheet_changes
    AFTER INSERT OR UPDATE ON timesheets
    FOR EACH ROW
    EXECUTE FUNCTION log_timesheet_changes();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_timesheets_updated_at ON timesheets;
CREATE TRIGGER trigger_timesheets_updated_at
    BEFORE UPDATE ON timesheets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_comments_updated_at ON timesheet_comments;
CREATE TRIGGER trigger_comments_updated_at
    BEFORE UPDATE ON timesheet_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PART 4: ROW LEVEL SECURITY
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'PART 4: ROW LEVEL SECURITY';
    RAISE NOTICE '==================================================';
END $$;

-- EMPLOYEES TABLE
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_employees_select_own" ON employees;
DROP POLICY IF EXISTS "policy_employees_select_company" ON employees;
DROP POLICY IF EXISTS "policy_employees_admin_all" ON employees;

CREATE POLICY "policy_employees_select_own" ON employees FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "policy_employees_select_company" ON employees FOR SELECT USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "policy_employees_admin_all" ON employees FOR ALL USING (EXISTS (SELECT 1 FROM employees e JOIN employee_roles er ON e.id = er.employee_id JOIN roles r ON er.role_id = r.id WHERE e.user_id = auth.uid() AND r.name = 'admin'));

-- EMPLOYEE_ROLES TABLE
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_roles_select_own" ON employee_roles;
DROP POLICY IF EXISTS "policy_roles_select_company" ON employee_roles;

CREATE POLICY "policy_roles_select_own" ON employee_roles FOR SELECT USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "policy_roles_select_company" ON employee_roles FOR SELECT USING (employee_id IN (SELECT e2.id FROM employees e1 JOIN employees e2 ON e1.company_id = e2.company_id WHERE e1.user_id = auth.uid()));

-- TEAMS TABLE
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_teams_select_company" ON teams;

CREATE POLICY "policy_teams_select_company" ON teams FOR SELECT USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

-- ROLES TABLE
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_roles_select_all" ON roles;

CREATE POLICY "policy_roles_select_all" ON roles FOR SELECT USING (true);

-- TIMESHEETS TABLE
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_timesheets_select_own" ON timesheets;
DROP POLICY IF EXISTS "policy_timesheets_manage_own" ON timesheets;
DROP POLICY IF EXISTS "policy_timesheets_select_managers" ON timesheets;

CREATE POLICY "policy_timesheets_select_own" ON timesheets FOR SELECT USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "policy_timesheets_manage_own" ON timesheets FOR ALL USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "policy_timesheets_select_managers" ON timesheets FOR SELECT USING (EXISTS (SELECT 1 FROM employees e JOIN employee_roles er ON e.id = er.employee_id JOIN roles r ON er.role_id = r.id WHERE e.user_id = auth.uid() AND r.name IN ('admin', 'team_lead')));

-- TIMESHEET_COMMENTS TABLE
ALTER TABLE timesheet_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_comments_select" ON timesheet_comments;
DROP POLICY IF EXISTS "policy_comments_insert" ON timesheet_comments;
DROP POLICY IF EXISTS "policy_comments_update" ON timesheet_comments;

CREATE POLICY "policy_comments_select" ON timesheet_comments FOR SELECT USING (EXISTS (SELECT 1 FROM employees e JOIN timesheets t ON t.id = timesheet_comments.timesheet_id WHERE e.user_id = auth.uid() AND (e.id = t.employee_id OR EXISTS (SELECT 1 FROM employee_roles er JOIN roles r ON er.role_id = r.id WHERE er.employee_id = e.id AND r.name IN ('admin', 'team_lead')))));
CREATE POLICY "policy_comments_insert" ON timesheet_comments FOR INSERT WITH CHECK (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "policy_comments_update" ON timesheet_comments FOR UPDATE USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- TIMESHEET_CHANGE_LOG TABLE
ALTER TABLE timesheet_change_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_changelog_select" ON timesheet_change_log;

CREATE POLICY "policy_changelog_select" ON timesheet_change_log FOR SELECT USING (EXISTS (SELECT 1 FROM employees e JOIN timesheets t ON t.id = timesheet_change_log.timesheet_id WHERE e.user_id = auth.uid() AND (e.id = t.employee_id OR EXISTS (SELECT 1 FROM employee_roles er JOIN roles r ON er.role_id = r.id WHERE er.employee_id = e.id AND r.name IN ('admin', 'team_lead')))));

-- EMAIL_NOTIFICATIONS TABLE
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_emails_select_own" ON email_notifications;

CREATE POLICY "policy_emails_select_own" ON email_notifications FOR SELECT USING (recipient_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- ANNOUNCEMENTS TABLE
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_announcements_select_company" ON announcements;

CREATE POLICY "policy_announcements_select_company" ON announcements FOR SELECT USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()) OR target_type = 'all');

-- =====================================================
-- PART 5: FIX AUTH LINKS
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'PART 5: FIX AUTH LINKS';
    RAISE NOTICE '==================================================';
END $$;

-- Fix email case
UPDATE employees SET email = LOWER(email) WHERE email != LOWER(email);

-- Create trigger for lowercase emails
CREATE OR REPLACE FUNCTION ensure_lowercase_email()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email = LOWER(NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lowercase_email ON employees;
CREATE TRIGGER trigger_lowercase_email
    BEFORE INSERT OR UPDATE OF email ON employees
    FOR EACH ROW
    EXECUTE FUNCTION ensure_lowercase_email();

-- Link employees to auth users
UPDATE employees e
SET user_id = au.id
FROM auth.users au
WHERE LOWER(e.email) = LOWER(au.email)
AND e.user_id IS NULL;

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================

DO $$
DECLARE
    v_missing_cols int;
    v_missing_tables int;
    v_unlinked_employees int;
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'MIGRATION COMPLETE - VERIFICATION';
    RAISE NOTICE '==================================================';
    
    -- Check columns
    SELECT COUNT(*) INTO v_missing_cols
    FROM (VALUES ('has_comments'), ('submitted_by'), ('withdrawn_at'), ('withdrawn_by'), ('rejected_at')) AS cols(name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'timesheets' AND column_name = cols.name
    );
    
    IF v_missing_cols = 0 THEN
        RAISE NOTICE '✓ All timesheet columns present';
    ELSE
        RAISE NOTICE '⚠ Missing % timesheet columns', v_missing_cols;
    END IF;
    
    -- Check tables
    SELECT COUNT(*) INTO v_missing_tables
    FROM (VALUES ('timesheet_comments'), ('timesheet_change_log'), ('email_notifications')) AS tbls(name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = tbls.name
    );
    
    IF v_missing_tables = 0 THEN
        RAISE NOTICE '✓ All enterprise tables present';
    ELSE
        RAISE NOTICE '⚠ Missing % enterprise tables', v_missing_tables;
    END IF;
    
    -- Check unlinked employees
    SELECT COUNT(*) INTO v_unlinked_employees
    FROM employees 
    WHERE user_id IS NULL AND is_active = true;
    
    IF v_unlinked_employees = 0 THEN
        RAISE NOTICE '✓ All active employees linked to auth';
    ELSE
        RAISE NOTICE '⚠ % active employees not linked to auth users', v_unlinked_employees;
        RAISE NOTICE '  → Create auth users for these employees in Supabase Dashboard';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '==================================================';
    RAISE NOTICE '🎉 MIGRATION SUCCESSFUL!';
    RAISE NOTICE '==================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Regenerate types: npx supabase gen types typescript';
    RAISE NOTICE '2. Restart dev server: npm run dev';
    RAISE NOTICE '3. Test login at: /login';
    RAISE NOTICE '';
END $$;
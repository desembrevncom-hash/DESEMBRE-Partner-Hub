-- ENABLE RLS
ALTER TABLE public.customer_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tier_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_access_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_access_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- GRANTS
-- Course content reading
GRANT SELECT ON public.course_categories TO anon, authenticated;
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT SELECT ON public.course_modules TO anon, authenticated;
GRANT SELECT ON public.lessons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_modules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lessons TO authenticated;

-- User specific tables
GRANT SELECT ON public.student_accounts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.student_accounts TO authenticated;

GRANT SELECT ON public.enrollments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;

GRANT SELECT ON public.course_entitlements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_entitlements TO authenticated;

GRANT SELECT ON public.lesson_progress TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;

-- Admin/Staff configs
GRANT SELECT ON public.customer_tiers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.customer_tiers TO authenticated;

GRANT SELECT ON public.customer_tier_memberships TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.customer_tier_memberships TO authenticated;

GRANT SELECT ON public.course_access_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_access_rules TO authenticated;

GRANT SELECT ON public.course_access_overrides TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_access_overrides TO authenticated;

-- RLS POLICIES
-- Admin check helper is public.is_admin_or_sub_admin()
-- Staff check helper is public.has_role(auth.uid(), 'sale') OR tele_lead OR telesale

-- course_categories
CREATE POLICY "Anon view public categories" ON public.course_categories FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.category_id = course_categories.id AND c.status = 'published' AND c.catalog_visibility = 'public' AND (c.catalog_opens_at IS NULL OR c.catalog_opens_at <= now()) AND (c.catalog_closes_at IS NULL OR c.catalog_closes_at > now())));

CREATE POLICY "Student view allowed categories" ON public.course_categories FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.category_id = course_categories.id AND private.can_access_course(c.id, 'catalog')));

CREATE POLICY "Admin CRUD categories" ON public.course_categories FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT categories" ON public.course_categories FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

-- courses
CREATE POLICY "Anon view public courses" ON public.courses FOR SELECT TO anon
USING (status = 'published' AND catalog_visibility = 'public' AND (catalog_opens_at IS NULL OR catalog_opens_at <= now()) AND (catalog_closes_at IS NULL OR catalog_closes_at > now()));

CREATE POLICY "Student view allowed courses" ON public.courses FOR SELECT TO authenticated
USING (private.can_access_course(id, 'catalog'));

CREATE POLICY "Admin CRUD courses" ON public.courses FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT courses" ON public.courses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

-- course_modules
CREATE POLICY "Anon view public modules" ON public.course_modules FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_modules.course_id AND c.status = 'published' AND c.catalog_visibility = 'public' AND (c.catalog_opens_at IS NULL OR c.catalog_opens_at <= now()) AND (c.catalog_closes_at IS NULL OR c.catalog_closes_at > now())));

CREATE POLICY "Student view allowed modules" ON public.course_modules FOR SELECT TO authenticated
USING (private.can_access_course(course_id, 'catalog') OR private.can_access_course(course_id, 'full'));

CREATE POLICY "Admin CRUD modules" ON public.course_modules FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT modules" ON public.course_modules FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

-- lessons
CREATE POLICY "Anon view public preview lessons" ON public.lessons FOR SELECT TO anon
USING (status = 'published' AND is_preview = true AND EXISTS (SELECT 1 FROM public.course_modules m JOIN public.courses c ON c.id = m.course_id WHERE m.id = lessons.module_id AND c.status = 'published' AND c.catalog_visibility = 'public' AND (c.catalog_opens_at IS NULL OR c.catalog_opens_at <= now()) AND (c.catalog_closes_at IS NULL OR c.catalog_closes_at > now())));

CREATE POLICY "Student view preview or full lessons" ON public.lessons FOR SELECT TO authenticated
USING ((status = 'published' AND is_preview = true AND EXISTS (SELECT 1 FROM public.course_modules m JOIN public.courses c ON c.id = m.course_id WHERE m.id = lessons.module_id AND c.status = 'published' AND (c.catalog_opens_at IS NULL OR c.catalog_opens_at <= now()) AND (c.catalog_closes_at IS NULL OR c.catalog_closes_at > now()))) OR private.can_access_course((SELECT course_id FROM public.course_modules WHERE id = module_id), 'full'));

CREATE POLICY "Admin CRUD lessons" ON public.lessons FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT lessons" ON public.lessons FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

-- student_accounts
CREATE POLICY "Student view own account" ON public.student_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin CRUD student_accounts" ON public.student_accounts FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT student_accounts" ON public.student_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

-- enrollments
CREATE POLICY "Student view own enrollments" ON public.enrollments FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.student_accounts WHERE user_id = auth.uid()));
CREATE POLICY "Admin CRUD enrollments" ON public.enrollments FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT enrollments" ON public.enrollments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

-- course_entitlements
CREATE POLICY "Student view own entitlements" ON public.course_entitlements FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.student_accounts WHERE user_id = auth.uid()));
CREATE POLICY "Admin CRUD entitlements" ON public.course_entitlements FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT entitlements" ON public.course_entitlements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

-- lesson_progress
CREATE POLICY "Student view own progress" ON public.lesson_progress FOR SELECT TO authenticated USING (enrollment_id IN (SELECT id FROM public.enrollments WHERE student_id IN (SELECT id FROM public.student_accounts WHERE user_id = auth.uid())));
CREATE POLICY "Student insert own progress" ON public.lesson_progress FOR INSERT TO authenticated WITH CHECK (enrollment_id IN (SELECT id FROM public.enrollments WHERE student_id IN (SELECT id FROM public.student_accounts WHERE user_id = auth.uid())) AND lesson_id IN (SELECT l.id FROM public.lessons l JOIN public.course_modules m ON m.id = l.module_id JOIN public.enrollments e ON e.course_id = m.course_id WHERE e.id = lesson_progress.enrollment_id));
CREATE POLICY "Student update own progress" ON public.lesson_progress FOR UPDATE TO authenticated USING (enrollment_id IN (SELECT id FROM public.enrollments WHERE student_id IN (SELECT id FROM public.student_accounts WHERE user_id = auth.uid()))) WITH CHECK (enrollment_id IN (SELECT id FROM public.enrollments WHERE student_id IN (SELECT id FROM public.student_accounts WHERE user_id = auth.uid())) AND lesson_id IN (SELECT l.id FROM public.lessons l JOIN public.course_modules m ON m.id = l.module_id JOIN public.enrollments e ON e.course_id = m.course_id WHERE e.id = lesson_progress.enrollment_id));
CREATE POLICY "Admin CRUD progress" ON public.lesson_progress FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT progress" ON public.lesson_progress FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

-- Config tables (Tiers, Memberships, Rules, Overrides)
CREATE POLICY "Admin CRUD tiers" ON public.customer_tiers FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT tiers" ON public.customer_tiers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

CREATE POLICY "Admin CRUD memberships" ON public.customer_tier_memberships FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT memberships" ON public.customer_tier_memberships FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

CREATE POLICY "Admin CRUD rules" ON public.course_access_rules FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT rules" ON public.course_access_rules FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

CREATE POLICY "Admin CRUD overrides" ON public.course_access_overrides FOR ALL TO authenticated USING (public.is_admin_or_sub_admin(auth.uid())) WITH CHECK (public.is_admin_or_sub_admin(auth.uid()));
CREATE POLICY "Staff SELECT overrides" ON public.course_access_overrides FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'sale') OR public.has_role(auth.uid(), 'tele_lead') OR public.has_role(auth.uid(), 'telesale'));

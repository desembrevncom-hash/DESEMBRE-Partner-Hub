-- course_categories
CREATE TABLE public.course_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- courses
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.course_categories(id) ON DELETE SET NULL,
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  catalog_visibility text NOT NULL CHECK (catalog_visibility IN ('public', 'tier', 'private')),
  enrollment_policy text NOT NULL CHECK (enrollment_policy IN ('open', 'approval', 'assigned', 'closed')),
  access_policy text NOT NULL CHECK (access_policy IN ('dynamic', 'grandfathered')),
  pricing_model text NOT NULL CHECK (pricing_model IN ('free', 'paid', 'included')),
  catalog_opens_at timestamptz,
  catalog_closes_at timestamptz,
  enrollment_opens_at timestamptz,
  enrollment_closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- course_modules
CREATE TABLE public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, position)
);

-- lessons
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  duration integer,
  is_preview boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, position)
);

-- course_access_rules
CREATE TABLE public.course_access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.customer_tiers(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('allow', 'deny')),
  access_scope text NOT NULL CHECK (access_scope IN ('catalog', 'enroll', 'full')),
  match_mode text NOT NULL CHECK (match_mode IN ('exact', 'minimum')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_rule_dates CHECK (ends_at IS NULL OR ends_at > starts_at)
);

-- student_accounts
CREATE TABLE public.student_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- course_access_overrides
CREATE TABLE public.course_access_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.student_accounts(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('allow', 'deny')),
  access_scope text NOT NULL CHECK (access_scope IN ('catalog', 'enroll', 'full')),
  reason text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_override_dates CHECK (expires_at IS NULL OR expires_at > starts_at)
);

-- course_entitlements
CREATE TABLE public.course_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.student_accounts(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('tier', 'manual', 'campaign', 'purchase')),
  source_id text NOT NULL,
  access_scope text NOT NULL CHECK (access_scope IN ('catalog', 'enroll', 'full')),
  status text NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_entitlement_dates CHECK (expires_at IS NULL OR expires_at > starts_at),
  UNIQUE(student_id, course_id, source_type, source_id)
);

-- enrollments
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.student_accounts(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'active', 'rejected', 'completed', 'cancelled', 'expired')),
  source text NOT NULL CHECK (source IN ('self', 'admin', 'tier_rule', 'campaign', 'purchase')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- lesson_progress
CREATE TABLE public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percent numeric NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_position_seconds numeric DEFAULT 0 CHECK (last_position_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, lesson_id)
);

-- Indexes
CREATE INDEX idx_course_categories_status ON public.course_categories(status);
CREATE INDEX idx_courses_status ON public.courses(status);
CREATE INDEX idx_courses_category_id ON public.courses(category_id);
CREATE INDEX idx_course_modules_course_id ON public.course_modules(course_id);
CREATE INDEX idx_lessons_module_id ON public.lessons(module_id);
CREATE INDEX idx_course_access_rules_course_id ON public.course_access_rules(course_id);
CREATE INDEX idx_course_access_rules_tier_id ON public.course_access_rules(tier_id);
CREATE INDEX idx_student_accounts_user_id ON public.student_accounts(user_id);
CREATE INDEX idx_student_accounts_customer_id ON public.student_accounts(customer_id);
CREATE INDEX idx_course_access_overrides_student_id ON public.course_access_overrides(student_id);
CREATE INDEX idx_course_access_overrides_course_id ON public.course_access_overrides(course_id);
CREATE INDEX idx_course_entitlements_student_id ON public.course_entitlements(student_id);
CREATE INDEX idx_course_entitlements_course_id ON public.course_entitlements(course_id);
CREATE INDEX idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_course_id ON public.enrollments(course_id);
CREATE INDEX idx_enrollments_status ON public.enrollments(status);
CREATE INDEX idx_lesson_progress_enrollment_id ON public.lesson_progress(enrollment_id);
CREATE INDEX idx_lesson_progress_lesson_id ON public.lesson_progress(lesson_id);

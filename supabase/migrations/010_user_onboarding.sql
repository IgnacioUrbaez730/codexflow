ALTER TABLE user_profiles
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT,
ADD COLUMN job_title TEXT,
ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT FALSE;

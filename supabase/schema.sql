-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  full_name       TEXT,
  title           TEXT,
  company         TEXT,
  email           TEXT,
  phone           TEXT,
  website         TEXT,
  linkedin_url    TEXT,
  twitter_url     TEXT,
  instagram_url   TEXT,
  bio             TEXT,
  avatar_url      TEXT,
  card_style      TEXT DEFAULT 'noir' CHECK (card_style IN ('noir','midnight','forest','slate')),
  is_active       BOOLEAN DEFAULT true,
  is_admin        BOOLEAN DEFAULT false,
  plan            TEXT DEFAULT 'free' CHECK (plan IN ('free','pro','elite')),
  total_views     INTEGER DEFAULT 0,
  total_leads     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Card Views ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_views (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  viewer_ip       TEXT,
  viewer_city     TEXT,
  viewer_country  TEXT,
  viewer_device   TEXT,
  viewer_browser  TEXT,
  referrer        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Leads ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  company     TEXT,
  message     TEXT,
  source      TEXT DEFAULT 'card_view',
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Wallet Passes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_passes (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  pass_type       TEXT NOT NULL CHECK (pass_type IN ('apple','google')),
  pass_identifier TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_views   ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_passes ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Public profiles viewable" ON profiles
  FOR SELECT USING (is_active = true);
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- card_views
CREATE POLICY "Anyone can insert card views" ON card_views
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Owners read own views" ON card_views
  FOR SELECT USING (profile_id = auth.uid());

-- leads
CREATE POLICY "Anyone can insert leads" ON leads
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Owners read own leads" ON leads
  FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Owners update own leads" ON leads
  FOR UPDATE USING (profile_id = auth.uid());

-- wallet_passes
CREATE POLICY "Users manage own wallet passes" ON wallet_passes
  FOR ALL USING (profile_id = auth.uid());

-- ─── Functions ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '', 'g'));
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::TEXT;
  END LOOP;

  INSERT INTO profiles (id, email, username, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION inc_view_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET total_views = total_views + 1 WHERE id = NEW.profile_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_card_view_created
  AFTER INSERT ON card_views
  FOR EACH ROW EXECUTE FUNCTION inc_view_count();

CREATE OR REPLACE FUNCTION inc_lead_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET total_leads = total_leads + 1 WHERE id = NEW.profile_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_lead_created
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION inc_lead_count();

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_username      ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_card_views_profile_id  ON card_views(profile_id);
CREATE INDEX IF NOT EXISTS idx_card_views_created_at  ON card_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_profile_id       ON leads(profile_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at       ON leads(created_at DESC);

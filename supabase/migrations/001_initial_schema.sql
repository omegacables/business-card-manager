-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  line_user_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Business cards table
CREATE TABLE business_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  department TEXT,
  position TEXT,
  name TEXT NOT NULL,
  name_kana TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  fax TEXT,
  postal_code TEXT,
  address TEXT,
  website TEXT,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Tags table
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, name)
);

-- Card-Tag junction table
CREATE TABLE card_tags (
  card_id UUID NOT NULL REFERENCES business_cards(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (card_id, tag_id)
);

-- Indexes for performance
CREATE INDEX idx_business_cards_user_id ON business_cards(user_id);
CREATE INDEX idx_business_cards_name ON business_cards(name);
CREATE INDEX idx_business_cards_company ON business_cards(company_name);
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_profiles_line_user_id ON profiles(line_user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_cards_updated_at
  BEFORE UPDATE ON business_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_tags ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Business cards policies
CREATE POLICY "Users can view their own cards"
  ON business_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cards"
  ON business_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards"
  ON business_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards"
  ON business_cards FOR DELETE
  USING (auth.uid() = user_id);

-- Tags policies
CREATE POLICY "Users can view their own tags"
  ON tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags"
  ON tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON tags FOR DELETE
  USING (auth.uid() = user_id);

-- Card tags policies
CREATE POLICY "Users can view their card tags"
  ON card_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_cards
      WHERE business_cards.id = card_tags.card_id
      AND business_cards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their card tags"
  ON card_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_cards
      WHERE business_cards.id = card_tags.card_id
      AND business_cards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their card tags"
  ON card_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM business_cards
      WHERE business_cards.id = card_tags.card_id
      AND business_cards.user_id = auth.uid()
    )
  );

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Storage bucket for business card images
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload card images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'card-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view card images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'card-images');

CREATE POLICY "Users can delete their card images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'card-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

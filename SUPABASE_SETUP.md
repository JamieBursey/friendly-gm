# Supabase Setup Guide

## 1. Get Your Supabase Credentials

1. Go to your friendlyBets project at [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (long string starting with `eyJ...`)

## 2. Configure Environment Variables

1. Open the `.env` file in the root of your project
2. Replace the placeholder values with your actual Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

## 3. Set Up Database Tables

Run the following SQL in your Supabase SQL Editor (**Dashboard** → **SQL Editor** → **New Query**):

### Create Tables

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- GM Rosters table
CREATE TABLE IF NOT EXISTS gm_rosters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  players JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GM Matches table
CREATE TABLE IF NOT EXISTS gm_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player1_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player1_roster_id UUID NOT NULL REFERENCES gm_rosters(id) ON DELETE CASCADE,
  player2_roster_id UUID NOT NULL REFERENCES gm_rosters(id) ON DELETE CASCADE,
  player1_score INTEGER,
  player2_score INTEGER,
  winner_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('player', 'special', 'legendary')),
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  attack INTEGER NOT NULL,
  defense INTEGER NOT NULL,
  special_ability TEXT,
  image_url TEXT,
  player_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Card Collections table (many-to-many: users <-> cards)
CREATE TABLE IF NOT EXISTS card_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

-- User Stats table
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  experience INTEGER NOT NULL DEFAULT 0,
  gm_wins INTEGER NOT NULL DEFAULT 0,
  gm_losses INTEGER NOT NULL DEFAULT 0,
  card_wins INTEGER NOT NULL DEFAULT 0,
  card_losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Create Indexes for Performance

```sql
-- Friendship indexes
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);

-- GM Rosters indexes
CREATE INDEX idx_gm_rosters_user_id ON gm_rosters(user_id);

-- GM Matches indexes
CREATE INDEX idx_gm_matches_player1_id ON gm_matches(player1_id);
CREATE INDEX idx_gm_matches_player2_id ON gm_matches(player2_id);
CREATE INDEX idx_gm_matches_status ON gm_matches(status);

-- Card Collection indexes
CREATE INDEX idx_card_collections_user_id ON card_collections(user_id);
CREATE INDEX idx_card_collections_card_id ON card_collections(card_id);

-- Card indexes
CREATE INDEX idx_cards_rarity ON cards(rarity);
CREATE INDEX idx_cards_type ON cards(type);
```

### Set Up Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE gm_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE gm_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Friendships policies
CREATE POLICY "Users can view their own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friend requests"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships they're part of"
  ON friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete friendships they're part of"
  ON friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- GM Rosters policies
CREATE POLICY "Users can view their own rosters"
  ON gm_rosters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own rosters"
  ON gm_rosters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rosters"
  ON gm_rosters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rosters"
  ON gm_rosters FOR DELETE
  USING (auth.uid() = user_id);

-- GM Matches policies
CREATE POLICY "Users can view matches they're in"
  ON gm_matches FOR SELECT
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Users can create matches"
  ON gm_matches FOR INSERT
  WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Users can update matches they're in"
  ON gm_matches FOR UPDATE
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Cards policies (public read, admin write)
CREATE POLICY "Cards are viewable by everyone"
  ON cards FOR SELECT USING (true);

-- Card Collections policies
CREATE POLICY "Users can view their own card collections"
  ON card_collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own card collections"
  ON card_collections FOR ALL
  USING (auth.uid() = user_id);

-- User Stats policies
CREATE POLICY "Users can view their own stats"
  ON user_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
  ON user_stats FOR ALL
  USING (auth.uid() = user_id);
```

### Create Database Functions

```sql
-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Initialize user stats
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call function on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gm_rosters_updated_at
  BEFORE UPDATE ON gm_rosters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON user_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 4. Test Your Setup

After running all the SQL above, you can test the connection by running your app:

```bash
npm start
```

## 5. Importing Existing friendlyBets Data

If you have existing users and friendships in your friendlyBets project, the tables should already exist. You can verify by checking the **Table Editor** in your Supabase dashboard.

### Check Existing Tables

Run this query to see what tables you have:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Migration Strategy

If you have existing `profiles` and `friendships` tables:

1. Keep your existing tables as-is
2. Add only the NEW tables (gm_rosters, gm_matches, cards, card_collections, user_stats)
3. Update your RLS policies to match the ones above

## Troubleshooting

### Error: "Missing Supabase environment variables"

- Make sure you copied the `.env.example` to `.env`
- Verify your environment variables are correctly formatted
- Restart your Expo dev server

### Error: "permission denied for table"

- Check that RLS policies are set up correctly
- Verify you're logged in (check `useAuth().user`)

### Can't see data in tables

- Check the RLS policies match your user ID
- Use the Supabase dashboard to manually verify data exists

## Next Steps

1. ✅ You've set up Supabase
2. Create authentication screens (login/signup)
3. Implement friend management UI
4. Build the GM roster saving feature
5. Create the card generation system

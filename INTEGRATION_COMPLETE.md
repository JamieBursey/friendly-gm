# Supabase Integration - Complete! ✅

## What Was Set Up

### 1. **Packages Installed**

- `@supabase/supabase-js` - Supabase client library
- `@react-native-async-storage/async-storage` - Secure token storage
- `react-native-url-polyfill` - Required polyfill for React Native

### 2. **Configuration Files Created**

- `lib/supabase.ts` - Supabase client initialization
- `.env` - Environment variables for your credentials
- `.env.example` - Template for credentials
- `.gitignore` - Updated to exclude .env file

### 3. **Authentication System**

- `contexts/AuthContext.tsx` - Auth state management with hooks
- `components/auth/AuthScreen.tsx` - Login/signup UI
- Updated `app/_layout.tsx` - Wrapped app with AuthProvider
- Updated `app/(tabs)/index.tsx` - Added auth check

### 4. **Database Services**

- `types/database.ts` - TypeScript types for all database tables
- `services/database.ts` - Complete service layer with functions for:
  - Profiles
  - Friendships
  - GM Rosters
  - GM Matches
  - User Stats
- `services/cards.ts` - Card game services including:
  - Card collections
  - Pack opening
  - Player card generation
  - Level-based card unlocking

### 5. **Documentation**

- `SUPABASE_SETUP.md` - Complete database setup guide with SQL
- Updated `README.md` - Project overview and setup instructions

## Database Schema Designed

The following tables were designed (SQL in SUPABASE_SETUP.md):

1. **profiles** - User profiles (extends auth.users)
2. **friendships** - Friend relationships with status
3. **gm_rosters** - Saved NHL rosters (JSONB data)
4. **gm_matches** - GM game matches with scores
5. **cards** - Available cards (player, special, legendary)
6. **card_collections** - User's card inventory
7. **user_stats** - Levels, XP, wins/losses

## Quick Start

### Step 1: Add Your Credentials

Open `.env` and add your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these:**

1. Go to [app.supabase.com](https://app.supabase.com)
2. Open your friendlyBets project
3. Settings → API
4. Copy URL and anon key

### Step 2: Set Up Database

1. Go to Supabase Dashboard → SQL Editor
2. Copy ALL SQL from `SUPABASE_SETUP.md`
3. Run it (creates tables, indexes, RLS policies, triggers)

### Step 3: Test It

```bash
npm start
```

You should see a login screen. Try signing up!

## How To Use The Services

### Authentication

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, signIn, signOut } = useAuth();

  // Check if logged in
  if (user) {
    return <Text>Welcome {user.email}</Text>;
  }
}
```

### Database Operations

```typescript
import { rosterService, friendService, cardService } from "@/services/database";

// Save a roster
const roster = await rosterService.createRoster(
  user.id,
  "My Team",
  gmRosterArray,
);

// Get friends
const friends = await friendService.getFriends(user.id);

// Open a card pack
const cards = await cardService.openCardPack(user.id, "gold");
```

## Next Steps

### Immediate Tasks:

1. ✅ Set up Supabase credentials in `.env`
2. ✅ Run SQL setup script
3. ⬜ Test authentication (signup/login)
4. ⬜ Integrate roster saving with Supabase
5. ⬜ Build friend management UI

### Phase 1: Complete GM Game

- [ ] Save rosters to database when user creates them
- [ ] Implement point tracking (use simulation.ts)
- [ ] Create matchmaking UI (select friend + roster)
- [ ] Build live scoring screen
- [ ] Add leaderboards

### Phase 2: Build Card Game

- [ ] Generate initial cards from user's roster
- [ ] Create card display components
- [ ] Build deck builder UI
- [ ] Implement battle system
- [ ] Add progression/leveling

### Phase 3: Polish & Social

- [ ] Friend requests UI
- [ ] Push notifications for challenges
- [ ] Chat/messaging
- [ ] Profile customization
- [ ] Achievements

## Available Service Functions

<details>
<summary><b>Profile Service</b></summary>

```typescript
profileService.getProfile(userId);
profileService.upsertProfile(profile);
profileService.searchProfiles(query);
```

</details>

<details>
<summary><b>Friend Service</b></summary>

```typescript
friendService.getFriends(userId);
friendService.getPendingRequests(userId);
friendService.sendFriendRequest(userId, friendId);
friendService.acceptFriendRequest(friendshipId);
friendService.removeFriendship(friendshipId);
```

</details>

<details>
<summary><b>Roster Service</b></summary>

```typescript
rosterService.getUserRosters(userId);
rosterService.getRoster(rosterId);
rosterService.createRoster(userId, name, players);
rosterService.updateRoster(rosterId, updates);
rosterService.deleteRoster(rosterId);
```

</details>

<details>
<summary><b>Match Service</b></summary>

```typescript
matchService.getUserMatches(userId);
matchService.getActiveMatches(userId);
matchService.createMatch(player1Id, player2Id, roster1Id, roster2Id);
matchService.updateMatchScore(matchId, player1Score, player2Score);
matchService.completeMatch(matchId, winnerId);
```

</details>

<details>
<summary><b>Stats Service</b></summary>

```typescript
statsService.getUserStats(userId);
statsService.initializeStats(userId);
statsService.updateGMStats(userId, won, experienceGained);
statsService.updateCardStats(userId, won, experienceGained);
```

</details>

<details>
<summary><b>Card Service</b></summary>

```typescript
cardService.getAllCards();
cardService.getUserCards(userId);
cardService.getCardsForLevel(level);
cardService.createPlayerCards(players);
cardService.addCardToCollection(userId, cardId, quantity);
cardService.openCardPack(userId, packType);
```

</details>

## Troubleshooting

**"Missing Supabase environment variables"**

- Check `.env` file exists in project root
- Verify no typos in variable names
- Restart Expo dev server

**"permission denied for table"**

- Run the RLS policy SQL from SUPABASE_SETUP.md
- Make sure you're logged in

**Can't create account**

- Check Supabase Dashboard → Authentication → Email is enabled
- Look at Logs for detailed error

## Questions?

- Check `SUPABASE_SETUP.md` for detailed setup
- Check `README.md` for project overview
- Review service code in `services/` for usage examples

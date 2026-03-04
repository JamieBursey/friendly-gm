# Friendly GM - NHL Fantasy & Card Game App

This is a [React Native](https://reactnative.dev/) project created with [Expo](https://expo.dev), featuring:

- 🏒 **GM Mode**: Build NHL rosters and compete with friends
- 🃏 **Card Game**: Yu-Gi-Oh style battle system with NHL player cards
- 👥 **Social**: Connect with friends from your existing friendlyBets network
- 📊 **Progression**: Level up and unlock new cards

## Tech Stack

- **React Native** with Expo
- **TypeScript** for type safety
- **Supabase** for backend (auth, database, real-time)
- **Expo Router** for file-based navigation

## Get started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

Follow the complete guide in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

Quick steps:

1. Get your Supabase credentials from the dashboard
2. Copy `.env.example` to `.env` and fill in your credentials
3. Run the SQL scripts to create database tables
4. Test the connection

### 3. Start the app

```bash
npx expo start
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go)

## Project Structure

```
app/
  (tabs)/           # Tab navigation screens
    index.tsx       # GM Mode home
    explore.tsx     # Card Game home
  _layout.tsx       # Root layout with AuthProvider
components/
  auth/             # Authentication screens
  gm/               # GM Mode components
  game/             # Game logic and progression
  services/         # API and data services
  theme/            # Design system (colors, spacing, typography)
contexts/
  AuthContext.tsx   # Authentication state management
lib/
  supabase.ts       # Supabase client configuration
services/
  database.ts       # Database service layer
  cards.ts          # Card game services
types/
  database.ts       # TypeScript types for database schema
```

## Features

### GM Mode ✅ (70% Complete)

- [x] NHL player search with autocomplete
- [x] Roster builder (15F, 8D, 2G = 25 total)
- [x] Auto-fill roster feature
- [x] Custom theming
- [ ] Save rosters to database
- [ ] Point tracking system
- [ ] Live scoring
- [ ] Multiplayer matchmaking
- [ ] Leaderboards

### Card Game 🚧 (In Progress)

- [ ] Card collection system
- [ ] Battle UI
- [ ] Turn-based gameplay
- [ ] Card abilities
- [ ] Progression & leveling
- [ ] Pack opening

### Social Features 🚧 (In Progress)

- [x] Supabase authentication
- [x] Database schema designed
- [ ] Friend management UI
- [ ] Friend requests
- [ ] Challenge system
- [ ] Chat/messaging

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [React Native documentation](https://reactnative.dev/)
- [Supabase documentation](https://supabase.com/docs)

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

MIT

// Database types - Update these to match your friendlyBets Supabase schema

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      friendships: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: "pending" | "accepted" | "rejected";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: "pending" | "accepted" | "rejected";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          friend_id?: string;
          status?: "pending" | "accepted" | "rejected";
          created_at?: string;
        };
      };
      gm_rosters: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          players: any; // JSON array of player data
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          players: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          players?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      gm_matches: {
        Row: {
          id: string;
          player1_id: string;
          player2_id: string;
          player1_roster_id: string;
          player2_roster_id: string;
          player1_score: number | null;
          player2_score: number | null;
          winner_id: string | null;
          status: "pending" | "active" | "completed";
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          player1_id: string;
          player2_id: string;
          player1_roster_id: string;
          player2_roster_id: string;
          player1_score?: number | null;
          player2_score?: number | null;
          winner_id?: string | null;
          status?: "pending" | "active" | "completed";
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          player1_id?: string;
          player2_id?: string;
          player1_roster_id?: string;
          player2_roster_id?: string;
          player1_score?: number | null;
          player2_score?: number | null;
          winner_id?: string | null;
          status?: "pending" | "active" | "completed";
          created_at?: string;
          completed_at?: string | null;
        };
      };
      card_collections: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          quantity: number;
          acquired_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          quantity?: number;
          acquired_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          card_id?: string;
          quantity?: number;
          acquired_at?: string;
        };
      };
      cards: {
        Row: {
          id: string;
          name: string;
          type: "player" | "special" | "legendary";
          rarity: "common" | "rare" | "epic" | "legendary";
          attack: number;
          defense: number;
          special_ability: string | null;
          image_url: string | null;
          player_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: "player" | "special" | "legendary";
          rarity: "common" | "rare" | "epic" | "legendary";
          attack: number;
          defense: number;
          special_ability?: string | null;
          image_url?: string | null;
          player_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: "player" | "special" | "legendary";
          rarity?: "common" | "rare" | "epic" | "legendary";
          attack?: number;
          defense?: number;
          special_ability?: string | null;
          image_url?: string | null;
          player_id?: string | null;
          created_at?: string;
        };
      };
      user_stats: {
        Row: {
          id: string;
          user_id: string;
          level: number;
          experience: number;
          gm_wins: number;
          gm_losses: number;
          card_wins: number;
          card_losses: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          level?: number;
          experience?: number;
          gm_wins?: number;
          gm_losses?: number;
          card_wins?: number;
          card_losses?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          level?: number;
          experience?: number;
          gm_wins?: number;
          gm_losses?: number;
          card_wins?: number;
          card_losses?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

// Helper types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Friendship = Database["public"]["Tables"]["friendships"]["Row"];
export type GMRoster = Database["public"]["Tables"]["gm_rosters"]["Row"];
export type GMMatch = Database["public"]["Tables"]["gm_matches"]["Row"];
export type Card = Database["public"]["Tables"]["cards"]["Row"];
export type CardCollection =
  Database["public"]["Tables"]["card_collections"]["Row"];
export type UserStats = Database["public"]["Tables"]["user_stats"]["Row"];

import { supabase } from "@/lib/supabase";
import type {
    Friendship,
    GMMatch,
    GMRoster,
    Profile,
    UserStats,
} from "@/types/database";

// ============================================
// PROFILE SERVICES
// ============================================

export const profileService = {
  /**
   * Get user profile by ID
   */
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data as Profile;
  },

  /**
   * Create or update user profile
   */
  async upsertProfile(profile: Partial<Profile>) {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(profile)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  },

  /**
   * Search profiles by username
   */
  async searchProfiles(query: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", `%${query}%`)
      .limit(20);

    if (error) throw error;
    return data as Profile[];
  },
};

// ============================================
// FRIENDSHIP SERVICES
// ============================================

export const friendService = {
  /**
   * Get all friends for a user (accepted friendships)
   */
  async getFriends(userId: string) {
    const { data, error } = await supabase
      .from("friendships")
      .select("*, friend:profiles!friendships_friend_id_fkey(*)")
      .eq("user_id", userId)
      .eq("status", "accepted");

    if (error) throw error;
    return data;
  },

  /**
   * Get pending friend requests
   */
  async getPendingRequests(userId: string) {
    const { data, error } = await supabase
      .from("friendships")
      .select("*, requester:profiles!friendships_user_id_fkey(*)")
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (error) throw error;
    return data;
  },

  /**
   * Send friend request
   */
  async sendFriendRequest(userId: string, friendId: string) {
    const { data, error } = await supabase
      .from("friendships")
      .insert({
        user_id: userId,
        friend_id: friendId,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;
    return data as Friendship;
  },

  /**
   * Accept friend request
   */
  async acceptFriendRequest(friendshipId: string) {
    const { data, error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId)
      .select()
      .single();

    if (error) throw error;
    return data as Friendship;
  },

  /**
   * Reject or remove friendship
   */
  async removeFriendship(friendshipId: string) {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId);

    if (error) throw error;
  },
};

// ============================================
// GM ROSTER SERVICES
// ============================================

export const rosterService = {
  /**
   * Get all rosters for a user
   */
  async getUserRosters(userId: string) {
    const { data, error } = await supabase
      .from("gm_rosters")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as GMRoster[];
  },

  /**
   * Get a specific roster by ID
   */
  async getRoster(rosterId: string) {
    const { data, error } = await supabase
      .from("gm_rosters")
      .select("*")
      .eq("id", rosterId)
      .single();

    if (error) throw error;
    return data as GMRoster;
  },

  /**
   * Create a new roster
   */
  async createRoster(userId: string, name: string, players: any[]) {
    const { data, error } = await supabase
      .from("gm_rosters")
      .insert({
        user_id: userId,
        name,
        players,
      })
      .select()
      .single();

    if (error) throw error;
    return data as GMRoster;
  },

  /**
   * Update an existing roster
   */
  async updateRoster(rosterId: string, updates: Partial<GMRoster>) {
    const { data, error } = await supabase
      .from("gm_rosters")
      .update(updates)
      .eq("id", rosterId)
      .select()
      .single();

    if (error) throw error;
    return data as GMRoster;
  },

  /**
   * Delete a roster
   */
  async deleteRoster(rosterId: string) {
    const { error } = await supabase
      .from("gm_rosters")
      .delete()
      .eq("id", rosterId);

    if (error) throw error;
  },
};

// ============================================
// GM MATCH SERVICES
// ============================================

export const matchService = {
  /**
   * Get all matches for a user
   */
  async getUserMatches(userId: string) {
    const { data, error } = await supabase
      .from("gm_matches")
      .select(
        "*, player1:profiles!gm_matches_player1_id_fkey(*), player2:profiles!gm_matches_player2_id_fkey(*)",
      )
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Get active matches
   */
  async getActiveMatches(userId: string) {
    const { data, error } = await supabase
      .from("gm_matches")
      .select(
        "*, player1:profiles!gm_matches_player1_id_fkey(*), player2:profiles!gm_matches_player2_id_fkey(*)",
      )
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Create a new match
   */
  async createMatch(
    player1Id: string,
    player2Id: string,
    roster1Id: string,
    roster2Id: string,
  ) {
    const { data, error } = await supabase
      .from("gm_matches")
      .insert({
        player1_id: player1Id,
        player2_id: player2Id,
        player1_roster_id: roster1Id,
        player2_roster_id: roster2Id,
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;
    return data as GMMatch;
  },

  /**
   * Update match scores
   */
  async updateMatchScore(
    matchId: string,
    player1Score: number,
    player2Score: number,
  ) {
    const { data, error } = await supabase
      .from("gm_matches")
      .update({
        player1_score: player1Score,
        player2_score: player2Score,
      })
      .eq("id", matchId)
      .select()
      .single();

    if (error) throw error;
    return data as GMMatch;
  },

  /**
   * Complete a match
   */
  async completeMatch(matchId: string, winnerId: string) {
    const { data, error } = await supabase
      .from("gm_matches")
      .update({
        winner_id: winnerId,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", matchId)
      .select()
      .single();

    if (error) throw error;
    return data as GMMatch;
  },
};

// ============================================
// USER STATS SERVICES
// ============================================

export const statsService = {
  /**
   * Get user stats
   */
  async getUserStats(userId: string) {
    const { data, error } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return data as UserStats;
  },

  /**
   * Initialize stats for new user
   */
  async initializeStats(userId: string) {
    const { data, error } = await supabase
      .from("user_stats")
      .insert({
        user_id: userId,
        level: 1,
        experience: 0,
        gm_wins: 0,
        gm_losses: 0,
        card_wins: 0,
        card_losses: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data as UserStats;
  },

  /**
   * Update user stats after GM game
   */
  async updateGMStats(userId: string, won: boolean, experienceGained: number) {
    const stats = await this.getUserStats(userId);

    const { data, error } = await supabase
      .from("user_stats")
      .update({
        gm_wins: won ? stats.gm_wins + 1 : stats.gm_wins,
        gm_losses: !won ? stats.gm_losses + 1 : stats.gm_losses,
        experience: stats.experience + experienceGained,
        level: Math.floor((stats.experience + experienceGained) / 1000) + 1,
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data as UserStats;
  },

  /**
   * Update user stats after card game
   */
  async updateCardStats(
    userId: string,
    won: boolean,
    experienceGained: number,
  ) {
    const stats = await this.getUserStats(userId);

    const { data, error } = await supabase
      .from("user_stats")
      .update({
        card_wins: won ? stats.card_wins + 1 : stats.card_wins,
        card_losses: !won ? stats.card_losses + 1 : stats.card_losses,
        experience: stats.experience + experienceGained,
        level: Math.floor((stats.experience + experienceGained) / 1000) + 1,
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data as UserStats;
  },
};

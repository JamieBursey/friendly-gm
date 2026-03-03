// src/services/nhl.ts
export type NhlRosterPlayer = {
    id: number;
    firstName?: { default: string };
    lastName?: { default: string };
    sweaterNumber?: number;
    positionCode?: string; // C, L, R, D, G
  };
  
  export type NhlRosterResponse = {
    forwards?: NhlRosterPlayer[];
    defensemen?: NhlRosterPlayer[];
    goalies?: NhlRosterPlayer[];
  };
  
  const NHL_BASE = "https://api-web.nhle.com";

export async function fetchCurrentRoster(teamAbbrev: string) {
  const url = `${NHL_BASE}/v1/roster/${teamAbbrev.toUpperCase()}/current`;
  console.log("Fetching NHL roster:", url);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        // Some hosts are picky; this often fixes “Failed to fetch” in mobile runtimes
        "User-Agent": "Mozilla/5.0 (ReactNative; Expo)",
      },
    });

    console.log("NHL roster status:", res.status);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text || "No body"}`);
    }

    const data = await res.json();
    return [
      ...(data.forwards ?? []),
      ...(data.defensemen ?? []),
      ...(data.goalies ?? []),
    ];
  } catch (e: any) {
    console.log("NHL roster fetch error:", e?.message, e);
    throw e;
  }
}
  
  export function displayName(p: NhlRosterPlayer) {
    const first = p.firstName?.default ?? "";
    const last = p.lastName?.default ?? "";
    return `${first} ${last}`.trim() || `Player ${p.id}`;
  }
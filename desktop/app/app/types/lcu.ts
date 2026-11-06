/** Mirrors `AppState` in `crates/shell-state/src/lib.rs`. */
export interface DraftState {
  /** Our lane, upper-case (`MIDDLE`); empty in queues that assign none. */
  myPosition: string
  myChampion: number | null
  myChampionLocked: boolean
  allyChampions: number[]
  /** Enemies picked or hovered so far — fewer than five for most of the draft. */
  enemyChampions: number[]
  /** Every cell of our side, us included, empty ones kept, in cell order. */
  myTeam: TeamSlot[]
  allyBans: number[]
  enemyBans: number[]
  secondsLeft: number
  /** The client's timer phase: `PLANNING`, `BAN_PICK`, `FINALIZATION`. */
  timerPhase: string
  /** Our action open right now — the ban or pick a click may write to. */
  myAction: DraftAction | null
  /** Our first action still to come, and how many turns away it is. */
  myNextAction: DraftAction | null
  turnsUntilMyAction: number | null
}

/** Mirrors `DraftAction` in `crates/lcu/src/champ_select.rs`. */
export interface DraftAction {
  id: number
  kind: 'pick' | 'ban' | string
  /** Hovered while in progress, committed once completed. */
  championId: number | null
  inProgress: boolean
  completed: boolean
}

/** Mirrors `TeamSlot` in `crates/lcu/src/model.rs`. */
export interface TeamSlot {
  championId: number | null
  /** Upper-case lane, empty in queues that assign none. */
  position: string
  locked: boolean
  isMe: boolean
}

export type GameflowPhase =
  | 'None' | 'Lobby' | 'Matchmaking' | 'ReadyCheck' | 'ChampSelect'
  | 'InProgress' | 'Reconnect' | 'WaitingForStats' | 'PreEndOfGame' | 'EndOfGame' | 'Unknown'

export interface AppState {
  /** False means no client is running — a normal state, not an error. */
  connected: boolean
  phase: GameflowPhase
  riotId: string | null
  profileIconId: number | null
  summonerLevel: number | null
  /** Champions the player has mastery points on, most first — their pick pool. Empty until read. */
  championPool: number[]
  /** The same champions with their mastery level and points, most first; at most 50. */
  championMastery: ChampionMastery[]
  draft: DraftState | null
  /** The player's picks in a lobby with no champion select (Swiftplay); absent elsewhere. */
  lobby?: LobbyState | null
}

/** Mirrors `LobbyState` in `crates/lcu/src/lobby.rs`. */
export interface LobbyState {
  queueId: number
  /** The player's picks, in slot order — two in Swiftplay. */
  slots: LobbySlot[]
}

/** Mirrors `LobbySlot` in `crates/lcu/src/lobby.rs`. */
export interface LobbySlot {
  /** Null for an empty slot. */
  championId: number | null
  /** Upper-case lane (`MIDDLE`), empty while none is picked. */
  position: string
}

/** Mirrors `ChampionMastery` in `crates/lcu/src/model.rs`. */
export interface ChampionMastery {
  championId: number
  /** Absent where the source keeps none (another player's, read from Blitz). */
  championPoints?: number
  championLevel: number
  /** Epoch ms; another player's only. */
  lastPlayTime?: number | null
}

/** Mirrors `Screen` in `crates/shell-state/src/lib.rs`. */
export type Screen = 'no-client' | 'dashboard' | 'draft' | 'in-game' | 'lobby'

export const EMPTY_STATE: AppState = {
  connected: false,
  phase: 'None',
  riotId: null,
  profileIconId: null,
  summonerLevel: null,
  championPool: [],
  championMastery: [],
  draft: null,
  lobby: null,
}

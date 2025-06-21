// src/game/PlayerFunds.ts

/**
 * Enumeration for the different game states.
 */
export enum GameState {
    Initial,      // Initial state - empty table
    Betting,      // Player setting bet
    Dealing,      // Initial cards are being dealt
    PlayerTurn,   // Player's turn to hit/stand
    DealerTurn,   // Dealer's turn
    GameOver      // Game ended
}

/**
 * Enumeration for the possible game results.
 */
export enum GameResult {
    PlayerWins,
    DealerWins,
    Push,
    PlayerBlackjack,
    InProgress
}

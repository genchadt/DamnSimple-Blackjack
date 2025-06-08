// src/game/PlayerFunds.ts
export enum GameState {
    Initial,      // Initial state - empty table
    Betting,      // Player setting bet
    PlayerTurn,   // Player's turn to hit/stand
    DealerTurn,   // Dealer's turn
    GameOver      // Game ended
}

export enum GameResult {
    PlayerWins,
    DealerWins,
    Push,
    PlayerBlackjack,
    InProgress
}

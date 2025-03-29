// src/game/gamestorage-ts
// No changes needed here for the core issue, but included for completeness.
import { Card, Suit, Rank } from "./Card"; // Import enums too
import { GameState, GameResult } from "./GameState";

// Interface for the serialized card data
interface SerializedCard {
    suit: Suit;
    rank: Rank;
    faceUp: boolean;
    // uniqueId is not saved/needed for restoration logic itself
}

// Interface for the loaded game state structure
export interface LoadedGameState {
    gameState: GameState | null;
    currentBet: number | null;
    gameResult: GameResult | null;
    playerHand: SerializedCard[] | null; // Store serialized data
    dealerHand: SerializedCard[] | null; // Store serialized data
}


export class GameStorage {
    private static readonly STORAGE_KEY_STATE = "damnSimpleBlackjack_gameState";
    private static readonly STORAGE_KEY_PLAYER_HAND = "damnSimpleBlackjack_playerHand";
    private static readonly STORAGE_KEY_DEALER_HAND = "damnSimpleBlackjack_dealerHand";
    private static readonly STORAGE_KEY_BET = "damnSimpleBlackjack_currentBet";
    private static readonly STORAGE_KEY_RESULT = "damnSimpleBlackjack_gameResult";
    private static readonly STORAGE_KEY_FUNDS = "damnSimpleBlackjack_funds"; // Added funds key

    /**
     * Saves the current game state to local storage.
     */
    public static saveGameState(
        gameState: GameState,
        currentBet: number,
        gameResult: GameResult,
        playerHand: Card[],
        dealerHand: Card[]
    ): void {
        try {
            localStorage.setItem(this.STORAGE_KEY_STATE, gameState.toString());
            localStorage.setItem(this.STORAGE_KEY_BET, currentBet.toString());
            localStorage.setItem(this.STORAGE_KEY_RESULT, gameResult.toString());

            // Save player hand (only if not in Initial state, otherwise clear it)
            if (gameState !== GameState.Initial) {
                const playerHandData: SerializedCard[] = playerHand.map(card => ({
                    suit: card.getSuit(),
                    rank: card.getRank(),
                    faceUp: card.isFaceUp()
                }));
                localStorage.setItem(this.STORAGE_KEY_PLAYER_HAND, JSON.stringify(playerHandData));
            } else {
                 localStorage.removeItem(this.STORAGE_KEY_PLAYER_HAND);
            }

            // Save dealer hand (only if not in Initial state, otherwise clear it)
             if (gameState !== GameState.Initial) {
                const dealerHandData: SerializedCard[] = dealerHand.map(card => ({
                    suit: card.getSuit(),
                    rank: card.getRank(),
                    faceUp: card.isFaceUp()
                }));
                localStorage.setItem(this.STORAGE_KEY_DEALER_HAND, JSON.stringify(dealerHandData));
             } else {
                 localStorage.removeItem(this.STORAGE_KEY_DEALER_HAND);
             }

        } catch (error) {
            console.error("Error saving game state:", error);
        }
    }

     /**
      * Clears saved hand data from local storage.
      * Useful when starting a fresh game or resetting.
      */
     public static clearSavedHands(): void {
         try {
             localStorage.removeItem(this.STORAGE_KEY_PLAYER_HAND);
             localStorage.removeItem(this.STORAGE_KEY_DEALER_HAND);
             console.log("Cleared saved hand data.");
         } catch (error) {
             console.error("Error clearing saved hands:", error);
         }
     }


    /**
     * Loads the game state from local storage.
     * Returns structured data including serialized hands.
     */
    public static loadGameState(): LoadedGameState {
        const emptyState: LoadedGameState = {
            gameState: null, currentBet: null, gameResult: null, playerHand: null, dealerHand: null
        };

        try {
            const savedStateStr = localStorage.getItem(this.STORAGE_KEY_STATE);
            if (!savedStateStr) return emptyState;

            const gameState = parseInt(savedStateStr) as GameState;
            if (isNaN(gameState) || !GameState[gameState]) {
                 console.error("Invalid saved game state value:", savedStateStr);
                 this.clearAllGameData(); // Clear corrupted state
                 return emptyState;
            }


            // If state is Initial, don't load hands/bet/result
            if (gameState === GameState.Initial) {
                return {
                    gameState: GameState.Initial, // Return valid Initial state
                    currentBet: null, gameResult: null, playerHand: null, dealerHand: null
                };
            }

            // Load other components for active game states
            const savedBetStr = localStorage.getItem(this.STORAGE_KEY_BET);
            const currentBet = savedBetStr ? parseInt(savedBetStr) : null;
             if (currentBet === null || isNaN(currentBet)) {
                 console.error("Invalid saved bet value:", savedBetStr);
                 // Don't necessarily clear all data, maybe just reset bet?
                 // For now, return empty to force reset.
                 return emptyState;
             }


            const savedResultStr = localStorage.getItem(this.STORAGE_KEY_RESULT);
            const gameResult = savedResultStr ? parseInt(savedResultStr) as GameResult : null;
             if (gameResult === null || isNaN(gameResult) || !GameResult[gameResult]) {
                 console.error("Invalid saved game result value:", savedResultStr);
                 return emptyState; // Force reset
             }


            // Restore player hand
            const playerHandJson = localStorage.getItem(this.STORAGE_KEY_PLAYER_HAND);
            let playerHand: SerializedCard[] | null = null;
            if (playerHandJson) {
                try {
                    playerHand = JSON.parse(playerHandJson) as SerializedCard[];
                    // Basic validation
                    if (!Array.isArray(playerHand) || playerHand.some(c => !c.suit || !c.rank)) {
                         console.error("Invalid player hand data structure.");
                         playerHand = null; // Invalidate hand
                    }
                } catch (e) {
                    console.error("Error parsing player hand JSON:", e);
                    playerHand = null;
                }
            }

            // Restore dealer hand
            const dealerHandJson = localStorage.getItem(this.STORAGE_KEY_DEALER_HAND);
            let dealerHand: SerializedCard[] | null = null;
            if (dealerHandJson) {
                 try {
                    dealerHand = JSON.parse(dealerHandJson) as SerializedCard[];
                     if (!Array.isArray(dealerHand) || dealerHand.some(c => !c.suit || !c.rank)) {
                         console.error("Invalid dealer hand data structure.");
                         dealerHand = null;
                     }
                 } catch (e) {
                    console.error("Error parsing dealer hand JSON:", e);
                    dealerHand = null;
                 }
            }

             // If hands are missing/invalid in a state that requires them, treat as error
             if (!playerHand || !dealerHand) {
                 console.error("Missing or invalid hand data for active game state. Resetting.");
                 this.clearAllGameData();
                 return emptyState;
             }


            return { gameState, currentBet, gameResult, playerHand, dealerHand };

        } catch (error) {
            console.error("Error loading game state:", error);
            this.clearAllGameData(); // Clear data on general load error
            return emptyState;
        }
    }

     // --- Funds Save/Load (Moved from PlayerFunds for consistency) ---
     public static saveFunds(funds: number): void {
        try {
            localStorage.setItem(this.STORAGE_KEY_FUNDS, funds.toString());
        } catch (error) {
            console.error("Error saving funds:", error);
        }
    }

    public static loadFunds(defaultFunds: number): number {
        try {
            const storedFunds = localStorage.getItem(this.STORAGE_KEY_FUNDS);
            if (storedFunds === null) {
                return defaultFunds;
            }
            const funds = parseInt(storedFunds);
            return isNaN(funds) ? defaultFunds : funds;
        } catch (error) {
            console.error("Error loading funds:", error);
            return defaultFunds;
        }
    }

     // --- Utility to clear all game data ---
     public static clearAllGameData(): void {
         try {
             localStorage.removeItem(this.STORAGE_KEY_STATE);
             localStorage.removeItem(this.STORAGE_KEY_BET);
             localStorage.removeItem(this.STORAGE_KEY_RESULT);
             localStorage.removeItem(this.STORAGE_KEY_PLAYER_HAND);
             localStorage.removeItem(this.STORAGE_KEY_DEALER_HAND);
             localStorage.removeItem(this.STORAGE_KEY_FUNDS);
             console.log("Cleared all saved game data.");
         } catch (error) {
             console.error("Error clearing all game data:", error);
         }
     }
}

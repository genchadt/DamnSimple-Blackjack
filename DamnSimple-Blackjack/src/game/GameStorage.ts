// src/game/GameStorage.ts
// No changes needed here for the core issue, but included for completeness.
// Updated to save/load insurance state
<<<<<<< HEAD
<<<<<<< HEAD
// Updated to save/load multiple player hands and active hand index
import { Card, Suit, Rank } from "./Card"; // Import enums too
import { GameState, GameResult } from "./GameState";
import { QualityLevel, DEFAULT_QUALITY_LEVEL, QualitySettings, UIScaleLevel, UIScaleSettings, DEFAULT_UI_SCALE_LEVEL, Constants } from "../Constants";
import { PlayerHandInfo } from "./BlackjackGame"; // Import PlayerHandInfo
=======
import { Card, Suit, Rank } from "./Card";
import { GameState, GameResult } from "./GameState";
import { QualityLevel, DEFAULT_QUALITY_LEVEL, QualitySettings, UIScaleLevel, UIScaleSettings, DEFAULT_UI_SCALE_LEVEL } from "../Constants";
>>>>>>> ef0a855 (Updated JSDocs)
=======
import { Card, Suit, Rank } from "./Card";
import { GameState, GameResult } from "./GameState";
import { QualityLevel, DEFAULT_QUALITY_LEVEL, QualitySettings, UIScaleLevel, UIScaleSettings, DEFAULT_UI_SCALE_LEVEL } from "../Constants";
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de

/**
 * Interface for serialized card data.
 */
interface SerializedCard {
    suit: Suit;
    rank: Rank;
    faceUp: boolean;
    // uniqueId is not saved/needed for restoration logic itself
}

<<<<<<< HEAD
<<<<<<< HEAD
// Interface for serialized player hand info
interface SerializedPlayerHandInfo {
    id: string;
    cards: SerializedCard[];
    bet: number;
    result: GameResult;
    isResolved: boolean;
    canHit: boolean;
    isBlackjack: boolean;
    isSplitAces: boolean;
}


// Interface for the loaded game state structure
=======
/**
 * Interface for the loaded game state.
 * Includes all necessary data to restore the game.
 */
>>>>>>> ef0a855 (Updated JSDocs)
export interface LoadedGameState {
    gameState: GameState | null;
    currentBet: number | null; // Bet for the initial hand
    gameResult: GameResult | null; // Overall game result
    playerHands: SerializedPlayerHandInfo[] | null; // Array of player hands
    activePlayerHandIndex: number | null;
    dealerHand: SerializedCard[] | null;
    insuranceTakenThisRound?: boolean;
    insuranceBetPlaced?: number;
    playerHand_legacy?: SerializedCard[] | null; // *** FIXED: For backward compatibility if old save exists
}

=======
/**
 * Interface for the loaded game state.
 * Includes all necessary data to restore the game.
 */
export interface LoadedGameState {
    gameState: GameState | null;
    currentBet: number | null;
    gameResult: GameResult | null;
    playerHand: SerializedCard[] | null;
    dealerHand: SerializedCard[] | null;
    insuranceTakenThisRound?: boolean; // Added
    insuranceBetPlaced?: number;      // Added
}

>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
/**
 * Class for managing game state storage.
 */
export class GameStorage {
    private static readonly STORAGE_KEY_STATE = "damnSimpleBlackjack_gameState";
    private static readonly STORAGE_KEY_PLAYER_HANDS = "damnSimpleBlackjack_playerHands"; // Changed from playerHand
    private static readonly STORAGE_KEY_ACTIVE_PLAYER_HAND_INDEX = "damnSimpleBlackjack_activePlayerHandIndex";
    private static readonly STORAGE_KEY_DEALER_HAND = "damnSimpleBlackjack_dealerHand";
    private static readonly STORAGE_KEY_BET = "damnSimpleBlackjack_currentBet"; // Initial bet for the round
    private static readonly STORAGE_KEY_RESULT = "damnSimpleBlackjack_gameResult"; // Overall game result
    private static readonly STORAGE_KEY_FUNDS = "damnSimpleBlackjack_funds";
    private static readonly STORAGE_KEY_QUALITY = "damnSimpleBlackjack_qualityLevel";
    private static readonly STORAGE_KEY_UI_SCALE = "damnSimpleBlackjack_uiScaleLevel";
    private static readonly STORAGE_KEY_INSURANCE_TAKEN = "damnSimpleBlackjack_insuranceTaken";
    private static readonly STORAGE_KEY_INSURANCE_BET = "damnSimpleBlackjack_insuranceBet";

    /**
     * Saves the current game state to local storage.
     * @param gameState The current game state.
     * @param currentBet The current bet amount.
     * @param gameResult The result of the current game.
     * @param playerHand The player's hand as an array of Card objects.
     * @param dealerHand The dealer's hand as an array of Card objects.
     * @param insuranceTaken Indicates if insurance was taken this round.
     * @param insuranceBet The amount of the insurance bet placed.
     * @throws Will log an error if saving fails.
     * @remarks
     * This method serializes the game state, player hand, dealer hand,
     * and insurance state to local storage.
     * If the game state is `GameState.Initial`, it clears the hands and insurance data.
     * If the game state is not `GameState.Initial`, it saves the hands and insurance state.
     */
    public static saveGameState(
        gameState: GameState,
        currentBet: number, // Initial bet for the round
        gameResult: GameResult,
        playerHands: PlayerHandInfo[], // Array of actual PlayerHandInfo objects
        activePlayerHandIndex: number,
        dealerHand: Card[],
        insuranceTaken?: boolean,
        insuranceBet?: number
    ): void {
        try {
            localStorage.setItem(this.STORAGE_KEY_STATE, gameState.toString());
            localStorage.setItem(this.STORAGE_KEY_BET, currentBet.toString());
            localStorage.setItem(this.STORAGE_KEY_RESULT, gameResult.toString());
            localStorage.setItem(this.STORAGE_KEY_ACTIVE_PLAYER_HAND_INDEX, activePlayerHandIndex.toString());


            if (gameState !== GameState.Initial) {
                const serializedPlayerHands: SerializedPlayerHandInfo[] = playerHands.map(handInfo => ({
                    id: handInfo.id,
                    cards: handInfo.cards.map(card => ({
                        suit: card.getSuit(),
                        rank: card.getRank(),
                        faceUp: card.isFaceUp()
                    })),
                    bet: handInfo.bet,
                    result: handInfo.result,
                    isResolved: handInfo.isResolved,
                    canHit: handInfo.canHit,
                    isBlackjack: handInfo.isBlackjack,
                    isSplitAces: handInfo.isSplitAces
                }));
                localStorage.setItem(this.STORAGE_KEY_PLAYER_HANDS, JSON.stringify(serializedPlayerHands));

                const dealerHandData: SerializedCard[] = dealerHand.map(card => ({
                    suit: card.getSuit(),
                    rank: card.getRank(),
                    faceUp: card.isFaceUp()
                }));
                localStorage.setItem(this.STORAGE_KEY_DEALER_HAND, JSON.stringify(dealerHandData));

                // Save insurance state
                if (insuranceTaken !== undefined) {
                    localStorage.setItem(this.STORAGE_KEY_INSURANCE_TAKEN, JSON.stringify(insuranceTaken));
                } else {
                    localStorage.removeItem(this.STORAGE_KEY_INSURANCE_TAKEN);
                }
                if (insuranceBet !== undefined && insuranceBet > 0) {
                    localStorage.setItem(this.STORAGE_KEY_INSURANCE_BET, insuranceBet.toString());
                } else {
                    localStorage.removeItem(this.STORAGE_KEY_INSURANCE_BET);
                }

            } else {
                localStorage.removeItem(this.STORAGE_KEY_PLAYER_HANDS);
                localStorage.removeItem(this.STORAGE_KEY_DEALER_HAND);
                localStorage.removeItem(this.STORAGE_KEY_ACTIVE_PLAYER_HAND_INDEX);
                localStorage.removeItem(this.STORAGE_KEY_INSURANCE_TAKEN);
                localStorage.removeItem(this.STORAGE_KEY_INSURANCE_BET);
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
            localStorage.removeItem(this.STORAGE_KEY_PLAYER_HANDS);
            localStorage.removeItem(this.STORAGE_KEY_DEALER_HAND);
            localStorage.removeItem(this.STORAGE_KEY_ACTIVE_PLAYER_HAND_INDEX);
            localStorage.removeItem(this.STORAGE_KEY_INSURANCE_TAKEN);
            localStorage.removeItem(this.STORAGE_KEY_INSURANCE_BET);
            console.log("Cleared saved hand, index, and insurance data.");
        } catch (error) {
            console.error("Error clearing saved hands/insurance:", error);
        }
    }


    /**
     * Loads the game state from local storage.
     * Returns structured data including serialized hands.
     */
    public static loadGameState(): LoadedGameState {
        const emptyState: LoadedGameState = {
            gameState: null, currentBet: null, gameResult: null,
            playerHands: null, activePlayerHandIndex: 0, dealerHand: null,
            insuranceTakenThisRound: false, insuranceBetPlaced: 0
        };

        try {
            const savedStateStr = localStorage.getItem(this.STORAGE_KEY_STATE);
            if (!savedStateStr) return emptyState;

            const gameState = parseInt(savedStateStr) as GameState;
            if (isNaN(gameState) || !GameState[gameState]) {
                console.error("Invalid saved game state value:", savedStateStr);
                this.clearAllGameData();
                return emptyState;
            }

            if (gameState === GameState.Initial) {
                return {
                    gameState: GameState.Initial, currentBet: null, gameResult: null,
                    playerHands: null, activePlayerHandIndex: 0, dealerHand: null,
                    insuranceTakenThisRound: false, insuranceBetPlaced: 0
                };
            }

            const savedBetStr = localStorage.getItem(this.STORAGE_KEY_BET);
            const currentBet = savedBetStr ? parseInt(savedBetStr) : null;
            if (currentBet === null || isNaN(currentBet)) {
                console.error("Invalid saved bet value:", savedBetStr); return emptyState;
            }

            const savedResultStr = localStorage.getItem(this.STORAGE_KEY_RESULT);
            const gameResult = savedResultStr ? parseInt(savedResultStr) as GameResult : null;
            if (gameResult === null || isNaN(gameResult) || !GameResult[gameResult]) {
                console.error("Invalid saved game result value:", savedResultStr); return emptyState;
            }

            const activePlayerHandIndexStr = localStorage.getItem(this.STORAGE_KEY_ACTIVE_PLAYER_HAND_INDEX);
            const activePlayerHandIndex = activePlayerHandIndexStr ? parseInt(activePlayerHandIndexStr) : 0;
            if (isNaN(activePlayerHandIndex)) {
                console.warn("Invalid activePlayerHandIndex, defaulting to 0");
            }


            const playerHandsJson = localStorage.getItem(this.STORAGE_KEY_PLAYER_HANDS);
            let playerHands: SerializedPlayerHandInfo[] | null = null;
            if (playerHandsJson) {
                try {
                    playerHands = JSON.parse(playerHandsJson) as SerializedPlayerHandInfo[];
                    if (!Array.isArray(playerHands) || playerHands.some(h => !h.cards || !Array.isArray(h.cards))) {
                        playerHands = null;
                    }
                } catch (e) { playerHands = null; }
            }

            // Backward compatibility for old single playerHand save
            let playerHandLegacy: SerializedCard[] | null = null;
            if (!playerHands) {
                const legacyPlayerHandJson = localStorage.getItem("damnSimpleBlackjack_playerHand"); // Old key
                if (legacyPlayerHandJson) {
                    try {
                        playerHandLegacy = JSON.parse(legacyPlayerHandJson) as SerializedCard[];
                        if (!Array.isArray(playerHandLegacy) || playerHandLegacy.some(c => !c.suit || !c.rank)) {
                            playerHandLegacy = null;
                        }
                    } catch (e) { playerHandLegacy = null; }
                }
            }


            const dealerHandJson = localStorage.getItem(this.STORAGE_KEY_DEALER_HAND);
            let dealerHand: SerializedCard[] | null = null;
            if (dealerHandJson) {
                try {
                    dealerHand = JSON.parse(dealerHandJson) as SerializedCard[];
                    if (!Array.isArray(dealerHand) || dealerHand.some(c => !c.suit || !c.rank)) {
                        dealerHand = null;
                    }
                } catch (e) { dealerHand = null; }
            }

            if ((!playerHands && !playerHandLegacy) || !dealerHand) {
                console.error("Missing or invalid hand data for active game state. Resetting.");
                this.clearAllGameData();
                return emptyState;
            }

            // Load insurance state
            let insuranceTakenThisRound = false;
            const insuranceTakenStr = localStorage.getItem(this.STORAGE_KEY_INSURANCE_TAKEN);
            if (insuranceTakenStr) {
                try { insuranceTakenThisRound = JSON.parse(insuranceTakenStr); } catch (e) { /* keep false */ }
            }

            let insuranceBetPlaced = 0;
            const insuranceBetStr = localStorage.getItem(this.STORAGE_KEY_INSURANCE_BET);
            if (insuranceBetStr) {
                insuranceBetPlaced = parseInt(insuranceBetStr);
                if (isNaN(insuranceBetPlaced)) insuranceBetPlaced = 0;
            }


            return { gameState, currentBet, gameResult, playerHands, activePlayerHandIndex, dealerHand, insuranceTakenThisRound, insuranceBetPlaced, playerHand_legacy: playerHandLegacy };

        } catch (error) {
            console.error("Error loading game state:", error);
            this.clearAllGameData();
            return emptyState;
        }
    }

    // --- Funds Save/Load (Moved from PlayerFunds for consistency) ---

    /**
     * Saves the player's funds to local storage.
     * @param funds
     */
    public static saveFunds(funds: number): void {
        try {
            localStorage.setItem(this.STORAGE_KEY_FUNDS, funds.toString());
        } catch (error) {
            console.error("Error saving funds:", error);
        }
    }

    /**
     * Loads the player's funds from local storage.
     * @param defaultFunds The default funds to return if no funds are saved.
     * @returns The loaded funds or the default value if not found or invalid.
     */
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

    // --- Quality Settings Save/Load ---

    /**
     * Saves the quality level to local storage.
     * @param level The quality level to save.
     */
    public static saveQualityLevel(level: QualityLevel): void {
        try {
            localStorage.setItem(this.STORAGE_KEY_QUALITY, level);
        } catch (error) {
            console.error("Error saving quality level:", error);
        }
    }

    /**
     * Loads the quality level from local storage.
     * @returns The loaded quality level or the default if not found or invalid.
     */
    public static loadQualityLevel(): QualityLevel {
        try {
            const storedLevel = localStorage.getItem(this.STORAGE_KEY_QUALITY) as QualityLevel;
            if (storedLevel && QualitySettings[storedLevel]) {
                return storedLevel;
            }
            return DEFAULT_QUALITY_LEVEL;
        } catch (error) {
            console.error("Error loading quality level:", error);
            return DEFAULT_QUALITY_LEVEL;
        }
    }

    // --- UI Scale Settings Save/Load ---

    /**
     * Saves the UI scale level to local storage.
     * @param level The UI scale level to save.
     */
    public static saveUIScaleLevel(level: UIScaleLevel): void {
        try {
            localStorage.setItem(this.STORAGE_KEY_UI_SCALE, level);
        } catch (error) {
            console.error("Error saving UI scale level:", error);
        }
    }

    /**
     * Loads the UI scale level from local storage.
     * @returns The loaded UI scale level or the default if not found or invalid.
     */
    public static loadUIScaleLevel(): UIScaleLevel {
        try {
            const storedLevel = localStorage.getItem(this.STORAGE_KEY_UI_SCALE) as UIScaleLevel;
            if (storedLevel && UIScaleSettings[storedLevel]) {
                return storedLevel;
            }
            return DEFAULT_UI_SCALE_LEVEL;
        } catch (error) {
            console.error("Error loading UI scale level:", error);
            return DEFAULT_UI_SCALE_LEVEL;
        }
    }


    // --- Utility to clear all game data ---

    /**
     * Clears all saved game data from local storage.
     * This includes game state, bets, results, hands, funds, quality settings, and UI scale.
     */
    public static clearAllGameData(): void {
        try {
            localStorage.removeItem(this.STORAGE_KEY_STATE);
            localStorage.removeItem(this.STORAGE_KEY_BET);
            localStorage.removeItem(this.STORAGE_KEY_RESULT);
            localStorage.removeItem(this.STORAGE_KEY_PLAYER_HANDS); // Updated key
            localStorage.removeItem("damnSimpleBlackjack_playerHand"); // Old key for cleanup
            localStorage.removeItem(this.STORAGE_KEY_ACTIVE_PLAYER_HAND_INDEX);
            localStorage.removeItem(this.STORAGE_KEY_DEALER_HAND);
            localStorage.removeItem(this.STORAGE_KEY_FUNDS);
            localStorage.removeItem(this.STORAGE_KEY_QUALITY);
            localStorage.removeItem(this.STORAGE_KEY_UI_SCALE);
            localStorage.removeItem(this.STORAGE_KEY_INSURANCE_TAKEN);
            localStorage.removeItem(this.STORAGE_KEY_INSURANCE_BET);
            console.log("Cleared all saved game data.");
        } catch (error) {
            console.error("Error clearing all game data:", error);
        }
    }
}

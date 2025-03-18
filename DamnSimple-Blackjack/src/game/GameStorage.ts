// game/GameStorage.ts
import { Card } from "./Card";
import { GameState, GameResult } from "./GameState";

export class GameStorage {
    private static readonly STORAGE_KEY_STATE = "damnSimpleBlackjack_gameState";
    private static readonly STORAGE_KEY_PLAYER_HAND = "damnSimpleBlackjack_playerHand";
    private static readonly STORAGE_KEY_DEALER_HAND = "damnSimpleBlackjack_dealerHand";
    private static readonly STORAGE_KEY_BET = "damnSimpleBlackjack_currentBet";
    private static readonly STORAGE_KEY_RESULT = "damnSimpleBlackjack_gameResult";

    /**
     * Saves the current game state to local storage.
     * This includes the game state, current bet, game result, and both player
     * and dealer hands. Each hand is serialized to JSON format.
     *
     * @param {GameState} gameState - The current state of the game.
     * @param {number} currentBet - The current bet amount.
     * @param {GameResult} gameResult - The result of the game.
     * @param {Card[]} playerHand - The player's hand of cards.
     * @param {Card[]} dealerHand - The dealer's hand of cards.
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
            
            // Save player hand
            const playerHandData = playerHand.map(card => ({
                suit: card.getSuit(),
                rank: card.getRank(),
                faceUp: card.isFaceUp()
            }));
            localStorage.setItem(this.STORAGE_KEY_PLAYER_HAND, JSON.stringify(playerHandData));
            
            // Save dealer hand
            const dealerHandData = dealerHand.map(card => ({
                suit: card.getSuit(),
                rank: card.getRank(),
                faceUp: card.isFaceUp()
            }));
            localStorage.setItem(this.STORAGE_KEY_DEALER_HAND, JSON.stringify(dealerHandData));
        } catch (error) {
            console.error("Error saving game state:", error);
        }
    }

    /**
     * Loads the game state from local storage. If the state is not saved, all
     * properties will be null. If the state is saved but invalid, all properties
     * will be null. If the state is saved and valid, the `gameState` property will
     * always be set, and the other properties will be set if the state is not
     * `GameState.Initial`.
     *
     * @returns An object with the following properties:
     * - `gameState`: The current state of the game. If the state is not saved or
     *   invalid, this will be null.
     * - `currentBet`: The current bet amount. If the state is not saved or
     *   invalid, this will be null.
     * - `gameResult`: The result of the game. If the state is not saved or
     *   invalid, this will be null.
     * - `playerHand`: The player's hand of cards. If the state is not saved or
     *   invalid, this will be null.
     * - `dealerHand`: The dealer's hand of cards. If the state is not saved or
     *   invalid, this will be null.
     */
    public static loadGameState(): {
        gameState: GameState | null,
        currentBet: number | null,
        gameResult: GameResult | null,
        playerHand: Card[] | null,
        dealerHand: Card[] | null
    } {
        try {
            const savedState = localStorage.getItem(this.STORAGE_KEY_STATE);
            if (!savedState) {
                return {
                    gameState: null,
                    currentBet: null,
                    gameResult: null,
                    playerHand: null,
                    dealerHand: null
                };
            }

            const gameState = parseInt(savedState) as GameState;
            
            // Only restore cards if we're in a valid game state
            if (gameState === GameState.Initial) {
                return {
                    gameState,
                    currentBet: null,
                    gameResult: null,
                    playerHand: null,
                    dealerHand: null
                };
            }
            
            const savedBet = localStorage.getItem(this.STORAGE_KEY_BET);
            const currentBet = savedBet ? parseInt(savedBet) : null;
            
            const savedResult = localStorage.getItem(this.STORAGE_KEY_RESULT);
            const gameResult = savedResult ? parseInt(savedResult) as GameResult : null;
            
            // Restore player hand
            const playerHandJson = localStorage.getItem(this.STORAGE_KEY_PLAYER_HAND);
            let playerHand: Card[] | null = null;
            if (playerHandJson) {
                const playerHandData = JSON.parse(playerHandJson);
                playerHand = playerHandData.map((cardData: any) => {
                    const card = new Card(cardData.suit, cardData.rank);
                    if (cardData.faceUp) {
                        // Set faceUp without triggering callbacks
                        card.setFaceUp(true);
                    }
                    return card;
                });
            }
            
            // Restore dealer hand
            const dealerHandJson = localStorage.getItem(this.STORAGE_KEY_DEALER_HAND);
            let dealerHand: Card[] | null = null;
            if (dealerHandJson) {
                const dealerHandData = JSON.parse(dealerHandJson);
                dealerHand = dealerHandData.map((cardData: any) => {
                    const card = new Card(cardData.suit, cardData.rank);
                    if (cardData.faceUp) {
                        // Set faceUp without triggering callbacks
                        card.setFaceUp(true);
                    }
                    return card;
                });
            }

            return {
                gameState,
                currentBet,
                gameResult,
                playerHand,
                dealerHand
            };
        } catch (error) {
            console.error("Error restoring game state:", error);
            return {
                gameState: null,
                currentBet: null,
                gameResult: null,
                playerHand: null,
                dealerHand: null
            };
        }
    }
}

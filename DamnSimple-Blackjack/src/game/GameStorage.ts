// game/GameStorage.ts
import { Card } from "./Card";
import { GameState, GameResult } from "./GameState";

export class GameStorage {
    private static readonly STORAGE_KEY_STATE = "damnSimpleBlackjack_gameState";
    private static readonly STORAGE_KEY_PLAYER_HAND = "damnSimpleBlackjack_playerHand";
    private static readonly STORAGE_KEY_DEALER_HAND = "damnSimpleBlackjack_dealerHand";
    private static readonly STORAGE_KEY_BET = "damnSimpleBlackjack_currentBet";
    private static readonly STORAGE_KEY_RESULT = "damnSimpleBlackjack_gameResult";

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

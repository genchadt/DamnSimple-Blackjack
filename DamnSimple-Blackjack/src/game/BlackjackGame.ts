// src/game/blackjackgame-ts (Simplified, owns hands)
import { Card } from "./Card";
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameActions } from "./GameActions";
import { GameController } from "../scenes/components/GameController"; // Import for callback type

export class BlackjackGame {
    private handManager: HandManager;
    private playerFunds: PlayerFunds;
    private gameActions: GameActions;

    // Hands are now directly managed here
    private playerHand: Card[] = [];
    private dealerHand: Card[] = [];

    private animationCompleteCallback: (() => void) | null = null;

    /**
     * Creates a new BlackjackGame object, loading any saved game state if present.
     */
    constructor() {
        this.handManager = new HandManager();
        this.playerFunds = new PlayerFunds();
        // Pass this instance and handManager to GameActions
        this.gameActions = new GameActions(this, this.handManager, this.playerFunds);

        // Try to restore game state (needs to happen after gameActions is created)
        const restored = this.gameActions.loadGameState();
        if (!restored) {
            // If not restored, ensure hands are empty and state is Initial
            this.playerHand = [];
            this.dealerHand = [];
            this.gameActions.setGameState(GameState.Initial, true); // Force save initial state
        }
         console.log("BlackjackGame Initialized. State:", GameState[this.getGameState()]);
         console.log("Initial Player Hand:", this.playerHand.map(c => c.toString()));
         console.log("Initial Dealer Hand:", this.dealerHand.map(c => c.toString()));
    }

    /**
     * Sets the callback function to be invoked when an animation completes.
     * This is typically set by the GameController.
     * @param callback The function to call on animation completion.
     */
    public setAnimationCompleteCallback(callback: () => void): void {
        this.animationCompleteCallback = callback;
    }

    /**
     * Triggers the animation complete callback, if one is set.
     * This should be called by the GameController when an animation finishes.
     */
    public notifyAnimationComplete(): void {
        if (this.animationCompleteCallback) {
            this.animationCompleteCallback();
        } else {
             console.warn("notifyAnimationComplete called but no callback is set.");
        }
    }


    // --- Core Game Actions (delegated to GameActions) ---
    public startNewGame(bet?: number): boolean {
        return this.gameActions.startNewGame(bet);
    }

    public playerHit(): void {
        this.gameActions.playerHit();
    }

    public playerStand(): void {
        this.gameActions.playerStand();
    }

    public doubleDown(): boolean {
        return this.gameActions.doubleDown();
    }

    // --- Game State Mgmt (delegated to GameActions) ---
    public getGameState(): GameState {
        return this.gameActions.getGameState();
    }

    public getGameResult(): GameResult {
        return this.gameActions.getGameResult();
    }

    // --- Hand Mgmt (Direct Access & Calculation) ---
    public getPlayerHand(): Card[] {
        return this.playerHand;
    }

    public setPlayerHand(hand: Card[]): void {
        this.playerHand = hand;
    }

    public getDealerHand(): Card[] {
        return this.dealerHand;
    }

    public setDealerHand(hand: Card[]): void {
        this.dealerHand = hand;
    }

    // Use ScoreCalculator directly
    public getPlayerScore(): number {
        return ScoreCalculator.calculateHandValue(this.playerHand);
    }

    public getDealerScore(): number {
        // Important: Only calculate based on face-up cards for dealer unless revealed
         if (this.getGameState() === GameState.PlayerTurn || this.getGameState() === GameState.Betting) {
             // Calculate score based only on face-up cards during player's turn/betting
             return ScoreCalculator.calculateHandValue(this.dealerHand.filter(card => card.isFaceUp()));
         } else {
             // Calculate full score during dealer's turn or game over
             return ScoreCalculator.calculateHandValue(this.dealerHand);
         }
    }

     // Simplified: Calculate score based on ALL cards in the hand, regardless of face-up state.
     // Used internally by GameActions for determining dealer moves/winner.
     public getDealerFullScore(): number {
        return ScoreCalculator.calculateHandValue(this.dealerHand);
    }


    // --- Money Mgmt ---
    public getCurrentBet(): number {
        return this.gameActions.getCurrentBet();
    }

    public setCurrentBet(amount: number): void {
        this.gameActions.setCurrentBet(amount);
    }

    public getPlayerFunds(): number {
        return this.playerFunds.getFunds();
    }

    public resetFunds(): void {
        this.playerFunds.resetFunds();
        this.gameActions.saveGameState(); // Save state after resetting funds
    }

    // --- Access to Managers/Components ---
    public getPlayerFundsManager(): PlayerFunds {
        return this.playerFunds;
    }

    public getHandManager(): HandManager {
        return this.handManager;
    }

    public getGameActions(): GameActions {
        return this.gameActions;
    }

    // --- Event Handling ---
    // Card flip callback is managed by HandManager
    public addCardFlipCallback(callback: (card: Card) => void): void {
        this.handManager.addCardFlipCallback(callback);
    }
}

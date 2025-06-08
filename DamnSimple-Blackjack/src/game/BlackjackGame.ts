// src/blackjackgame-ts
// Added debug log to notifyCardDealt
import { Card } from "./Card";
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameActions } from "./GameActions";

export class BlackjackGame {
    private handManager: HandManager;
    private playerFunds: PlayerFunds;
    private gameActions: GameActions;

    private playerHand: Card[] = [];
    private dealerHand: Card[] = [];

    private animationCompleteCallback: (() => void) | null = null;

    /** Callback function set by GameController to trigger card deal animations. */
    public notifyCardDealt: (card: Card, index: number, isPlayer: boolean, faceUp: boolean) => void = (card, index, isPlayer, faceUp) => {
        // *** DEBUG LOG ADDED ***
        console.log(`%c[BlackjackGame] notifyCardDealt: Card=${card.toString()}, Index=${index}, IsPlayer=${isPlayer}, FaceUp=${faceUp}`, 'color: #8A2BE2'); // BlueViolet
    };


    constructor() {
        this.handManager = new HandManager();
        this.playerFunds = new PlayerFunds();
        this.gameActions = new GameActions(this, this.handManager, this.playerFunds);

        const restored = this.gameActions.loadGameState();
        if (!restored) {
            this.playerHand = [];
            this.dealerHand = [];
            this.gameActions.setGameState(GameState.Initial, true);
        }
        console.log("[BlackjackGame] Initialized. State:", GameState[this.getGameState()]);
        console.log("[BlackjackGame] Initial Player Hand:", this.playerHand.map(c => c.toString()));
        console.log("[BlackjackGame] Initial Dealer Hand:", this.dealerHand.map(c => c.toString()));
    }

    /**
     * Sets the callback function to be invoked when a game action's associated animation sequence is logically complete.
     * This is typically called by the GameController.
     * @param callback The function to call.
     */
    public setAnimationCompleteCallback(callback: () => void): void {
        this.animationCompleteCallback = callback;
    }

    /**
     * Called by GameActions when a logical step (potentially involving animation) is complete.
     * This, in turn, invokes the callback set by the GameController.
     */
    public notifyAnimationComplete(): void {
        // console.log("[BlackjackGame] Animation complete notification received"); // Reduce log noise
        if (this.animationCompleteCallback) {
            this.animationCompleteCallback();
        } else {
            console.log("[BlackjackGame] No animation complete callback registered");
        }
    }

    // --- Core Game Actions ---
    /**
     * Attempts to start a new game round with the specified bet amount.
     * @param bet The amount to bet. Defaults to the last bet amount if not provided.
     * @returns True if the game started successfully, false otherwise (e.g., insufficient funds).
     */
    public startNewGame(bet?: number): boolean {
        return this.gameActions.startNewGame(bet);
    }

    /** Initiates the player 'hit' action (requesting another card). */
    public playerHit(): void {
        this.gameActions.playerHit();
    }

    /** Initiates the player 'stand' action (ending their turn). */
    public playerStand(): void {
        this.gameActions.playerStand();
    }

    /**
     * Attempts to initiate the player 'double down' action.
     * @returns True if the double down action was successfully initiated, false otherwise.
     */
    public doubleDown(): boolean {
        return this.gameActions.doubleDown();
    }

    // --- Game State Mgmt ---
    /** Gets the current state of the game (e.g., Betting, PlayerTurn). */
    public getGameState(): GameState {
        return this.gameActions.getGameState();
    }

    /** Gets the result of the last completed game (e.g., PlayerWins, Push). */
    public getGameResult(): GameResult {
        return this.gameActions.getGameResult();
    }

    // --- Hand Mgmt ---
    /** Gets the player's current hand of cards. */
    public getPlayerHand(): Card[] {
        return this.playerHand;
    }

    /** Sets the player's hand (used primarily during game state restoration). */
    public setPlayerHand(hand: Card[]): void {
        this.playerHand = hand;
    }

    /** Gets the dealer's current hand of cards. */
    public getDealerHand(): Card[] {
        return this.dealerHand;
    }

    /** Sets the dealer's hand (used primarily during game state restoration). */
    public setDealerHand(hand: Card[]): void {
        this.dealerHand = hand;
    }

    /** Calculates and returns the current score of the player's hand. */
    public getPlayerScore(): number {
        return ScoreCalculator.calculateHandValue(this.playerHand);
    }

    /**
     * Calculates and returns the dealer's score based on the current game state.
     * Shows only the value of face-up cards during player's turn/betting.
     * Shows the full value during dealer's turn or game over.
     */
    public getDealerScore(): number {
        if (this.getGameState() === GameState.PlayerTurn || this.getGameState() === GameState.Betting || this.getGameState() === GameState.Initial) {
            // Calculate score only from cards that are face up
            return ScoreCalculator.calculateHandValue(this.dealerHand.filter(card => card.isFaceUp()));
        } else {
            // Calculate score from all cards in dealer's hand
            return ScoreCalculator.calculateHandValue(this.dealerHand);
        }
    }

    /** Calculates and returns the full score of the dealer's hand, ignoring card visibility state. */
    public getDealerFullScore(): number {
        return ScoreCalculator.calculateHandValue(this.dealerHand);
    }

    // --- Money Mgmt ---
    /** Gets the current bet amount for the round. */
    public getCurrentBet(): number {
        return this.gameActions.getCurrentBet();
    }

    /** Sets the current bet amount (typically during the Betting phase). */
    public setCurrentBet(amount: number): void {
        this.gameActions.setCurrentBet(amount);
    }

    /** Gets the player's total available funds. */
    public getPlayerFunds(): number {
        return this.playerFunds.getFunds();
    }

    /** Resets the player's funds to the default amount and saves the state. */
    public resetFunds(): void {
        this.playerFunds.resetFunds();
        this.gameActions.saveGameState();
    }

    // --- Accessors ---
    /** Gets the PlayerFunds manager instance. */
    public getPlayerFundsManager(): PlayerFunds {
        return this.playerFunds;
    }

    /** Gets the HandManager instance (handles deck and card flip callbacks). */
    public getHandManager(): HandManager {
        return this.handManager;
    }

    /** Gets the GameActions manager instance (handles core game logic flow). */
    public getGameActions(): GameActions {
        return this.gameActions;
    }

    // --- Event Handling ---
    /**
     * Registers a callback function to be notified whenever any card managed by the game is flipped.
     * @param id A unique identifier for the callback.
     * @param callback The function to execute when a card flips, receiving the Card object.
     */
    public addCardFlipCallback(id: string, callback: (card: Card) => void): void {
        this.handManager.addCardFlipCallback(id, callback);
    }
}

// src/game/blackjackgame-ts (Added notifyCardDealt signature)
import { Card } from "./Card";
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameActions } from "./GameActions";
// No need to import GameController here anymore

export class BlackjackGame {
    private handManager: HandManager;
    private playerFunds: PlayerFunds;
    private gameActions: GameActions;

    private playerHand: Card[] = [];
    private dealerHand: Card[] = [];

    private animationCompleteCallback: (() => void) | null = null;

    // *** ADDED THIS SIGNATURE ***
    /** Callback function set by GameController to trigger card deal animations. */
    public notifyCardDealt: (card: Card, index: number, isPlayer: boolean, faceUp: boolean) => void = () => {};


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
        console.log("BlackjackGame Initialized. State:", GameState[this.getGameState()]);
        console.log("Initial Player Hand:", this.playerHand.map(c => c.toString()));
        console.log("Initial Dealer Hand:", this.dealerHand.map(c => c.toString()));
    }

    public setAnimationCompleteCallback(callback: () => void): void {
        this.animationCompleteCallback = callback;
    }

    public notifyAnimationComplete(): void {
        console.log("BlackjackGame: Animation complete notification received");
        
        // ONLY call the callback, don't directly call gameActions
        if (this.animationCompleteCallback) {
            this.animationCompleteCallback();
        } else {
            console.log("No animation complete callback registered");
        }
    }    

    // --- Core Game Actions ---
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

    // --- Game State Mgmt ---
    public getGameState(): GameState {
        return this.gameActions.getGameState();
    }

    public getGameResult(): GameResult {
        return this.gameActions.getGameResult();
    }

    // --- Hand Mgmt ---
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

    public getPlayerScore(): number {
        return ScoreCalculator.calculateHandValue(this.playerHand);
    }

    public getDealerScore(): number {
        // Calculate score based only on face-up cards during player's turn/betting
        if (this.getGameState() === GameState.PlayerTurn || this.getGameState() === GameState.Betting || this.getGameState() === GameState.Initial) {
             return ScoreCalculator.calculateHandValue(this.dealerHand.filter(card => card.isFaceUp()));
        } else {
             // Calculate full score during dealer's turn or game over
             return ScoreCalculator.calculateHandValue(this.dealerHand);
        }
    }

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
        this.gameActions.saveGameState();
    }

    // --- Accessors ---
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
    public addCardFlipCallback(id: string, callback: (card: Card) => void): void {
        this.handManager.addCardFlipCallback(id, callback);
    }
}

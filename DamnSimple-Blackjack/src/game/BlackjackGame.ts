// game/BlackjackGame.ts
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

    /**
     * Creates a new BlackjackGame object, loading any saved game state if present.
     */
    constructor() {
        this.handManager = new HandManager();
        this.playerFunds = new PlayerFunds();
        this.gameActions = new GameActions(this.handManager, this.playerFunds);
        
        // Try to restore game state
        this.gameActions.loadGameState();
    }

    /**
     * Sets the game state to the given value, saving the new state to local storage.
     */
    public setGameState(state: GameState): void {
        this.gameActions.setGameState(state);
    }

    /**
     * Starts a new game of blackjack with the specified bet amount.
     */
    public startNewGame(bet?: number): boolean {
        return this.gameActions.startNewGame(bet);
    }

    /**
     * Executes a hit action for the player or dealer.
     */
    public playerHit(): void {
        this.gameActions.playerHit();
    }

    /**
     * Executes a stand action for the player or dealer.
     */
    public playerStand(): void {
        this.gameActions.playerStand();
    }

    /**
     * Sets the current bet amount to the specified value.
     */
    public setCurrentBet(amount: number): void {
        this.gameActions.setCurrentBet(amount);
    }
    
    /**
     * Doubles the current bet and deals one more card to the player's hand.
     */
    public doubleDown(): boolean {
        return this.gameActions.doubleDown();
    }

    /**
     * Determines if the player can split their hand.
     */
    public canSplit(): boolean {
        return ScoreCalculator.canSplit(
            this.handManager.getPlayerHand(), 
            this.playerFunds.getFunds(), 
            this.gameActions.getCurrentBet()
        );
    }

    /**
     * Adds a callback function to be called when a card is flipped.
     */
    public addCardFlipCallback(callback: (card: Card) => void): void {
        this.handManager.addCardFlipCallback(callback);
    }

    /**
     * Calculates the total value of a hand in Blackjack.
     */
    public calculateHandValue(hand: Card[]): number {
        return ScoreCalculator.calculateHandValue(hand);
    }

    /**
     * Retrieves the player's hand.
     */
    public getPlayerHand(): Card[] {
        return this.handManager.getPlayerHand();
    }

    /**
     * Retrieves the dealer's hand.
     */
    public getDealerHand(): Card[] {
        return this.handManager.getDealerHand();
    }

    /**
     * Retrieves the current game state.
     */
    public getGameState(): GameState {
        return this.gameActions.getGameState();
    }

    /**
     * Retrieves the result of the game.
     */
    public getGameResult(): GameResult {
        return this.gameActions.getGameResult();
    }

    /**
     * Calculates the total value of the player's hand.
     */
    public getPlayerScore(): number {
        return ScoreCalculator.calculateHandValue(this.handManager.getPlayerHand());
    }

    /**
     * Calculates the total value of the dealer's hand.
     */
    public getDealerScore(): number {
        return ScoreCalculator.calculateHandValue(this.handManager.getDealerHand());
    }
    
    /**
     * Retrieves the player's current funds.
     */
    public getPlayerFunds(): number {
        return this.playerFunds.getFunds();
    }
    
    /**
     * Retrieves the current bet amount for the game.
     */
    public getCurrentBet(): number {
        return this.gameActions.getCurrentBet();
    }
    
    /**
     * Resets the player's funds to the default amount.
     */
    public resetFunds(): void {
        this.playerFunds.resetFunds();
    }
}

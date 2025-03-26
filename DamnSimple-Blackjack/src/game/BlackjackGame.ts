// game/BlackjackGame.ts
import { Card } from "./Card";
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameActions } from "./GameActions";

export class BlackjackGame {
    //#region Properties
    private handManager: HandManager;
    private gameActions: GameActions;
    private playerFunds: PlayerFunds;
    private playerHands: Card[][] = [];
    private dealerHands: Card[][] = [];
    private currentHandIndex: number = 0;
    //#endregion

    //#region Constructor
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
    //#endregion

    //#region Core Game Actions
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
     * Doubles the current bet and deals one more card to the player's hand.
     */
    public doubleDown(): boolean {
        return this.gameActions.doubleDown();
    }

    /**
     * Splits the player's hand into two separate hands.
     */
    public splitHand(): boolean {
        if (!this.canSplit()) {
            return false;
        }

        // Deduct the bet for the split hand
        if (!this.playerFunds.deductFunds(this.gameActions.getCurrentBet())) {
            return false;
        }

        // Get current hand
        const currentHand = this.playerHands[this.currentHandIndex];

        // Create a new hand for the split
        const newHand: Card[] = [currentHand.pop()!];
        this.playerHands.push(newHand);

        // Deal a new card to each hand
        this.handManager.dealCard(currentHand, true);
        this.handManager.dealCard(newHand, true);

        return true;
    }
    //#endregion

    //#region Game State Mgmt
    /**
     * Sets the game state to the given value, saving the new state to local storage.
     */
    public setGameState(state: GameState): void {
        this.gameActions.setGameState(state);
    }

    /**
     * Retrieves the current game state.
     * 
     * @return {GameState} The current state of the game.
     */
    public getGameState(): GameState {
        return this.gameActions.getGameState();
    }

    /**
     * Retrieves the result of the game.
     * 
     * @return {GameResult} The result of the game.
     */
    public getGameResult(): GameResult {
        return this.gameActions.getGameResult();
    }
    //#endregion

    //#region Hand Mgmt
    /**
     * Switch to the next hand if available.
     */
    public nextHand(): boolean {
        if (this.currentHandIndex < this.playerHands.length - 1) {
            this.currentHandIndex++;
            return true;
        }
        return false;
    }

    /**
     * Retrieves the player's hand.
     * 
     * @return {Card[]} The player's hand of cards.
     */
    public getPlayerHand(): Card[] {
        return this.playerHands[this.currentHandIndex];
    }

    /**
     * Retrieves the dealer's hand.
     * 
     * @return {Card[]} The dealer's hand of cards.
     */
    public getDealerHand(): Card[] {
        return this.handManager.getDealerHand();
    }

    /**
     * Calculates the total value of a hand in Blackjack.
     * 
     * @param {Card[]} hand - The hand of cards to calculate the value for.
     */
    public calculateHandValue(hand: Card[]): number {
        return ScoreCalculator.calculateHandValue(hand);
    }

    /**
     * Calculates the total value of the player's hand.
     * 
     * @return {number} The total value of the player's hand.
     */
    public getPlayerScore(): number {
        return ScoreCalculator.calculateHandValue(this.handManager.getPlayerHand());
    }

    /**
     * Calculates the total value of the dealer's hand.
     * 
     * @return {number} The total value of the dealer's hand.
     */
    public getDealerScore(): number {
        return ScoreCalculator.calculateHandValue(this.handManager.getDealerHand());
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
    //#endregion

    //#region Money Mgmt
    /**
     * Retrieves the current bet amount for the game.
     * 
     * @return {number} The current bet amount.
     */
    public getCurrentBet(): number {
        return this.gameActions.getCurrentBet();
    }

    /**
     * Sets the current bet amount to the specified value.
     */
    public setCurrentBet(amount: number): void {
        this.gameActions.setCurrentBet(amount);
    }

    /**
     * Retrieves the player's current funds.
     * 
     * @return {number} The player's current funds.
     */
    public getPlayerFunds(): number {
        return this.playerFunds.getFunds();
    }
    
    /**
     * Resets the player's funds to the default amount.
     */
    public resetFunds(): void {
        this.playerFunds.resetFunds();
    }
    //#endregion

    //#region Event Handling
    /**
     * Adds a callback function to be called when a card is flipped.
     * 
     * @param {function} callback - The callback function to be called when a card is flipped.
     * @param {Card} card - The card that was flipped.
     */
    public addCardFlipCallback(callback: (card: Card) => void): void {
        this.handManager.addCardFlipCallback(callback);
    }
    //#endregion
}

// src/blackjackgame-ts
// Added onHandModified callback for granular updates
// Added insurance properties and methods
import { Card, Rank } from "./Card";
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameActions } from "./GameActions";
import { Constants } from "../Constants";

/**
 * Represents a modification to a player's or dealer's hand.
 * This is used to notify listeners about changes in the hand, such as adding a card or setting the hand.
 */
export interface HandModificationUpdate {
    card?: Card; // The card that was added (undefined for a 'set' operation)
    isPlayer: boolean; // Which hand was modified
    type: 'add' | 'set'; // The type of modification ('set' is used for clearing or restoring)
}

/**
 * Represents the main game logic for a Blackjack game.
 * Manages player and dealer hands, game state, and player funds.
 * Provides methods for starting a new game, handling player actions, and managing game state.
 */
export class BlackjackGame {
    private handManager: HandManager;
    private playerFunds: PlayerFunds;
    private gameActions: GameActions;

    private playerHand: Card[] = [];
    private dealerHand: Card[] = [];

    public insuranceTakenThisRound: boolean = false;
    public insuranceBetPlaced: number = 0;

    private animationCompleteCallback: (() => void) | null = null;
    public onHandModified: ((update: HandModificationUpdate) => void) | null = null;

    public notifyCardDealt: (card: Card, index: number, isPlayer: boolean, faceUp: boolean) => void = (card, index, isPlayer, faceUp) => {
        console.log(`%c[BlackjackGame] notifyCardDealt: Card=${card.toString()}, Index=${index}, IsPlayer=${isPlayer}, FaceUp=${faceUp}`, 'color: #8A2BE2'); // BlueViolet
    };

    /**
     * Constructs a new BlackjackGame instance.
     *
     * Creates a new HandManager and PlayerFunds instance.
     * Instantiates a GameActions instance, which will load game state from storage.
     * If the loaded game state is empty (i.e. the game is starting from scratch), sets the game state to Initial
     * and initializes the player and dealer hands.
     * Logs information about the initial state of the game to the console.
     */
    constructor() {
        this.handManager = new HandManager();
        this.playerFunds = new PlayerFunds();
        this.gameActions = new GameActions(this, this.handManager, this.playerFunds);

        const restored = this.gameActions.loadGameState(); // This will also load/set insurance state on BlackjackGame
        if (!restored) {
            this.playerHand = [];
            this.dealerHand = [];
            this.insuranceTakenThisRound = false;
            this.insuranceBetPlaced = 0;
            this.gameActions.setGameState(GameState.Initial, true);
        }
        console.log("[BlackjackGame] Initialized. State:", GameState[this.getGameState()]);
        console.log("[BlackjackGame] Initial Player Hand:", this.playerHand.map(c => c.toString()));
        console.log("[BlackjackGame] Initial Dealer Hand:", this.dealerHand.map(c => c.toString()));
        console.log(`[BlackjackGame] Initial Insurance: Taken=${this.insuranceTakenThisRound}, Bet=${this.insuranceBetPlaced}`);
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

    /**
     * Initiates the player 'hit' action.
     * Delegates to GameActions.playerHit.
     */
    public playerHit(): void {
        this.gameActions.playerHit();
    }

    /**
     * Initiates the player 'stand' action.
     * Delegates to GameActions.playerStand.
     */
    public playerStand(): void {
        this.gameActions.playerStand();
    }

    /**
     * Initiates the player 'surrender' action.
     * Delegates to GameActions.playerSurrender.
     */
    public doubleDown(): boolean {
        return this.gameActions.doubleDown();
    }

    /** Initiates the player 'take insurance' action.
     * Delegates to GameActions.playerTakeInsurance.
     */
    public playerTakeInsurance(): void {
        this.gameActions.playerTakeInsurance();
    }

    /**
     * Checks if insurance is currently available to the player.
     * Conditions: Player's turn, player has 2 cards, dealer's upcard is Ace,
     * insurance not yet taken/declined, player has sufficient funds.
     */
    public isInsuranceAvailable(): boolean {
        if (this.getGameState() !== GameState.PlayerTurn) return false;
        if (this.playerHand.length !== 2) return false; // Only on first two cards
        if (this.dealerHand.length !== 2) return false; // Dealer must have initial hand
        if (this.insuranceTakenThisRound) return false; // Insurance decision already made

        const dealerUpCard = this.dealerHand.find(card => card.isFaceUp());
        if (!dealerUpCard || dealerUpCard.getRank() !== Rank.Ace) return false;

        const insuranceCost = this.getCurrentBet() * Constants.INSURANCE_BET_RATIO;
        if (this.getPlayerFunds() < insuranceCost) return false;

        return true;
    }


    // --- Game State Mgmt ---

    /**
     * Gets the current game state.
     * @returns The current GameState.
     */
    public getGameState(): GameState {
        return this.gameActions.getGameState();
    }

    /**
     * Gets the current game result.
     * @return The current GameResult, which can be Win, Lose, Draw, or InProgress.
     */
    public getGameResult(): GameResult {
        return this.gameActions.getGameResult();
    }

    // --- Hand Mgmt ---

    /**
     * Gets the player's current hand of cards.
     * @return An array of Card objects representing the player's hand.
     */
    public getPlayerHand(): Card[] {
        return this.playerHand;
    }

    /**
     * Sets the player's hand and notifies listeners of the change.
     * @param hand
     */
    public setPlayerHand(hand: Card[]): void {
        this.playerHand = hand;
        if (this.onHandModified) {
            this.onHandModified({ isPlayer: true, type: 'set' });
        }
    }

    /**
     * Gets the dealer's current hand of cards.
     * @return An array of Card objects representing the dealer's hand.
     */
    public getDealerHand(): Card[] {
        return this.dealerHand;
    }

    /**
     * Sets the dealer's hand and notifies listeners of the change.
     * @param hand
     */
    public setDealerHand(hand: Card[]): void {
        this.dealerHand = hand;
        if (this.onHandModified) {
            this.onHandModified({ isPlayer: false, type: 'set' });
        }
    }

    /**
     * Adds a card to the player's hand and notifies listeners.
     * @param card
     */
    public addCardToPlayerHand(card: Card): void {
        this.playerHand.push(card);
        if (this.onHandModified) {
            this.onHandModified({ card: card, isPlayer: true, type: 'add' });
        }
    }

    /**
     * Adds a card to the dealer's hand and notifies listeners.
     * @param card
     */
    public addCardToDealerHand(card: Card): void {
        this.dealerHand.push(card);
        if (this.onHandModified) {
            this.onHandModified({ card: card, isPlayer: false, type: 'add' });
        }
    }

    /**
     * Gets the current player's score based on the player's hand.
     * @return The total score of the player's hand.
     */
    public getPlayerScore(): number {
        return ScoreCalculator.calculateHandValue(this.playerHand);
    }

    /**
     * Calculates and returns the dealer's score based on the current game state.
     * Shows only the value of face-up cards during player's turn/betting.
     * Shows the full value during dealer's turn or game over.
     * @return The dealer's score.
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

    /**
     * Gets the dealer's full score, including all cards in the dealer's hand.
     * This is used for final score calculations after the game ends.
     * @return The total score of the dealer's hand.
     */
    public getDealerFullScore(): number {
        return ScoreCalculator.calculateHandValue(this.dealerHand);
    }

    // --- Money Mgmt ---

    /**
     * Gets the current bet amount.
     * This is typically used during the Betting phase to determine how much the player has wagered.
     * @return The current bet amount.
     */
    public getCurrentBet(): number {
        return this.gameActions.getCurrentBet();
    }

    /**
     * Sets the current bet amount.
     * This is used to update the player's bet during the Betting phase.
     * @param amount The new bet amount to set.
     */
    public setCurrentBet(amount: number): void {
        this.gameActions.setCurrentBet(amount);
    }

    /**
     * Gets the player's current funds.
     * This is used to check how much money the player has available to bet.
     * @return The current amount of funds the player has.
     */
    public getPlayerFunds(): number {
        return this.playerFunds.getFunds();
    }

    /**
     * Resets the player's funds to default (e.g., starting amount).
     */
    public resetFunds(): void {
        this.playerFunds.resetFunds();
        this.gameActions.saveGameState(); // Save after funds reset
    }

    // --- Accessors ---

    /**
     * Gets the PlayerFunds instance, which manages the player's funds.
     * @return The PlayerFunds instance.
     */
    public getPlayerFundsManager(): PlayerFunds {
        return this.playerFunds;
    }

    /**
     * Gets the HandManager instance, which manages the player's and dealer's hands.
     * @return The HandManager instance.
     */
    public getHandManager(): HandManager {
        return this.handManager;
    }

    /**
     * Gets the GameActions instance, which manages game actions and state.
     * @return The GameActions instance.
     */
    public getGameActions(): GameActions {
        return this.gameActions;
    }

    // --- Event Handling ---

    /**
     * Registers a callback function to be notified whenever any card managed by the game is flipped.
     * @param id A unique identifier for the callback.
     * @param callback The function to execute when a card is flipped, receiving the Card object.
     */
    public addCardFlipCallback(id: string, callback: (card: Card) => void): void {
        this.handManager.addCardFlipCallback(id, callback);
    }
}

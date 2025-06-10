// src/game/BlackjackGame.ts
// Added onHandModified callback for granular updates
// Added insurance properties and methods
// Added support for multiple player hands for split functionality
import { Card, Rank } from "./Card"; // Import Rank
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameActions } from "./GameActions";
import { Constants } from "../Constants"; // Import Constants

/** Defines the structure for hand modification updates. */
export interface HandModificationUpdate {
    card?: Card; // The card that was added (undefined for a 'set' operation)
    isPlayer: boolean; // Which hand was modified (true for player, false for dealer)
    handIndex?: number; // For player, which hand was modified if multiple exist
    type: 'add' | 'set' | 'clear' | 'split'; // The type of modification
}

/** Defines the structure for a player's hand, including its bet and status. */
export interface PlayerHandInfo {
    id: string; // Unique ID for this hand instance, e.g., "hand-0", "hand-1"
    cards: Card[];
    bet: number;
    result: GameResult; // Result for this specific hand
    isResolved: boolean; // True if this hand has been stood, busted, doubled, or split-Aces auto-stand.
    canHit: boolean; // Can this hand take more cards?
    isBlackjack: boolean; // Was this hand a natural blackjack?
    isSplitAces: boolean; // True if this hand resulted from splitting Aces (special rules apply)
}

export class BlackjackGame {
    private handManager: HandManager;
    private playerFunds: PlayerFunds;
    private gameActions: GameActions;

    private playerHands: PlayerHandInfo[] = [];
    private activePlayerHandIndex: number = 0;
    private dealerHand: Card[] = [];

    // Insurance related properties - managed by GameActions, reflected here for UI/availability checks
    public insuranceTakenThisRound: boolean = false;
    public insuranceBetPlaced: number = 0;


    private animationCompleteCallback: (() => void) | null = null;
    /** NEW: Callback function set by GameController to trigger when a hand is modified. */
    public onHandModified: ((update: HandModificationUpdate) => void) | null = null;

    /** Callback function set by GameController to trigger card deal animations. */
    public notifyCardDealt: (card: Card, indexInHand: number, isPlayer: boolean, handDisplayIndex: number, faceUp: boolean) => void = (card, indexInHand, isPlayer, handDisplayIndex, faceUp) => {
        // *** DEBUG LOG ADDED ***
        console.log(`%c[BlackjackGame] notifyCardDealt: Card=${card.toString()}, IndexInHand=${indexInHand}, IsPlayer=${isPlayer}, HandDisplayIndex=${handDisplayIndex}, FaceUp=${faceUp}`, 'color: #8A2BE2'); // BlueViolet
    };


    constructor() {
        this.handManager = new HandManager();
        this.playerFunds = new PlayerFunds();
        this.gameActions = new GameActions(this, this.handManager, this.playerFunds);

        const restored = this.gameActions.loadGameState(); // This will also load/set insurance state on BlackjackGame
        if (!restored) {
            this.playerHands = [];
            this.activePlayerHandIndex = 0;
            this.dealerHand = [];
            this.insuranceTakenThisRound = false;
            this.insuranceBetPlaced = 0;
            this.gameActions.setGameState(GameState.Initial, true);
        }
        console.log("[BlackjackGame] Initialized. State:", GameState[this.getGameState()]);
        if (this.playerHands.length > 0) {
            this.playerHands.forEach((hand, idx) => {
                console.log(`[BlackjackGame] Initial Player Hand ${idx}:`, hand.cards.map(c => c.toString()));
            });
        } else {
            console.log("[BlackjackGame] Initial Player Hand: Empty");
        }
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

    /** Initiates the player 'split' action. */
    public playerSplit(): void {
        this.gameActions.playerSplit();
    }

    /** Initiates the player 'take insurance' action. */
    public playerTakeInsurance(): void {
        this.gameActions.playerTakeInsurance();
    }

    /**
     * Checks if the active player hand can be split.
     * Conditions: Player's turn, active hand has 2 cards of the same rank,
     * player has sufficient funds for an additional bet, and max splits not reached.
     */
    public canSplit(): boolean {
        if (this.getGameState() !== GameState.PlayerTurn) return false;
        const activeHandInfo = this.getActivePlayerHandInfo();
        if (!activeHandInfo || activeHandInfo.cards.length !== 2 || activeHandInfo.isResolved) return false;
        if (this.playerHands.length >= Constants.MAX_SPLIT_HANDS) return false; // Max splits reached

        const card1Rank = activeHandInfo.cards[0].getRank();
        const card2Rank = activeHandInfo.cards[1].getRank();
        if (card1Rank !== card2Rank) return false;

        if (this.getPlayerFunds() < activeHandInfo.bet) return false; // Not enough funds for another bet

        return true;
    }


    /**
     * Checks if insurance is currently available to the player.
     * Conditions: Player's turn, player has 2 cards in their *first* hand, dealer's upcard is Ace,
     * insurance not yet taken/declined, player has sufficient funds.
     * Insurance is typically offered only before any other actions (hit, stand, double, split) on the first hand.
     */
    public isInsuranceAvailable(): boolean {
        if (this.getGameState() !== GameState.PlayerTurn) return false;
        // Insurance is usually offered based on the initial hand, before splits.
        // If a split has occurred, insurance is typically no longer an option for subsequent hands.
        // For simplicity, we only check the first hand and only if no other actions have been taken on it.
        if (this.playerHands.length > 1 || this.activePlayerHandIndex !== 0) return false;

        const firstHand = this.playerHands[0];
        if (!firstHand || firstHand.cards.length !== 2) return false; // Only on first two cards of the initial hand
        if (this.dealerHand.length !== 2) return false; // Dealer must have initial hand
        if (this.insuranceTakenThisRound) return false; // Insurance decision already made

        const dealerUpCard = this.dealerHand.find(card => card.isFaceUp());
        if (!dealerUpCard || dealerUpCard.getRank() !== Rank.Ace) return false;

        const insuranceCost = this.getCurrentBet() * Constants.INSURANCE_BET_RATIO; // Bet of the first hand
        if (this.getPlayerFunds() < insuranceCost) return false;

        return true;
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
    /** Gets all player hands. */
    public getPlayerHands(): PlayerHandInfo[] {
        return this.playerHands;
    }

    /** Sets all player hands and notifies listeners. Used for initialization/loading. */
    public setPlayerHands(hands: PlayerHandInfo[]): void {
        this.playerHands = hands;
        if (this.onHandModified) {
            // Notify for each hand, or a general 'set all' notification
            hands.forEach((hand, index) => {
                this.onHandModified!({ isPlayer: true, handIndex: index, type: 'set' });
            });
        }
    }

    /** Gets the currently active player hand's cards. */
    public getActivePlayerHand(): Card[] {
        const handInfo = this.getActivePlayerHandInfo();
        return handInfo ? handInfo.cards : [];
    }

    /** Gets the currently active PlayerHandInfo object. */
    public getActivePlayerHandInfo(): PlayerHandInfo | null {
        if (this.playerHands.length > 0 && this.activePlayerHandIndex >= 0 && this.activePlayerHandIndex < this.playerHands.length) {
            return this.playerHands[this.activePlayerHandIndex];
        }
        return null;
    }

    public getActivePlayerHandIndex(): number {
        return this.activePlayerHandIndex;
    }

    public setActivePlayerHandIndex(index: number): void {
        if (index >= 0 && index < this.playerHands.length) {
            this.activePlayerHandIndex = index;
            if (this.onHandModified) { // Notify that the active hand changed
                this.onHandModified({ isPlayer: true, handIndex: index, type: 'set' }); // 'set' can indicate focus change
            }
        } else {
            console.error(`[BlackjackGame] Invalid active hand index: ${index}`);
        }
    }


    /** Gets the dealer's current hand of cards. */
    public getDealerHand(): Card[] {
        return this.dealerHand;
    }

    /** Sets the dealer's hand and notifies listeners of the change. */
    public setDealerHand(hand: Card[]): void {
        this.dealerHand = hand;
        if (this.onHandModified) {
            this.onHandModified({ isPlayer: false, type: 'set' });
        }
    }

    /** Adds a card to the specified player's hand and notifies listeners. */
    public addCardToPlayerHand(card: Card, handIndex: number): void {
        if (handIndex >= 0 && handIndex < this.playerHands.length) {
            this.playerHands[handIndex].cards.push(card);
            if (this.onHandModified) {
                this.onHandModified({ card: card, isPlayer: true, handIndex: handIndex, type: 'add' });
            }
        } else {
            console.error(`[BlackjackGame] Invalid handIndex ${handIndex} for addCardToPlayerHand.`);
        }
    }

    /** Adds a card to the dealer's hand and notifies listeners. */
    public addCardToDealerHand(card: Card): void {
        this.dealerHand.push(card);
        if (this.onHandModified) {
            this.onHandModified({ card: card, isPlayer: false, type: 'add' });
        }
    }

    /** Calculates and returns the current score of the active player's hand. */
    public getPlayerScore(): number { // This now refers to the active hand
        const activeHand = this.getActivePlayerHandInfo();
        return activeHand ? ScoreCalculator.calculateHandValue(activeHand.cards) : 0;
    }

    /** Calculates and returns the score of a specific player hand by index. */
    public getPlayerScoreForHand(handIndex: number): number {
        if (handIndex >= 0 && handIndex < this.playerHands.length) {
            return ScoreCalculator.calculateHandValue(this.playerHands[handIndex].cards);
        }
        return 0;
    }


    /**
     * Calculates and returns the dealer's score based on the current game state.
     * Shows only the value of face-up cards during player's turn/betting.
     * Shows the full value during dealer's turn or game over.
     */
    public getDealerScore(): number {
        if (this.getGameState() === GameState.PlayerTurn || this.getGameState() === GameState.Betting || this.getGameState() === GameState.Initial || this.getGameState() === GameState.Dealing) {
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
    /** Gets the current bet amount for the active round/hand. */
    public getCurrentBet(): number { // This typically refers to the bet of the first/main hand or the active hand
        const activeHandInfo = this.getActivePlayerHandInfo();
        if (activeHandInfo) {
            return activeHandInfo.bet;
        }
        return this.gameActions.getCurrentBet(); // Fallback to GameActions' general currentBet if no active hand (e.g. betting phase)
    }

    /** Sets the current bet amount (typically during the Betting phase for the first hand). */
    public setCurrentBet(amount: number): void { // This sets the bet for the upcoming first hand
        this.gameActions.setCurrentBet(amount);
    }

    /** Gets the player's total available funds. */
    public getPlayerFunds(): number {
        return this.playerFunds.getFunds();
    }

    /** Resets the player's funds to the default amount and saves the state. */
    public resetFunds(): void {
        this.playerFunds.resetFunds();
        this.gameActions.saveGameState(); // Save after funds reset
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
     * @param callback The function to execute when a card is flipped, receiving the Card object.
     */
    public addCardFlipCallback(id: string, callback: (card: Card) => void): void {
        this.handManager.addCardFlipCallback(id, callback);
    }
}

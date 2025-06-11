// src/game/BlackjackGame.ts
// Added onHandModified callback for granular updates
// Added insurance properties and methods
<<<<<<< HEAD
<<<<<<< HEAD
// Added support for multiple player hands for split functionality
import { Card, Rank } from "./Card"; // Import Rank
=======
import { Card, Rank } from "./Card";
>>>>>>> ef0a855 (Updated JSDocs)
=======
import { Card, Rank } from "./Card";
>>>>>>> ef0a855 (Updated JSDocs)
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
    isPlayer: boolean; // Which hand was modified (true for player, false for dealer)
    handIndex?: number; // For player, which hand was modified if multiple exist
    type: 'add' | 'set' | 'clear' | 'split'; // The type of modification
}

<<<<<<< HEAD
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

=======
>>>>>>> ef0a855 (Updated JSDocs)
/**
 * Represents the main game logic for a Blackjack game.
 * Manages player and dealer hands, game state, and player funds.
 * Provides methods for starting a new game, handling player actions, and managing game state.
 */
export class BlackjackGame {
    private handManager: HandManager;
    private playerFunds: PlayerFunds;
    private gameActions: GameActions;

    private playerHands: PlayerHandInfo[] = [];
    private activePlayerHandIndex: number = -1; // Initialize to -1
    private dealerHand: Card[] = [];

    public insuranceTakenThisRound: boolean = false;
    public insuranceBetPlaced: number = 0;

    private animationCompleteCallback: (() => void) | null = null;
    public onHandModified: ((update: HandModificationUpdate) => void) | null = null;

<<<<<<< HEAD
<<<<<<< HEAD
    /** Callback function set by GameController to trigger card deal animations. */
    public notifyCardDealt: (card: Card, indexInHand: number, isPlayer: boolean, handDisplayIndex: number, faceUp: boolean) => void = (card, indexInHand, isPlayer, handDisplayIndex, faceUp) => {
        console.debug(`%c[BlackjackGame] notifyCardDealt: Card=${card.toString()}, IndexInHand=${indexInHand}, IsPlayer=${isPlayer}, HandDisplayIndex=${handDisplayIndex}, FaceUp=${faceUp}`, 'color: #8A2BE2'); // BlueViolet
=======
=======
>>>>>>> ef0a855 (Updated JSDocs)
    public notifyCardDealt: (card: Card, index: number, isPlayer: boolean, faceUp: boolean) => void = (card, index, isPlayer, faceUp) => {
        console.log(`%c[BlackjackGame] notifyCardDealt: Card=${card.toString()}, Index=${index}, IsPlayer=${isPlayer}, FaceUp=${faceUp}`, 'color: #8A2BE2'); // BlueViolet
>>>>>>> ef0a855 (Updated JSDocs)
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
            this.playerHands = [];
            this.activePlayerHandIndex = 0;
            this.dealerHand = [];
            this.insuranceTakenThisRound = false;
            this.insuranceBetPlaced = 0;
            this.gameActions.setGameState(GameState.Initial, true);
        }
        console.info("[BlackjackGame] Initialized. State:", GameState[this.getGameState()]);
        if (this.playerHands.length > 0) {
            this.playerHands.forEach((hand, idx) => {
                console.info(`[BlackjackGame] Initial Player Hand ${idx}:`, hand.cards.map(c => c.toString()));
            });
        } else {
            console.info("[BlackjackGame] Initial Player Hand: Empty");
        }
        console.info("[BlackjackGame] Initial Dealer Hand:", this.dealerHand.map(c => c.toString()));
        console.info(`[BlackjackGame] Initial Insurance: Taken=${this.insuranceTakenThisRound}, Bet=${this.insuranceBetPlaced}`);
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
        // console.info("[BlackjackGame] Animation complete notification received"); // Reduce log noise
        if (this.animationCompleteCallback) {
            this.animationCompleteCallback();
        } else {
            console.info("[BlackjackGame] No animation complete callback registered");
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

<<<<<<< HEAD
<<<<<<< HEAD
    /** Initiates the player 'split' action. */
    public playerSplit(): void {
        this.gameActions.playerSplit();
    }

    /** Initiates the player 'take insurance' action. */
=======
    /** Initiates the player 'take insurance' action.
     * Delegates to GameActions.playerTakeInsurance.
     */
>>>>>>> ef0a855 (Updated JSDocs)
=======
    /** Initiates the player 'take insurance' action.
     * Delegates to GameActions.playerTakeInsurance.
     */
>>>>>>> ef0a855 (Updated JSDocs)
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
<<<<<<< HEAD
<<<<<<< HEAD
    /** Gets all player hands. */
    public getPlayerHands(): PlayerHandInfo[] {
        return this.playerHands;
    }

    /** Sets all player hands and notifies listeners. Used for initialization/loading. */
    public setPlayerHands(hands: PlayerHandInfo[]): void {
        this.playerHands = hands;
=======
=======
>>>>>>> ef0a855 (Updated JSDocs)

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
>>>>>>> ef0a855 (Updated JSDocs)
        if (this.onHandModified) {
            // Notify for each hand, or a general 'set all' notification
            hands.forEach((hand, index) => {
                this.onHandModified!({ isPlayer: true, handIndex: index, type: 'set' });
            });
        }
    }

<<<<<<< HEAD
<<<<<<< HEAD
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
        // Allow setting to 0 if hands are currently empty (e.g., during reset, before first hand is dealt)
        // startNewGame will populate playerHands and this index will become valid.
        if (this.playerHands.length === 0 && index === 0) {
            this.activePlayerHandIndex = 0;
            // No onHandModified call here, as there's no actual hand to change focus on yet.
            // The UI will update when hands are actually populated.
            return;
        }

        if (index >= 0 && index < this.playerHands.length) {
            if (this.activePlayerHandIndex !== index) {
                this.activePlayerHandIndex = index;
                if (this.onHandModified) { // Notify that the active hand changed
                    this.onHandModified({ isPlayer: true, handIndex: index, type: 'set' }); // 'set' can indicate focus change
                }
            }
        } else {
            console.error(`[BlackjackGame] Invalid active hand index: ${index}. Hands count: ${this.playerHands.length}`);
        }
    }


    /** Gets the dealer's current hand of cards. */
=======
=======
>>>>>>> ef0a855 (Updated JSDocs)
    /**
     * Gets the dealer's current hand of cards.
     * @return An array of Card objects representing the dealer's hand.
     */
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855 (Updated JSDocs)
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

<<<<<<< HEAD
<<<<<<< HEAD
    /** Adds a card to the specified player's hand and notifies listeners. */
    public addCardToPlayerHand(card: Card, handIndex: number): void {
        if (handIndex >= 0 && handIndex < this.playerHands.length) {
            this.playerHands[handIndex].cards.push(card);
            if (this.onHandModified) {
                this.onHandModified({ card: card, isPlayer: true, handIndex: handIndex, type: 'add' });
            }
        } else {
            console.error(`[BlackjackGame] Invalid handIndex ${handIndex} for addCardToPlayerHand.`);
=======
=======
>>>>>>> ef0a855 (Updated JSDocs)
    /**
     * Adds a card to the player's hand and notifies listeners.
     * @param card
     */
    public addCardToPlayerHand(card: Card): void {
        this.playerHand.push(card);
        if (this.onHandModified) {
            this.onHandModified({ card: card, isPlayer: true, type: 'add' });
>>>>>>> ef0a855 (Updated JSDocs)
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

<<<<<<< HEAD
<<<<<<< HEAD
    /** Calculates and returns the current score of the active player's hand. */
    public getPlayerScore(): number { // This now refers to the active hand
        const activeHand = this.getActivePlayerHandInfo();
        return activeHand ? ScoreCalculator.calculateHandValue(activeHand.cards) : 0;
=======
=======
>>>>>>> ef0a855 (Updated JSDocs)
    /**
     * Gets the current player's score based on the player's hand.
     * @return The total score of the player's hand.
     */
    public getPlayerScore(): number {
        return ScoreCalculator.calculateHandValue(this.playerHand);
>>>>>>> ef0a855 (Updated JSDocs)
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
     * @return The dealer's score.
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

    /**
     * Gets the dealer's full score, including all cards in the dealer's hand.
     * This is used for final score calculations after the game ends.
     * @return The total score of the dealer's hand.
     */
    public getDealerFullScore(): number {
        return ScoreCalculator.calculateHandValue(this.dealerHand);
    }

    // --- Money Mgmt ---
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
=======
>>>>>>> ef0a855 (Updated JSDocs)

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
>>>>>>> ef0a855 (Updated JSDocs)
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
<<<<<<< HEAD
// src/game/GameActions.ts
import { Card, Rank } from "./Card"; // Import Rank
=======
// src/game/gameactions-ts
// Added extensive debug logs to startNewGame, processDealQueue, onAnimationComplete
// Added insurance logic
// Introduced GameState.Dealing
// Made resolveInsurance public for debug purposes
import { Card, Rank } from "./Card";
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
=======
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { GameStorage } from "./GameStorage";
<<<<<<< HEAD
<<<<<<< HEAD
import { BlackjackGame, PlayerHandInfo } from "./BlackjackGame"; // Import PlayerHandInfo
import { Constants } from "../Constants"; // Import Constants
=======
import { BlackjackGame } from "./BlackjackGame";
import { Constants } from "../Constants";
>>>>>>> ef0a855 (Updated JSDocs)
=======
import { BlackjackGame } from "./BlackjackGame";
import { Constants } from "../Constants";
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6

/**
 * Enumeration for the last animated action.
 * This is used to track the last action that triggered an animation,
 * allowing the game to determine the next logical step after an animation completes.
 */
enum LastAnimatedAction {
    None,
    InitialDeal, // Represents one card being dealt in the initial sequence
    PlayerHit,
    DealerHit,
    DoubleDownHit,
    RevealDealerHole, // Represents the flip animation of the hole card
    InsuranceTaken, // Represents the UI update after insurance is taken (no cards dealt)
    SplitCardMove, // Animation of a card moving to a new hand position during a split
    DealToSplitHand // Dealing a card to a newly formed or switched-to split hand
}

/**
 * GameActions class handles the game logic for Blackjack, including state management,
 * betting, player actions (hit, stand, double down), dealer logic, and animations.
 * It manages the flow of the game, ensuring that actions are taken in the correct order
 * and that the game state is updated appropriately after each action.
 */
export class GameActions {
    private blackjackGame: BlackjackGame;
    private handManager: HandManager;
    private playerFunds: PlayerFunds;
    private gameState: GameState = GameState.Initial;
    private gameResult: GameResult = GameResult.InProgress; // Overall game result, might be less relevant with multiple hands
    private currentBet: number = 0; // Bet for the initial hand, or reference for subsequent split bets
    private lastBet: number = 10;

    // Insurance specific state for the current round, managed by GameActions
    private roundInsuranceBetAmount: number = 0; // The actual amount of the insurance bet placed this round
    private roundInsuranceTaken: boolean = false; // If insurance was taken this round

    // State for managing the last animated action
    private lastAction: LastAnimatedAction = LastAnimatedAction.None;
<<<<<<< HEAD
<<<<<<< HEAD
    /** Queue for the initial 4-card deal sequence. */
    private dealQueue: { isPlayer: boolean, handDisplayIndex: number, faceUp: boolean }[] = [];
    /** Flag indicating if the initial 4-card deal animation sequence is currently active. */
=======

    // Queue for the initial deal sequence
    private dealQueue: { hand: Card[], faceUp: boolean, isPlayer: boolean }[] = [];

    // State to track if we are currently dealing the initial sequence
>>>>>>> ef0a855 (Updated JSDocs)
    private isDealingInitialSequence: boolean = false;

    // Callback to execute after revealing the dealer's hole card
    private _postRevealCallback: (() => void) | null = null;
    /** Stores a callback for after a split-related animation (like moving a card). */
    private _postSplitAnimationCallback: (() => void) | null = null;

=======

    // Queue for the initial deal sequence
    private dealQueue: { hand: Card[], faceUp: boolean, isPlayer: boolean }[] = [];

    // State to track if we are currently dealing the initial sequence
    private isDealingInitialSequence: boolean = false;

    // Callback to execute after revealing the dealer's hole card
    private _postRevealCallback: (() => void) | null = null;

<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
    /**
     * Constructs a GameActions instance.
     * @param blackjackGame
     * @param handManager
     * @param playerFunds
     * @remarks
     * This class is responsible for managing the game logic of Blackjack,
     * including state transitions, betting, player actions, dealer logic,
     * and animations.
     */
    constructor(blackjackGame: BlackjackGame, handManager: HandManager, playerFunds: PlayerFunds) {
        this.blackjackGame = blackjackGame;
        this.handManager = handManager;
        this.playerFunds = playerFunds;
    }

    // --- State ---

    /**
     * Sets the game's logical state.
     * @param state The new GameState.
     * @param forceSave If true, saves the state even if it hasn't changed (used for explicit saves).
     * @param notifyController If true, explicitly notifies the controller to update UI.
     */
    public setGameState(state: GameState, forceSave: boolean = false, notifyController: boolean = false): void {
        if (state === GameState.Initial) {
            this.resetInternalState(); // Reset actions state first
            this.blackjackGame.setPlayerHands([]); // Clear logical player hands
            this.blackjackGame.setDealerHand([]);   // Clear logical dealer hand
            this.blackjackGame.setActivePlayerHandIndex(0); // Reset active hand index
            this.blackjackGame.insuranceTakenThisRound = false;
            this.blackjackGame.insuranceBetPlaced = 0;
            // roundInsuranceBetAmount and roundInsuranceTaken are reset in resetInternalState
            GameStorage.clearSavedHands(); // Ensure storage is cleared for a true initial state
        }
        const stateChanged = this.gameState !== state;
        if (stateChanged || forceSave) {
            console.log(`%c[GameActions] State Changing: ${GameState[this.gameState]} -> ${GameState[state]}`, 'color: orange; font-weight: bold;');
            if (state === GameState.GameOver) {
                console.debug(`%c[GameActions] DEBUG: Setting GameState to GameOver. Current lastAction: ${LastAnimatedAction[this.lastAction]}. Notifying controller: ${notifyController}`, 'background-color: yellow; color: black');
            }
            this.gameState = state;
            this.saveGameState();
        }
        if (notifyController) {
            this.blackjackGame.notifyAnimationComplete(); // This signals GameController.onGameActionComplete
        }
    }

    /**
     * Gets the current game state.
     * @return The current GameState.
     */
    public getGameState(): GameState { return this.gameState; }

    /**
     * Sets the result of the completed game. (This might need adjustment for multi-hand scenarios)
     * For now, it sets a general game result. Individual hand results are in PlayerHandInfo.
     * @param result The new GameResult.
     * @param forceSave If true, saves the state even if it hasn't changed.
     */
    public setGameResult(result: GameResult, forceSave: boolean = false): void {
        if (this.gameResult !== result || forceSave) {
            this.gameResult = result;
            // this.saveGameState(); // Game state save will happen with setGameState(GameOver)
        }
    }

    /**
     * Gets the current game result.
     * @return The current GameResult.
     */
    public getGameResult(): GameResult { return this.gameResult; }

    // --- Bet ---
<<<<<<< HEAD
<<<<<<< HEAD
    public getCurrentBet(): number { return this.currentBet; } // This is the primary bet for the round
=======
=======
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6

    /**
     * Gets the current bet amount.
     * @return The current bet amount.
     */
    public getCurrentBet(): number { return this.currentBet; }

    /**
     * Gets the last bet amount.
     * This is used to retrieve the bet amount from the previous round.
     * @return The last bet amount.
     */
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
=======
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
    public getLastBet(): number { return this.lastBet; }

    /**
     * Sets the current bet amount, validating against player funds and minimum bet.
     * Only allowed during Betting or Initial states. This sets the bet for the first hand.
     * @param amount The desired bet amount.
     */
    public setCurrentBet(amount: number): void {
        if (this.gameState === GameState.Betting || this.gameState === GameState.Initial) {
            const playerFunds = this.playerFunds.getFunds();
            const validAmount = Math.max(Constants.MIN_BET, Math.min(amount, playerFunds));
            if (this.currentBet !== validAmount) {
                this.currentBet = validAmount;
            }
        } else {
            console.warn("[GameActions] Cannot set bet outside of Betting/Initial state.");
        }
    }

    // --- Game Flow ---

    /**
     * Initiates the start of a new game round.
     * Clears hands, deducts the bet, sets up the initial deal queue, and starts the deal animation sequence.
     * @param bet The bet amount for the new round. Uses last bet if omitted.
     * @returns True if the game start sequence was successfully initiated, false otherwise.
     */
    public startNewGame(bet: number = this.lastBet): boolean {
        console.log(`%c[GameActions] startNewGame called. Bet: ${bet}, Current State: ${GameState[this.gameState]}`, 'color: #008080'); // Teal
        if (this.gameState !== GameState.Betting && this.gameState !== GameState.Initial && this.gameState !== GameState.GameOver) {
            console.error("[GameActions] Cannot start new game from state:", GameState[this.gameState]);
            return false;
        }
        // Check for ongoing actions BEFORE resetting internal state, as reset might clear lastAction.
        if (this.isDealingInitialSequence || (this.lastAction !== LastAnimatedAction.None && this.lastAction !== LastAnimatedAction.RevealDealerHole)) { // Allow reveal to be in progress if game over led here
            console.warn(`[GameActions] Cannot start new game while an action/animation (${LastAnimatedAction[this.lastAction]}) is in progress or initial deal active.`);
            return false;
        }

        const playerFunds = this.playerFunds.getFunds();
        const validBet = Math.max(Constants.MIN_BET, Math.min(bet, playerFunds));
        if (playerFunds < validBet || validBet < Constants.MIN_BET) {
            console.error(`[GameActions] Cannot start game. Insufficient funds (${playerFunds}) for bet (${validBet}) or bet too low.`);
            this.setGameState(GameState.Betting, false, true); // Go back to betting
            return false;
        }

        // Reset internal flags for a new deal sequence
        this.lastAction = LastAnimatedAction.None;
        this.isDealingInitialSequence = false; // Will be set true later when queue processing starts
        this.dealQueue = [];
        this._postRevealCallback = null;
        this._postSplitAnimationCallback = null;
        // Reset round-specific insurance state
        this.roundInsuranceBetAmount = 0;
        this.roundInsuranceTaken = false;
        this.blackjackGame.insuranceTakenThisRound = false; // Also on BlackjackGame instance
        this.blackjackGame.insuranceBetPlaced = 0;       // Also on BlackjackGame instance

        this.setGameResult(GameResult.InProgress); // Overall game result
        this.handManager.refreshDeckIfNeeded();

        // SET STATE TO DEALING *BEFORE* HAND MODIFICATIONS that trigger renderCards
        // This ensures renderCards calls during setup see GameState.Dealing and skip cleanup/instant creation.
        this.setGameState(GameState.Dealing, true, true);

        this.currentBet = validBet;
        this.lastBet = validBet;

        // Clear dealer's hand first. If onHandModified triggers renderCards, it will see 'Dealing' state.
        this.blackjackGame.setDealerHand([]);

        // Create the first player hand. If onHandModified triggers renderCards, it will see 'Dealing' state.
        const initialPlayerHand: PlayerHandInfo = {
            id: `hand-0`,
            cards: [],
            bet: this.currentBet,
            result: GameResult.InProgress,
            isResolved: false,
            canHit: true,
            isBlackjack: false,
            isSplitAces: false
        };
        this.blackjackGame.setPlayerHands([initialPlayerHand]);
        this.blackjackGame.setActivePlayerHandIndex(0);

        if (!this.playerFunds.deductFunds(this.currentBet)) { // Deduct bet for the first hand
            console.error("[GameActions] Fund deduction failed unexpectedly for initial hand.");
            this.blackjackGame.setPlayerHands([]);
            this.blackjackGame.setDealerHand([]);
            this.setGameState(GameState.Betting, false, true); // Revert to betting on failure
            return false;
        }

        // Queuing deals
        console.log(`%c[GameActions] Queuing 1st card: Dealer, faceUp=false`, 'color: #008080');
        this.queueDeal(false, 0, false); // Dealer hand (display index 0 for dealer)
        console.log(`%c[GameActions] Queuing 2nd card: Player Hand 0, faceUp=true`, 'color: #008080');
        this.queueDeal(true, 0, true);  // Player hand 0
        console.log(`%c[GameActions] Queuing 3rd card: Dealer, faceUp=true`, 'color: #008080');
        this.queueDeal(false, 0, true); // Dealer hand
        console.log(`%c[GameActions] Queuing 4th card: Player Hand 0, faceUp=true`, 'color: #008080');
        this.queueDeal(true, 0, true);  // Player hand 0
        console.log(`%c[GameActions] Deal Queue:`, 'color: #008080', this.dealQueue.map(d => `Player=${d.isPlayer}, HandIdx=${d.handDisplayIndex}, FaceUp=${d.faceUp}`));

        // this.lastAction = LastAnimatedAction.InitialDeal; // This will be set inside processDealQueue
        this.isDealingInitialSequence = true; // Set this flag before starting the queue

        console.log(`%c[GameActions] Initiating first deal from queue...`, 'color: #008080');
        this.processDealQueue();

        console.log(`%c[GameActions] New game started logic initiated. Bet: ${this.currentBet}`, 'color: #008080');
        return true;
    }

    /**
     * Checks for initial Blackjack after the initial deal sequence completes for the first hand.
     * If Blackjack occurs, reveals the dealer's hole card and determines the game outcome for that hand.
     * If no Blackjack, proceeds to the player's turn (and offers insurance if applicable).
     */
    private checkInitialBlackjack(): void {
        const activeHandInfo = this.blackjackGame.getActivePlayerHandInfo();
        if (!activeHandInfo) {
            console.error("[GameActions] checkInitialBlackjack: No active player hand found!");
            this.setGameState(GameState.GameOver, true, true); // Should not happen
            return;
        }

        const playerScore = ScoreCalculator.calculateHandValue(activeHandInfo.cards);
        console.log(`%c[GameActions] checkInitialBlackjack for Hand ${this.blackjackGame.getActivePlayerHandIndex()}. Player Score: ${playerScore}`, 'color: #DAA520');

        if (playerScore === 21 && activeHandInfo.cards.length === 2) { // Natural Blackjack
            activeHandInfo.isBlackjack = true;
            activeHandInfo.isResolved = true;
            activeHandInfo.canHit = false;
            console.log(`%c[GameActions] Player Hand ${this.blackjackGame.getActivePlayerHandIndex()} has Blackjack!`, 'color: gold; font-weight: bold;');

            this.requestRevealDealerHoleCard(() => {
                console.log(`%c[GameActions] Post-reveal callback for Player BJ on Hand ${this.blackjackGame.getActivePlayerHandIndex()}.`, 'color: #DAA520');
                this.resolveInsurance(); // Resolve insurance first
                const dealerFullScore = this.blackjackGame.getDealerFullScore();
                const dealerHasBlackjack = dealerFullScore === 21 && this.blackjackGame.getDealerHand().length === 2;

                if (dealerHasBlackjack) {
                    console.log("[GameActions] Dealer also has Blackjack! Push for this hand.");
                    activeHandInfo.result = GameResult.Push;
                    this.playerFunds.addFunds(activeHandInfo.bet); // Return original bet
                } else {
                    console.log("[GameActions] Player wins with Blackjack! (Pays 3:2) for this hand.");
                    activeHandInfo.result = GameResult.PlayerBlackjack;
                    this.playerFunds.addFunds(activeHandInfo.bet * 2.5); // Original bet + 1.5x winnings
                }
                this.proceedToNextActionOrEndGame();
            });
        } else {
            console.log(`%c[GameActions] No initial Blackjack for Hand ${this.blackjackGame.getActivePlayerHandIndex()}. Proceeding to PlayerTurn.`, 'color: #DAA520');
            this.setGameState(GameState.PlayerTurn, true, true);
        }
    }

<<<<<<< HEAD
<<<<<<< HEAD
    /** Initiates the player 'hit' action if conditions are met for the active hand. */
=======
    /**
     * Logic executed when the player 'hit' action is initiated.
     */
>>>>>>> ef0a855 (Updated JSDocs)
=======
    /**
     * Logic executed when the player 'hit' action is initiated.
     */
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
    public playerHit(): void {
        if (this.gameState !== GameState.PlayerTurn) { console.warn("[GameActions] Cannot hit outside of PlayerTurn"); return; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("[GameActions] Cannot hit: Action/Animation in progress."); return; }

        const activeHandInfo = this.blackjackGame.getActivePlayerHandInfo();
        if (!activeHandInfo || !activeHandInfo.canHit || activeHandInfo.isResolved) {
            console.warn("[GameActions] Active hand cannot hit or is already resolved.");
            return;
        }

        console.log(`[GameActions] Player hits on Hand ${this.blackjackGame.getActivePlayerHandIndex()}.`);
        this.blackjackGame.insuranceTakenThisRound = true;
        this.lastAction = LastAnimatedAction.PlayerHit;
        this.dealCardToHand(this.blackjackGame.getActivePlayerHandIndex(), true);
    }

<<<<<<< HEAD
<<<<<<< HEAD
    /** Logic executed after the player 'hit' animation completes. Checks for bust on the active hand. */
=======
    /**
     * Completes the player 'hit' action after the card deal animation.
     */
>>>>>>> ef0a855 (Updated JSDocs)
=======
    /**
     * Completes the player 'hit' action after the card deal animation.
     */
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
    private completePlayerHit(): void {
        const activeHandInfo = this.blackjackGame.getActivePlayerHandInfo();
        if (!activeHandInfo) { console.error("[GameActions] completePlayerHit: No active hand."); return; }

        const playerScore = ScoreCalculator.calculateHandValue(activeHandInfo.cards);
        console.log(`%c[GameActions] completePlayerHit for Hand ${this.blackjackGame.getActivePlayerHandIndex()}. Score: ${playerScore}`, 'color: #DAA520');

        if (playerScore > 21) {
            console.log(`%c[GameActions] Player Hand ${this.blackjackGame.getActivePlayerHandIndex()} Bust!`, 'color: red; font-weight: bold;');
            activeHandInfo.result = GameResult.DealerWins;
            activeHandInfo.isResolved = true;
            activeHandInfo.canHit = false;
            this.lastAction = LastAnimatedAction.None; // Reset before proceeding
            this.proceedToNextActionOrEndGame();
        } else if (playerScore === 21) {
            activeHandInfo.isResolved = true;
            activeHandInfo.canHit = false;
            console.log(`%c[GameActions] Player Hand ${this.blackjackGame.getActivePlayerHandIndex()} reached 21. Auto-standing.`, 'color: #DAA520');
            this.lastAction = LastAnimatedAction.None; // Reset before proceeding
            this.proceedToNextActionOrEndGame();
        } else {
            console.log(`%c[GameActions] Player Hit OK for Hand ${this.blackjackGame.getActivePlayerHandIndex()}. Player turn continues for this hand.`, 'color: #DAA520');
            this.lastAction = LastAnimatedAction.None; // Player can act again
            this.saveGameState();
            this.blackjackGame.notifyAnimationComplete();
        }
    }

<<<<<<< HEAD
<<<<<<< HEAD
    /** Initiates the player 'stand' action if conditions are met for the active hand. */
=======
=======
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
    /**
     * Logic executed when the player 'stand' action is initiated.
     * Reveals the dealer's hole card and proceeds to the dealer's turn.
     */
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
=======
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
    public playerStand(): void {
        if (this.gameState !== GameState.PlayerTurn) { console.warn("[GameActions] Cannot stand outside of PlayerTurn"); return; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("[GameActions] Cannot stand: Action/Animation in progress."); return; }

        const activeHandInfo = this.blackjackGame.getActivePlayerHandInfo();
        if (!activeHandInfo || activeHandInfo.isResolved) {
            console.warn("[GameActions] Active hand already resolved, cannot stand.");
            return;
        }

        console.log(`[GameActions] Player stands on Hand ${this.blackjackGame.getActivePlayerHandIndex()}.`);
        activeHandInfo.isResolved = true;
        activeHandInfo.canHit = false;
        this.blackjackGame.insuranceTakenThisRound = true;

        this.lastAction = LastAnimatedAction.None; // Reset before proceeding
        this.proceedToNextActionOrEndGame();
    }


    /**
     * Initiates the player 'double down' action if conditions are met for the active hand.
     * @returns True if the action was successfully initiated, false otherwise.
     */
    public doubleDown(): boolean {
        if (this.gameState !== GameState.PlayerTurn) { console.warn("[GameActions] Cannot double down now."); return false; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("[GameActions] Cannot double down: Action/Animation in progress."); return false; }

        const activeHandInfo = this.blackjackGame.getActivePlayerHandInfo();
        if (!activeHandInfo || activeHandInfo.cards.length !== 2 || activeHandInfo.isResolved || !activeHandInfo.canHit) {
            console.warn("[GameActions] Double down conditions not met for active hand.");
            return false;
        }
        if (this.playerFunds.getFunds() < activeHandInfo.bet) {
            console.warn("[GameActions] Insufficient funds to double down on active hand.");
            return false;
        }

        console.log(`[GameActions] Player doubles down on Hand ${this.blackjackGame.getActivePlayerHandIndex()}.`);
        if (!this.playerFunds.deductFunds(activeHandInfo.bet)) {
            console.error("[GameActions] Fund deduction failed for double down.");
            return false;
        }

        activeHandInfo.bet *= 2;
        console.log(`[GameActions] Bet for Hand ${this.blackjackGame.getActivePlayerHandIndex()} doubled to: ${activeHandInfo.bet}`);
        this.blackjackGame.insuranceTakenThisRound = true;

        this.lastAction = LastAnimatedAction.DoubleDownHit;
        this.dealCardToHand(this.blackjackGame.getActivePlayerHandIndex(), true);
        return true;
    }

<<<<<<< HEAD
<<<<<<< HEAD
    /** Logic executed after the double down card deal animation completes. Checks for bust, then proceeds. */
=======
    /**
     * Logic executed after th 'double down' animation completes.
     */
>>>>>>> ef0a855 (Updated JSDocs)
=======
    /**
     * Logic executed after th 'double down' animation completes.
     */
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
    private completeDoubleDown(): void {
        const activeHandInfo = this.blackjackGame.getActivePlayerHandInfo();
        if (!activeHandInfo) { console.error("[GameActions] completeDoubleDown: No active hand."); return; }

        activeHandInfo.isResolved = true;
        activeHandInfo.canHit = false;

        const playerScore = ScoreCalculator.calculateHandValue(activeHandInfo.cards);
        console.log(`%c[GameActions] completeDoubleDown for Hand ${this.blackjackGame.getActivePlayerHandIndex()}. Score: ${playerScore}`, 'color: #DAA520');

        if (playerScore > 21) {
            console.log(`%c[GameActions] Player Hand ${this.blackjackGame.getActivePlayerHandIndex()} Bust on Double Down!`, 'color: red; font-weight: bold;');
            activeHandInfo.result = GameResult.DealerWins;
        }
        this.lastAction = LastAnimatedAction.None; // Reset before proceeding
        this.proceedToNextActionOrEndGame();
    }

<<<<<<< HEAD
<<<<<<< HEAD

    /** Handles the player's decision to take insurance. */
=======
    /**
     * Logic executed when the player takes insurance.
     */
>>>>>>> ef0a855 (Updated JSDocs)
=======
    /**
     * Logic executed when the player takes insurance.
     */
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
    public playerTakeInsurance(): void {
        if (!this.blackjackGame.isInsuranceAvailable()) {
            console.warn("[GameActions] Insurance is not available.");
            return;
        }
        if (this.lastAction !== LastAnimatedAction.None) {
            console.warn("[GameActions] Cannot take insurance: Action/Animation in progress.");
            return;
        }

        const firstHandBet = this.blackjackGame.getPlayerHands()[0].bet;
        const insuranceCost = firstHandBet * Constants.INSURANCE_BET_RATIO;

        if (!this.playerFunds.deductFunds(insuranceCost)) {
            console.error("[GameActions] Failed to deduct funds for insurance.");
            return;
        }

        console.log(`[GameActions] Player takes insurance. Bet: ${insuranceCost}`);
        this.roundInsuranceBetAmount = insuranceCost;
        this.roundInsuranceTaken = true;
        this.blackjackGame.insuranceTakenThisRound = true;
        this.blackjackGame.insuranceBetPlaced = insuranceCost;

        this.lastAction = LastAnimatedAction.InsuranceTaken;
        this.saveGameState();
        this.blackjackGame.notifyAnimationComplete(); // For UI update
        this.onAnimationComplete(); // Process logical completion of InsuranceTaken
    }

    /**
     * Resolves the insurance bet based on whether the dealer has Blackjack.
     * Public for DebugManager access.
     */
    public resolveInsurance(): void {
        if (this.roundInsuranceTaken) {
            console.log("[GameActions] Resolving insurance...");
            const dealerHand = this.blackjackGame.getDealerHand();
            const dealerHasBlackjack = this.blackjackGame.getDealerFullScore() === 21 && dealerHand.length === 2 && dealerHand.some(c => c.isFaceUp() && c.getRank() === Rank.Ace);

            if (dealerHasBlackjack) {
                console.log("[GameActions] Dealer has Blackjack. Insurance pays 2:1.");
                const winnings = this.roundInsuranceBetAmount * Constants.INSURANCE_PAYOUT_RATIO;
                const totalReturn = this.roundInsuranceBetAmount + winnings;
                this.playerFunds.addFunds(totalReturn);
                console.log(`[GameActions] Insurance payout: ${totalReturn} added to funds.`);
            } else {
                console.log("[GameActions] Dealer does not have Blackjack. Insurance bet lost.");
            }
            this.roundInsuranceTaken = false;
            this.roundInsuranceBetAmount = 0;
        }
    }

<<<<<<< HEAD
<<<<<<< HEAD
    /**
     * Handles the player's decision to split a hand.
     */
    public playerSplit(): void {
        if (!this.blackjackGame.canSplit()) {
            console.warn("[GameActions] Split condition not met.");
            return;
        }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) {
            console.warn("[GameActions] Cannot split: Action/Animation in progress.");
            return;
        }

        const activeHandIndex = this.blackjackGame.getActivePlayerHandIndex();
        const handToSplit = this.blackjackGame.getPlayerHands()[activeHandIndex];

        console.log(`[GameActions] Player splits Hand ${activeHandIndex}.`);

        if (!this.playerFunds.deductFunds(handToSplit.bet)) {
            console.error("[GameActions] Insufficient funds to cover bet for new split hand.");
            return;
        }

        const cardToMove = handToSplit.cards.pop()!;
        const isSplittingAces = handToSplit.cards[0].getRank() === Rank.Ace;

        const newHand: PlayerHandInfo = {
            id: `hand-${this.blackjackGame.getPlayerHands().length}`,
            cards: [cardToMove],
            bet: handToSplit.bet,
            result: GameResult.InProgress,
            isResolved: false,
            canHit: !isSplittingAces, // Aces can't be hit after split (usually only one card each)
            isBlackjack: false,
            isSplitAces: isSplittingAces
        };

        handToSplit.isSplitAces = isSplittingAces;
        handToSplit.canHit = !isSplittingAces; // Original hand also follows split aces hit rule

        this.blackjackGame.getPlayerHands().push(newHand);

        if (this.blackjackGame.onHandModified) {
            this.blackjackGame.onHandModified({
                isPlayer: true,
                handIndex: activeHandIndex,
                type: 'split' // Indicates the original hand was modified by splitting
            });
            this.blackjackGame.onHandModified({
                isPlayer: true,
                handIndex: this.blackjackGame.getPlayerHands().length - 1, // Index of the new hand
                type: 'set' // Indicates a new hand was set up
            });
        }

        this.blackjackGame.insuranceTakenThisRound = true; // Player made an action, insurance offer (if any) is over.

        this.lastAction = LastAnimatedAction.SplitCardMove;
        this._postSplitAnimationCallback = () => {
            console.log(`[GameActions] Post-split animation: Dealing card to first split hand (Hand ${activeHandIndex})`);
            // Ensure lastAction is set correctly *before* calling dealCardToHand.
            // This was identified as a potential cause for the "invalid lastAction state" error.
            this.lastAction = LastAnimatedAction.DealToSplitHand; 
            this.dealCardToHand(activeHandIndex, true);
        };

        // Notify that the cardToMove is now part of a new hand for visual purposes.
        // The CardVisualizer's renderCards or a specific split animation handler will place it.
        // For now, notifyCardDealt might be confusing here as it's not a "deal" from deck.
        // The onHandModified and subsequent renderCards should handle visual update.
        // However, if a specific animation for the card moving is desired, this is where it would be triggered.
        // For simplicity, we rely on renderCards called by GameController after onHandModified.
        this.saveGameState();
        this.blackjackGame.notifyAnimationComplete(); // Notify controller to update UI and potentially re-render cards
    }


=======
>>>>>>> ef0a855 (Updated JSDocs)
=======
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
    // --- Dealer Logic ---

    /**
     * Initiates the visual reveal of the dealer's hole card if it's face down.
     * @param callback Optional function to execute after the reveal animation completes.
     */
    public requestRevealDealerHoleCard(callback?: () => void): void {
        const dealerHand = this.blackjackGame.getDealerHand();
        console.log(`%c[GameActions] requestRevealDealerHoleCard called. Dealer Hand Length: ${dealerHand.length}`, 'color: magenta');
        if (dealerHand.length > 0) {
            const holeCard = dealerHand[0]; // Keep a reference
            console.log(`%c[GameActions]   -> Hole Card: ${holeCard.toString()} (ID: ${holeCard.getUniqueId()}), IsFaceUp: ${holeCard.isFaceUp()}`, 'color: magenta');

            if (!holeCard.isFaceUp()) {
                if (this.lastAction !== LastAnimatedAction.None) {
                    console.warn(`%c[GameActions] Cannot reveal hole card while action (${LastAnimatedAction[this.lastAction]}) is in progress. Blocking reveal. Callback will NOT be executed.`, 'color: red; font-weight: bold;');
                    // Do not execute callback if blocked, as the state is uncertain.
                    return;
                }
                console.log(`%c[GameActions] Setting lastAction=RevealDealerHole and storing callback.`, 'color: magenta');
                this.lastAction = LastAnimatedAction.RevealDealerHole;
                this._postRevealCallback = callback || null;
                console.log(`%c[GameActions] Calling flip() on dealer card 0: ${holeCard.toString()}`, 'color: magenta');
                holeCard.flip();
            } else {
                console.log(`%c[GameActions] Dealer hole card already revealed. Executing callback immediately (if provided).`, 'color: magenta');
                if (callback) {
                    Promise.resolve().then(callback);
                }
            }
        } else {
            console.log(`%c[GameActions] No dealer cards to reveal. Executing callback immediately (if provided).`, 'color: magenta');
            if (callback) {
                Promise.resolve().then(callback);
            }
        }
    }

    /**
     * Executes the dealer's turn logic.
     * This method checks the dealer's score and decides whether to hit or stand based on Blackjack rules.
     * It also handles bust conditions and proceeds to determine the game outcome.
     */
    public executeDealerTurn(): void {
        console.log(`%c[GameActions] executeDealerTurn called. State: ${GameState[this.gameState]}`, 'color: magenta');
        if (this.gameState !== GameState.DealerTurn) {
            console.warn(`[GameActions] executeDealerTurn called in wrong state: ${GameState[this.gameState]}`);
            if (!this.areAllPlayerHandsResolved()) {
                console.error("[GameActions] CRITICAL: executeDealerTurn called but not all player hands are resolved!");
                return;
            }
            this.setGameState(GameState.DealerTurn, true, false);
        }

        if (this.lastAction !== LastAnimatedAction.None) {
            console.warn(`%c[GameActions] Cannot execute dealer turn: Action/Animation (${LastAnimatedAction[this.lastAction]}) in progress.`, 'color: magenta');
            return;
        }

        const dealerScore = this.blackjackGame.getDealerFullScore();
        console.log(`%c[GameActions] DEALER TURN - Current Full Score: ${dealerScore}`, 'color: magenta; font-weight: bold;');

        if (dealerScore < Constants.DEALER_STAND_SCORE) {
            console.log("[GameActions] Dealer score < 17. Dealer hits.");
            this.lastAction = LastAnimatedAction.DealerHit;
            this.dealCardToHand(-1, true);
        } else {
            console.log(`[GameActions] Dealer score ${dealerScore} >= ${Constants.DEALER_STAND_SCORE}. Dealer stands.`);
            this.dealerStand();
        }
    }

    /**
     * Logic executed after the dealer 'hit' animation completes.
     * Checks for bust, otherwise continues dealer turn.
     */
    private completeDealerHit(): void {
        const dealerScore = this.blackjackGame.getDealerFullScore();
        console.log(`%c[GameActions] completeDealerHit. Score: ${dealerScore}`, 'color: #DAA520');
        this.saveGameState();

        if (dealerScore > 21) {
            console.log("%c[GameActions] Dealer Bust!", 'color: lime; font-weight: bold;');
            this.blackjackGame.getPlayerHands().forEach(handInfo => {
                if (handInfo.result === GameResult.InProgress) {
                    handInfo.result = GameResult.PlayerWins;
                    this.playerFunds.addFunds(handInfo.bet * 2);
                }
            });
            this.resolveInsurance();
            this.setGameResult(GameResult.PlayerWins);
            this.lastAction = LastAnimatedAction.None; // Ensure lastAction is None before GameOver
            console.debug(`%c[GameActions] DEBUG: Dealer Busted. Calling setGameState(GameOver).`, 'background-color: yellow; color: black');
            this.setGameState(GameState.GameOver, true, true);
        } else {
            console.log(`%c[GameActions] Dealer Hit OK. Continuing dealer turn...`, 'color: #DAA520');
            // Reset lastAction BEFORE calling executeDealerTurn to allow it to proceed
            this.lastAction = LastAnimatedAction.None;
            this.executeDealerTurn();
        }
    }

<<<<<<< HEAD
<<<<<<< HEAD
    /** Logic executed when the dealer stands. Determines the winner for each player hand. */
=======
    /**
     * Logic executed when the dealer stands. Determines the winner based on scores.
     */
>>>>>>> ef0a855 (Updated JSDocs)
=======
    /**
     * Logic executed when the dealer stands. Determines the winner based on scores.
     */
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
    private dealerStand(): void {
        console.log(`%c[GameActions] dealerStand called. State: ${GameState[this.gameState]}, LastAction: ${LastAnimatedAction[this.lastAction]}`, 'color: #DAA520');

        this.resolveInsurance();

        const dealerScore = this.blackjackGame.getDealerFullScore();
        let overallGameResultHasPlayerWin = false;

        this.blackjackGame.getPlayerHands().forEach((handInfo, index) => {
            if (handInfo.result === GameResult.InProgress) {
                const playerScore = ScoreCalculator.calculateHandValue(handInfo.cards);
                if (playerScore > 21) { // Player bust
                    handInfo.result = GameResult.DealerWins;
                } else if (dealerScore > 21) { // Dealer bust
                    handInfo.result = GameResult.PlayerWins;
                    this.playerFunds.addFunds(handInfo.bet * 2);
                    overallGameResultHasPlayerWin = true;
                } else if (playerScore > dealerScore) { // Player higher than dealer
                    handInfo.result = GameResult.PlayerWins;
                    this.playerFunds.addFunds(handInfo.bet * 2);
                    overallGameResultHasPlayerWin = true;
                } else if (dealerScore > playerScore) { // Dealer higher than player
                    handInfo.result = GameResult.DealerWins;
                } else { // Push
                    handInfo.result = GameResult.Push;
                    this.playerFunds.addFunds(handInfo.bet);
                }
                console.log(`%c[GameActions] Hand ${index} Result: ${GameResult[handInfo.result]} (Player: ${playerScore}, Dealer: ${dealerScore})`, 'color: yellow;');
            } else { // Hand was already resolved (e.g. Player Blackjack, Player Bust earlier)
                if (handInfo.result === GameResult.PlayerWins || handInfo.result === GameResult.PlayerBlackjack) {
                    overallGameResultHasPlayerWin = true;
                }
                console.log(`%c[GameActions] Hand ${index} was already resolved as: ${GameResult[handInfo.result]}`, 'color: gray;');
            }
        });

        if (this.blackjackGame.getPlayerHands().every(h => h.result === GameResult.DealerWins)) {
            this.setGameResult(GameResult.DealerWins);
        } else if (overallGameResultHasPlayerWin) {
            this.setGameResult(GameResult.PlayerWins);
        } else if (this.blackjackGame.getPlayerHands().every(h => h.result === GameResult.Push || h.result === GameResult.DealerWins)) {
            if (this.blackjackGame.getPlayerHands().some(h => h.result === GameResult.Push)) {
                this.setGameResult(GameResult.Push);
            } else {
                this.setGameResult(GameResult.DealerWins);
            }
        }
        // If the above conditions don't set a specific overall result,
        // it might remain InProgress or a previous state.
        // Ensure an overall result is determined. If any player hand won or pushed, it's not a total dealer win.
        // If all hands are resolved and none are player wins/pushes, it's a dealer win.

        this.lastAction = LastAnimatedAction.None; // Ensure lastAction is None before GameOver
        // The setGameState to GameOver will notify the controller, which should update the UI.
        // If "New Hand" / "Change Bet" buttons are still greyed out after this,
        // the issue is likely in GameUI.ts's handling of the GameState.GameOver,
        // as GameActions has correctly set the state.
        console.debug(`%c[GameActions] DEBUG: Dealer Stands. Calling setGameState(GameOver).`, 'background-color: yellow; color: black');
        this.setGameState(GameState.GameOver, true, true);
    }

    // --- Card Dealing ---
<<<<<<< HEAD
<<<<<<< HEAD
    /** Adds a card deal instruction to the initial deal queue. */
    private queueDeal(isPlayer: boolean, handDisplayIndex: number, faceUp: boolean): void {
        this.dealQueue.push({ isPlayer, handDisplayIndex, faceUp });
=======
=======
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6

    /**
     * Queues a card deal for the initial deal sequence.
     * @param hand
     * @param faceUp
     * @param isPlayer
     * @private
     */
    private queueDeal(hand: Card[], faceUp: boolean, isPlayer: boolean): void {
        this.dealQueue.push({ hand, faceUp, isPlayer });
>>>>>>> ef0a855 (Updated JSDocs)
    }

    /**
     * Processes the deal queue for the initial deal sequence.
     * This method handles the logic for dealing cards to the player and dealer,
     * including managing the state of the game during the initial deal.
     * It ensures that cards are dealt in the correct order and that the game state
     * is updated appropriately after each card is dealt.
     */
    private processDealQueue(): void {
        console.log(`%c[GameActions] processDealQueue called. Queue size: ${this.dealQueue.length}, isDealingInitialSequence: ${this.isDealingInitialSequence}`, 'color: cyan');
        if (!this.isDealingInitialSequence) {
            console.error("[GameActions] processDealQueue called outside of initial deal sequence!");
            this.lastAction = LastAnimatedAction.None;
            return;
        }

        if (this.dealQueue.length > 0) {
            const dealInfo = this.dealQueue.shift()!;
            const target = dealInfo.isPlayer ? `Player Hand ${dealInfo.handDisplayIndex}` : 'Dealer';
            console.log(`%c[GameActions] Processing deal for: ${target}, faceUp: ${dealInfo.faceUp}`, 'color: cyan; font-weight: bold;');

            const card = this.handManager.drawCard();

            if (!card) {
                console.error("[GameActions] Deck empty during initial deal!");
                this.isDealingInitialSequence = false;
                this.lastAction = LastAnimatedAction.None;
                this.setGameState(GameState.GameOver, true);
                this.setGameResult(GameResult.DealerWins);
                this.blackjackGame.notifyAnimationComplete();
                return;
            }

            console.log(`%c[GameActions]   -> Drawn card: ${card.toString()}`, 'color: cyan');
            card.setFaceUp(dealInfo.faceUp);
            console.log(`%c[GameActions]   -> Card state after setFaceUp: ${card.isFaceUp()}`, 'color: cyan');

            let handRef: Card[];
            if (dealInfo.isPlayer) {
                const playerHandInfo = this.blackjackGame.getPlayerHands()[dealInfo.handDisplayIndex];
                playerHandInfo.cards.push(card);
                handRef = playerHandInfo.cards;
            } else {
                this.blackjackGame.addCardToDealerHand(card);
                handRef = this.blackjackGame.getDealerHand();
            }
            this.handManager.registerFlipCallback(card);

            console.log(`%c[GameActions]   -> Adding card to ${target}. New hand size: ${handRef.length}`, 'color: cyan');
            this.lastAction = LastAnimatedAction.InitialDeal;
            console.log(`%c[GameActions]   -> Set lastAction = InitialDeal`, 'color: cyan');
            console.log(`%c[GameActions]   -> Calling blackjackGame.notifyCardDealt with faceUp=${dealInfo.faceUp}`, 'color: cyan');
            this.blackjackGame.notifyCardDealt(
                card,
                handRef.length - 1,
                dealInfo.isPlayer,
                dealInfo.handDisplayIndex,
                dealInfo.faceUp
            );
            console.log(`%c[GameActions]   -> Waiting for visual animation to complete...`, 'color: cyan');
        } else {
            console.error("[GameActions] processDealQueue called with empty queue during initial deal sequence!");
            this.isDealingInitialSequence = false;
            this.lastAction = LastAnimatedAction.None;
            this.checkInitialBlackjack();
        }
    }

<<<<<<< HEAD
<<<<<<< HEAD
    /** Deals a single card directly to a hand (used for Hit, Double Down, Dealer Hit, Split Hand).
     * @param targetHandIndex For player, the index of the hand in playerHands. For dealer, pass -1.
     * @param faceUp Whether the card should be dealt face up.
     */
    private dealCardToHand(targetHandIndex: number, faceUp: boolean): void {
        const isPlayerHand = targetHandIndex !== -1;
        const handDesc = isPlayerHand ? `Player Hand ${targetHandIndex}` : 'Dealer';
        console.log(`%c[GameActions] dealCardToHand called for ${handDesc}. FaceUp: ${faceUp}, isDealingInitial: ${this.isDealingInitialSequence}`, 'color: cyan');

=======
=======
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
    /**
     * Deals a single card to the specified hand.
     * This method is used for player hits, dealer hits, and double downs.
     * It checks if the game is in the correct state to deal a card and manages the animation flow.
     * @param hand
     * @param faceUp
     * @private
     */
    private dealCardToHand(hand: Card[], faceUp: boolean): void {
        console.log(`%c[GameActions] dealCardToHand called. FaceUp: ${faceUp}, isDealingInitial: ${this.isDealingInitialSequence}`, 'color: cyan');
>>>>>>> ef0a855 (Updated JSDocs)
        if (this.isDealingInitialSequence) {
            console.error("[GameActions] Cannot deal single card while initial deal sequence is processing!");
            this.lastAction = LastAnimatedAction.None;
            return;
        }

        // Valid preceding actions for dealing a single card (hit, double, dealer hit, or dealing to a split hand)
        const validPrecedingActions = [
            LastAnimatedAction.PlayerHit,
            LastAnimatedAction.DealerHit,
            LastAnimatedAction.DoubleDownHit,
            LastAnimatedAction.DealToSplitHand // This is crucial for the split logic
        ];
        if (!validPrecedingActions.includes(this.lastAction)) {
            console.error(`[GameActions] dealCardToHand called with invalid lastAction state: ${LastAnimatedAction[this.lastAction]}. Expected one of: ${validPrecedingActions.map(a => LastAnimatedAction[a]).join(', ')}`);
            // Potentially reset lastAction to None to prevent further errors if this is a critical path failure.
            // However, this might mask the root cause. For now, just log and return.
            // this.lastAction = LastAnimatedAction.None; 
            return;
        }


        const card = this.handManager.drawCard();
        if (card) {
            console.log(`%c[GameActions]   -> Dealing single card ${card.toString()} to ${handDesc}`, 'color: cyan');
            card.setFaceUp(faceUp);
            console.log(`%c[GameActions]   -> Card state after setFaceUp: ${card.isFaceUp()}`, 'color: cyan');

            let handRef: Card[];
            let handDisplayIndexForNotification: number;

            if (isPlayerHand) {
                const playerHandInfo = this.blackjackGame.getPlayerHands()[targetHandIndex];
                if (!playerHandInfo) {
                    console.error(`[GameActions] dealCardToHand: Player hand at index ${targetHandIndex} not found!`);
                    this.lastAction = LastAnimatedAction.None;
                    return;
                }
                this.blackjackGame.addCardToPlayerHand(card, targetHandIndex);
                handRef = playerHandInfo.cards;
                handDisplayIndexForNotification = targetHandIndex;

                if (playerHandInfo.isSplitAces && playerHandInfo.cards.length === 2) {
                    playerHandInfo.canHit = false;
                    playerHandInfo.isResolved = true;
                    console.log(`%c[GameActions]   -> Hand ${targetHandIndex} (Split Aces) received second card. Auto-standing.`, 'color: orange');
                }

            } else { // Dealer's hand
                this.blackjackGame.addCardToDealerHand(card);
                handRef = this.blackjackGame.getDealerHand();
                handDisplayIndexForNotification = 0;
            }
            this.handManager.registerFlipCallback(card);
            console.log(`%c[GameActions]   -> Added card to ${handDesc}. New size: ${handRef.length}`, 'color: cyan');
            console.log(`%c[GameActions]   -> Calling blackjackGame.notifyCardDealt with faceUp=${faceUp}`, 'color: cyan');
            this.blackjackGame.notifyCardDealt(card, handRef.length - 1, isPlayerHand, handDisplayIndexForNotification, faceUp);
            console.log(`%c[GameActions]   -> Waiting for visual animation to complete...`, 'color: cyan');
        } else {
            console.error("[GameActions] Deck is empty when trying to deal single card!");
            const currentAction = this.lastAction;
            this.lastAction = LastAnimatedAction.None;
            if (currentAction === LastAnimatedAction.DealerHit) this.dealerStand();
            else if (currentAction === LastAnimatedAction.PlayerHit || currentAction === LastAnimatedAction.DoubleDownHit || currentAction === LastAnimatedAction.DealToSplitHand) {
                const activeHandInfo = this.blackjackGame.getActivePlayerHandInfo();
                if (activeHandInfo) {
                    activeHandInfo.isResolved = true;
                    activeHandInfo.canHit = false;
                }
                this.proceedToNextActionOrEndGame();
            } else {
                this.blackjackGame.notifyAnimationComplete();
            }
        }
    }


    // --- Animation Callback ---

    /**
     * Callback for when an animation completes.
     * This method handles the logic for processing the last action that was animated,
     * updating the game state, and managing the next steps in the game flow.
     */
    public onAnimationComplete(): void {
        const actionJustCompleted = this.lastAction;
        console.log(`%c[GameActions] >>> onAnimationComplete called for action: ${LastAnimatedAction[actionJustCompleted]} <<<`, 'color: orange; font-weight: bold');

        // Store and clear callbacks first, so they are not accidentally re-used if logic below re-enters onAnimationComplete
        const postRevealCb = this._postRevealCallback;
        this._postRevealCallback = null;
        const postSplitAnimCb = this._postSplitAnimationCallback;
        this._postSplitAnimationCallback = null;

        // IMPORTANT: lastAction is managed by each case or the methods they call.
        // No general fallback reset at the end of this method anymore.

        if (actionJustCompleted === LastAnimatedAction.InitialDeal) {
            if (this.dealQueue.length > 0) {
                console.log(`%c[GameActions]   -> InitialDeal completed, ${this.dealQueue.length} cards left in queue. Processing next...`, 'color: orange');
                this.processDealQueue(); // This will keep lastAction as InitialDeal if more cards
                console.log(`%c[GameActions] <<< onAnimationComplete finished processing for ${LastAnimatedAction[actionJustCompleted]} (InitialDeal Queue Continues) >>>`, 'color: orange; font-weight: bold');
                return; 
            } else {
                console.log(`%c[GameActions]   -> InitialDeal completed, queue empty. Sequence finished.`, 'color: orange');
                this.isDealingInitialSequence = false;
                this.lastAction = LastAnimatedAction.None; 
                console.log(`%c[GameActions]   -> Checking for initial Blackjack...`, 'color: orange');
                this.checkInitialBlackjack(); 
                console.log(`%c[GameActions] <<< onAnimationComplete finished processing for ${LastAnimatedAction[actionJustCompleted]} (InitialDeal Sequence End) >>>`, 'color: orange; font-weight: bold');
                return;
            }
        }


        switch (actionJustCompleted) {
            case LastAnimatedAction.PlayerHit:
                console.log(`%c[GameActions]   -> Calling completePlayerHit()`, 'color: orange');
                this.completePlayerHit();
                // completePlayerHit now sets lastAction to None if player can act again or proceeds.
                break;
            case LastAnimatedAction.DealerHit:
                console.log(`%c[GameActions]   -> Calling completeDealerHit()`, 'color: orange');
                this.completeDealerHit();
                // completeDealerHit sets lastAction to None before calling executeDealerTurn (which might set a new DealerHit) or GameOver.
                break;
            case LastAnimatedAction.DoubleDownHit:
                console.log(`%c[GameActions]   -> Calling completeDoubleDown()`, 'color: orange');
                this.completeDoubleDown();
                // completeDoubleDown sets lastAction to None.
                break;
            case LastAnimatedAction.RevealDealerHole:
                console.log(`%c[GameActions]   -> RevealDealerHole animation complete.`, 'color: orange');
                this.lastAction = LastAnimatedAction.None; // Reset before callback
                if (postRevealCb) {
                    console.log(`%c[GameActions]   -> Executing post-reveal callback. lastAction is now ${LastAnimatedAction[this.lastAction]}`, 'color: orange');
                    postRevealCb(); 
                } else {
                    console.warn("[GameActions] RevealDealerHole completed but no callback was set. This might be an issue if a dependent action was expected.");
                    this.blackjackGame.notifyAnimationComplete(); 
                }
                break;
            case LastAnimatedAction.InsuranceTaken:
                console.log(`%c[GameActions]   -> InsuranceTaken action complete. UI already updated by setGameState or direct notify.`, 'color: orange');
                this.lastAction = LastAnimatedAction.None;
                // playerTakeInsurance calls notifyAnimationComplete for UI and then this.onAnimationComplete.
                // No further notification needed from here.
                break;
            case LastAnimatedAction.SplitCardMove:
                console.log(`%c[GameActions]   -> SplitCardMove animation complete.`, 'color: orange');
                // lastAction is NOT set to None here. postSplitAnimCb will set it to DealToSplitHand.
                if (postSplitAnimCb) {
                    console.log(`%c[GameActions]   -> Executing post-split animation callback.`, 'color: orange');
                    postSplitAnimCb(); 
                } else {
                    console.error("[GameActions] SplitCardMove completed but no callback to deal card!");
                    this.lastAction = LastAnimatedAction.None; // Fallback if no callback
                    this.blackjackGame.notifyAnimationComplete();
                }
                break;
            case LastAnimatedAction.DealToSplitHand:
                console.log(`%c[GameActions]   -> DealToSplitHand animation complete.`, 'color: orange');
                const activeHand = this.blackjackGame.getActivePlayerHandInfo();
                if (activeHand) {
                    const score = ScoreCalculator.calculateHandValue(activeHand.cards);
                    if (score > 21) {
                        activeHand.result = GameResult.DealerWins;
                        activeHand.isResolved = true;
                        activeHand.canHit = false;
                        console.log(`%c[GameActions]     -> Hand ${this.blackjackGame.getActivePlayerHandIndex()} BUSTED after split deal. Score: ${score}`, 'color: red');
                        this.lastAction = LastAnimatedAction.None; // Reset before proceeding
                        this.proceedToNextActionOrEndGame();
                    } else if (score === 21 || (activeHand.isSplitAces && activeHand.cards.length === 2)) { 
                        activeHand.isResolved = true;
                        activeHand.canHit = false;
                        console.log(`%c[GameActions]     -> Hand ${this.blackjackGame.getActivePlayerHandIndex()} reached 21 or is split Aces (and got 2nd card). Auto-standing. Score: ${score}`, 'color: orange');
                        this.lastAction = LastAnimatedAction.None; // Reset before proceeding
                        this.proceedToNextActionOrEndGame();
                    } else {
                        console.log(`%c[GameActions]     -> Player turn continues for split Hand ${this.blackjackGame.getActivePlayerHandIndex()}. Score: ${score}`, 'color: orange');
                        this.lastAction = LastAnimatedAction.None; // Player can act again
                        this.blackjackGame.notifyAnimationComplete(); 
                    }
                } else {
                    console.error("[GameActions] DealToSplitHand complete, but no active hand info.");
                    this.lastAction = LastAnimatedAction.None; // Fallback
                    this.blackjackGame.notifyAnimationComplete();
                }
                break;
            case LastAnimatedAction.None:
                console.log("[GameActions] Animation finished for None action. UI should be up-to-date via controller.");
                this.lastAction = LastAnimatedAction.None; // Ensure it remains None
                // If this was triggered by blackjackGame.notifyAnimationComplete() without a pending visual,
                // it means the controller should just update the UI, which it does.
                // No further game logic progression from here unless a previous action set it up.
                break;
            default:
                console.warn(`[GameActions] Unhandled animation completion for action: ${LastAnimatedAction[actionJustCompleted]}`);
                this.lastAction = LastAnimatedAction.None; // Fallback for unhandled cases
                this.blackjackGame.notifyAnimationComplete(); 
                break;
        }

        // REMOVED FALLBACK RESET LOGIC:
        // if (this.lastAction === actionJustCompleted && actionJustCompleted !== LastAnimatedAction.None) {
        //     console.log(`%c[GameActions]   -> Fallback: Resetting lastAction from ${LastAnimatedAction[this.lastAction]} to None (end of onAnimationComplete).`, 'color: orange');
        //     this.lastAction = LastAnimatedAction.None;
        // } else if (actionJustCompleted !== LastAnimatedAction.None && this.lastAction !== LastAnimatedAction.None) {
        //     console.log(`%c[GameActions]   -> lastAction was changed or reset during onAnimationComplete. Current: ${LastAnimatedAction[this.lastAction]} (was ${LastAnimatedAction[actionJustCompleted]})`, 'color: orange');
        // }
        
        // Log the state of lastAction after the specific handler has run.
        if (actionJustCompleted !== LastAnimatedAction.None) { // Avoid logging for "None" completing "None"
            if (this.lastAction !== actionJustCompleted && this.lastAction !== LastAnimatedAction.None) {
                console.log(`%c[GameActions]   -> lastAction is now ${LastAnimatedAction[this.lastAction]} (changed from ${LastAnimatedAction[actionJustCompleted]} by handler).`, 'color: orange');
            } else if (this.lastAction === LastAnimatedAction.None) {
                console.log(`%c[GameActions]   -> lastAction is now None (set by handler for ${LastAnimatedAction[actionJustCompleted]}).`, 'color: orange');
            }
        }

        console.log(`%c[GameActions] <<< onAnimationComplete finished processing for ${LastAnimatedAction[actionJustCompleted]} >>>`, 'color: orange; font-weight: bold');
    }


    /**
     * Determines the next step after a player hand is resolved (stood, bust, doubled, blackjack, split aces).
     * Moves to the next player hand if available, or to the dealer's turn, or ends the game.
     */
    public proceedToNextActionOrEndGame(): void {
        console.log(`%c[GameActions] proceedToNextActionOrEndGame called.`, 'color: purple');
        const playerHands = this.blackjackGame.getPlayerHands();
        let nextHandIndex = this.blackjackGame.getActivePlayerHandIndex() + 1;

        while (nextHandIndex < playerHands.length && playerHands[nextHandIndex].isResolved) {
            nextHandIndex++;
        }

        if (nextHandIndex < playerHands.length) {
            console.log(`%c[GameActions]   -> Moving to next player hand: Hand ${nextHandIndex}`, 'color: purple');
            this.blackjackGame.setActivePlayerHandIndex(nextHandIndex);
            const newActiveHand = this.blackjackGame.getActivePlayerHandInfo()!;

            if (newActiveHand.cards.length === 1) {
                console.log(`%c[GameActions]   -> New active hand (Hand ${nextHandIndex}) has 1 card. Dealing second card.`, 'color: purple');
                this.lastAction = LastAnimatedAction.DealToSplitHand;
                this.dealCardToHand(nextHandIndex, true);
            } else {
                console.log(`%c[GameActions]   -> Player turn continues for Hand ${nextHandIndex}. UI update needed.`, 'color: purple');
                this.setGameState(GameState.PlayerTurn, true, true);
            }
        } else {
            console.log(`%c[GameActions]   -> All player hands resolved. Proceeding to Dealer's Turn.`, 'color: purple');
            // Notify controller immediately that we are moving to DealerTurn
            this.setGameState(GameState.DealerTurn, true, true); 

            const anyPlayerHandStillInPlay = playerHands.some(h => h.result === GameResult.InProgress || h.result === GameResult.PlayerBlackjack);

            if (anyPlayerHandStillInPlay || this.roundInsuranceTaken) {
                console.log("[GameActions] Requesting hole card reveal before dealer turn.");
                this.requestRevealDealerHoleCard(() => {
                    console.log(`%c[GameActions] Post-reveal callback. Executing dealer turn.`, 'color: #DAA520');
                    const dealerFullScore = this.blackjackGame.getDealerFullScore();
                    const dealerHasBlackjack = dealerFullScore === 21 && this.blackjackGame.getDealerHand().length === 2;
                    if (dealerHasBlackjack && !this.roundInsuranceTaken) {
                        console.log("[GameActions] Dealer has Blackjack after hole card reveal.");
                        this.dealerStand();
                    } else {
                        this.executeDealerTurn();
                    }
                });
            } else {
                console.log("[GameActions] All player hands busted and no insurance. Game Over.");
                this.requestRevealDealerHoleCard(() => {
                    this.setGameState(GameState.GameOver, true, true);
                });
            }
        }
        this.saveGameState();
    }

    private areAllPlayerHandsResolved(): boolean {
        return this.blackjackGame.getPlayerHands().every(hand => hand.isResolved);
    }


    /** Resets critical internal state variables, usually called during game reset or before starting a new game. */
    public resetInternalState(): void {
        this.lastAction = LastAnimatedAction.None;
        this.isDealingInitialSequence = false;
        this.dealQueue = [];
        this._postRevealCallback = null;
        this._postSplitAnimationCallback = null;
        // Reset round-specific insurance state as well, as this is a full internal reset
        this.roundInsuranceBetAmount = 0;
        this.roundInsuranceTaken = false;
        this.currentBet = 0; // Reset current bet for GameActions
        this.gameResult = GameResult.InProgress; // Reset overall game result
        console.log("[GameActions] Internal state reset (lastAction, queues, callbacks, round insurance, currentBet, gameResult cleared).");
    }


    // --- Save/Load ---

    /**
     * Saves the current game state to storage, avoiding saves during initial deal animation.
     */
    public saveGameState(): void {
        GameStorage.saveGameState(
            this.gameState, this.currentBet, this.gameResult,
            this.blackjackGame.getPlayerHands(),
            this.blackjackGame.getActivePlayerHandIndex(),
            this.blackjackGame.getDealerHand(),
            this.blackjackGame.insuranceTakenThisRound,
            this.blackjackGame.insuranceBetPlaced
        );
    }

    /**
     * Loads the game state from storage.
     * Resets hands, state, and other variables as needed.
     * Returns true if the game state was successfully restored, false if no valid state was found.
     */
    public loadGameState(): boolean {
        const loadedData = GameStorage.loadGameState();

        this.blackjackGame.setPlayerHands([]);
        this.blackjackGame.setDealerHand([]);
        this.isDealingInitialSequence = false;
        this.lastAction = LastAnimatedAction.None;
        this._postRevealCallback = null;
        this._postSplitAnimationCallback = null;
        this.roundInsuranceBetAmount = 0;
        this.roundInsuranceTaken = false;

        if (!loadedData.gameState) {
            GameStorage.clearSavedHands();
            this.setGameState(GameState.Initial, true);
            this.setGameResult(GameResult.InProgress);
            this.currentBet = 0;
            const initialFunds = GameStorage.loadFunds(Constants.DEFAULT_FUNDS);
            this.lastBet = initialFunds >= Constants.MIN_BET ? Constants.MIN_BET : 0;
            this.blackjackGame.insuranceTakenThisRound = false;
            this.blackjackGame.insuranceBetPlaced = 0;
            this.blackjackGame.setActivePlayerHandIndex(0); // Set to 0 for a fresh start
            return false;
        }

        console.log("%c[GameActions] Restoring game state...", 'color: blue');
        this.gameState = loadedData.gameState;
        this.currentBet = loadedData.currentBet!;
        this.lastBet = this.currentBet > 0 ? this.currentBet : (GameStorage.loadFunds(Constants.DEFAULT_FUNDS) >= Constants.MIN_BET ? Constants.MIN_BET : 0);
        this.gameResult = loadedData.gameResult!;

        this.blackjackGame.insuranceTakenThisRound = loadedData.insuranceTakenThisRound || false;
        this.blackjackGame.insuranceBetPlaced = loadedData.insuranceBetPlaced || 0;
        this.roundInsuranceTaken = this.blackjackGame.insuranceTakenThisRound;
        this.roundInsuranceBetAmount = this.blackjackGame.insuranceBetPlaced;

<<<<<<< HEAD
<<<<<<< HEAD
        if (loadedData.playerHands && Array.isArray(loadedData.playerHands)) {
            const restoredPlayerHands: PlayerHandInfo[] = loadedData.playerHands.map((handData, idx) => {
                const cards = handData.cards.map(cardInfo => {
                    const card = new Card(cardInfo.suit, cardInfo.rank);
                    card.setFaceUp(cardInfo.faceUp);
                    this.handManager.registerFlipCallback(card);
                    return card;
                });
                return {
                    id: handData.id || `hand-${idx}`,
                    cards: cards,
                    bet: handData.bet,
                    result: handData.result,
                    isResolved: handData.isResolved,
                    canHit: handData.canHit,
                    isBlackjack: handData.isBlackjack,
                    isSplitAces: handData.isSplitAces || false
                };
            });
            this.blackjackGame.setPlayerHands(restoredPlayerHands);
            this.blackjackGame.setActivePlayerHandIndex(loadedData.activePlayerHandIndex || 0);
        } else {
            const legacyPlayerHand = loadedData.playerHand_legacy ? loadedData.playerHand_legacy.map(data => {
                const card = new Card(data.suit, data.rank);
                card.setFaceUp(data.faceUp);
                this.handManager.registerFlipCallback(card);
                return card;
            }) : [];

            const initialPlayerHand: PlayerHandInfo = {
                id: `hand-0`,
                cards: legacyPlayerHand,
                bet: this.currentBet,
                result: GameResult.InProgress,
                isResolved: false,
                canHit: true,
                isBlackjack: false,
                isSplitAces: false
            };
            this.blackjackGame.setPlayerHands([initialPlayerHand]);
            this.blackjackGame.setActivePlayerHandIndex(0);
        }

=======
=======
<<<<<<< HEAD
>>>>>>> ef0a855 (Updated JSDocs)
=======
>>>>>>> ef0a855f75c6336e7e7eeea24c045839cd6db4de
>>>>>>> 686e185efb0f986d9745a5c41522e7d0a67379b6
        /**
         * Restores the player hand(s) from the saved state.
         */
        const restoredPlayerHand = loadedData.playerHand!.map(data => {
            const card = new Card(data.suit, data.rank);
            card.setFaceUp(data.faceUp);
            this.handManager.registerFlipCallback(card);
            return card;
        });
        this.blackjackGame.setPlayerHand(restoredPlayerHand);
>>>>>>> ef0a855 (Updated JSDocs)

        /**
         * Restores the dealer hand from the saved state.
         */
        const restoredDealerHand = loadedData.dealerHand!.map(data => {
            const card = new Card(data.suit, data.rank);
            card.setFaceUp(data.faceUp);
            this.handManager.registerFlipCallback(card);
            return card;
        });
        this.blackjackGame.setDealerHand(restoredDealerHand);

        console.log(`%c[GameActions] Game state restored: ${GameState[this.gameState]}, InitialBet: ${this.currentBet}, ActiveHand: ${this.blackjackGame.getActivePlayerHandIndex()}`, 'color: blue; font-weight: bold');
        console.log(`[GameActions]   Insurance: Taken=${this.blackjackGame.insuranceTakenThisRound}, Bet=${this.blackjackGame.insuranceBetPlaced}`);
        this.blackjackGame.getPlayerHands().forEach((h, i) => {
            console.log(`[GameActions] Restored Player Hand ${i} (${h.id}): Bet=${h.bet}, Res=${GameResult[h.result]}, Resolved=${h.isResolved}, Cards:`, h.cards.map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));
        });
        console.log("[GameActions] Restored Dealer Hand:", this.blackjackGame.getDealerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));

        return true;
    }
}

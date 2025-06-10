// src/game/GameActions.ts
// Added extensive debug logs to startNewGame, processDealQueue, onAnimationComplete
// Added insurance logic
// Introduced GameState.Dealing
// Made resolveInsurance public for debug purposes
// Added split logic
import { Card, Rank } from "./Card"; // Import Rank
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameStorage } from "./GameStorage";
import { BlackjackGame, PlayerHandInfo } from "./BlackjackGame"; // Import PlayerHandInfo
import { Constants } from "../Constants"; // Import Constants

/** Enum to track the last animated action initiated by GameActions. */
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


    private lastAction: LastAnimatedAction = LastAnimatedAction.None;
    /** Queue for the initial 4-card deal sequence. */
    private dealQueue: { isPlayer: boolean, handDisplayIndex: number, faceUp: boolean }[] = [];
    /** Flag indicating if the initial 4-card deal animation sequence is currently active. */
    private isDealingInitialSequence: boolean = false;
    /** Stores a callback to execute after the dealer hole card reveal animation completes. */
    private _postRevealCallback: (() => void) | null = null;
    /** Stores a callback for after a split-related animation (like moving a card). */
    private _postSplitAnimationCallback: (() => void) | null = null;

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
        const stateChanged = this.gameState !== state;
        if (stateChanged || forceSave) {
            console.log(`%c[GameActions] State Changing: ${GameState[this.gameState]} -> ${GameState[state]}`, 'color: orange; font-weight: bold;');
            this.gameState = state;
            this.saveGameState();
        }
        if (notifyController) {
            this.blackjackGame.notifyAnimationComplete();
        }
    }
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
    public getGameResult(): GameResult { return this.gameResult; }

    // --- Bet ---
    public getCurrentBet(): number { return this.currentBet; } // This is the primary bet for the round
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
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) {
            console.warn("[GameActions] Cannot start new game while an action/animation is in progress.");
            return false;
        }
        const playerFunds = this.playerFunds.getFunds();
        const validBet = Math.max(Constants.MIN_BET, Math.min(bet, playerFunds));
        if (playerFunds < validBet || validBet < Constants.MIN_BET) {
            console.error(`[GameActions] Cannot start game. Insufficient funds (${playerFunds}) for bet (${validBet}) or bet too low.`);
            this.setGameState(GameState.Betting, false, true);
            return false;
        }


        this.currentBet = validBet; // This is the bet for the first hand
        this.lastBet = validBet;
        // Create the first player hand
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
            this.setGameState(GameState.Betting, false, true);
            return false;
        }

        this.blackjackGame.setDealerHand([]);
        this.blackjackGame.insuranceTakenThisRound = false;
        this.blackjackGame.insuranceBetPlaced = 0;
        this.roundInsuranceBetAmount = 0;
        this.roundInsuranceTaken = false;

        this.setGameResult(GameResult.InProgress); // Overall game result
        this.handManager.refreshDeckIfNeeded();

        this.setGameState(GameState.Dealing, true, true);

        this.dealQueue = [];
        console.log(`%c[GameActions] Queuing 1st card: Dealer, faceUp=false`, 'color: #008080');
        this.queueDeal(false, 0, false); // Dealer hand (display index 0 for dealer)
        console.log(`%c[GameActions] Queuing 2nd card: Player Hand 0, faceUp=true`, 'color: #008080');
        this.queueDeal(true, 0, true);  // Player hand 0
        console.log(`%c[GameActions] Queuing 3rd card: Dealer, faceUp=true`, 'color: #008080');
        this.queueDeal(false, 0, true); // Dealer hand
        console.log(`%c[GameActions] Queuing 4th card: Player Hand 0, faceUp=true`, 'color: #008080');
        this.queueDeal(true, 0, true);  // Player hand 0
        console.log(`%c[GameActions] Deal Queue:`, 'color: #008080', this.dealQueue.map(d => `Player=${d.isPlayer}, HandIdx=${d.handDisplayIndex}, FaceUp=${d.faceUp}`));

        this.lastAction = LastAnimatedAction.InitialDeal;
        this.isDealingInitialSequence = true;

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
                // Don't set overall game to GameOver yet if there are other hands (e.g. from a future split scenario)
                // For now, with no splits yet, this means game over.
                this.proceedToNextActionOrEndGame();
            });
        } else {
            console.log(`%c[GameActions] No initial Blackjack for Hand ${this.blackjackGame.getActivePlayerHandIndex()}. Proceeding to PlayerTurn.`, 'color: #DAA520');
            this.setGameState(GameState.PlayerTurn, true, true);
            // Insurance check is implicitly handled by UI based on blackjackGame.isInsuranceAvailable()
        }
    }

    /** Initiates the player 'hit' action if conditions are met for the active hand. */
    public playerHit(): void {
        if (this.gameState !== GameState.PlayerTurn) { console.warn("[GameActions] Cannot hit outside of PlayerTurn"); return; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("[GameActions] Cannot hit: Action/Animation in progress."); return; }

        const activeHandInfo = this.blackjackGame.getActivePlayerHandInfo();
        if (!activeHandInfo || !activeHandInfo.canHit || activeHandInfo.isResolved) {
            console.warn("[GameActions] Active hand cannot hit or is already resolved.");
            return;
        }

        console.log(`[GameActions] Player hits on Hand ${this.blackjackGame.getActivePlayerHandIndex()}.`);
        this.blackjackGame.insuranceTakenThisRound = true; // Mark insurance as no longer available if offered
        this.lastAction = LastAnimatedAction.PlayerHit;
        this.dealCardToHand(this.blackjackGame.getActivePlayerHandIndex(), true);
    }

    /** Logic executed after the player 'hit' animation completes. Checks for bust on the active hand. */
    private completePlayerHit(): void {
        const activeHandInfo = this.blackjackGame.getActivePlayerHandInfo();
        if (!activeHandInfo) { console.error("[GameActions] completePlayerHit: No active hand."); return; }

        const playerScore = ScoreCalculator.calculateHandValue(activeHandInfo.cards);
        console.log(`%c[GameActions] completePlayerHit for Hand ${this.blackjackGame.getActivePlayerHandIndex()}. Score: ${playerScore}`, 'color: #DAA520');

        if (playerScore > 21) {
            console.log(`%c[GameActions] Player Hand ${this.blackjackGame.getActivePlayerHandIndex()} Bust!`, 'color: red; font-weight: bold;');
            activeHandInfo.result = GameResult.DealerWins; // Assuming dealer wins if player busts
            activeHandInfo.isResolved = true;
            activeHandInfo.canHit = false;
            this.proceedToNextActionOrEndGame();
        } else if (playerScore === 21) {
            // Auto-stand on 21 (common rule, can be configurable)
            activeHandInfo.isResolved = true;
            activeHandInfo.canHit = false;
            console.log(`%c[GameActions] Player Hand ${this.blackjackGame.getActivePlayerHandIndex()} reached 21. Auto-standing.`, 'color: #DAA520');
            this.proceedToNextActionOrEndGame();
        } else {
            console.log(`%c[GameActions] Player Hit OK for Hand ${this.blackjackGame.getActivePlayerHandIndex()}. Player turn continues for this hand.`, 'color: #DAA520');
            this.saveGameState();
            this.blackjackGame.notifyAnimationComplete(); // Notify UI to re-enable buttons
        }
    }

    /** Initiates the player 'stand' action if conditions are met for the active hand. */
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
        this.blackjackGame.insuranceTakenThisRound = true; // Mark insurance as no longer available

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
        this.blackjackGame.insuranceTakenThisRound = true; // Mark insurance as no longer available

        this.lastAction = LastAnimatedAction.DoubleDownHit;
        // Deal card, then the hand is automatically resolved.
        this.dealCardToHand(this.blackjackGame.getActivePlayerHandIndex(), true);
        return true;
    }

    /** Logic executed after the double down card deal animation completes. Checks for bust, then proceeds. */
    private completeDoubleDown(): void {
        const activeHandInfo = this.blackjackGame.getActivePlayerHandInfo();
        if (!activeHandInfo) { console.error("[GameActions] completeDoubleDown: No active hand."); return; }

        activeHandInfo.isResolved = true; // Double down means hand is resolved after one card
        activeHandInfo.canHit = false;

        const playerScore = ScoreCalculator.calculateHandValue(activeHandInfo.cards);
        console.log(`%c[GameActions] completeDoubleDown for Hand ${this.blackjackGame.getActivePlayerHandIndex()}. Score: ${playerScore}`, 'color: #DAA520');

        if (playerScore > 21) {
            console.log(`%c[GameActions] Player Hand ${this.blackjackGame.getActivePlayerHandIndex()} Bust on Double Down!`, 'color: red; font-weight: bold;');
            activeHandInfo.result = GameResult.DealerWins;
        }
        // Result is InProgress if not bust, will be determined against dealer.
        this.proceedToNextActionOrEndGame();
    }


    /** Handles the player's decision to take insurance. */
    public playerTakeInsurance(): void {
        if (!this.blackjackGame.isInsuranceAvailable()) {
            console.warn("[GameActions] Insurance is not available.");
            return;
        }
        if (this.lastAction !== LastAnimatedAction.None) {
            console.warn("[GameActions] Cannot take insurance: Action/Animation in progress.");
            return;
        }

        const firstHandBet = this.blackjackGame.getPlayerHands()[0].bet; // Insurance based on first hand's bet
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
        this.blackjackGame.notifyAnimationComplete(); // Notify UI to update (e.g., disable insurance button)
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
                const totalReturn = this.roundInsuranceBetAmount + winnings; // Original bet back + winnings
                this.playerFunds.addFunds(totalReturn);
                console.log(`[GameActions] Insurance payout: ${totalReturn} added to funds.`);
            } else {
                console.log("[GameActions] Dealer does not have Blackjack. Insurance bet lost.");
                // The bet was already deducted.
            }
            // Reset for next round
            this.roundInsuranceTaken = false;
            this.roundInsuranceBetAmount = 0;
            // blackjackGame.insuranceBetPlaced will be reset on new game
        }
    }

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

        // Deduct bet for the new hand
        if (!this.playerFunds.deductFunds(handToSplit.bet)) {
            console.error("[GameActions] Insufficient funds to cover bet for new split hand.");
            return;
        }

        const cardToMove = handToSplit.cards.pop()!; // Take the second card for the new hand
        const isSplittingAces = handToSplit.cards[0].getRank() === Rank.Ace;

        // Create the new hand
        const newHand: PlayerHandInfo = {
            id: `hand-${this.blackjackGame.getPlayerHands().length}`,
            cards: [cardToMove],
            bet: handToSplit.bet, // Same bet as the original hand
            result: GameResult.InProgress,
            isResolved: false,
            canHit: !isSplittingAces, // If splitting Aces, canHit becomes false after 1 more card
            isBlackjack: false, // Split hands cannot be natural blackjack
            isSplitAces: isSplittingAces
        };

        // Modify the original hand
        handToSplit.isSplitAces = isSplittingAces;
        handToSplit.canHit = !isSplittingAces; // Same logic

        // Add new hand to game
        this.blackjackGame.getPlayerHands().push(newHand);

        if (this.blackjackGame.onHandModified) {
            this.blackjackGame.onHandModified({
                isPlayer: true,
                handIndex: activeHandIndex, // Original hand modified
                type: 'split' // Special type to indicate a card was removed for split
            });
            this.blackjackGame.onHandModified({
                isPlayer: true,
                handIndex: this.blackjackGame.getPlayerHands().length - 1, // New hand added
                type: 'set'
            });
        }

        this.blackjackGame.insuranceTakenThisRound = true; // Mark insurance as no longer available

        // Animation: Card moves to its new spot (visualizer handles this)
        // For now, we'll assume an instant visual update or a simple animation.
        // The GameController will need to be notified to trigger the visual split.
        // We need to deal a card to the *current* active hand (the first of the two split hands).
        this.lastAction = LastAnimatedAction.DealToSplitHand; // Or a more general "PlayerAction"
        this._postSplitAnimationCallback = () => {
            console.log(`[GameActions] Post-split animation: Dealing card to first split hand (Hand ${activeHandIndex})`);
            this.dealCardToHand(activeHandIndex, true);
        };

        // Notify controller about the split action to handle visuals
        // For simplicity, we directly call the callback for now.
        // In a more complex setup, CardVisualizer would animate the card moving.
        this.blackjackGame.notifyCardDealt(cardToMove, 0, true, this.blackjackGame.getPlayerHands().length - 1, true); // Notify for the new hand's first card
        // The above notifyCardDealt is for the *visual creation* of the new hand's card.
        // The actual dealing of the *second* card to the first split hand happens after this.

        // For now, let's assume the visual split of the card is quick or handled, then deal.
        // This part needs careful sequencing with CardVisualizer.
        // The CardVisualizer will need to know to place the `cardToMove` into a new hand slot.

        // Let's assume CardVisualizer.splitHand(originalHandIndex, newHandIndex, cardToMove) is called by GameController
        // And on its animation complete, it calls GameActions.onAnimationComplete() which then triggers _postSplitAnimationCallback.
        // For now, we'll simulate this by setting lastAction and relying on onAnimationComplete.
        console.log(`[GameActions] Split initiated. Waiting for visual confirmation (simulated) then dealing to Hand ${activeHandIndex}.`);
        this.lastAction = LastAnimatedAction.SplitCardMove; // Indicate a visual split action is "in progress"
        // Manually trigger the completion to proceed with dealing the next card.
        // In a real scenario, this would be triggered by CardVisualizer.
        // For now, we assume the visual rearrangement for the split card is done by CardVisualizer.renderCards() or a specific call.
        // Then, we deal the next card.

        // The critical part is that after playerSplit() is called, the UI should update,
        // CardVisualizer should show two hands (one with 1 card, one with 1 card),
        // and then a card should be dealt to the active hand.
        this.saveGameState();
        this.blackjackGame.notifyAnimationComplete(); // This will trigger UI update.
        // Then GameActions.onAnimationComplete will run.
        // If lastAction is SplitCardMove, it will call _postSplitAnimationCallback.
    }


    // --- Dealer Logic ---
    /**
     * Initiates the visual reveal of the dealer's hole card if it's face down.
     * @param callback Optional function to execute after the reveal animation completes.
     */
    private requestRevealDealerHoleCard(callback?: () => void): void {
        const dealerHand = this.blackjackGame.getDealerHand();
        console.log(`%c[GameActions] requestRevealDealerHoleCard called. Dealer Hand Length: ${dealerHand.length}`, 'color: magenta');
        if (dealerHand.length > 0) {
            console.log(`%c[GameActions]   -> Dealer Card 0: ${dealerHand[0].toString()}, IsFaceUp: ${dealerHand[0].isFaceUp()}`, 'color: magenta');
        }

        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            if (this.lastAction !== LastAnimatedAction.None) {
                console.warn(`%c[GameActions] Cannot reveal hole card while action (${LastAnimatedAction[this.lastAction]}) is in progress. Blocking reveal.`, 'color: magenta');
                if (callback) {
                    console.warn(`%c[GameActions]   -> Forcing post-reveal callback immediately due to block.`, 'color: magenta');
                    Promise.resolve().then(callback); // Ensure async execution
                }
                return;
            }
            console.log(`%c[GameActions] Setting lastAction=RevealDealerHole and storing callback.`, 'color: magenta');
            this.lastAction = LastAnimatedAction.RevealDealerHole;
            this._postRevealCallback = callback || null;
            console.log(`%c[GameActions] Calling flip() on dealer card 0: ${dealerHand[0].toString()}`, 'color: magenta');
            dealerHand[0].flip(); // This triggers CardVisualizer, which calls onVisualAnimationComplete, then GameActions.onAnimationComplete
        } else {
            console.log(`%c[GameActions] Dealer hole card already revealed or no card exists. Executing callback immediately (if provided).`, 'color: magenta');
            if (callback) {
                Promise.resolve().then(callback); // Ensure async execution
            }
        }
    }

    /** Executes the dealer's turn logic: Hit if score < 17, otherwise stand. */
    public executeDealerTurn(): void {
        console.log(`%c[GameActions] executeDealerTurn called. State: ${GameState[this.gameState]}`, 'color: magenta');
        if (this.gameState !== GameState.DealerTurn) {
            console.warn(`[GameActions] executeDealerTurn called in wrong state: ${GameState[this.gameState]}`);
            // If called prematurely, ensure player's turn is fully resolved.
            if (!this.areAllPlayerHandsResolved()) {
                console.error("[GameActions] CRITICAL: executeDealerTurn called but not all player hands are resolved!");
                // Attempt to recover or force resolution, though this indicates a logic flaw.
                // For now, just log and potentially block.
                return;
            }
            // If all player hands are resolved, it's okay to proceed to dealer turn if state was wrong.
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
            this.dealCardToHand(-1, true); // -1 for dealer hand index
        } else {
            console.log(`[GameActions] Dealer score ${dealerScore} >= ${Constants.DEALER_STAND_SCORE}. Dealer stands.`);
            this.dealerStand();
        }
    }

    /** Logic executed after the dealer 'hit' animation completes. Checks for bust, otherwise continues dealer turn. */
    private completeDealerHit(): void {
        const dealerScore = this.blackjackGame.getDealerFullScore();
        console.log(`%c[GameActions] completeDealerHit. Score: ${dealerScore}`, 'color: #DAA520');
        this.saveGameState();

        if (dealerScore > 21) {
            console.log("%c[GameActions] Dealer Bust!", 'color: lime; font-weight: bold;');
            // All non-busted player hands win
            this.blackjackGame.getPlayerHands().forEach(handInfo => {
                if (handInfo.result === GameResult.InProgress) { // Only update if not already resolved (e.g. player bust)
                    handInfo.result = GameResult.PlayerWins;
                    this.playerFunds.addFunds(handInfo.bet * 2);
                }
            });
            this.resolveInsurance(); // Resolve insurance before setting GameOver
            this.setGameResult(GameResult.PlayerWins); // General game result
            this.setGameState(GameState.GameOver, true, true);
        } else {
            console.log(`%c[GameActions] Dealer Hit OK. Continuing dealer turn...`, 'color: #DAA520');
            this.executeDealerTurn(); // Recursive call to continue dealer's turn
        }
    }

    /** Logic executed when the dealer stands. Determines the winner for each player hand. */
    private dealerStand(): void {
        console.log(`%c[GameActions] dealerStand called. State: ${GameState[this.gameState]}, LastAction: ${LastAnimatedAction[this.lastAction]}`, 'color: #DAA520');

        this.resolveInsurance(); // Resolve insurance first

        const dealerScore = this.blackjackGame.getDealerFullScore();
        let overallGameResultHasPlayerWin = false;

        this.blackjackGame.getPlayerHands().forEach((handInfo, index) => {
            if (handInfo.result === GameResult.InProgress) { // Only resolve hands not already decided (e.g. player bust/blackjack)
                const playerScore = ScoreCalculator.calculateHandValue(handInfo.cards);
                if (playerScore > 21) { // Should have been caught, but as a safeguard
                    handInfo.result = GameResult.DealerWins;
                } else if (dealerScore > 21) { // Dealer busted (already handled in completeDealerHit, but good for direct stand)
                    handInfo.result = GameResult.PlayerWins;
                    this.playerFunds.addFunds(handInfo.bet * 2);
                    overallGameResultHasPlayerWin = true;
                } else if (playerScore > dealerScore) {
                    handInfo.result = GameResult.PlayerWins;
                    this.playerFunds.addFunds(handInfo.bet * 2);
                    overallGameResultHasPlayerWin = true;
                } else if (dealerScore > playerScore) {
                    handInfo.result = GameResult.DealerWins;
                } else { // Push
                    handInfo.result = GameResult.Push;
                    this.playerFunds.addFunds(handInfo.bet); // Return original bet
                }
                console.log(`%c[GameActions] Hand ${index} Result: ${GameResult[handInfo.result]} (Player: ${playerScore}, Dealer: ${dealerScore})`, 'color: yellow;');
            } else {
                // If hand was already resolved (e.g. player blackjack, player bust), its funds are already handled.
                if (handInfo.result === GameResult.PlayerWins || handInfo.result === GameResult.PlayerBlackjack) {
                    overallGameResultHasPlayerWin = true;
                }
                console.log(`%c[GameActions] Hand ${index} was already resolved as: ${GameResult[handInfo.result]}`, 'color: gray;');
            }
        });

        // Determine a general game result for simple display, could be more nuanced
        if (this.blackjackGame.getPlayerHands().every(h => h.result === GameResult.DealerWins)) {
            this.setGameResult(GameResult.DealerWins);
        } else if (overallGameResultHasPlayerWin) {
            this.setGameResult(GameResult.PlayerWins); // If at least one hand won
        } else if (this.blackjackGame.getPlayerHands().every(h => h.result === GameResult.Push || h.result === GameResult.DealerWins)) {
            // If all hands are push or dealer wins, and no player wins, it's either push or dealer win.
            // This logic might need refinement for a single "overall result" display.
            // For now, if any hand pushed and no wins, call it a push.
            if (this.blackjackGame.getPlayerHands().some(h => h.result === GameResult.Push)) {
                this.setGameResult(GameResult.Push);
            } else {
                this.setGameResult(GameResult.DealerWins);
            }
        }


        this.setGameState(GameState.GameOver, true, true);
    }

    // --- Card Dealing ---
    /** Adds a card deal instruction to the initial deal queue. */
    private queueDeal(isPlayer: boolean, handDisplayIndex: number, faceUp: boolean): void {
        this.dealQueue.push({ isPlayer, handDisplayIndex, faceUp });
    }

    /** Processes the next card deal from the initial deal queue, triggering its animation. */
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
                this.setGameResult(GameResult.DealerWins); // Or some error state
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
                handRef.length - 1, // index in that specific hand
                dealInfo.isPlayer,
                dealInfo.handDisplayIndex, // which player hand (or 0 for dealer)
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

    /** Deals a single card directly to a hand (used for Hit, Double Down, Dealer Hit, Split Hand).
     * @param targetHandIndex For player, the index of the hand in playerHands. For dealer, pass -1.
     * @param faceUp Whether the card should be dealt face up.
     */
    private dealCardToHand(targetHandIndex: number, faceUp: boolean): void {
        const isPlayerHand = targetHandIndex !== -1;
        const handDesc = isPlayerHand ? `Player Hand ${targetHandIndex}` : 'Dealer';
        console.log(`%c[GameActions] dealCardToHand called for ${handDesc}. FaceUp: ${faceUp}, isDealingInitial: ${this.isDealingInitialSequence}`, 'color: cyan');

        if (this.isDealingInitialSequence) {
            console.error("[GameActions] Cannot deal single card while initial deal sequence is processing!");
            this.lastAction = LastAnimatedAction.None; // Reset to avoid blocking
            return;
        }
        // lastAction check might need adjustment if dealing to split hand is a distinct action
        if (this.lastAction === LastAnimatedAction.None || this.lastAction === LastAnimatedAction.InitialDeal) {
            // Allow if previous action was SplitCardMove, as we need to deal to the split hand
            if (this.lastAction !== LastAnimatedAction.SplitCardMove && this.lastAction !== LastAnimatedAction.DealToSplitHand) {
                console.error(`[GameActions] dealCardToHand called with invalid lastAction state: ${LastAnimatedAction[this.lastAction]}`);
                return;
            }
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

                // Special rule for split Aces: only one card, then auto-stand.
                if (playerHandInfo.isSplitAces && playerHandInfo.cards.length === 2) {
                    playerHandInfo.canHit = false;
                    playerHandInfo.isResolved = true; // Mark as resolved for turn progression
                    console.log(`%c[GameActions]   -> Hand ${targetHandIndex} (Split Aces) received second card. Auto-standing.`, 'color: orange');
                }

            } else { // Dealer's hand
                this.blackjackGame.addCardToDealerHand(card);
                handRef = this.blackjackGame.getDealerHand();
                handDisplayIndexForNotification = 0; // Dealer is always hand 0 for visualizer in this context
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
                // If player was hitting, and deck runs out, they effectively stand.
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
    /** Central handler for when any visual animation completes (deal, flip). Determines the next logical step. */
    public onAnimationComplete(): void {
        const actionJustCompleted = this.lastAction;
        console.log(`%c[GameActions] >>> onAnimationComplete called for action: ${LastAnimatedAction[actionJustCompleted]} <<<`, 'color: orange; font-weight: bold');

        // Store and clear callbacks before potential recursive calls or state changes
        const postRevealCb = this._postRevealCallback;
        this._postRevealCallback = null;
        const postSplitAnimCb = this._postSplitAnimationCallback;
        this._postSplitAnimationCallback = null;

        if (actionJustCompleted === LastAnimatedAction.InitialDeal) {
            if (this.dealQueue.length > 0) {
                console.log(`%c[GameActions]   -> InitialDeal completed, ${this.dealQueue.length} cards left in queue. Processing next...`, 'color: orange');
                this.processDealQueue(); // Continues the initial deal sequence
                return; // Don't reset lastAction yet
            } else {
                console.log(`%c[GameActions]   -> InitialDeal completed, queue empty. Sequence finished.`, 'color: orange');
                this.isDealingInitialSequence = false;
                this.lastAction = LastAnimatedAction.None; // Reset lastAction
                console.log(`%c[GameActions]   -> Checking for initial Blackjack...`, 'color: orange');
                this.checkInitialBlackjack();
                return;
            }
        }

        // For all other actions, reset lastAction now.
        const previousLastAction = this.lastAction;
        console.log(`%c[GameActions]   -> Resetting lastAction from ${LastAnimatedAction[previousLastAction]} to None.`, 'color: orange');
        this.lastAction = LastAnimatedAction.None;


        switch (previousLastAction) {
            case LastAnimatedAction.PlayerHit:
                console.log(`%c[GameActions]   -> Calling completePlayerHit()`, 'color: orange');
                this.completePlayerHit();
                break;
            case LastAnimatedAction.DealerHit:
                console.log(`%c[GameActions]   -> Calling completeDealerHit()`, 'color: orange');
                this.completeDealerHit();
                break;
            case LastAnimatedAction.DoubleDownHit:
                console.log(`%c[GameActions]   -> Calling completeDoubleDown()`, 'color: orange');
                this.completeDoubleDown();
                break;
            case LastAnimatedAction.RevealDealerHole:
                console.log(`%c[GameActions]   -> RevealDealerHole animation complete.`, 'color: orange');
                if (postRevealCb) {
                    console.log(`%c[GameActions]   -> Executing post-reveal callback.`, 'color: orange');
                    postRevealCb(); // Execute the stored callback
                } else {
                    console.warn("[GameActions] RevealDealerHole completed but no callback was set. This might be an issue if a dependent action was expected.");
                    // If no callback, perhaps the game should just notify UI?
                    this.blackjackGame.notifyAnimationComplete();
                }
                break;
            case LastAnimatedAction.InsuranceTaken:
                console.log(`%c[GameActions]   -> InsuranceTaken action complete. UI already updated.`, 'color: orange');
                // No further game logic step, UI was updated by notifyAnimationComplete in playerTakeInsurance
                break;
            case LastAnimatedAction.SplitCardMove: // Visual animation of card moving for split is done
                console.log(`%c[GameActions]   -> SplitCardMove animation complete.`, 'color: orange');
                if (postSplitAnimCb) {
                    console.log(`%c[GameActions]   -> Executing post-split animation callback.`, 'color: orange');
                    postSplitAnimCb(); // This should deal the card to the first split hand
                } else {
                    console.error("[GameActions] SplitCardMove completed but no callback to deal card!");
                }
                break;
            case LastAnimatedAction.DealToSplitHand: // Card dealt to a split hand (either 2nd card to 1st hand, or 2nd card to 2nd hand)
                console.log(`%c[GameActions]   -> DealToSplitHand animation complete.`, 'color: orange');
                const activeHand = this.blackjackGame.getActivePlayerHandInfo();
                if (activeHand) {
                    const score = ScoreCalculator.calculateHandValue(activeHand.cards);
                    if (score > 21) { // Bust after getting card on split hand
                        activeHand.result = GameResult.DealerWins;
                        activeHand.isResolved = true;
                        activeHand.canHit = false;
                        console.log(`%c[GameActions]     -> Hand ${this.blackjackGame.getActivePlayerHandIndex()} BUSTED after split deal. Score: ${score}`, 'color: red');
                        this.proceedToNextActionOrEndGame();
                    } else if (score === 21 || activeHand.isSplitAces) { // Auto-stand on 21 or if split aces got their one card
                        activeHand.isResolved = true;
                        activeHand.canHit = false;
                        console.log(`%c[GameActions]     -> Hand ${this.blackjackGame.getActivePlayerHandIndex()} reached 21 or is split Aces. Auto-standing. Score: ${score}`, 'color: orange');
                        this.proceedToNextActionOrEndGame();
                    } else {
                        // Player turn continues for this hand
                        console.log(`%c[GameActions]     -> Player turn continues for split Hand ${this.blackjackGame.getActivePlayerHandIndex()}. Score: ${score}`, 'color: orange');
                        this.blackjackGame.notifyAnimationComplete(); // Update UI
                    }
                } else {
                    console.error("[GameActions] DealToSplitHand complete, but no active hand info.");
                }
                break;
            case LastAnimatedAction.None:
                // This case can be hit if notifyAnimationComplete was called without a pending lastAction,
                // e.g. from GameController after a UI update for a non-animated game action.
                console.log("[GameActions] Animation finished for None action. UI should be up-to-date.");
                break;
            default:
                console.warn(`[GameActions] Unhandled animation completion for action: ${LastAnimatedAction[previousLastAction]}`);
                this.blackjackGame.notifyAnimationComplete(); // Generic UI update
                break;
        }
        console.log(`%c[GameActions] <<< onAnimationComplete finished processing for ${LastAnimatedAction[previousLastAction]} >>>`, 'color: orange; font-weight: bold');
    }


    /**
     * Determines the next step after a player hand is resolved (stood, bust, doubled, blackjack, split aces).
     * Moves to the next player hand if available, or to the dealer's turn, or ends the game.
     */
    private proceedToNextActionOrEndGame(): void {
        console.log(`%c[GameActions] proceedToNextActionOrEndGame called.`, 'color: purple');
        const playerHands = this.blackjackGame.getPlayerHands();
        let nextHandIndex = this.blackjackGame.getActivePlayerHandIndex() + 1;

        // Check if there's an unresolved hand after the current one
        while (nextHandIndex < playerHands.length && playerHands[nextHandIndex].isResolved) {
            nextHandIndex++;
        }

        if (nextHandIndex < playerHands.length) {
            // There's another player hand to play
            console.log(`%c[GameActions]   -> Moving to next player hand: Hand ${nextHandIndex}`, 'color: purple');
            this.blackjackGame.setActivePlayerHandIndex(nextHandIndex);
            const newActiveHand = this.blackjackGame.getActivePlayerHandInfo()!;

            // If this new active hand only has one card (because it was just split to), deal its second card.
            if (newActiveHand.cards.length === 1) {
                console.log(`%c[GameActions]   -> New active hand (Hand ${nextHandIndex}) has 1 card. Dealing second card.`, 'color: purple');
                this.lastAction = LastAnimatedAction.DealToSplitHand; // Set action before dealing
                this.dealCardToHand(nextHandIndex, true);
            } else {
                // Hand already has 2+ cards (shouldn't happen if split logic is correct for new hands)
                // or it's a hand that was already played and somehow revisited (logic error).
                // For now, assume player's turn continues for this hand.
                console.log(`%c[GameActions]   -> Player turn continues for Hand ${nextHandIndex}. UI update needed.`, 'color: purple');
                this.setGameState(GameState.PlayerTurn, true, true); // Ensure state and notify UI
            }
        } else {
            // All player hands are resolved. Proceed to dealer's turn.
            console.log(`%c[GameActions]   -> All player hands resolved. Proceeding to Dealer's Turn.`, 'color: purple');
            this.setGameState(GameState.DealerTurn, true, false); // Don't notify controller yet, reveal hole card first

            // If any player hand is not busted, dealer needs to play.
            const anyPlayerHandStillInPlay = playerHands.some(h => h.result === GameResult.InProgress || h.result === GameResult.PlayerBlackjack);

            if (anyPlayerHandStillInPlay || this.roundInsuranceTaken) { // Dealer plays if any hand could win, or if insurance was taken
                console.log("[GameActions] Requesting hole card reveal before dealer turn.");
                this.requestRevealDealerHoleCard(() => {
                    console.log(`%c[GameActions] Post-reveal callback. Executing dealer turn.`, 'color: #DAA520');
                    const dealerFullScore = this.blackjackGame.getDealerFullScore();
                    const dealerHasBlackjack = dealerFullScore === 21 && this.blackjackGame.getDealerHand().length === 2;
                    if (dealerHasBlackjack && !this.roundInsuranceTaken) { // If dealer has BJ and no insurance, game might resolve fast
                        console.log("[GameActions] Dealer has Blackjack after hole card reveal.");
                        this.dealerStand(); // This will resolve against player hands
                    } else {
                        this.executeDealerTurn();
                    }
                });
            } else {
                // All player hands busted, and no insurance. Game over.
                console.log("[GameActions] All player hands busted and no insurance. Game Over.");
                // Ensure dealer's hole card is revealed visually even if they don't play.
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


    // --- Save/Load ---
    /** Saves the current game state to storage, avoiding saves during initial deal animation. */
    public saveGameState(): void {
        GameStorage.saveGameState(
            this.gameState, this.currentBet, this.gameResult,
            this.blackjackGame.getPlayerHands(), // Save all player hands
            this.blackjackGame.getActivePlayerHandIndex(), // Save active hand index
            this.blackjackGame.getDealerHand(),
            this.blackjackGame.insuranceTakenThisRound,
            this.blackjackGame.insuranceBetPlaced
        );
    }

    /** Loads game state from storage and restores the game logic. */
    public loadGameState(): boolean {
        const loadedData = GameStorage.loadGameState();

        this.blackjackGame.setPlayerHands([]); // Clear existing before load
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
            this.blackjackGame.setActivePlayerHandIndex(0);
            return false;
        }

        console.log("%c[GameActions] Restoring game state...", 'color: blue');
        this.gameState = loadedData.gameState;
        this.currentBet = loadedData.currentBet!; // This is the initial bet for the round
        this.lastBet = this.currentBet > 0 ? this.currentBet : (GameStorage.loadFunds(Constants.DEFAULT_FUNDS) >= Constants.MIN_BET ? Constants.MIN_BET : 0);
        this.gameResult = loadedData.gameResult!;

        this.blackjackGame.insuranceTakenThisRound = loadedData.insuranceTakenThisRound || false;
        this.blackjackGame.insuranceBetPlaced = loadedData.insuranceBetPlaced || 0;
        this.roundInsuranceTaken = this.blackjackGame.insuranceTakenThisRound;
        this.roundInsuranceBetAmount = this.blackjackGame.insuranceBetPlaced;

        // Restore Player Hands
        if (loadedData.playerHands && Array.isArray(loadedData.playerHands)) {
            const restoredPlayerHands: PlayerHandInfo[] = loadedData.playerHands.map((handData, idx) => {
                const cards = handData.cards.map(cardInfo => {
                    const card = new Card(cardInfo.suit, cardInfo.rank);
                    card.setFaceUp(cardInfo.faceUp);
                    this.handManager.registerFlipCallback(card);
                    return card;
                });
                return {
                    id: handData.id || `hand-${idx}`, // Ensure ID exists
                    cards: cards,
                    bet: handData.bet,
                    result: handData.result,
                    isResolved: handData.isResolved,
                    canHit: handData.canHit,
                    isBlackjack: handData.isBlackjack,
                    isSplitAces: handData.isSplitAces || false // Default to false if not present
                };
            });
            this.blackjackGame.setPlayerHands(restoredPlayerHands);
            this.blackjackGame.setActivePlayerHandIndex(loadedData.activePlayerHandIndex || 0);
        } else {
            // Handle case where playerHands might be missing from older save data
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
                isResolved: false, // Assume not resolved if loading mid-game
                canHit: true,
                isBlackjack: false,
                isSplitAces: false
            };
            this.blackjackGame.setPlayerHands([initialPlayerHand]);
            this.blackjackGame.setActivePlayerHandIndex(0);
        }


        const restoredDealerHand = loadedData.dealerHand!.map(data => {
            const card = new Card(data.suit, data.rank);
            card.setFaceUp(data.faceUp);
            this.handManager.registerFlipCallback(card);
            return card;
        });
        this.blackjackGame.setDealerHand(restoredDealerHand);

        console.log(`%c[GameActions] Game state restored: ${GameState[this.gameState]}, InitialBet: ${this.currentBet}, ActiveHand: ${this.blackjackGame.getActivePlayerHandIndex()}`, 'color: blue; font-weight: bold;');
        console.log(`[GameActions]   Insurance: Taken=${this.blackjackGame.insuranceTakenThisRound}, Bet=${this.blackjackGame.insuranceBetPlaced}`);
        this.blackjackGame.getPlayerHands().forEach((h, i) => {
            console.log(`[GameActions] Restored Player Hand ${i} (${h.id}): Bet=${h.bet}, Res=${GameResult[h.result]}, Resolved=${h.isResolved}, Cards:`, h.cards.map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));
        });
        console.log("[GameActions] Restored Dealer Hand:", this.blackjackGame.getDealerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));

        return true;
    }
}

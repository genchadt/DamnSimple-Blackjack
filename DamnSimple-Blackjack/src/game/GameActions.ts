// src/game/gameactions-ts
// Added extensive debug logs to startNewGame, processDealQueue, onAnimationComplete
// Added insurance logic
// Introduced GameState.Dealing
import { Card, Rank } from "./Card"; // Import Rank
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameStorage } from "./GameStorage";
import { BlackjackGame } from "./BlackjackGame";
import { Constants } from "../Constants"; // Import Constants

/** Enum to track the last animated action initiated by GameActions. */
enum LastAnimatedAction {
    None,
    InitialDeal, // Represents one card being dealt in the initial sequence
    PlayerHit,
    DealerHit,
    DoubleDownHit,
    RevealDealerHole, // Represents the flip animation of the hole card
    InsuranceTaken // Represents the UI update after insurance is taken (no cards dealt)
}

export class GameActions {
    private blackjackGame: BlackjackGame;
    private handManager: HandManager;
    private playerFunds: PlayerFunds;
    private gameState: GameState = GameState.Initial;
    private gameResult: GameResult = GameResult.InProgress;
    private currentBet: number = 0;
    private lastBet: number = 10;

    // Insurance specific state for the current round, managed by GameActions
    private roundInsuranceBetAmount: number = 0; // The actual amount of the insurance bet placed this round
    private roundInsuranceTaken: boolean = false; // If insurance was taken this round


    private lastAction: LastAnimatedAction = LastAnimatedAction.None;
    /** Queue for the initial 4-card deal sequence. */
    private dealQueue: { hand: Card[], faceUp: boolean, isPlayer: boolean }[] = []; // Added isPlayer for logging
    /** Flag indicating if the initial 4-card deal animation sequence is currently active. */
    private isDealingInitialSequence: boolean = false;
    /** Stores a callback to execute after the dealer hole card reveal animation completes. */
    private _postRevealCallback: (() => void) | null = null;

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
            this.saveGameState(); // saveGameState implicitly notifies if state changed via GameController.onGameActionComplete -> update
                                  // when GameActions.onAnimationComplete is called by the controller.
        }
        if (notifyController) { // For immediate UI updates not tied to animation completion
            this.blackjackGame.notifyAnimationComplete();
        }
    }
    public getGameState(): GameState { return this.gameState; }

    /**
     * Sets the result of the completed game.
     * @param result The new GameResult.
     * @param forceSave If true, saves the state even if it hasn't changed.
     */
    public setGameResult(result: GameResult, forceSave: boolean = false): void {
        if (this.gameResult !== result || forceSave) {
            this.gameResult = result;
            this.saveGameState();
        }
    }
    public getGameResult(): GameResult { return this.gameResult; }

    // --- Bet ---
    public getCurrentBet(): number { return this.currentBet; }
    public getLastBet(): number { return this.lastBet; }

    /**
     * Sets the current bet amount, validating against player funds and minimum bet.
     * Only allowed during Betting or Initial states.
     * @param amount The desired bet amount.
     */
    public setCurrentBet(amount: number): void {
        if (this.gameState === GameState.Betting || this.gameState === GameState.Initial) {
            const playerFunds = this.playerFunds.getFunds();
            const validAmount = Math.max(Constants.MIN_BET, Math.min(amount, playerFunds));
            if (this.currentBet !== validAmount) {
                this.currentBet = validAmount;
                // No saveGameState here, bet is confirmed by startNewGame or UI interaction
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
            this.setGameState(GameState.Betting, false, true); // Revert to betting, notify controller
            return false;
        }
        if (!this.playerFunds.deductFunds(validBet)) {
            console.error("[GameActions] Fund deduction failed unexpectedly.");
            this.setGameState(GameState.Betting, false, true); // Revert to betting, notify controller
            return false;
        }

        this.currentBet = validBet;
        this.lastBet = validBet;
        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);
        this.blackjackGame.insuranceTakenThisRound = false;
        this.blackjackGame.insuranceBetPlaced = 0;
        this.roundInsuranceBetAmount = 0;
        this.roundInsuranceTaken = false;

        this.setGameResult(GameResult.InProgress);
        this.handManager.refreshDeckIfNeeded();

        this.setGameState(GameState.Dealing, true, true); // Set to Dealing, force save, and notify controller immediately

        this.dealQueue = [];
        console.log(`%c[GameActions] Queuing 1st card: Dealer, faceUp=false`, 'color: #008080');
        this.queueDeal(this.blackjackGame.getDealerHand(), false, false); // Dealer, face down
        console.log(`%c[GameActions] Queuing 2nd card: Player, faceUp=true`, 'color: #008080');
        this.queueDeal(this.blackjackGame.getPlayerHand(), true, true);   // Player, face up
        console.log(`%c[GameActions] Queuing 3rd card: Dealer, faceUp=true`, 'color: #008080');
        this.queueDeal(this.blackjackGame.getDealerHand(), true, false);  // Dealer, face up
        console.log(`%c[GameActions] Queuing 4th card: Player, faceUp=true`, 'color: #008080');
        this.queueDeal(this.blackjackGame.getPlayerHand(), true, true);   // Player, face up
        console.log(`%c[GameActions] Deal Queue:`, 'color: #008080', this.dealQueue.map(d => `Player=${d.isPlayer}, FaceUp=${d.faceUp}`));

        this.lastAction = LastAnimatedAction.InitialDeal;
        this.isDealingInitialSequence = true;

        console.log(`%c[GameActions] Initiating first deal from queue...`, 'color: #008080');
        this.processDealQueue(); // This will trigger animations, and onAnimationComplete will handle UI updates thereafter.

        console.log(`%c[GameActions] New game started logic initiated. Bet: ${this.currentBet}`, 'color: #008080');
        return true;
    }

    /**
     * Checks for initial Blackjack after the initial deal sequence completes.
     * If Blackjack occurs, reveals the dealer's hole card and determines the game outcome.
     * If no Blackjack, proceeds to the player's turn (and offers insurance if applicable).
     */
    private checkInitialBlackjack(): void {
        const playerScore = this.blackjackGame.getPlayerScore();
        console.log(`%c[GameActions] checkInitialBlackjack. Player Score: ${playerScore}`, 'color: #DAA520'); // GoldenRod

        if (playerScore === 21) { // Player has Blackjack
            console.log("%c[GameActions] Player has Blackjack!", 'color: gold; font-weight: bold;');
            this.requestRevealDealerHoleCard(() => {
                console.log(`%c[GameActions] Post-reveal callback for Player BJ.`, 'color: #DAA520');
                this.resolveInsurance();
                const dealerFullScore = this.blackjackGame.getDealerFullScore();
                const dealerHasBlackjack = dealerFullScore === 21 && this.blackjackGame.getDealerHand().length === 2;

                if (dealerHasBlackjack) {
                    console.log("[GameActions] Dealer also has Blackjack! Push.");
                    this.setGameResult(GameResult.Push);
                    this.playerFunds.addFunds(this.currentBet);
                } else {
                    console.log("[GameActions] Player wins with Blackjack! (Pays 3:2)");
                    this.setGameResult(GameResult.PlayerBlackjack);
                    this.playerFunds.addFunds(this.currentBet * 2.5);
                }
                this.setGameState(GameState.GameOver, true, true); // Notify controller for final UI
            });
        } else { // Player does not have Blackjack
            console.log(`%c[GameActions] No initial Blackjack. Proceeding to PlayerTurn.`, 'color: #DAA520');
            this.setGameState(GameState.PlayerTurn, true, true); // Notify controller for player actions
        }
    }

    /** Initiates the player 'hit' action if conditions are met. */
    public playerHit(): void {
        if (this.gameState !== GameState.PlayerTurn) { console.warn("[GameActions] Cannot hit outside of PlayerTurn"); return; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("[GameActions] Cannot hit: Action/Animation in progress."); return; }

        console.log("[GameActions] Player hits.");
        this.blackjackGame.insuranceTakenThisRound = true;
        this.lastAction = LastAnimatedAction.PlayerHit;
        this.dealCardToHand(this.blackjackGame.getPlayerHand(), true);
    }

    /** Logic executed after the player 'hit' animation completes. Checks for bust. */
    private completePlayerHit(): void {
        const playerScore = this.blackjackGame.getPlayerScore();
        console.log(`%c[GameActions] completePlayerHit. Score: ${playerScore}`, 'color: #DAA520');
        if (playerScore > 21) {
            console.log("%c[GameActions] Player Bust!", 'color: red; font-weight: bold;');
            this.setGameResult(GameResult.DealerWins);
            this.requestRevealDealerHoleCard(() => {
                console.log(`%c[GameActions] Post-reveal callback for Player Bust.`, 'color: #DAA520');
                this.resolveInsurance();
                this.setGameState(GameState.GameOver, true, true); // Notify for UI
            });
        } else {
            console.log(`%c[GameActions] Player Hit OK. Player turn continues.`, 'color: #DAA520');
            this.saveGameState(); // Save, UI updated by controller via onGameActionComplete
            this.blackjackGame.notifyAnimationComplete(); // Signal action done, UI will update
        }
    }

    /** Initiates the player 'stand' action if conditions are met. */
    public playerStand(): void {
        if (this.gameState !== GameState.PlayerTurn) { console.warn("[GameActions] Cannot stand outside of PlayerTurn"); return; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("[GameActions] Cannot stand: Action/Animation in progress."); return; }

        console.log("[GameActions] Player stands.");
        this.blackjackGame.insuranceTakenThisRound = true;
        this.setGameState(GameState.DealerTurn, true, true); // Notify for UI change (e.g. disable player buttons)

        console.log("[GameActions] Requesting hole card reveal before dealer turn.");
        this.requestRevealDealerHoleCard(() => {
            console.log(`%c[GameActions] Post-reveal callback for Player Stand. Executing dealer turn.`, 'color: #DAA520');
            const dealerFullScore = this.blackjackGame.getDealerFullScore();
            const dealerHasBlackjack = dealerFullScore === 21 && this.blackjackGame.getDealerHand().length === 2;
            if (dealerHasBlackjack) {
                console.log("[GameActions] Dealer has Blackjack after hole card reveal (player stood).");
                this.dealerStand();
            } else {
                this.executeDealerTurn();
            }
        });
    }

    /**
     * Initiates the player 'double down' action if conditions are met.
     * @returns True if the action was successfully initiated, false otherwise.
     */
    public doubleDown(): boolean {
        if (this.gameState !== GameState.PlayerTurn || this.blackjackGame.getPlayerHand().length !== 2) { console.warn("[GameActions] Cannot double down now."); return false; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("[GameActions] Cannot double down: Action/Animation in progress."); return false; }
        if (this.playerFunds.getFunds() < this.currentBet) { console.warn("[GameActions] Insufficient funds to double down."); return false; }

        console.log("[GameActions] Player doubles down.");
        if (!this.playerFunds.deductFunds(this.currentBet)) { console.error("[GameActions] Fund deduction failed for double down."); return false; }

        this.currentBet *= 2;
        console.log("[GameActions] Bet doubled to:", this.currentBet);
        this.blackjackGame.insuranceTakenThisRound = true;
        this.saveGameState(); // Save new bet and funds
        this.blackjackGame.notifyAnimationComplete(); // Update UI for bet/funds change

        this.lastAction = LastAnimatedAction.DoubleDownHit;
        this.dealCardToHand(this.blackjackGame.getPlayerHand(), true);
        return true;
    }

    /** Logic executed after the double down card deal animation completes. Checks for bust, then proceeds to dealer turn. */
    private completeDoubleDown(): void {
        const playerScore = this.blackjackGame.getPlayerScore();
        console.log(`%c[GameActions] completeDoubleDown. Score: ${playerScore}`, 'color: #DAA520');
        // State already saved for bet/funds. Player hand change will be saved by dealCardToHand.

        if (playerScore > 21) {
            console.log("%c[GameActions] Player Bust on Double Down!", 'color: red; font-weight: bold;');
            this.setGameResult(GameResult.DealerWins);
            this.requestRevealDealerHoleCard(() => {
                console.log(`%c[GameActions] Post-reveal callback for Double Down Bust.`, 'color: #DAA520');
                this.resolveInsurance();
                this.setGameState(GameState.GameOver, true, true); // Notify for UI
            });
        } else {
            console.log(`%c[GameActions] Double Down OK. Proceeding to DealerTurn.`, 'color: #DAA520');
            this.setGameState(GameState.DealerTurn, true, true); // Notify for UI
            console.log("[GameActions] Requesting hole card reveal before dealer turn (after Double Down).");
            this.requestRevealDealerHoleCard(() => {
                console.log(`%c[GameActions] Post-reveal callback for Double Down OK. Executing dealer turn.`, 'color: #DAA520');
                const dealerFullScore = this.blackjackGame.getDealerFullScore();
                const dealerHasBlackjack = dealerFullScore === 21 && this.blackjackGame.getDealerHand().length === 2;
                if (dealerHasBlackjack) {
                    console.log("[GameActions] Dealer has Blackjack after hole card reveal (player doubled).");
                    this.dealerStand();
                } else {
                    this.executeDealerTurn();
                }
            });
        }
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

        const insuranceCost = this.blackjackGame.getCurrentBet() * Constants.INSURANCE_BET_RATIO;
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
        this.blackjackGame.notifyAnimationComplete(); // Notify UI to update (e.g., show insurance bet, disable insurance button)
    }

    /** Resolves the insurance bet based on whether the dealer has Blackjack. */
    private resolveInsurance(): void {
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
        }
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
                    Promise.resolve().then(callback);
                }
                return;
            }
            console.log(`%c[GameActions] Setting lastAction=RevealDealerHole and storing callback.`, 'color: magenta');
            this.lastAction = LastAnimatedAction.RevealDealerHole;
            this._postRevealCallback = callback || null;
            console.log(`%c[GameActions] Calling flip() on dealer card 0: ${dealerHand[0].toString()}`, 'color: magenta');
            dealerHand[0].flip(); // This triggers CardVisualizer, which calls onVisualAnimationComplete -> GameActions.onAnimationComplete
        } else {
            console.log(`%c[GameActions] Dealer hole card already revealed or no card exists. Executing callback immediately (if provided).`, 'color: magenta');
            if (callback) {
                Promise.resolve().then(callback);
            }
        }
    }

    /** Executes the dealer's turn logic: Hit if score < 17, otherwise stand. */
    public executeDealerTurn(): void {
        console.log(`%c[GameActions] executeDealerTurn called. State: ${GameState[this.gameState]}`, 'color: magenta');
        if (this.gameState !== GameState.DealerTurn) {
            console.warn(`[GameActions] executeDealerTurn called in wrong state: ${GameState[this.gameState]}`);
            return;
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
            this.dealCardToHand(this.blackjackGame.getDealerHand(), true);
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
            console.log("%c[GameActions] Dealer Bust! Player Wins.", 'color: lime; font-weight: bold;');
            this.setGameResult(GameResult.PlayerWins);
            this.playerFunds.addFunds(this.currentBet * 2);
            this.resolveInsurance();
            this.setGameState(GameState.GameOver, true, true); // Notify for UI
        } else {
            console.log(`%c[GameActions] Dealer Hit OK. Continuing dealer turn...`, 'color: #DAA520');
            this.executeDealerTurn(); // No UI notification needed here, executeDealerTurn will handle it or call dealerStand
        }
    }

    /** Logic executed when the dealer stands. Determines the winner based on scores. */
    private dealerStand(): void {
        console.log(`%c[GameActions] dealerStand called. State: ${GameState[this.gameState]}, LastAction: ${LastAnimatedAction[this.lastAction]}`, 'color: #DAA520');
        if ((this.gameState === GameState.Initial ||
                this.gameState === GameState.Betting ||
                this.gameState === GameState.PlayerTurn ||
                this.gameState === GameState.Dealing) && // Added Dealing state
            this.lastAction === LastAnimatedAction.None) {
            console.warn(`[GameActions] dealerStand called unexpectedly in state: ${GameState[this.gameState]} with no preceding action.`);
            return;
        }
        console.log("[GameActions] Dealer stands. Determining winner.");

        this.resolveInsurance();

        const playerScore = this.blackjackGame.getPlayerScore();
        const dealerScore = this.blackjackGame.getDealerFullScore();

        if (playerScore > 21) {
            console.log("%c[GameActions] Player Bust. Dealer Wins.", 'color: red;');
            this.setGameResult(GameResult.DealerWins);
        } else if (dealerScore > 21) {
            console.log("%c[GameActions] Dealer Bust. Player Wins!", 'color: lime;');
            this.setGameResult(GameResult.PlayerWins);
            this.playerFunds.addFunds(this.currentBet * 2);
        } else if (playerScore > dealerScore) {
            console.log(`%c[GameActions] Player (${playerScore}) beats Dealer (${dealerScore}). Player Wins!`, 'color: lime;');
            this.setGameResult(GameResult.PlayerWins);
            this.playerFunds.addFunds(this.currentBet * 2);
        } else if (dealerScore > playerScore) {
            console.log(`%c[GameActions] Dealer (${dealerScore}) beats Player (${playerScore}). Dealer Wins.`, 'color: red;');
            this.setGameResult(GameResult.DealerWins);
        } else {
            console.log(`%c[GameActions] Player (${playerScore}) and Dealer (${dealerScore}) Push.`, 'color: yellow;');
            this.setGameResult(GameResult.Push);
            this.playerFunds.addFunds(this.currentBet);
        }

        this.setGameState(GameState.GameOver, true, true); // Notify for UI
    }

    // --- Card Dealing ---
    /** Adds a card deal instruction to the initial deal queue. */
    private queueDeal(hand: Card[], faceUp: boolean, isPlayer: boolean): void {
        this.dealQueue.push({ hand, faceUp, isPlayer });
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
            const target = dealInfo.isPlayer ? 'Player' : 'Dealer';
            console.log(`%c[GameActions] Processing deal for: ${target}, faceUp: ${dealInfo.faceUp}`, 'color: cyan; font-weight: bold;');

            const card = this.handManager.drawCard();

            if (!card) {
                console.error("[GameActions] Deck empty during initial deal!");
                this.isDealingInitialSequence = false;
                this.lastAction = LastAnimatedAction.None;
                this.setGameState(GameState.GameOver, true);
                this.setGameResult(GameResult.DealerWins); // Or some other error result
                this.blackjackGame.notifyAnimationComplete(); // Ensure UI updates to game over
                return;
            }

            console.log(`%c[GameActions]   -> Drawn card: ${card.toString()}`, 'color: cyan');
            card.setFaceUp(dealInfo.faceUp); // Set faceUp *before* adding to hand or notifying
            console.log(`%c[GameActions]   -> Card state after setFaceUp: ${card.isFaceUp()}`, 'color: cyan');

            const isPlayer = dealInfo.isPlayer;
            if (isPlayer) {
                this.blackjackGame.addCardToPlayerHand(card);
            } else {
                this.blackjackGame.addCardToDealerHand(card);
            }
            this.handManager.registerFlipCallback(card);

            console.log(`%c[GameActions]   -> Adding card to ${target} hand. New hand size: ${dealInfo.hand.length}`, 'color: cyan');
            this.lastAction = LastAnimatedAction.InitialDeal;
            console.log(`%c[GameActions]   -> Set lastAction = InitialDeal`, 'color: cyan');
            console.log(`%c[GameActions]   -> Calling blackjackGame.notifyCardDealt with faceUp=${dealInfo.faceUp}`, 'color: cyan');
            this.blackjackGame.notifyCardDealt(
                card,
                dealInfo.hand.length - 1,
                isPlayer,
                dealInfo.faceUp // Pass the intended faceUp state for animation
            );
            console.log(`%c[GameActions]   -> Waiting for visual animation to complete...`, 'color: cyan');
        } else {
            console.error("[GameActions] processDealQueue called with empty queue during initial deal sequence!");
            this.isDealingInitialSequence = false;
            this.lastAction = LastAnimatedAction.None;
            this.checkInitialBlackjack(); // This will set PlayerTurn or GameOver and notify UI
        }
    }

    /** Deals a single card directly to a hand (used for Hit, Double Down, Dealer Hit). */
    private dealCardToHand(hand: Card[], faceUp: boolean): void {
        console.log(`%c[GameActions] dealCardToHand called. FaceUp: ${faceUp}, isDealingInitial: ${this.isDealingInitialSequence}`, 'color: cyan');
        if (this.isDealingInitialSequence) {
            console.error("[GameActions] Cannot deal single card while initial deal sequence is processing!");
            this.lastAction = LastAnimatedAction.None;
            return;
        }
        if (this.lastAction === LastAnimatedAction.None || this.lastAction === LastAnimatedAction.InitialDeal) {
            console.error(`[GameActions] dealCardToHand called with invalid lastAction state: ${LastAnimatedAction[this.lastAction]}`);
            return;
        }

        const card = this.handManager.drawCard();
        if (card) {
            const isPlayer = hand === this.blackjackGame.getPlayerHand();
            const target = isPlayer ? 'Player' : 'Dealer';
            console.log(`%c[GameActions]   -> Dealing single card ${card.toString()} to ${target}`, 'color: cyan');
            card.setFaceUp(faceUp);
            console.log(`%c[GameActions]   -> Card state after setFaceUp: ${card.isFaceUp()}`, 'color: cyan');

            if (isPlayer) {
                this.blackjackGame.addCardToPlayerHand(card);
            } else {
                this.blackjackGame.addCardToDealerHand(card);
            }
            this.handManager.registerFlipCallback(card);
            console.log(`%c[GameActions]   -> Added card to ${target} hand. New size: ${hand.length}`, 'color: cyan');
            console.log(`%c[GameActions]   -> Calling blackjackGame.notifyCardDealt with faceUp=${faceUp}`, 'color: cyan');
            this.blackjackGame.notifyCardDealt(card, hand.length - 1, isPlayer, faceUp);
            console.log(`%c[GameActions]   -> Waiting for visual animation to complete...`, 'color: cyan');
        } else {
            console.error("[GameActions] Deck is empty when trying to deal single card!");
            const currentAction = this.lastAction;
            this.lastAction = LastAnimatedAction.None;
            if (currentAction === LastAnimatedAction.DealerHit) this.dealerStand();
            else if (currentAction === LastAnimatedAction.PlayerHit || currentAction === LastAnimatedAction.DoubleDownHit) this.playerStand();
            else this.blackjackGame.notifyAnimationComplete();
        }
    }


    // --- Animation Callback ---
    /** Central handler for when any visual animation completes (deal, flip). Determines the next logical step. */
    public onAnimationComplete(): void {
        const actionJustCompleted = this.lastAction;
        console.log(`%c[GameActions] >>> onAnimationComplete called for action: ${LastAnimatedAction[actionJustCompleted]} <<<`, 'color: orange; font-weight: bold');

        if (actionJustCompleted === LastAnimatedAction.InitialDeal) {
            if (this.dealQueue.length > 0) {
                console.log(`%c[GameActions]   -> InitialDeal completed, ${this.dealQueue.length} cards left in queue. Processing next...`, 'color: orange');
                this.processDealQueue(); // Continues dealing, UI updates via this chain
                return;
            } else {
                console.log(`%c[GameActions]   -> InitialDeal completed, queue empty. Sequence finished.`, 'color: orange');
                this.isDealingInitialSequence = false;
                this.lastAction = LastAnimatedAction.None;
                console.log(`%c[GameActions]   -> Checking for initial Blackjack...`, 'color: orange');
                this.checkInitialBlackjack(); // This will set PlayerTurn or GameOver and notify UI
                return;
            }
        }

        const previousLastAction = this.lastAction; // Store before resetting
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
                if (this._postRevealCallback) {
                    console.log(`%c[GameActions]   -> Executing post-reveal callback.`, 'color: orange');
                    const callback = this._postRevealCallback;
                    this._postRevealCallback = null;
                    setTimeout(callback, 0); // Callback might change state and notify UI
                } else {
                    console.warn("[GameActions] RevealDealerHole completed but no callback was set.");
                    this.blackjackGame.notifyAnimationComplete(); // Ensure UI knows something finished
                }
                break;
            case LastAnimatedAction.InsuranceTaken:
                console.log(`%c[GameActions]   -> InsuranceTaken action complete. UI already updated.`, 'color: orange');
                // No further game logic step, UI was updated when insurance was taken.
                // The blackjackGame.notifyAnimationComplete() was already called by playerTakeInsurance.
                // This case is mostly for acknowledging the action completion and resetting lastAction.
                break;
            case LastAnimatedAction.None:
                // This case can happen if notifyAnimationComplete is called for a state change
                // without a pending visual/logical action (e.g., from setGameState with notifyController=true)
                console.log("[GameActions] Animation finished for None action. UI should be up-to-date.");
                // No further action needed, GameController.onGameActionComplete already updated the UI.
                break;
            default:
                console.warn(`[GameActions] Unhandled animation completion for action: ${LastAnimatedAction[previousLastAction]}`);
                this.blackjackGame.notifyAnimationComplete(); // Generic notification
                break;
        }
        console.log(`%c[GameActions] <<< onAnimationComplete finished processing for ${LastAnimatedAction[previousLastAction]} >>>`, 'color: orange; font-weight: bold');
    }

    // --- Save/Load ---
    /** Saves the current game state to storage, avoiding saves during initial deal animation. */
    public saveGameState(): void {
        // Allow saving during GameState.Dealing, as it's a valid persistent state.
        // if (this.isDealingInitialSequence && this.lastAction === LastAnimatedAction.InitialDeal) {
        //     console.log("[GameActions] Skipping saveGameState during active initial card deal animation.");
        //     return;
        // }
        GameStorage.saveGameState(
            this.gameState, this.currentBet, this.gameResult,
            this.blackjackGame.getPlayerHand(), this.blackjackGame.getDealerHand(),
            this.blackjackGame.insuranceTakenThisRound,
            this.blackjackGame.insuranceBetPlaced
        );
    }

    /** Loads game state from storage and restores the game logic. */
    public loadGameState(): boolean {
        const loadedData = GameStorage.loadGameState();

        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);
        this.isDealingInitialSequence = false;
        this.lastAction = LastAnimatedAction.None;
        this._postRevealCallback = null;
        this.roundInsuranceBetAmount = 0;
        this.roundInsuranceTaken = false;


        if (!loadedData.gameState) {
            GameStorage.clearSavedHands();
            this.setGameState(GameState.Initial, true); // Force save for initial state
            this.setGameResult(GameResult.InProgress);
            this.currentBet = 0;
            const initialFunds = GameStorage.loadFunds(Constants.DEFAULT_FUNDS);
            this.lastBet = initialFunds >= Constants.MIN_BET ? Constants.MIN_BET : 0;
            this.blackjackGame.insuranceTakenThisRound = false;
            this.blackjackGame.insuranceBetPlaced = 0;
            return false;
        }

        console.log("%c[GameActions] Restoring game state...", 'color: blue');
        this.gameState = loadedData.gameState; // Don't use setGameState here to avoid notifications during load
        this.currentBet = loadedData.currentBet!;
        this.lastBet = this.currentBet > 0 ? this.currentBet : (GameStorage.loadFunds(Constants.DEFAULT_FUNDS) >= Constants.MIN_BET ? Constants.MIN_BET : 0);
        this.gameResult = loadedData.gameResult!;

        this.blackjackGame.insuranceTakenThisRound = loadedData.insuranceTakenThisRound || false;
        this.blackjackGame.insuranceBetPlaced = loadedData.insuranceBetPlaced || 0;
        this.roundInsuranceTaken = this.blackjackGame.insuranceTakenThisRound;
        this.roundInsuranceBetAmount = this.blackjackGame.insuranceBetPlaced;


        const restoredPlayerHand = loadedData.playerHand!.map(data => {
            const card = new Card(data.suit, data.rank);
            card.setFaceUp(data.faceUp);
            this.handManager.registerFlipCallback(card);
            return card;
        });
        this.blackjackGame.setPlayerHand(restoredPlayerHand);

        const restoredDealerHand = loadedData.dealerHand!.map(data => {
            const card = new Card(data.suit, data.rank);
            card.setFaceUp(data.faceUp);
            this.handManager.registerFlipCallback(card);
            return card;
        });
        this.blackjackGame.setDealerHand(restoredDealerHand);

        console.log(`%c[GameActions] Game state restored: ${GameState[this.gameState]}, Bet: ${this.currentBet}`, 'color: blue; font-weight: bold;');
        console.log(`[GameActions]   Insurance: Taken=${this.blackjackGame.insuranceTakenThisRound}, Bet=${this.blackjackGame.insuranceBetPlaced}`);
        console.log("[GameActions] Restored Player Hand:", this.blackjackGame.getPlayerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));
        console.log("[GameActions] Restored Dealer Hand:", this.blackjackGame.getDealerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));

        return true;
    }
}

// src/game/gameactions-ts
// Added extensive debug logs to startNewGame, processDealQueue, onAnimationComplete
// Added insurance logic
// Introduced GameState.Dealing
// Made resolveInsurance public for debug purposes
import { Card, Rank } from "./Card";
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { GameStorage } from "./GameStorage";
import { BlackjackGame } from "./BlackjackGame";
import { Constants } from "../Constants";

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
    InsuranceTaken // Represents the UI update after insurance is taken (no cards dealt)
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
    private gameResult: GameResult = GameResult.InProgress;
    private currentBet: number = 0;
    private lastBet: number = 10;

    // Insurance specific state for the current round, managed by GameActions
    private roundInsuranceBetAmount: number = 0; // The actual amount of the insurance bet placed this round
    private roundInsuranceTaken: boolean = false; // If insurance was taken this round

    // State for managing the last animated action
    private lastAction: LastAnimatedAction = LastAnimatedAction.None;

    // Queue for the initial deal sequence
    private dealQueue: { hand: Card[], faceUp: boolean, isPlayer: boolean }[] = [];

    // State to track if we are currently dealing the initial sequence
    private isDealingInitialSequence: boolean = false;

    // Callback to execute after revealing the dealer's hole card
    private _postRevealCallback: (() => void) | null = null;

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

    /**
     * Gets the current game state.
     * @return The current GameState.
     */
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

    /**
     * Gets the current game result.
     * @return The current GameResult.
     */
    public getGameResult(): GameResult { return this.gameResult; }

    // --- Bet ---

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
        if (!this.playerFunds.deductFunds(validBet)) {
            console.error("[GameActions] Fund deduction failed unexpectedly.");
            this.setGameState(GameState.Betting, false, true);
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

        this.setGameState(GameState.Dealing, true, true);

        this.dealQueue = [];
        console.log(`%c[GameActions] Queuing 1st card: Dealer, faceUp=false`, 'color: #008080');
        this.queueDeal(this.blackjackGame.getDealerHand(), false, false);
        console.log(`%c[GameActions] Queuing 2nd card: Player, faceUp=true`, 'color: #008080');
        this.queueDeal(this.blackjackGame.getPlayerHand(), true, true);
        console.log(`%c[GameActions] Queuing 3rd card: Dealer, faceUp=true`, 'color: #008080');
        this.queueDeal(this.blackjackGame.getDealerHand(), true, false);
        console.log(`%c[GameActions] Queuing 4th card: Player, faceUp=true`, 'color: #008080');
        this.queueDeal(this.blackjackGame.getPlayerHand(), true, true);
        console.log(`%c[GameActions] Deal Queue:`, 'color: #008080', this.dealQueue.map(d => `Player=${d.isPlayer}, FaceUp=${d.faceUp}`));

        this.lastAction = LastAnimatedAction.InitialDeal;
        this.isDealingInitialSequence = true;

        console.log(`%c[GameActions] Initiating first deal from queue...`, 'color: #008080');
        this.processDealQueue();

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
        console.log(`%c[GameActions] checkInitialBlackjack. Player Score: ${playerScore}`, 'color: #DAA520');

        if (playerScore === 21) {
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
                this.setGameState(GameState.GameOver, true, true);
            });
        } else {
            console.log(`%c[GameActions] No initial Blackjack. Proceeding to PlayerTurn.`, 'color: #DAA520');
            this.setGameState(GameState.PlayerTurn, true, true);
        }
    }

    /**
     * Logic executed when the player 'hit' action is initiated.
     */
    public playerHit(): void {
        if (this.gameState !== GameState.PlayerTurn) { console.warn("[GameActions] Cannot hit outside of PlayerTurn"); return; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("[GameActions] Cannot hit: Action/Animation in progress."); return; }

        console.log("[GameActions] Player hits.");
        this.blackjackGame.insuranceTakenThisRound = true;
        this.lastAction = LastAnimatedAction.PlayerHit;
        this.dealCardToHand(this.blackjackGame.getPlayerHand(), true);
    }

    /**
     * Completes the player 'hit' action after the card deal animation.
     */
    private completePlayerHit(): void {
        const playerScore = this.blackjackGame.getPlayerScore();
        console.log(`%c[GameActions] completePlayerHit. Score: ${playerScore}`, 'color: #DAA520');
        if (playerScore > 21) {
            console.log("%c[GameActions] Player Bust!", 'color: red; font-weight: bold;');
            this.setGameResult(GameResult.DealerWins);
            this.requestRevealDealerHoleCard(() => {
                console.log(`%c[GameActions] Post-reveal callback for Player Bust.`, 'color: #DAA520');
                this.resolveInsurance();
                this.setGameState(GameState.GameOver, true, true);
            });
        } else {
            console.log(`%c[GameActions] Player Hit OK. Player turn continues.`, 'color: #DAA520');
            this.saveGameState();
            this.blackjackGame.notifyAnimationComplete();
        }
    }

    /**
     * Logic executed when the player 'stand' action is initiated.
     * Reveals the dealer's hole card and proceeds to the dealer's turn.
     */
    public playerStand(): void {
        if (this.gameState !== GameState.PlayerTurn) { console.warn("[GameActions] Cannot stand outside of PlayerTurn"); return; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("[GameActions] Cannot stand: Action/Animation in progress."); return; }

        console.log("[GameActions] Player stands.");
        this.blackjackGame.insuranceTakenThisRound = true;
        this.setGameState(GameState.DealerTurn, true, true);

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
        this.saveGameState();
        this.blackjackGame.notifyAnimationComplete();

        this.lastAction = LastAnimatedAction.DoubleDownHit;
        this.dealCardToHand(this.blackjackGame.getPlayerHand(), true);
        return true;
    }

    /**
     * Logic executed after th 'double down' animation completes.
     */
    private completeDoubleDown(): void {
        const playerScore = this.blackjackGame.getPlayerScore();
        console.log(`%c[GameActions] completeDoubleDown. Score: ${playerScore}`, 'color: #DAA520');

        if (playerScore > 21) {
            console.log("%c[GameActions] Player Bust on Double Down!", 'color: red; font-weight: bold;');
            this.setGameResult(GameResult.DealerWins);
            this.requestRevealDealerHoleCard(() => {
                console.log(`%c[GameActions] Post-reveal callback for Double Down Bust.`, 'color: #DAA520');
                this.resolveInsurance();
                this.setGameState(GameState.GameOver, true, true);
            });
        } else {
            console.log(`%c[GameActions] Double Down OK. Proceeding to DealerTurn.`, 'color: #DAA520');
            this.setGameState(GameState.DealerTurn, true, true);
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

    /**
     * Logic executed when the player takes insurance.
     */
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
        this.blackjackGame.notifyAnimationComplete();
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
            dealerHand[0].flip();
        } else {
            console.log(`%c[GameActions] Dealer hole card already revealed or no card exists. Executing callback immediately (if provided).`, 'color: magenta');
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

    /**
     * Logic executed after the dealer 'hit' animation completes.
     * Checks for bust, otherwise continues dealer turn.
     */
    private completeDealerHit(): void {
        const dealerScore = this.blackjackGame.getDealerFullScore();
        console.log(`%c[GameActions] completeDealerHit. Score: ${dealerScore}`, 'color: #DAA520');
        this.saveGameState();

        if (dealerScore > 21) {
            console.log("%c[GameActions] Dealer Bust! Player Wins.", 'color: lime; font-weight: bold;');
            this.setGameResult(GameResult.PlayerWins);
            this.playerFunds.addFunds(this.currentBet * 2);
            this.resolveInsurance();
            this.setGameState(GameState.GameOver, true, true);
        } else {
            console.log(`%c[GameActions] Dealer Hit OK. Continuing dealer turn...`, 'color: #DAA520');
            this.executeDealerTurn();
        }
    }

    /**
     * Logic executed when the dealer stands. Determines the winner based on scores.
     */
    private dealerStand(): void {
        console.log(`%c[GameActions] dealerStand called. State: ${GameState[this.gameState]}, LastAction: ${LastAnimatedAction[this.lastAction]}`, 'color: #DAA520');
        if ((this.gameState === GameState.Initial ||
                this.gameState === GameState.Betting ||
                this.gameState === GameState.PlayerTurn ||
                this.gameState === GameState.Dealing) &&
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

        this.setGameState(GameState.GameOver, true, true);
    }

    // --- Card Dealing ---

    /**
     * Queues a card deal for the initial deal sequence.
     * @param hand
     * @param faceUp
     * @param isPlayer
     * @private
     */
    private queueDeal(hand: Card[], faceUp: boolean, isPlayer: boolean): void {
        this.dealQueue.push({ hand, faceUp, isPlayer });
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
            const target = dealInfo.isPlayer ? 'Player' : 'Dealer';
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

    /**
     * Callback for when an animation completes.
     * This method handles the logic for processing the last action that was animated,
     * updating the game state, and managing the next steps in the game flow.
     */
    public onAnimationComplete(): void {
        const actionJustCompleted = this.lastAction;
        console.log(`%c[GameActions] >>> onAnimationComplete called for action: ${LastAnimatedAction[actionJustCompleted]} <<<`, 'color: orange; font-weight: bold');

        if (actionJustCompleted === LastAnimatedAction.InitialDeal) {
            if (this.dealQueue.length > 0) {
                console.log(`%c[GameActions]   -> InitialDeal completed, ${this.dealQueue.length} cards left in queue. Processing next...`, 'color: orange');
                this.processDealQueue();
                return;
            } else {
                console.log(`%c[GameActions]   -> InitialDeal completed, queue empty. Sequence finished.`, 'color: orange');
                this.isDealingInitialSequence = false;
                this.lastAction = LastAnimatedAction.None;
                console.log(`%c[GameActions]   -> Checking for initial Blackjack...`, 'color: orange');
                this.checkInitialBlackjack();
                return;
            }
        }

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
                if (this._postRevealCallback) {
                    console.log(`%c[GameActions]   -> Executing post-reveal callback.`, 'color: orange');
                    const callback = this._postRevealCallback;
                    this._postRevealCallback = null;
                    setTimeout(callback, 0);
                } else {
                    console.warn("[GameActions] RevealDealerHole completed but no callback was set.");
                    this.blackjackGame.notifyAnimationComplete();
                }
                break;
            case LastAnimatedAction.InsuranceTaken:
                console.log(`%c[GameActions]   -> InsuranceTaken action complete. UI already updated.`, 'color: orange');
                break;
            case LastAnimatedAction.None:
                console.log("[GameActions] Animation finished for None action. UI should be up-to-date.");
                break;
            default:
                console.warn(`[GameActions] Unhandled animation completion for action: ${LastAnimatedAction[previousLastAction]}`);
                this.blackjackGame.notifyAnimationComplete();
                break;
        }
        console.log(`%c[GameActions] <<< onAnimationComplete finished processing for ${LastAnimatedAction[previousLastAction]} >>>`, 'color: orange; font-weight: bold');
    }

    // --- Save/Load ---

    /**
     * Saves the current game state to storage, avoiding saves during initial deal animation.
     */
    public saveGameState(): void {
        GameStorage.saveGameState(
            this.gameState, this.currentBet, this.gameResult,
            this.blackjackGame.getPlayerHand(), this.blackjackGame.getDealerHand(),
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

        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);
        this.isDealingInitialSequence = false;
        this.lastAction = LastAnimatedAction.None;
        this._postRevealCallback = null;
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

        console.log(`%c[GameActions] Game state restored: ${GameState[this.gameState]}, Bet: ${this.currentBet}`, 'color: blue; font-weight: bold;');
        console.log(`[GameActions]   Insurance: Taken=${this.blackjackGame.insuranceTakenThisRound}, Bet=${this.blackjackGame.insuranceBetPlaced}`);
        console.log("[GameActions] Restored Player Hand:", this.blackjackGame.getPlayerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));
        console.log("[GameActions] Restored Dealer Hand:", this.blackjackGame.getDealerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));

        return true;
    }
}

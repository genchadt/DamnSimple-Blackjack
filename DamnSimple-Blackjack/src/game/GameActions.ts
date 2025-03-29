// src/game/gameactions-ts
import { Card } from "./Card";
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameStorage } from "./GameStorage";
import { BlackjackGame } from "./BlackjackGame";

/** Enum to track the last animated action initiated by GameActions. */
enum LastAnimatedAction {
    None,
    InitialDeal, // Represents one card being dealt in the initial sequence
    PlayerHit,
    DealerHit,
    DoubleDownHit,
    RevealDealerHole // Represents the flip animation of the hole card
}

export class GameActions {
    private blackjackGame: BlackjackGame;
    private handManager: HandManager;
    private playerFunds: PlayerFunds;
    private gameState: GameState = GameState.Initial;
    private gameResult: GameResult = GameResult.InProgress;
    private currentBet: number = 0;
    private lastBet: number = 10;

    private lastAction: LastAnimatedAction = LastAnimatedAction.None;
    /** Queue for the initial 4-card deal sequence. */
    private dealQueue: { hand: Card[], faceUp: boolean }[] = [];
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
     */
    public setGameState(state: GameState, forceSave: boolean = false): void {
        if (this.gameState !== state || forceSave) {
            // console.log(`%cGame state changing: ${GameState[this.gameState]} -> ${GameState[state]}`, 'color: orange; font-weight: bold;');
            this.gameState = state;
            this.saveGameState();
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
             const validAmount = Math.max(10, Math.min(amount, playerFunds));
             if (this.currentBet !== validAmount) {
                 this.currentBet = validAmount;
             }
        } else {
             console.warn("Cannot set bet outside of Betting/Initial state.");
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
        if (this.gameState !== GameState.Betting && this.gameState !== GameState.Initial && this.gameState !== GameState.GameOver) {
            console.error("Cannot start new game from state:", GameState[this.gameState]);
            return false;
        }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) {
             console.warn("Cannot start new game while an action/animation is in progress.");
             return false;
        }
        const playerFunds = this.playerFunds.getFunds();
        const validBet = Math.max(10, Math.min(bet, playerFunds));
        if (playerFunds < validBet || validBet < 10) {
            console.error(`Cannot start game. Insufficient funds (${playerFunds}) for bet (${validBet}) or bet too low.`);
            this.setGameState(GameState.Betting); // Revert to betting
            this.blackjackGame.notifyAnimationComplete(); // Notify controller to update UI
            return false;
        }
        if (!this.playerFunds.deductFunds(validBet)) {
             console.error("Fund deduction failed unexpectedly.");
             this.setGameState(GameState.Betting);
             this.blackjackGame.notifyAnimationComplete();
             return false;
        }

        this.currentBet = validBet;
        this.lastBet = validBet;
        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);
        this.setGameResult(GameResult.InProgress);
        this.handManager.refreshDeckIfNeeded();
        this.setGameState(GameState.PlayerTurn); // Tentatively set to player turn

        // Setup the initial deal queue (Dealer Down, Player Up, Dealer Up, Player Up)
        this.dealQueue = [];
        this.queueDeal(this.blackjackGame.getDealerHand(), false);
        this.queueDeal(this.blackjackGame.getPlayerHand(), true);
        this.queueDeal(this.blackjackGame.getDealerHand(), true);
        this.queueDeal(this.blackjackGame.getPlayerHand(), true);

        this.lastAction = LastAnimatedAction.InitialDeal; // Mark the *type* of action starting
        this.isDealingInitialSequence = true; // Flag the sequence start

        this.processDealQueue(); // Start the first deal animation

        console.log(`New game started logic initiated. Bet: ${this.currentBet}`);
        return true;
    }

    /**
     * Checks for initial Blackjack after the initial deal sequence completes.
     * If Blackjack occurs, reveals the dealer's hole card and determines the game outcome.
     * If no Blackjack, proceeds to the player's turn.
     */
    private checkInitialBlackjack(): void {
         const playerScore = this.blackjackGame.getPlayerScore();

         if (playerScore === 21) {
             console.log("%cPlayer has Blackjack!", 'color: gold; font-weight: bold;');
             // Reveal hole card, then determine outcome in the callback
             this.requestRevealDealerHoleCard(() => {
                 const dealerFullScore = this.blackjackGame.getDealerFullScore();
                 if (dealerFullScore === 21) {
                     console.log("Dealer also has Blackjack! Push.");
                     this.setGameResult(GameResult.Push);
                     this.playerFunds.addFunds(this.currentBet); // Return original bet
                 } else {
                     console.log("Player wins with Blackjack! (Pays 3:2)");
                     this.setGameResult(GameResult.PlayerBlackjack);
                     this.playerFunds.addFunds(this.currentBet * 2.5); // Original bet + 1.5x winnings
                 }
                 this.setGameState(GameState.GameOver);
                 this.saveGameState();
                 this.blackjackGame.notifyAnimationComplete(); // Update UI
             });
         }
         else {
              this.setGameState(GameState.PlayerTurn); // Ensure state is PlayerTurn
              this.saveGameState();
              this.blackjackGame.notifyAnimationComplete(); // Update UI for player turn actions
         }
    }

    /** Initiates the player 'hit' action if conditions are met. */
    public playerHit(): void {
        if (this.gameState !== GameState.PlayerTurn) { console.warn("Cannot hit outside of PlayerTurn"); return; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("Cannot hit: Action/Animation in progress."); return; }

        console.log("Player hits.");
        this.lastAction = LastAnimatedAction.PlayerHit;
        this.dealCardToHand(this.blackjackGame.getPlayerHand(), true); // Deal one card face up
    }

    /** Logic executed after the player 'hit' animation completes. Checks for bust. */
    private completePlayerHit(): void {
        const playerScore = this.blackjackGame.getPlayerScore();
        if (playerScore > 21) {
            console.log("%cPlayer Bust!", 'color: red; font-weight: bold;');
            this.setGameResult(GameResult.DealerWins);
            // Reveal hole card (if needed), then end game in callback
            this.requestRevealDealerHoleCard(() => {
                 this.setGameState(GameState.GameOver);
                 this.saveGameState();
                 this.blackjackGame.notifyAnimationComplete(); // Update UI
            });
        } else {
             // Player turn continues
             this.saveGameState();
             this.blackjackGame.notifyAnimationComplete(); // Update UI, enable actions
        }
    }

    /** Initiates the player 'stand' action if conditions are met. */
    public playerStand(): void {
        if (this.gameState !== GameState.PlayerTurn) { console.warn("Cannot stand outside of PlayerTurn"); return; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("Cannot stand: Action/Animation in progress."); return; }

        console.log("Player stands.");
        this.setGameState(GameState.DealerTurn);
        this.saveGameState();

        // Reveal hole card, then execute dealer turn logic in the callback
        this.requestRevealDealerHoleCard(() => {
            this.executeDealerTurn();
        });
    }

    /**
     * Initiates the player 'double down' action if conditions are met.
     * @returns True if the action was successfully initiated, false otherwise.
     */
    public doubleDown(): boolean {
        if (this.gameState !== GameState.PlayerTurn || this.blackjackGame.getPlayerHand().length !== 2) { console.warn("Cannot double down now."); return false; }
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) { console.warn("Cannot double down: Action/Animation in progress."); return false; }
        if (this.playerFunds.getFunds() < this.currentBet) { console.warn("Insufficient funds to double down."); return false; }

        console.log("Player doubles down.");
        if (!this.playerFunds.deductFunds(this.currentBet)) { console.error("Fund deduction failed for double down."); return false; }

        this.currentBet *= 2;
        console.log("Bet doubled to:", this.currentBet);
        this.saveGameState(); // Save doubled bet

        this.lastAction = LastAnimatedAction.DoubleDownHit;
        this.dealCardToHand(this.blackjackGame.getPlayerHand(), true); // Deal one card face up
        return true;
    }

    /** Logic executed after the double down card deal animation completes. Checks for bust, then proceeds to dealer turn. */
     private completeDoubleDown(): void {
         const playerScore = this.blackjackGame.getPlayerScore();
         this.saveGameState(); // Save hand state after hit

         if (playerScore > 21) {
             console.log("%cPlayer Bust on Double Down!", 'color: red; font-weight: bold;');
             this.setGameResult(GameResult.DealerWins);
             // Reveal hole card, then end game in callback
             this.requestRevealDealerHoleCard(() => {
                 this.setGameState(GameState.GameOver);
                 this.saveGameState();
                 this.blackjackGame.notifyAnimationComplete(); // Update UI
             });
         } else {
             // Double down successful, proceed to dealer turn
             this.setGameState(GameState.DealerTurn);
             this.saveGameState();
             // Reveal hole card, then execute dealer turn logic in callback
             this.requestRevealDealerHoleCard(() => {
                 this.executeDealerTurn();
             });
         }
     }

    // --- Dealer Logic ---
    /**
     * Initiates the visual reveal of the dealer's hole card if it's face down.
     * @param callback Optional function to execute after the reveal animation completes.
     */
    private requestRevealDealerHoleCard(callback?: () => void): void {
        const dealerHand = this.blackjackGame.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            if (this.lastAction !== LastAnimatedAction.None) {
                 console.warn(`Cannot reveal hole card while action (${LastAnimatedAction[this.lastAction]}) is in progress.`);
                 // Optionally queue or just block? Blocking for now.
                 // If blocking, we need to ensure the callback still happens eventually or state gets stuck.
                 // Maybe force the callback immediately if blocked?
                 if(callback) Promise.resolve().then(callback); // Try immediate callback if blocked
                 return;
            }
            this.lastAction = LastAnimatedAction.RevealDealerHole;
            this._postRevealCallback = callback || null; // Store callback for onAnimationComplete
            dealerHand[0].flip(); // This triggers Card.onFlip -> HandManager -> CardVisualizer.updateCardVisual (which animates)
        } else {
            // Card already revealed or no card exists, execute callback immediately if provided
            if (callback) {
                Promise.resolve().then(callback); // Ensure async execution
            }
        }
    }

    /** Executes the dealer's turn logic: Hit if score < 17, otherwise stand. */
    public executeDealerTurn(): void {
        if (this.gameState !== GameState.DealerTurn) {
            console.warn(`executeDealerTurn called in wrong state: ${GameState[this.gameState]}`);
            return;
        }
        // Prevent starting a new dealer action if one is already animating
        if (this.lastAction !== LastAnimatedAction.None) {
             console.warn(`Cannot execute dealer turn: Action/Animation (${LastAnimatedAction[this.lastAction]}) in progress.`);
             return;
        }

        const dealerScore = this.blackjackGame.getDealerFullScore();
        // console.log(`%cDEALER TURN - Current Score: ${dealerScore}`, 'color: magenta; font-weight: bold;');

        if (dealerScore < 17) {
            console.log("Dealer hits");
            this.lastAction = LastAnimatedAction.DealerHit;
            this.dealCardToHand(this.blackjackGame.getDealerHand(), true); // Deal face up
        } else {
            console.log("Dealer stands");
            this.dealerStand(); // No animation needed for stand, just proceed to determine winner
        }
    }

    /** Logic executed after the dealer 'hit' animation completes. Checks for bust, otherwise continues dealer turn. */
     private completeDealerHit(): void {
         const dealerScore = this.blackjackGame.getDealerFullScore();
         this.saveGameState(); // Save hand state

         if (dealerScore > 21) {
             console.log("%cDealer Bust! Player Wins.", 'color: lime; font-weight: bold;');
             this.setGameResult(GameResult.PlayerWins);
             this.playerFunds.addFunds(this.currentBet * 2); // Original bet + winnings
             this.setGameState(GameState.GameOver);
             this.saveGameState();
             this.blackjackGame.notifyAnimationComplete(); // Update UI
         } else {
             // Dealer didn't bust, continue turn logic
             this.executeDealerTurn(); // Decide next action (hit again or stand)
         }
     }

    /** Logic executed when the dealer stands. Determines the winner based on scores. */
    private dealerStand(): void {
        // Ensure we are in DealerTurn or just finished a dealer action leading here
        if (this.gameState !== GameState.DealerTurn && this.lastAction === LastAnimatedAction.None) {
             console.warn(`dealerStand called unexpectedly in state: ${GameState[this.gameState]} with no preceding action.`);
             // If game is already over, just notify UI update might be needed
             if (this.gameState === GameState.GameOver) {
                  this.blackjackGame.notifyAnimationComplete();
             }
             return;
        }
        // console.log("Dealer stands. Determining winner."); // Reduce log noise
        const playerScore = this.blackjackGame.getPlayerScore();
        const dealerScore = this.blackjackGame.getDealerFullScore();

        // Determine winner
        if (playerScore > 21) { // Should have been caught earlier, but double check
             console.log("%cPlayer Bust. Dealer Wins.", 'color: red;');
             this.setGameResult(GameResult.DealerWins);
             // No funds change (already lost)
        } else if (dealerScore > 21) { // Should have been caught by completeDealerHit
             console.log("%cDealer Bust. Player Wins!", 'color: lime;');
             this.setGameResult(GameResult.PlayerWins);
             // Funds added in completeDealerHit
        } else if (playerScore > dealerScore) {
            console.log(`%cPlayer (${playerScore}) beats Dealer (${dealerScore}). Player Wins!`, 'color: lime;');
            this.setGameResult(GameResult.PlayerWins);
            this.playerFunds.addFunds(this.currentBet * 2); // Original bet + winnings
        } else if (dealerScore > playerScore) {
            console.log(`%cDealer (${dealerScore}) beats Player (${playerScore}). Dealer Wins.`, 'color: red;');
            this.setGameResult(GameResult.DealerWins);
            // No funds change (already lost)
        } else { // Scores are equal
            console.log(`%cPlayer (${playerScore}) and Dealer (${dealerScore}) Push.`, 'color: yellow;');
            this.setGameResult(GameResult.Push);
            this.playerFunds.addFunds(this.currentBet); // Return original bet
        }

        this.setGameState(GameState.GameOver);
        this.saveGameState();
        this.blackjackGame.notifyAnimationComplete(); // Update UI to show results/options
    }

    // --- Card Dealing ---
    /** Adds a card deal instruction to the initial deal queue. */
    private queueDeal(hand: Card[], faceUp: boolean): void {
        this.dealQueue.push({ hand, faceUp });
    }

    /** Processes the next card deal from the initial deal queue, triggering its animation. */
    private processDealQueue(): void {
        if (!this.isDealingInitialSequence) {
            console.error("processDealQueue called outside of initial deal sequence!");
            this.lastAction = LastAnimatedAction.None; // Reset action state if error
            return;
        }

        if (this.dealQueue.length > 0) {
            const dealInfo = this.dealQueue.shift()!;
            const card = this.handManager.drawCard();

            if (!card) {
                console.error("Deck empty during initial deal!");
                this.isDealingInitialSequence = false;
                this.lastAction = LastAnimatedAction.None;
                // TODO: Handle this error state more gracefully? Maybe force GameOver?
                this.setGameState(GameState.GameOver); // Force game over?
                this.setGameResult(GameResult.DealerWins); // Assume error favors dealer?
                this.blackjackGame.notifyAnimationComplete();
                return;
            }

            // *** CRITICAL: Set the card's logical faceUp state BEFORE triggering animation ***
            card.setFaceUp(dealInfo.faceUp);

            dealInfo.hand.push(card);
            this.handManager.registerFlipCallback(card); // Ensure flip callback is attached
            const isPlayer = dealInfo.hand === this.blackjackGame.getPlayerHand();

            // console.log(`%cDealing ${card.toString()} to ${isPlayer ? 'Player' : 'Dealer'} (${dealInfo.faceUp ? 'up' : 'down'})`, 'color: cyan; font-weight: bold;');

            // Set lastAction *before* starting animation (indicates what *type* of animation is running)
            this.lastAction = LastAnimatedAction.InitialDeal;

            // Trigger visual animation for this single card via BlackjackGame -> GameController
            this.blackjackGame.notifyCardDealt(
                card,
                dealInfo.hand.length - 1, // Index of the card just added
                isPlayer,
                dealInfo.faceUp // Pass the intended final visual state
            );

            // The next card in the queue will be processed when this animation completes (via onAnimationComplete)
        } else {
            // Should not be reached directly, onAnimationComplete handles the end of the sequence.
            console.error("processDealQueue called with empty queue during initial deal sequence!");
            this.isDealingInitialSequence = false;
            this.lastAction = LastAnimatedAction.None;
            this.checkInitialBlackjack(); // Attempt recovery by checking BJ
        }
    }

    /** Deals a single card directly to a hand (used for Hit, Double Down, Dealer Hit). */
    private dealCardToHand(hand: Card[], faceUp: boolean): void {
         if (this.isDealingInitialSequence) {
             console.error("Cannot deal single card while initial deal sequence is processing!");
             this.lastAction = LastAnimatedAction.None; // Reset intended action if blocked
             return;
         }
         // lastAction should already be set by the calling function (PlayerHit, DealerHit, etc.)
         if (this.lastAction === LastAnimatedAction.None || this.lastAction === LastAnimatedAction.InitialDeal) {
             console.error(`dealCardToHand called with invalid lastAction state: ${LastAnimatedAction[this.lastAction]}`);
             // Attempt to recover? Or just block? Block for now.
             return;
         }

         const card = this.handManager.drawCard();
         if (card) {
             // *** CRITICAL: Set the card's logical faceUp state BEFORE triggering animation ***
             card.setFaceUp(faceUp);

             hand.push(card);
             this.handManager.registerFlipCallback(card);
             const isPlayer = hand === this.blackjackGame.getPlayerHand();
             const target = isPlayer ? 'Player' : 'Dealer';
             // console.log(`Dealing single card ${card.toString()} to ${target} (${faceUp ? 'up' : 'down'})`); // Reduce log noise

             // Trigger visual animation via BlackjackGame -> GameController
             this.blackjackGame.notifyCardDealt(card, hand.length - 1, isPlayer, faceUp);
             // The corresponding completion logic (completePlayerHit, completeDealerHit, etc.)
             // will be called by onAnimationComplete based on the 'lastAction' state.
         } else {
             console.error("Deck is empty when trying to deal single card!");
             const currentAction = this.lastAction; // Store before resetting
             this.lastAction = LastAnimatedAction.None; // Reset action state

             // Attempt to gracefully end the turn if the deck runs out mid-action
             if (currentAction === LastAnimatedAction.DealerHit) this.dealerStand();
             else if (currentAction === LastAnimatedAction.PlayerHit || currentAction === LastAnimatedAction.DoubleDownHit) this.playerStand();
             else this.blackjackGame.notifyAnimationComplete(); // Notify UI update otherwise
         }
    }


    // --- Animation Callback ---
    /** Central handler for when any visual animation completes (deal, flip). Determines the next logical step. */
    public onAnimationComplete(): void {
        const actionJustCompleted = this.lastAction;
        // console.log(`%cGAME ACTIONS: Animation complete for: ${LastAnimatedAction[actionJustCompleted]}`, 'color: orange; font-weight: bold');

        // --- Handle Initial Deal Sequence ---
        if (actionJustCompleted === LastAnimatedAction.InitialDeal) {
            if (this.dealQueue.length > 0) {
                // More cards in the initial sequence, process the next one.
                // Keep lastAction as InitialDeal, processDealQueue will trigger the next animation.
                this.processDealQueue();
                return; // Stop further processing here
            } else {
                // Initial deal sequence is fully complete (all cards dealt and animated).
                this.isDealingInitialSequence = false;
                this.lastAction = LastAnimatedAction.None; // Reset action state
                this.checkInitialBlackjack(); // Now check for Blackjack
                return; // Stop further processing here
            }
        }

        // --- Handle Completion of Specific Actions (Non-Queue) ---
        // Reset lastAction *before* calling the completion logic,
        // allowing the completion logic to potentially start a new action/animation.
        this.lastAction = LastAnimatedAction.None;

        switch (actionJustCompleted) {
            case LastAnimatedAction.PlayerHit:
                this.completePlayerHit();
                break;
            case LastAnimatedAction.DealerHit:
                this.completeDealerHit(); // This might call executeDealerTurn again
                break;
            case LastAnimatedAction.DoubleDownHit:
                this.completeDoubleDown();
                break;
            case LastAnimatedAction.RevealDealerHole:
                // console.log("Dealer hole reveal animation complete."); // Reduce log noise
                if (this._postRevealCallback) {
                    // console.log("Executing post-reveal callback."); // Reduce log noise
                    const callback = this._postRevealCallback;
                    this._postRevealCallback = null; // Clear callback reference
                    // Execute callback async to allow current stack to clear before potentially starting new logic/animation
                    setTimeout(callback, 0);
                } else {
                    console.warn("RevealDealerHole completed but no callback was set.");
                    // If no callback, still notify UI might need update
                    this.blackjackGame.notifyAnimationComplete();
                }
                break;
            case LastAnimatedAction.None:
                 // This might happen if an animation finished but the state was already reset (e.g., rapid actions)
                 // console.log("Animation finished for None action. Notifying UI just in case."); // Reduce log noise
                 this.blackjackGame.notifyAnimationComplete(); // Notify UI might need update
                 break;
            default:
                console.warn(`Unhandled animation completion for action: ${LastAnimatedAction[actionJustCompleted]}`);
                this.blackjackGame.notifyAnimationComplete(); // Notify UI
                break;
        }
    }

    // --- Save/Load ---
    /** Saves the current game state to storage, avoiding saves during initial deal animation. */
    public saveGameState(): void {
        if (this.isDealingInitialSequence) {
            // console.log("Skipping save game state during initial deal sequence."); // Reduce log noise
            return;
        }
        GameStorage.saveGameState(
            this.gameState, this.currentBet, this.gameResult,
            this.blackjackGame.getPlayerHand(), this.blackjackGame.getDealerHand()
        );
    }

    /** Loads game state from storage and restores the game logic. */
    public loadGameState(): boolean {
        const state = GameStorage.loadGameState();
        // Ensure hands are clear before loading and flags are reset
        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);
        this.isDealingInitialSequence = false;
        this.lastAction = LastAnimatedAction.None;
        this._postRevealCallback = null;

        if (!state.gameState) {
            // No active game state found or state was Initial
            GameStorage.clearSavedHands(); // Ensure hands are cleared if state was Initial
            this.setGameState(GameState.Initial);
            this.setGameResult(GameResult.InProgress);
            this.currentBet = 0;
            // Set last bet based on funds, default 10
            const initialFunds = GameStorage.loadFunds(1000);
            this.lastBet = initialFunds >= 10 ? 10 : 0;
            return false; // Indicate no active game was restored
        }

        // Restore active game state
        console.log("%cRestoring game state...", 'color: blue');
        this.gameState = state.gameState; // Already validated by loadGameState
        this.currentBet = state.currentBet!; // Already validated
        this.lastBet = this.currentBet > 0 ? this.currentBet : (GameStorage.loadFunds(1000) >= 10 ? 10 : 0);
        this.gameResult = state.gameResult!; // Already validated

        // Restore hands (existence already validated by loadGameState)
        const restoredPlayerHand = state.playerHand!.map(data => {
            const card = new Card(data.suit, data.rank);
            card.setFaceUp(data.faceUp);
            this.handManager.registerFlipCallback(card); // IMPORTANT: Re-register flip callback
            return card;
        });
        this.blackjackGame.setPlayerHand(restoredPlayerHand);

        const restoredDealerHand = state.dealerHand!.map(data => {
            const card = new Card(data.suit, data.rank);
            card.setFaceUp(data.faceUp);
            this.handManager.registerFlipCallback(card); // IMPORTANT: Re-register flip callback
            return card;
        });
        this.blackjackGame.setDealerHand(restoredDealerHand);

        console.log(`%cGame state restored: ${GameState[this.gameState]}, Bet: ${this.currentBet}`, 'color: blue; font-weight: bold;');
        console.log("Restored Player Hand:", this.blackjackGame.getPlayerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));
        console.log("Restored Dealer Hand:", this.blackjackGame.getDealerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));

        return true; // Indicate active game was restored
    }
}

// src/game/gameactions-ts (Major rewrite for state, async, dealer logic)
import { Card } from "./Card";
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameStorage } from "./GameStorage";
import { BlackjackGame } from "./BlackjackGame"; // Import BlackjackGame

// Enum to track the last action that required an animation
enum LastAnimatedAction {
    None,
    DealCardPlayer,
    DealCardDealer,
    RevealDealerHole,
    InitialDeal,
    PlayerHit,
    DealerHit,
    DoubleDownHit
}


export class GameActions {
    private blackjackGame: BlackjackGame; // Reference to main game logic
    private handManager: HandManager;
    private playerFunds: PlayerFunds;
    private gameState: GameState = GameState.Initial;
    private gameResult: GameResult = GameResult.InProgress;
    private currentBet: number = 0;
    private lastBet: number = 10; // Default starting/re-bet amount

    private lastAction: LastAnimatedAction = LastAnimatedAction.None;
    private dealQueue: { hand: Card[], faceUp: boolean }[] = [];
    private isDealing: boolean = false;


    constructor(blackjackGame: BlackjackGame, handManager: HandManager, playerFunds: PlayerFunds) {
        this.blackjackGame = blackjackGame;
        this.handManager = handManager;
        this.playerFunds = playerFunds;

        // Set the callback in BlackjackGame
        this.blackjackGame.setAnimationCompleteCallback(this.onAnimationComplete.bind(this));
    }

    // --- State Management ---

    public setGameState(state: GameState, forceSave: boolean = false): void {
        if (this.gameState !== state || forceSave) {
            console.log(`Game state changing: ${GameState[this.gameState]} -> ${GameState[state]}`);
            this.gameState = state;
            this.saveGameState(); // Save whenever state changes
            // Trigger UI update indirectly via controller after state change
        }
    }

    public getGameState(): GameState {
        return this.gameState;
    }

     public setGameResult(result: GameResult, forceSave: boolean = false): void {
        if (this.gameResult !== result || forceSave) {
            this.gameResult = result;
            this.saveGameState(); // Save whenever result changes (usually with GameOver state)
        }
    }

    public getGameResult(): GameResult {
        return this.gameResult;
    }

    // --- Bet Management ---

    public getCurrentBet(): number {
        return this.currentBet;
    }

    public setCurrentBet(amount: number): void {
        // Allow setting bet only in Betting or Initial state
        if (this.gameState === GameState.Betting || this.gameState === GameState.Initial) {
             const playerFunds = this.playerFunds.getFunds();
             // Clamp bet between 10 and player funds
             const validAmount = Math.max(10, Math.min(amount, playerFunds));
             if (this.currentBet !== validAmount) {
                 this.currentBet = validAmount;
                 console.log("Current bet set to:", this.currentBet);
                 // Don't save here, save when game starts or state changes
             }
        } else {
             console.warn("Cannot set bet outside of Betting/Initial state.");
        }
    }


    // --- Core Game Flow ---

    public startNewGame(bet: number = this.lastBet): boolean {
        if (this.gameState !== GameState.Betting && this.gameState !== GameState.Initial && this.gameState !== GameState.GameOver) {
            console.error("Cannot start new game from state:", GameState[this.gameState]);
            return false;
        }

        // Ensure bet is valid
        const playerFunds = this.playerFunds.getFunds();
        const validBet = Math.max(10, Math.min(bet, playerFunds));

        if (playerFunds < validBet || validBet < 10) {
            console.error(`Cannot start game. Insufficient funds (${playerFunds}) for bet (${validBet}) or bet too low.`);
            this.setGameState(GameState.Betting); // Go back to betting if funds issue
            return false;
        }

        // Deduct bet
        if (!this.playerFunds.deductFunds(validBet)) {
             console.error("Fund deduction failed unexpectedly.");
             this.setGameState(GameState.Betting);
             return false; // Should not happen if check above passed
        }

        this.currentBet = validBet;
        this.lastBet = validBet; // Remember for next game

        // Reset hands and game result
        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);
        this.setGameResult(GameResult.InProgress);

        // Refresh deck if needed
        this.handManager.refreshDeckIfNeeded();

        // Set state BEFORE dealing starts
        this.setGameState(GameState.PlayerTurn); // Tentative state, might change immediately if Blackjack

        // Queue initial deal animations
        this.queueDeal(this.blackjackGame.getDealerHand(), false); // Dealer 1 (down)
        this.queueDeal(this.blackjackGame.getPlayerHand(), true);  // Player 1 (up)
        this.queueDeal(this.blackjackGame.getDealerHand(), true);  // Dealer 2 (up)
        this.queueDeal(this.blackjackGame.getPlayerHand(), true);  // Player 2 (up)
        this.lastAction = LastAnimatedAction.InitialDeal; // Mark the sequence
        this.processDealQueue(); // Start the dealing process

        console.log(`New game started with bet: ${this.currentBet}`);
        this.saveGameState(); // Save state after starting deal
        return true;
    }

    private checkInitialBlackjack(): void {
         // This is called AFTER initial deal animations complete
         const playerScore = this.blackjackGame.getPlayerScore();
         const dealerFullScore = this.blackjackGame.getDealerFullScore(); // Check dealer's full hand value

         if (playerScore === 21) {
             console.log("Player has Blackjack!");
             // Reveal dealer's hole card visually
             this.requestRevealDealerHoleCard(() => {
                 // This callback runs AFTER the hole card reveal animation (if any)
                 if (dealerFullScore === 21) {
                     console.log("Dealer also has Blackjack! Push.");
                     this.setGameResult(GameResult.Push);
                     this.playerFunds.addFunds(this.currentBet); // Return bet
                 } else {
                     console.log("Player wins with Blackjack!");
                     this.setGameResult(GameResult.PlayerBlackjack);
                     this.playerFunds.addFunds(this.currentBet * 2.5); // Blackjack pays 3:2
                 }
                 this.setGameState(GameState.GameOver);
                 this.blackjackGame.notifyAnimationComplete(); // Notify UI update needed
             });
         } else if (dealerFullScore === 21) {
             // Dealer might have blackjack even if player doesn't
             console.log("Dealer has Blackjack!");
             this.requestRevealDealerHoleCard(() => {
                 this.setGameResult(GameResult.DealerWins);
                 this.setGameState(GameState.GameOver);
                 this.blackjackGame.notifyAnimationComplete(); // Notify UI update needed
             });
         }
         // If neither has blackjack, the game state remains PlayerTurn (set during startNewGame)
         // and the game proceeds normally. Notify completion to potentially enable UI.
         else {
              this.blackjackGame.notifyAnimationComplete();
         }
    }


    public playerHit(): void {
        if (this.gameState !== GameState.PlayerTurn) return;

        console.log("Player hits.");
        this.lastAction = LastAnimatedAction.PlayerHit;
        this.dealCardToHand(this.blackjackGame.getPlayerHand(), true);
        // Check for bust will happen in onAnimationComplete
    }

    private completePlayerHit(): void {
        const playerScore = this.blackjackGame.getPlayerScore();
        console.log("Player score after hit:", playerScore);
        if (playerScore > 21) {
            console.log("Player Bust!");
            this.setGameResult(GameResult.DealerWins);
            // Reveal dealer card before ending game
            this.requestRevealDealerHoleCard(() => {
                 this.setGameState(GameState.GameOver);
                 this.blackjackGame.notifyAnimationComplete(); // Notify UI update
            });
        } else {
             // Player didn't bust, turn continues. Notify completion to re-enable UI.
             this.blackjackGame.notifyAnimationComplete();
        }
        this.saveGameState();
    }

    public playerStand(): void {
        if (this.gameState !== GameState.PlayerTurn) return;

        console.log("Player stands.");
        this.setGameState(GameState.DealerTurn);

        // Reveal dealer's hole card, then start dealer's turn logic
        this.requestRevealDealerHoleCard(() => {
            // This callback runs AFTER the hole card reveal animation (if any)
            console.log("Dealer hole card revealed, starting dealer turn.");
            this.executeDealerTurn(); // Start the dealer's decision process
        });
        this.saveGameState(); // Save state change to DealerTurn
    }


    public doubleDown(): boolean {
        if (this.gameState !== GameState.PlayerTurn || this.blackjackGame.getPlayerHand().length !== 2) {
             console.warn("Cannot double down now.");
            return false;
        }

        // Check funds
        if (this.playerFunds.getFunds() < this.currentBet) {
             console.warn("Insufficient funds to double down.");
            return false;
        }

        console.log("Player doubles down.");
        // Deduct additional bet
        if (!this.playerFunds.deductFunds(this.currentBet)) {
             console.error("Fund deduction failed for double down.");
             return false; // Should not happen
        }

        // Double the bet amount
        this.currentBet *= 2;
        console.log("Bet doubled to:", this.currentBet);

        // Deal one card
        this.lastAction = LastAnimatedAction.DoubleDownHit;
        this.dealCardToHand(this.blackjackGame.getPlayerHand(), true);
        // Stand will happen automatically in onAnimationComplete

        this.saveGameState(); // Save new bet amount
        return true;
    }

     private completeDoubleDown(): void {
         const playerScore = this.blackjackGame.getPlayerScore();
         console.log("Player score after double down hit:", playerScore);
         if (playerScore > 21) {
             console.log("Player Bust on Double Down!");
             this.setGameResult(GameResult.DealerWins);
             // Reveal dealer card before ending game
             this.requestRevealDealerHoleCard(() => {
                 this.setGameState(GameState.GameOver);
                 this.blackjackGame.notifyAnimationComplete(); // Notify UI update
             });
         } else {
             // Player didn't bust, automatically stand and proceed to dealer's turn
             console.log("Double down complete, proceeding to dealer turn.");
             this.setGameState(GameState.DealerTurn);
             this.requestRevealDealerHoleCard(() => {
                 this.executeDealerTurn();
             });
         }
         this.saveGameState();
     }


    // --- Dealer Logic ---

    private requestRevealDealerHoleCard(callback?: () => void): void {
        const dealerHand = this.blackjackGame.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            console.log("Requesting dealer hole card reveal.");
            this.lastAction = LastAnimatedAction.RevealDealerHole;
            // Store the callback to be called on animation completion
            this._postRevealCallback = callback;
            dealerHand[0].flip(); // Trigger the visual update via Card's onFlip
            // The actual callback execution happens in onAnimationComplete
        } else {
            console.log("Dealer hole card already revealed or no card to reveal.");
            // If no reveal needed, execute callback immediately
            if (callback) {
                callback();
            }
        }
    }

    // Temporary storage for the callback after reveal animation
    private _postRevealCallback: (() => void) | null | undefined = null;


    /** Contains the logic for the dealer's turn decision */
    private executeDealerTurn(): void {
        if (this.gameState !== GameState.DealerTurn) return;

        const dealerScore = this.blackjackGame.getDealerFullScore(); // Use full score for decision
        console.log(`Dealer turn. Current score: ${dealerScore}`);

        if (dealerScore < 17) {
            console.log("Dealer hits.");
            this.lastAction = LastAnimatedAction.DealerHit;
            this.dealCardToHand(this.blackjackGame.getDealerHand(), true);
            // Next action (hit again or stand) will be decided in onAnimationComplete
        } else {
            console.log("Dealer stands.");
            this.dealerStand(); // Dealer stands, determine winner
        }
        this.saveGameState(); // Save state in case of mid-turn reload
    }

     private completeDealerHit(): void {
         const dealerScore = this.blackjackGame.getDealerFullScore();
         console.log("Dealer score after hit:", dealerScore);
         if (dealerScore > 21) {
             console.log("Dealer Bust! Player Wins.");
             this.setGameResult(GameResult.PlayerWins);
             this.playerFunds.addFunds(this.currentBet * 2); // Win pays 1:1
             this.setGameState(GameState.GameOver);
             this.blackjackGame.notifyAnimationComplete(); // Notify UI update
         } else {
             // Dealer didn't bust, decide next move
             this.executeDealerTurn();
         }
         this.saveGameState();
     }


    /** Called when dealer score is >= 17 */
    private dealerStand(): void {
        if (this.gameState !== GameState.DealerTurn) return;
        console.log("Dealer stands. Determining winner.");

        const playerScore = this.blackjackGame.getPlayerScore();
        const dealerScore = this.blackjackGame.getDealerFullScore();

        if (dealerScore > 21) {
             // This case should technically be caught by completeDealerHit, but as a fallback
             console.log("Dealer Bust! Player Wins.");
             this.setGameResult(GameResult.PlayerWins);
             this.playerFunds.addFunds(this.currentBet * 2);
        } else if (playerScore > dealerScore) {
            console.log(`Player (${playerScore}) beats Dealer (${dealerScore}). Player Wins!`);
            this.setGameResult(GameResult.PlayerWins);
            this.playerFunds.addFunds(this.currentBet * 2);
        } else if (dealerScore > playerScore) {
            console.log(`Dealer (${dealerScore}) beats Player (${playerScore}). Dealer Wins.`);
            this.setGameResult(GameResult.DealerWins);
            // Player already lost bet on placing it
        } else { // Scores are equal
            console.log(`Player (${playerScore}) and Dealer (${dealerScore}) Push.`);
            this.setGameResult(GameResult.Push);
            this.playerFunds.addFunds(this.currentBet); // Return bet
        }

        this.setGameState(GameState.GameOver);
        this.saveGameState();
        this.blackjackGame.notifyAnimationComplete(); // Notify UI update
    }


    // --- Card Dealing ---

    private queueDeal(hand: Card[], faceUp: boolean): void {
        this.dealQueue.push({ hand, faceUp });
    }

    private processDealQueue(): void {
        if (this.isDealing || this.dealQueue.length === 0) {
            return;
        }

        this.isDealing = true;
        const dealInfo = this.dealQueue.shift()!;
        const card = this.handManager.drawCard();

        if (card) {
            // Add card to logical hand *before* animation
            dealInfo.hand.push(card);
            this.handManager.registerFlipCallback(card); // Ensure callback is set

             // Determine correct LastAnimatedAction based on target hand
             const isPlayer = dealInfo.hand === this.blackjackGame.getPlayerHand();
             if (this.lastAction !== LastAnimatedAction.InitialDeal) { // Don't override InitialDeal sequence
                 this.lastAction = isPlayer ? LastAnimatedAction.DealCardPlayer : LastAnimatedAction.DealCardDealer;
             }

            // Trigger visual deal animation (CardVisualizer will handle faceUp)
            this.blackjackGame.notifyCardDealt(card, dealInfo.hand.length - 1, isPlayer, dealInfo.faceUp);

            // onAnimationComplete will call processDealQueue again
        } else {
            console.error("Deck is empty during deal queue processing!");
            this.isDealing = false;
            // Handle error state?
        }
    }

    /** Deals a single card and triggers animation. Used by Hit/DoubleDown. */
    private dealCardToHand(hand: Card[], faceUp: boolean): void {
         const card = this.handManager.drawCard();
         if (card) {
             hand.push(card);
             this.handManager.registerFlipCallback(card);

             const isPlayer = hand === this.blackjackGame.getPlayerHand();
             // lastAction is set by the calling method (PlayerHit, DealerHit, etc.)
             this.blackjackGame.notifyCardDealt(card, hand.length - 1, isPlayer, faceUp);
             // onAnimationComplete will handle the rest
         } else {
             console.error("Deck is empty when trying to deal single card!");
             // Handle error state? Maybe force stand?
             if (this.gameState === GameState.DealerTurn) this.dealerStand();
             else if (this.gameState === GameState.PlayerTurn) this.playerStand();
         }
    }


    // --- Animation Callback Handler ---

    /** Central handler for logic after animations complete */
    private onAnimationComplete(): void {
        console.log(`Animation complete. Last action: ${LastAnimatedAction[this.lastAction]}, Current state: ${GameState[this.gameState]}`);

        const action = this.lastAction;
        this.lastAction = LastAnimatedAction.None; // Reset last action

         // Handle deal queue processing first
         if (this.isDealing) {
             this.isDealing = false; // Mark current deal animation as finished
             if (this.dealQueue.length > 0) {
                 this.processDealQueue(); // Start next deal in queue
                 return; // Don't process other logic until queue is empty
             }
             // If queue is now empty, fall through to check if it was the InitialDeal
         }


        switch (action) {
            case LastAnimatedAction.InitialDeal:
                 // Check for blackjack only after the *entire* initial deal sequence is done
                 if (!this.isDealing && this.dealQueue.length === 0) {
                     this.checkInitialBlackjack();
                 }
                break;

            case LastAnimatedAction.PlayerHit:
                this.completePlayerHit();
                break;

            case LastAnimatedAction.DealerHit:
                 this.completeDealerHit();
                break;

            case LastAnimatedAction.DoubleDownHit:
                 this.completeDoubleDown();
                break;

             case LastAnimatedAction.RevealDealerHole:
                 console.log("Dealer hole reveal animation complete.");
                 // Execute the stored callback, if any
                 if (this._postRevealCallback) {
                     const callback = this._postRevealCallback;
                     this._postRevealCallback = null; // Clear callback
                     callback(); // Execute it
                 } else {
                      // If no specific callback, just notify general completion
                      this.blackjackGame.notifyAnimationComplete();
                 }
                 break;

             case LastAnimatedAction.DealCardPlayer: // Single card dealt (e.g. during restore or debug)
             case LastAnimatedAction.DealCardDealer:
                 // Usually no specific logic needed after single debug/restore deal, just notify completion
                 this.blackjackGame.notifyAnimationComplete();
                 break;

            case LastAnimatedAction.None:
            default:
                 // If animation finished but wasn't tied to specific game action,
                 // still notify completion for potential UI updates/enabling.
                 console.log("Animation finished for unknown/no action.");
                 this.blackjackGame.notifyAnimationComplete();
                break;
        }
    }


    // --- Save/Load ---

    public saveGameState(): void {
        GameStorage.saveGameState(
            this.gameState,
            this.currentBet,
            this.gameResult,
            this.blackjackGame.getPlayerHand(),
            this.blackjackGame.getDealerHand()
        );
        console.log("Game state saved.");
    }

    public loadGameState(): boolean {
        const state = GameStorage.loadGameState();

        // Clear existing hands before loading - crucial for restore
        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);

        if (!state.gameState || state.gameState === GameState.Initial) {
            console.log("No saved game state found or state is Initial.");
            GameStorage.clearSavedHands(); // Clear potentially stale hand data
            this.setGameState(GameState.Initial); // Ensure state is Initial
            this.setGameResult(GameResult.InProgress);
            this.currentBet = 0;
            this.lastBet = 10;
            return false; // Indicate nothing was loaded
        }

        console.log("Restoring game state...");
        this.gameState = state.gameState; // Set directly, don't trigger saveGameState yet

        this.currentBet = state.currentBet ?? 0; // Use nullish coalescing for default
        this.lastBet = this.currentBet > 0 ? this.currentBet : 10; // Restore last bet if valid

        this.gameResult = state.gameResult ?? GameResult.InProgress;

        // Restore hands
        if (state.playerHand) {
            const restoredPlayerHand = state.playerHand.map(data => {
                const card = new Card(data.suit, data.rank);
                card.setFaceUp(data.faceUp); // Set directly
                this.handManager.registerFlipCallback(card); // Re-register callback
                return card;
            });
            this.blackjackGame.setPlayerHand(restoredPlayerHand);
        }

        if (state.dealerHand) {
            const restoredDealerHand = state.dealerHand.map(data => {
                const card = new Card(data.suit, data.rank);
                card.setFaceUp(data.faceUp); // Set directly
                this.handManager.registerFlipCallback(card); // Re-register callback
                return card;
            });
            this.blackjackGame.setDealerHand(restoredDealerHand);
        }

        console.log(`Game state restored: ${GameState[this.gameState]}, Bet: ${this.currentBet}`);
        console.log("Restored Player Hand:", this.blackjackGame.getPlayerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));
        console.log("Restored Dealer Hand:", this.blackjackGame.getDealerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));

        // Do not save state here, let the calling context handle UI updates etc.
        return true; // Indicate successful load
    }
}

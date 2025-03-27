// src/game/gameactions-ts (Further refined onAnimationComplete for Initial Deal)
import { Card } from "./Card";
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameStorage } from "./GameStorage";
import { BlackjackGame } from "./BlackjackGame";

enum LastAnimatedAction {
    None, DealCardPlayer, DealCardDealer, RevealDealerHole,
    InitialDeal, PlayerHit, DealerHit, DoubleDownHit
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
    private dealQueue: { hand: Card[], faceUp: boolean }[] = [];
    // 'isDealing' now specifically means the initial 4-card deal sequence is active
    private isDealingInitialSequence: boolean = false;
    private _postRevealCallback: (() => void) | null | undefined = null;

    constructor(blackjackGame: BlackjackGame, handManager: HandManager, playerFunds: PlayerFunds) {
        this.blackjackGame = blackjackGame;
        this.handManager = handManager;
        this.playerFunds = playerFunds;
    }

    // --- State ---
    public setGameState(state: GameState, forceSave: boolean = false): void {
        if (this.gameState !== state || forceSave) {
            console.log(`%cGame state changing: ${GameState[this.gameState]} -> ${GameState[state]}`, 'color: orange; font-weight: bold;');
            this.gameState = state;
            this.saveGameState();
        }
    }
    public getGameState(): GameState { return this.gameState; }
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

    public setCurrentBet(amount: number): void {
        if (this.gameState === GameState.Betting || this.gameState === GameState.Initial) {
             const playerFunds = this.playerFunds.getFunds();
             const validAmount = Math.max(10, Math.min(amount, playerFunds));
             if (this.currentBet !== validAmount) {
                 this.currentBet = validAmount;
                 console.log("Current bet set to:", this.currentBet);
             }
        } else {
             console.warn("Cannot set bet outside of Betting/Initial state.");
        }
    }

    // --- Game Flow ---
    public startNewGame(bet: number = this.lastBet): boolean {
        console.log(`%cAttempting to start new game with bet: ${bet}`, 'color: cyan');
        if (this.gameState !== GameState.Betting && this.gameState !== GameState.Initial && this.gameState !== GameState.GameOver) {
            console.error("Cannot start new game from state:", GameState[this.gameState]);
            return false;
        }
        // Prevent starting if already dealing the initial sequence
        if (this.isDealingInitialSequence) {
             console.warn("Cannot start new game while initial deal sequence is in progress.");
             return false;
        }
        const playerFunds = this.playerFunds.getFunds();
        const validBet = Math.max(10, Math.min(bet, playerFunds));
        if (playerFunds < validBet || validBet < 10) {
            console.error(`Cannot start game. Insufficient funds (${playerFunds}) for bet (${validBet}) or bet too low.`);
            this.setGameState(GameState.Betting);
            this.blackjackGame.notifyAnimationComplete();
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
        // Set a temporary state, like Dealing, maybe? Or keep PlayerTurn tentative.
        // Let's keep PlayerTurn tentative.
        this.setGameState(GameState.PlayerTurn);

        this.dealQueue = [];
        this.queueDeal(this.blackjackGame.getDealerHand(), false); // D down
        this.queueDeal(this.blackjackGame.getPlayerHand(), true);  // P up
        this.queueDeal(this.blackjackGame.getDealerHand(), true);  // D up
        this.queueDeal(this.blackjackGame.getPlayerHand(), true);  // P up

        this.lastAction = LastAnimatedAction.InitialDeal;
        this.isDealingInitialSequence = true; // Mark that the initial deal sequence has started

        console.log(`%cStarting initial deal sequence. Queue size: ${this.dealQueue.length}`, 'color: cyan');
        this.processDealQueue(); // Start the first deal animation

        console.log(`New game started logic initiated. Bet: ${this.currentBet}`);
        return true;
    }

    private checkInitialBlackjack(): void {
         console.log("%cChecking for initial Blackjack...", 'color: yellow');
         const playerScore = this.blackjackGame.getPlayerScore();

         if (playerScore === 21) {
             console.log("%cPlayer has Blackjack!", 'color: gold; font-weight: bold;');
             this.requestRevealDealerHoleCard(() => {
                 const dealerFullScore = this.blackjackGame.getDealerFullScore();
                 if (dealerFullScore === 21) {
                     console.log("Dealer also has Blackjack! Push.");
                     this.setGameResult(GameResult.Push);
                     this.playerFunds.addFunds(this.currentBet);
                 } else {
                     console.log("Player wins with Blackjack! (Pays 3:2)");
                     this.setGameResult(GameResult.PlayerBlackjack);
                     this.playerFunds.addFunds(this.currentBet * 2.5);
                 }
                 this.setGameState(GameState.GameOver);
                 this.saveGameState();
                 this.blackjackGame.notifyAnimationComplete(); // Update UI
             });
         }
         else {
              console.log("No player Blackjack. Proceeding to player turn.");
              this.setGameState(GameState.PlayerTurn); // Ensure state is PlayerTurn
              this.saveGameState();
              this.blackjackGame.notifyAnimationComplete(); // Update UI for player turn
         }
    }


    public playerHit(): void {
        if (this.gameState !== GameState.PlayerTurn) {
            console.warn("Cannot hit outside of PlayerTurn");
            return;
        }
        // Prevent action if initial sequence or another animation is running
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) {
             console.warn(`Cannot hit while action/animation (${this.isDealingInitialSequence ? 'InitialDeal' : LastAnimatedAction[this.lastAction]}) is in progress.`);
             return;
        }
        console.log("Player hits.");
        this.lastAction = LastAnimatedAction.PlayerHit;
        this.dealCardToHand(this.blackjackGame.getPlayerHand(), true);
    }

    private completePlayerHit(): void {
        const playerScore = this.blackjackGame.getPlayerScore();
        console.log("Player score after hit:", playerScore);
        if (playerScore > 21) {
            console.log("%cPlayer Bust!", 'color: red; font-weight: bold;');
            this.setGameResult(GameResult.DealerWins);
            this.requestRevealDealerHoleCard(() => {
                 this.setGameState(GameState.GameOver);
                 this.saveGameState();
                 this.blackjackGame.notifyAnimationComplete();
            });
        } else {
             // Player turn continues
             this.saveGameState();
             this.blackjackGame.notifyAnimationComplete(); // Update UI, ready for next action
        }
    }

    public playerStand(): void {
        if (this.gameState !== GameState.PlayerTurn) {
             console.warn("Cannot stand outside of PlayerTurn");
             return;
        }
         // Prevent action if initial sequence or another animation is running
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) {
             console.warn(`Cannot stand while action/animation (${this.isDealingInitialSequence ? 'InitialDeal' : LastAnimatedAction[this.lastAction]}) is in progress.`);
             return;
        }
        console.log("Player stands.");
        this.setGameState(GameState.DealerTurn);
        this.saveGameState();

        this.requestRevealDealerHoleCard(() => {
            console.log("Dealer hole card revealed, starting dealer turn logic.");
            this.executeDealerTurn();
        });
    }

    public doubleDown(): boolean {
        if (this.gameState !== GameState.PlayerTurn || this.blackjackGame.getPlayerHand().length !== 2) {
             console.warn("Cannot double down now."); return false;
        }
        // Prevent action if initial sequence or another animation is running
        if (this.isDealingInitialSequence || this.lastAction !== LastAnimatedAction.None) {
             console.warn(`Cannot double down while action/animation (${this.isDealingInitialSequence ? 'InitialDeal' : LastAnimatedAction[this.lastAction]}) is in progress.`);
             return false;
        }
        if (this.playerFunds.getFunds() < this.currentBet) {
             console.warn("Insufficient funds to double down."); return false;
        }
        console.log("Player doubles down.");
        if (!this.playerFunds.deductFunds(this.currentBet)) {
             console.error("Fund deduction failed for double down."); return false;
        }
        this.currentBet *= 2;
        console.log("Bet doubled to:", this.currentBet);
        this.saveGameState();

        this.lastAction = LastAnimatedAction.DoubleDownHit;
        this.dealCardToHand(this.blackjackGame.getPlayerHand(), true);
        return true;
    }

     private completeDoubleDown(): void {
         const playerScore = this.blackjackGame.getPlayerScore();
         console.log("Player score after double down hit:", playerScore);
         this.saveGameState();

         if (playerScore > 21) {
             console.log("%cPlayer Bust on Double Down!", 'color: red; font-weight: bold;');
             this.setGameResult(GameResult.DealerWins);
             this.requestRevealDealerHoleCard(() => {
                 this.setGameState(GameState.GameOver);
                 this.saveGameState();
                 this.blackjackGame.notifyAnimationComplete();
             });
         } else {
             console.log("Double down complete, proceeding to dealer turn.");
             this.setGameState(GameState.DealerTurn);
             this.saveGameState();
             this.requestRevealDealerHoleCard(() => {
                 this.executeDealerTurn();
             });
         }
     }

    // --- Dealer Logic ---
    private requestRevealDealerHoleCard(callback?: () => void): void {
        const dealerHand = this.blackjackGame.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            console.log("Requesting dealer hole card reveal.");
            // Prevent overlap if already revealing or doing another action
            if (this.lastAction !== LastAnimatedAction.None) {
                 console.warn(`Cannot reveal hole card while action (${LastAnimatedAction[this.lastAction]}) is in progress.`);
                 // Maybe queue the reveal? For now, just block.
                 return;
            }
            this.lastAction = LastAnimatedAction.RevealDealerHole;
            this._postRevealCallback = callback;
            dealerHand[0].flip();
        } else {
            console.log("Dealer hole card already revealed or no card to reveal. Executing callback immediately.");
            if (callback) {
                Promise.resolve().then(callback);
            }
        }
    }

    public executeDealerTurn(): void {
        if (this.gameState !== GameState.DealerTurn) return;
    
        const dealerScore = this.blackjackGame.getDealerFullScore();
        console.log(`%cDEALER TURN - Current Score: ${dealerScore}`, 
                   'color: magenta; font-weight: bold;');
    
        // Dealer must hit until at least 17
        if (dealerScore < 17) {
            console.log("Dealer hits");
            this.lastAction = LastAnimatedAction.DealerHit;
            this.dealCardToHand(this.blackjackGame.getDealerHand(), true);
        } else {
            console.log("Dealer stands");
            this.dealerStand();
        }
    }

     private completeDealerHit(): void {
         const dealerScore = this.blackjackGame.getDealerFullScore();
         console.log("Dealer score after hit animation:", dealerScore);
         this.saveGameState();

         if (dealerScore > 21) {
             console.log("%cDealer Bust! Player Wins.", 'color: lime; font-weight: bold;');
             this.setGameResult(GameResult.PlayerWins);
             this.playerFunds.addFunds(this.currentBet * 2);
             this.setGameState(GameState.GameOver);
             this.saveGameState();
             this.blackjackGame.notifyAnimationComplete();
         } else {
             console.log("Dealer hit complete, deciding next move...");
             // Important: Reset lastAction before calling executeDealerTurn again
             // This allows executeDealerTurn to proceed if it decides to hit again.
             // However, the visual animation needs to finish first.
             // Let onAnimationComplete handle calling executeDealerTurn again.
             // NO - executeDealerTurn should be called here to make the *next* decision.
             this.executeDealerTurn();
         }
     }

    private dealerStand(): void {
        if (this.gameState !== GameState.DealerTurn) {
             console.warn(`dealerStand called in wrong state: ${GameState[this.gameState]}`);
             if (this.gameState === GameState.GameOver) {
                 this.blackjackGame.notifyAnimationComplete();
             }
             return;
        }
        console.log("Dealer stands. Determining winner.");
        const playerScore = this.blackjackGame.getPlayerScore();
        const dealerScore = this.blackjackGame.getDealerFullScore();

        if (playerScore > dealerScore) {
            console.log(`%cPlayer (${playerScore}) beats Dealer (${dealerScore}). Player Wins!`, 'color: lime;');
            this.setGameResult(GameResult.PlayerWins);
            this.playerFunds.addFunds(this.currentBet * 2);
        } else if (dealerScore > playerScore) {
            console.log(`%cDealer (${dealerScore}) beats Player (${playerScore}). Dealer Wins.`, 'color: red;');
            this.setGameResult(GameResult.DealerWins);
        } else {
            console.log(`%cPlayer (${playerScore}) and Dealer (${dealerScore}) Push.`, 'color: yellow;');
            this.setGameResult(GameResult.Push);
            this.playerFunds.addFunds(this.currentBet);
        }

        this.setGameState(GameState.GameOver);
        this.saveGameState();
        this.blackjackGame.notifyAnimationComplete(); // Update UI
    }

    // --- Card Dealing ---
    private queueDeal(hand: Card[], faceUp: boolean): void {
        this.dealQueue.push({ hand, faceUp });
    }

    private processDealQueue(): void {
        if (!this.isDealingInitialSequence) {
            console.error("processDealQueue called outside of initial deal sequence!");
            return;
        }
    
        // Process ONE card from the queue
        if (this.dealQueue.length > 0) {
            const dealInfo = this.dealQueue.shift()!;
            const card = this.handManager.drawCard();
            
            if (!card) {
                console.error("Deck empty during initial deal!");
                this.isDealingInitialSequence = false;
                return;
            }
            
            dealInfo.hand.push(card);
            this.handManager.registerFlipCallback(card);
            const isPlayer = dealInfo.hand === this.blackjackGame.getPlayerHand();
            
            console.log(`%cDealing ${card.toString()} to ${isPlayer ? 'Player' : 'Dealer'} (${dealInfo.faceUp ? 'up' : 'down'})`, 
                       'color: cyan; font-weight: bold;');
            
            // Set lastAction BEFORE starting animation
            this.lastAction = LastAnimatedAction.InitialDeal;
            
            // Trigger visual animation for ONE card
            this.blackjackGame.notifyCardDealt(
                card, 
                dealInfo.hand.length - 1, 
                isPlayer, 
                dealInfo.faceUp
            );
            
            // Next card will be dealt when animation completes
            return;
        }
        
        // If we get here, the queue is empty - all cards have been dealt
        console.log("All cards dealt from queue, completing deal sequence");
        this.isDealingInitialSequence = false;
        this.lastAction = LastAnimatedAction.None;
        this.checkInitialBlackjack();
    }

    // Deals a single card immediately (Hit, Double Down, Dealer Hit)
    private dealCardToHand(hand: Card[], faceUp: boolean): void {
         // Prevent dealing if initial sequence is running
         if (this.isDealingInitialSequence) {
             console.error("Cannot deal single card while initial deal sequence is processing!");
             this.lastAction = LastAnimatedAction.None; // Reset intended action
             return;
         }
         const card = this.handManager.drawCard();
         if (card) {
             hand.push(card);
             this.handManager.registerFlipCallback(card);
             const isPlayer = hand === this.blackjackGame.getPlayerHand();
             const target = isPlayer ? 'Player' : 'Dealer';
             console.log(`Dealing single card ${card.toString()} to ${target} (${faceUp ? 'up' : 'down'})`);

             // Trigger visual animation using the faceUp parameter
             // The 'lastAction' (Hit, DoubleDownHit, DealerHit) is already set by the calling function
             this.blackjackGame.notifyCardDealt(card, hand.length - 1, isPlayer, faceUp);
             // onAnimationComplete will handle the next step based on lastAction
         } else {
             console.error("Deck is empty when trying to deal single card!");
             this.lastAction = LastAnimatedAction.None; // Reset action
             if (this.gameState === GameState.DealerTurn) this.dealerStand();
             else if (this.gameState === GameState.PlayerTurn) this.playerStand();
             else this.blackjackGame.notifyAnimationComplete();
         }
    }


    // --- Animation Callback ---
    public onAnimationComplete(): void {
        const actionJustCompleted = this.lastAction;
        console.log(`%cGAME ACTIONS: Animation complete for: ${LastAnimatedAction[actionJustCompleted]}`, 'color: orange; font-weight: bold');
    
        // --- Handle Initial Deal Sequence ---
        if (actionJustCompleted === LastAnimatedAction.InitialDeal) {
            // Check if there are more cards to deal in the queue
            if (this.dealQueue.length > 0) {
                console.log(`Continuing initial deal sequence. Cards left: ${this.dealQueue.length}`);
                // Don't reset lastAction yet - processDealQueue will set it again
                this.processDealQueue(); // Process the next card
                return; // Stop further processing
            } else {
                // Queue is empty, the initial deal sequence is complete
                console.log("Initial Deal sequence complete - all cards dealt");
                this.isDealingInitialSequence = false;
                this.lastAction = LastAnimatedAction.None;
                this.checkInitialBlackjack();
                return;
            }
        }
    
        // --- Handle Completion of Specific Actions (Non-Queue) ---
        // Reset lastAction *only* after the specific action's logic is done
        switch (actionJustCompleted) {
            // InitialDeal handled above
            case LastAnimatedAction.PlayerHit:
                this.lastAction = LastAnimatedAction.None; // Reset action
                this.completePlayerHit();
                break;
            case LastAnimatedAction.DealerHit:
                this.lastAction = LastAnimatedAction.None; // Reset before potential next hit
                this.completeDealerHit();
                break;
            case LastAnimatedAction.DoubleDownHit:
                this.lastAction = LastAnimatedAction.None; // Reset action
                this.completeDoubleDown();
                break;
            case LastAnimatedAction.RevealDealerHole:
                this.lastAction = LastAnimatedAction.None; // Reset action
                console.log("Dealer hole reveal animation complete.");
                if (this._postRevealCallback) {
                    console.log("Executing post-reveal callback.");
                    const callback = this._postRevealCallback;
                    this._postRevealCallback = null; // Clear callback
                    // Execute callback async to allow current stack to clear
                    setTimeout(callback, 0);
                } else {
                    console.warn("RevealDealerHole completed but no callback was set.");
                    // If no callback, still notify UI might need update
                    this.blackjackGame.notifyAnimationComplete();
                }
                break;
            case LastAnimatedAction.None:
                 // If animation finished but no action was recorded, just notify UI might need update
                console.log("Animation finished for None action. Notifying UI.");
                break;
            default:
                console.warn(`Unhandled animation completion for action: ${LastAnimatedAction[actionJustCompleted]}`);
                this.lastAction = LastAnimatedAction.None; // Reset action defensively
                this.blackjackGame.notifyAnimationComplete(); // Notify UI
                break;
        }
    }

    // --- Save/Load ---
    public saveGameState(): void {
        // Avoid saving during the initial deal animation sequence
        if (this.isDealingInitialSequence) {
            return;
        }
        GameStorage.saveGameState(
            this.gameState, this.currentBet, this.gameResult,
            this.blackjackGame.getPlayerHand(), this.blackjackGame.getDealerHand()
        );
    }
    public loadGameState(): boolean {
        const state = GameStorage.loadGameState();
        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);
        this.isDealingInitialSequence = false; // Ensure flag is reset on load

        if (!state.gameState) {
            console.log("No saved active game state found.");
            GameStorage.clearSavedHands();
            this.setGameState(GameState.Initial);
            this.setGameResult(GameResult.InProgress);
            this.currentBet = 0;
            this.lastBet = GameStorage.loadFunds(1000) >= 10 ? 10 : 0;
            return false;
        }
        
        // Check if we're in Initial state (using type assertion since TypeScript doesn't see it as possible)
        if (state.gameState === (GameState.Initial as GameState)) {
            console.log("Game state is Initial.");
            GameStorage.clearSavedHands();
            this.setGameState(GameState.Initial);
            this.setGameResult(GameResult.InProgress);
            this.currentBet = 0;
            this.lastBet = GameStorage.loadFunds(1000) >= 10 ? 10 : 0;
            return false;
        }

        console.log("%cRestoring game state...", 'color: blue');
        this.gameState = state.gameState;
        this.currentBet = state.currentBet ?? 0;
        this.lastBet = this.currentBet > 0 ? this.currentBet : (GameStorage.loadFunds(1000) >= 10 ? 10 : 0);
        this.gameResult = state.gameResult ?? GameResult.InProgress;

        if (state.playerHand) {
            const restoredPlayerHand = state.playerHand.map(data => {
                const card = new Card(data.suit, data.rank);
                card.setFaceUp(data.faceUp);
                this.handManager.registerFlipCallback(card);
                return card;
            });
            this.blackjackGame.setPlayerHand(restoredPlayerHand);
        } else {
             console.error("Saved state is active but player hand missing!");
             GameStorage.clearAllGameData();
             return this.loadGameState();
        }

        if (state.dealerHand) {
            const restoredDealerHand = state.dealerHand.map(data => {
                const card = new Card(data.suit, data.rank);
                card.setFaceUp(data.faceUp);
                this.handManager.registerFlipCallback(card);
                return card;
            });
            this.blackjackGame.setDealerHand(restoredDealerHand);
        } else {
             console.error("Saved state is active but dealer hand missing!");
             GameStorage.clearAllGameData();
             return this.loadGameState();
        }

        console.log(`%cGame state restored: ${GameState[this.gameState]}, Bet: ${this.currentBet}`, 'color: blue; font-weight: bold;');
        console.log("Restored Player Hand:", this.blackjackGame.getPlayerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));
        console.log("Restored Dealer Hand:", this.blackjackGame.getDealerHand().map(c => c.toString() + (c.isFaceUp() ? '(Up)' : '(Down)')));

        return true;
    }
}

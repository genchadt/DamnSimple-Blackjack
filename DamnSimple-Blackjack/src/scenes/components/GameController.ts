// src/scenes/components/gamecontroller-ts
// Added extensive debug logs to callbacks and requestCardDealAnimation
import { Scene } from "@babylonjs/core";
import { BlackjackGame } from "../../game/BlackjackGame";
import { GameResult, GameState } from "../../game/GameState";
import { GameUI } from "../../ui/GameUI";
import { CardVisualizer } from "./CardVisualizer";
import { Card } from "../../game/Card";

export class GameController {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private gameUI: GameUI;
    private cardVisualizer: CardVisualizer;
    private gameStateRestored: boolean = false;
    // *** FIX: Add flags to prevent re-entrant calls during processing ***
    private isProcessingVisualComplete: boolean = false;
    private isProcessingGameActionComplete: boolean = false;

    constructor(scene: Scene, blackjackGame: BlackjackGame, gameUI: GameUI, cardVisualizer: CardVisualizer) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;
        this.gameUI = gameUI;
        this.cardVisualizer = cardVisualizer;
        this.isProcessingVisualComplete = false; // Initialize flag
        this.isProcessingGameActionComplete = false; // Initialize flag
        console.log("[Controller] Initializing...");

        // --- Setup Callbacks (Revised Order/Logic) ---
        // 1. CardVisualizer animation finishes -> Calls GameController.onVisualAnimationComplete
        this.cardVisualizer.setOnAnimationCompleteCallback(this.onVisualAnimationComplete.bind(this));
        console.log("[Controller] CardVisualizer animation complete callback set.");

        // 2. GameActions logic step finishes -> Calls BlackjackGame.notifyAnimationComplete -> GameController.onGameActionComplete -> GameUI.update
        this.blackjackGame.setAnimationCompleteCallback(this.onGameActionComplete.bind(this));
        console.log("[Controller] BlackjackGame action complete callback set.");

        // 3. GameActions needs to trigger visual dealing -> Calls BlackjackGame.notifyCardDealt -> GameController.requestCardDealAnimation -> CardVisualizer.createCardMesh
        this.blackjackGame.notifyCardDealt = this.requestCardDealAnimation.bind(this);
        console.log("[Controller] BlackjackGame notifyCardDealt override set.");

        // --- Game State Restoration ---
        if (this.blackjackGame.getGameState() !== GameState.Initial) {
            console.log(`%c[Controller] Game state was restored: ${GameState[this.blackjackGame.getGameState()]}`, "color: blue; font-weight: bold;");
            this.gameStateRestored = true;
            // Defer visual setup until scene is ready
            this.scene.executeWhenReady(() => {
                console.log("[Controller] Scene ready, rendering restored cards...");
                // Render cards instantly in their restored positions/states
                this.cardVisualizer.renderCards(true); // Calls CardViz.renderCards with isRestoring=true
                // Update UI to match restored state
                this.update();

                // If restored into DealerTurn, ensure dealer logic continues
                if (this.blackjackGame.getGameState() === GameState.DealerTurn) {
                    console.log("[Controller] Restored into DealerTurn, initiating dealer logic.");
                    const dealerHand = this.blackjackGame.getDealerHand();
                    // Ensure hole card is visually revealed if needed (logic should handle flip)
                    if(dealerHand.length > 0 && !dealerHand[0].isFaceUp()){
                        console.log("[Controller] Restored dealer hole card is face down. Flipping visually (via logical flip).");
                        // Trigger the standard flip which will animate and trigger callbacks
                        // Use a timeout to ensure the scene has rendered the card before flipping
                        setTimeout(() => {
                            console.log("[Controller] Timeout: Calling flip() on restored dealer hole card.");
                            dealerHand[0].flip(); // This triggers visual update via CardViz.updateCardVisual
                            // The dealer logic should resume AFTER the flip animation via the callback chain (onVisualAnimationComplete -> onGameActionComplete -> executeDealerTurn)
                        }, 100); // Small delay for rendering
                    } else {
                        // Hole card already up or no cards, proceed directly
                        console.log("[Controller] Restored dealer hole card is face up or no cards. Executing dealer turn directly.");
                        // Use a small delay to ensure visuals are rendered before logic runs
                        setTimeout(() => {
                            console.log("[Controller] Timeout: Calling executeDealerTurn.");
                            this.blackjackGame.getGameActions().executeDealerTurn();
                        }, 100); // Small delay
                    }
                } else if (this.blackjackGame.getGameState() === GameState.PlayerTurn) {
                     // Check for bust state on restore
                    if (this.blackjackGame.getPlayerScore() > 21) {
                        console.warn("[Controller] Restored into PlayerTurn but player is bust. Setting to GameOver.");
                        this.blackjackGame.getGameActions().setGameResult(GameResult.DealerWins);
                        this.blackjackGame.getGameActions().setGameState(GameState.GameOver, true);
                        this.update(); // Update UI to reflect game over
                    } else {
                        // Ensure UI is updated for player's turn actions
                        console.log("[Controller] Restored into PlayerTurn (not bust). Updating UI.");
                        this.update();
                    }
                } else {
                    // Ensure UI is updated for other states like GameOver or Betting
                     console.log(`[Controller] Restored into state ${GameState[this.blackjackGame.getGameState()]}. Updating UI.`);
                    this.update();
                }
            });
        } else {
            // If starting fresh (Initial state), update UI once
             console.log("[Controller] Starting in Initial state. Performing initial UI update.");
            this.update();
        }
        console.log("[Controller] Initialization complete.");
    }


    // Called by BlackjackGame when GameActions requests a card visual
    private requestCardDealAnimation(card: Card, index: number, isPlayer: boolean, faceUp: boolean): void {
        // *** DEBUG LOG ADDED ***
        const target = isPlayer ? 'Player' : 'Dealer';
        console.log(`%c[Controller] <<< requestCardDealAnimation received: Card=${card.toString()}, Index=${index}, Target=${target}, FaceUp=${faceUp}`, 'color: teal; font-weight: bold;');
        console.log(`%c[Controller]     Calling cardVisualizer.createCardMesh...`, 'color: teal');
        this.cardVisualizer.createCardMesh(card, index, isPlayer, faceUp);
        console.log(`%c[Controller] >>> requestCardDealAnimation finished.`, 'color: teal; font-weight: bold;');
    }

    // Called by CardVisualizer when its animation finishes
    private onVisualAnimationComplete(): void {
        // *** DEBUG LOG ADDED ***
        console.log(`%c[Controller] <<< onVisualAnimationComplete called. isProcessingVisualComplete=${this.isProcessingVisualComplete}`, 'color: green; font-weight: bold;');
        // *** FIX: Add guard against re-entrancy ***
        if (this.isProcessingVisualComplete) {
             console.log("[Controller]     Skipping: Already processing visual complete."); // Reduce log noise
             console.log(`%c[Controller] <<< onVisualAnimationComplete skipped.`, 'color: green; font-weight: bold;');
            return;
        }
        this.isProcessingVisualComplete = true;
        console.log("[Controller]     Processing: Notifying game logic (GameActions.onAnimationComplete)...");

        // This tells GameActions that the visual part it was waiting for (deal, flip) is done.
        this.blackjackGame.getGameActions().onAnimationComplete();

        // DO NOT update UI here directly. Let the game logic completion trigger the UI update.
        this.isProcessingVisualComplete = false; // Reset flag
        console.log("[Controller]     Processing finished. isProcessingVisualComplete = false.");
        console.log(`%c[Controller] <<< onVisualAnimationComplete finished.`, 'color: green; font-weight: bold;');
    }

     // Called by BlackjackGame when GameActions signals its logical step is done
     // (often triggered *by* onVisualAnimationComplete)
    private onGameActionComplete(): void {
        // *** DEBUG LOG ADDED ***
        console.log(`%c[Controller] <<< onGameActionComplete called. isProcessingGameActionComplete=${this.isProcessingGameActionComplete}`, 'color: purple; font-weight: bold;');
        // *** FIX: Add guard against re-entrancy ***
        if (this.isProcessingGameActionComplete) {
            console.log("[Controller]     Skipping: Already processing game action complete."); // Reduce log noise
            console.log(`%c[Controller] <<< onGameActionComplete skipped.`, 'color: purple; font-weight: bold;');
            return;
        }
        this.isProcessingGameActionComplete = true;
        console.log("[Controller]     Processing: Updating UI...");

        // Update UI based on the new game state resulting from the completed action
        this.update();

        this.isProcessingGameActionComplete = false; // Reset flag
        console.log("[Controller]     Processing finished. isProcessingGameActionComplete = false.");
        console.log(`%c[Controller] <<< onGameActionComplete finished.`, 'color: purple; font-weight: bold;');
    }

    // Triggered by UI (e.g., Confirm Bet) via GameUI -> BlackjackGame
    public startNewGame(bet: number = 10): void {
        // This method isn't directly called anymore, GameUI calls blackjackGame.startNewGame
        console.warn("[Controller] startNewGame was called directly. This should be handled via BlackjackGame instance.");
        // this.clearTable(); // Clearing is handled by GameActions/Visualizer as needed
        // const success = this.blackjackGame.startNewGame(bet);
        // this.update();
    }

    // Central UI update function
    public update(): void {
        const animating = this.isAnimating();
        // console.log(`[Controller] Updating UI. Animating: ${animating}. State: ${GameState[this.blackjackGame.getGameState()]}`); // Reduce log noise
        this.gameUI.update(animating); // Pass animation status to UI
        // console.log("[Controller] Update complete."); // Reduce log noise
    }

    // Clears visual elements via CardVisualizer
    public clearTable(): void {
        // console.log("[Controller] Clearing table visuals."); // Reduce log noise
        this.cardVisualizer.clearTable();
    }

    // Checks if CardVisualizer has animations in progress
    public isAnimating(): boolean {
        return this.cardVisualizer.isAnimationInProgress();
    }
}

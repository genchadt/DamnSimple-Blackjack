// src/scenes/components/gamecontroller-ts
// Added extensive debug logs to callbacks and requestCardDealAnimation
// Ensured onGameActionComplete calls GameActions.onAnimationComplete
import { Scene } from "@babylonjs/core";
import { BlackjackGame, HandModificationUpdate } from "../../game/BlackjackGame";
import { GameResult, GameState } from "../../game/GameState";
import { GameUI } from "../../ui/GameUI";
import { CardVisualizer } from "./CardVisualizer";
import { Card } from "../../game/Card";
import { DebugManager } from "../../debug/DebugManager";

export class GameController {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private gameUI: GameUI;
    private cardVisualizer: CardVisualizer;
    private debugManager: DebugManager;
    private gameStateRestored: boolean = false;
    private isProcessingVisualComplete: boolean = false;
    private isProcessingGameActionComplete: boolean = false;

    constructor(scene: Scene, blackjackGame: BlackjackGame, gameUI: GameUI, cardVisualizer: CardVisualizer, debugManager: DebugManager) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;
        this.gameUI = gameUI;
        this.cardVisualizer = cardVisualizer;
        this.debugManager = debugManager;
        this.isProcessingVisualComplete = false;
        this.isProcessingGameActionComplete = false;
        console.log("[Controller] Initializing...");

        // --- Setup Callbacks (Revised Order/Logic) ---
        // 1. CardVisualizer animation finishes -> Calls GameController.onVisualAnimationComplete
        this.cardVisualizer.setOnAnimationCompleteCallback(this.onVisualAnimationComplete.bind(this));
        console.log("[Controller] CardVisualizer animation complete callback set.");

        // 2. GameActions logic step finishes -> Calls BlackjackGame.notifyAnimationComplete -> GameController.onGameActionComplete -> GameUI.update AND GameActions.onAnimationComplete
        this.blackjackGame.setAnimationCompleteCallback(this.onGameActionComplete.bind(this));
        console.log("[Controller] BlackjackGame action complete callback set.");

        // NEW: Set the hand modified callback for instant debug updates
        this.blackjackGame.onHandModified = this.onHandModified.bind(this);
        console.log("[Controller] BlackjackGame onHandModified callback set.");

        // 3. GameActions needs to trigger visual dealing -> Calls BlackjackGame.notifyCardDealt -> GameController.requestCardDealAnimation -> CardVisualizer.createCardMesh
        this.blackjackGame.notifyCardDealt = this.requestCardDealAnimation.bind(this);
        console.log("[Controller] BlackjackGame notifyCardDealt override set.");

        // --- Game State Restoration ---
        if (this.blackjackGame.getGameState() !== GameState.Initial) {
            console.log(`%c[Controller] Game state was restored: ${GameState[this.blackjackGame.getGameState()]}`, "color: blue; font-weight: bold;");
            this.gameStateRestored = true;
            this.scene.executeWhenReady(() => {
                console.log("[Controller] Scene ready, rendering restored cards...");
                this.cardVisualizer.renderCards(true);
                this.update();

                if (this.blackjackGame.getGameState() === GameState.DealerTurn) {
                    console.log("[Controller] Restored into DealerTurn, initiating dealer logic.");
                    const dealerHand = this.blackjackGame.getDealerHand();
                    if(dealerHand.length > 0 && !dealerHand[0].isFaceUp()){
                        console.log("[Controller] Restored dealer hole card is face down. Flipping visually (via logical flip).");
                        setTimeout(() => {
                            console.log("[Controller] Timeout: Calling flip() on restored dealer hole card.");
                            dealerHand[0].flip(); // This will trigger onVisualAnimationComplete -> GameActions.onAnimationComplete
                        }, 100);
                    } else {
                        console.log("[Controller] Restored dealer hole card is face up or no cards. Executing dealer turn directly.");
                        setTimeout(() => {
                            console.log("[Controller] Timeout: Calling executeDealerTurn.");
                            this.blackjackGame.getGameActions().executeDealerTurn(); // This will proceed, and if it hits, will trigger onVisualAnimationComplete
                        }, 100);
                    }
                } else if (this.blackjackGame.getGameState() === GameState.PlayerTurn) {
                    if (this.blackjackGame.getPlayerScore() > 21) {
                        console.warn("[Controller] Restored into PlayerTurn but player is bust. Setting to GameOver.");
                        this.blackjackGame.getGameActions().setGameResult(GameResult.DealerWins);
                        this.blackjackGame.getGameActions().setGameState(GameState.GameOver, true);
                        this.update();
                    } else {
                        console.log("[Controller] Restored into PlayerTurn (not bust). Updating UI.");
                        this.update();
                    }
                } else {
                    console.log(`[Controller] Restored into state ${GameState[this.blackjackGame.getGameState()]}. Updating UI.`);
                    this.update();
                }
            });
        } else {
            console.log("[Controller] Starting in Initial state. Performing initial UI update.");
            this.update();
        }
        console.log("[Controller] Initialization complete.");
    }


    // Called by BlackjackGame when GameActions requests a card visual
    private requestCardDealAnimation(card: Card, index: number, isPlayer: boolean, faceUp: boolean): void {
        const target = isPlayer ? 'Player' : 'Dealer';
        console.log(`%c[Controller] <<< requestCardDealAnimation received: Card=${card.toString()}, Index=${index}, Target=${target}, FaceUp=${faceUp}`, 'color: teal; font-weight: bold;');
        console.log(`%c[Controller]     Calling cardVisualizer.createCardMesh...`, 'color: teal');
        this.cardVisualizer.createCardMesh(card, index, isPlayer, faceUp);
        console.log(`%c[Controller] >>> requestCardDealAnimation finished.`, 'color: teal; font-weight: bold;');
    }

    // Called by CardVisualizer when its animation finishes
    private onVisualAnimationComplete(): void {
        console.log(`%c[Controller] <<< onVisualAnimationComplete called. isProcessingVisualComplete=${this.isProcessingVisualComplete}`, 'color: green; font-weight: bold;');
        if (this.isProcessingVisualComplete) {
            console.log("[Controller]     Skipping: Already processing visual complete.");
            console.log(`%c[Controller] <<< onVisualAnimationComplete skipped.`, 'color: green; font-weight: bold;');
            return;
        }
        this.isProcessingVisualComplete = true;
        console.log("[Controller]     Processing: Notifying game logic (GameActions.onAnimationComplete)...");

        this.blackjackGame.getGameActions().onAnimationComplete();

        this.isProcessingVisualComplete = false;
        console.log("[Controller]     Processing finished. isProcessingVisualComplete = false.");
        console.log(`%c[Controller] <<< onVisualAnimationComplete finished.`, 'color: green; font-weight: bold;');
    }

    /** NEW: Handles the notification that a hand has been logically modified. */
    private onHandModified(update: HandModificationUpdate): void {
        const type = update.type;
        const target = update.isPlayer ? 'Player' : 'Dealer';
        console.log(`%c[Controller] <<< onHandModified called. Type: ${type}, Target: ${target}`, 'color: #FF6347; font-weight: bold;'); // Tomato
        this.debugManager.updateDebugHandDisplay();
    }

    /**
     * Called by BlackjackGame when a logical game action (which might not have a visual animation,
     * e.g., taking insurance, or after a visual animation like a card deal) completes its
     * immediate logical processing in GameActions.
     * This method updates the UI and then notifies GameActions that this phase is complete,
     * allowing GameActions to reset its internal state (like lastAction).
     */
    private onGameActionComplete(): void {
        console.log(`%c[Controller] <<< onGameActionComplete called. isProcessingGameActionComplete=${this.isProcessingGameActionComplete}`, 'color: purple; font-weight: bold;');
        if (this.isProcessingGameActionComplete) {
            console.log("[Controller]     Skipping: Already processing game action complete.");
            console.log(`%c[Controller] <<< onGameActionComplete skipped.`, 'color: purple; font-weight: bold;');
            return;
        }
        this.isProcessingGameActionComplete = true;
        console.log("[Controller]     Processing: Updating UI and then notifying GameActions to finalize its state...");

        this.update(); // Update UI
        this.debugManager.updateDebugHandDisplay(); // Update debug display

        // Notify GameActions that its initiated logical step (or the aftermath of a visual one)
        // has had its UI consequences processed by the controller.
        // This allows GameActions.onAnimationComplete() to run and reset its internal state (e.g., lastAction).
        this.blackjackGame.getGameActions().onAnimationComplete();

        this.isProcessingGameActionComplete = false;
        console.log("[Controller]     Processing finished. isProcessingGameActionComplete = false.");
        console.log(`%c[Controller] <<< onGameActionComplete finished.`, 'color: purple; font-weight: bold;');
    }

    public startNewGame(bet: number = 10): void {
        console.warn("[Controller] startNewGame was called directly. This should be handled via BlackjackGame instance.");
    }

    public update(): void {
        const animating = this.isAnimating();
        this.gameUI.update(animating);
    }

    public clearTable(): void {
        this.cardVisualizer.clearTable();
    }

    public isAnimating(): boolean {
        return this.cardVisualizer.isAnimationInProgress();
    }
}

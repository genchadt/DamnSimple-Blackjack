// src/scenes/components/GameController.ts
// Added extensive debug logs to callbacks and requestCardDealAnimation
// Ensured onGameActionComplete calls GameActions.onAnimationComplete
// Updated for multi-hand card dealing notification
import { Scene } from "@babylonjs/core";
import { BlackjackGame, HandModificationUpdate, PlayerHandInfo } from "../../game/BlackjackGame"; // Import PlayerHandInfo
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
                this.cardVisualizer.renderCards(true); // True to indicate restoration
                this.update(); // Update UI based on restored state

                // If restored into a state that requires immediate action (e.g., dealer's turn)
                const currentGameState = this.blackjackGame.getGameState();
                if (currentGameState === GameState.DealerTurn) {
                    console.log("[Controller] Restored into DealerTurn, initiating dealer logic.");
                    const dealerHand = this.blackjackGame.getDealerHand();
                    if(dealerHand.length > 0 && !dealerHand[0].isFaceUp()){
                        console.log("[Controller] Restored dealer hole card is face down. Flipping visually (via logical flip).");
                        // Delay slightly to ensure visuals are set up from renderCards
                        setTimeout(() => {
                            console.log("[Controller] Timeout: Calling flip() on restored dealer hole card.");
                            dealerHand[0].flip(); // This will trigger onVisualAnimationComplete -> GameActions.onAnimationComplete -> executeDealerTurn
                        }, 100);
                    } else {
                        console.log("[Controller] Restored dealer hole card is face up or no cards. Executing dealer turn directly.");
                        setTimeout(() => {
                            console.log("[Controller] Timeout: Calling executeDealerTurn.");
                            this.blackjackGame.getGameActions().executeDealerTurn();
                        }, 100);
                    }
                } else if (currentGameState === GameState.PlayerTurn) {
                    const activeHand = this.blackjackGame.getActivePlayerHandInfo();
                    if (activeHand && this.blackjackGame.getPlayerScore() > 21 && !activeHand.isResolved) {
                        console.warn("[Controller] Restored into PlayerTurn but active hand is bust and not resolved. Resolving now.");
                        // This state should ideally be resolved by GameActions load, but as a fallback:
                        activeHand.isResolved = true;
                        activeHand.result = GameResult.DealerWins;
                        this.blackjackGame.getGameActions().proceedToNextActionOrEndGame(); // GameActions method
                        this.update();
                    } else {
                        console.log("[Controller] Restored into PlayerTurn. UI updated.");
                    }
                } else {
                    console.log(`[Controller] Restored into state ${GameState[currentGameState]}. UI updated.`);
                }
            });
        } else {
            console.log("[Controller] Starting in Initial state. Performing initial UI update.");
            this.update();
        }
        console.log("[Controller] Initialization complete.");
    }


    // Called by BlackjackGame when GameActions requests a card visual
    private requestCardDealAnimation(card: Card, indexInHand: number, isPlayer: boolean, handDisplayIndex: number, faceUp: boolean): void {
        const targetDesc = isPlayer ? `Player Hand ${handDisplayIndex}` : 'Dealer';
        console.log(`%c[Controller] <<< requestCardDealAnimation received: Card=${card.toString()}, IndexInHand=${indexInHand}, Target=${targetDesc}, FaceUp=${faceUp}`, 'color: teal; font-weight: bold;');
        console.log(`%c[Controller]     Calling cardVisualizer.createCardMesh...`, 'color: teal');
        this.cardVisualizer.createCardMesh(card, indexInHand, isPlayer, handDisplayIndex, faceUp);
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

        // This is the primary path for GameActions to process the end of a visual animation
        this.blackjackGame.getGameActions().onAnimationComplete();

        this.isProcessingVisualComplete = false;
        console.log("[Controller]     Processing finished. isProcessingVisualComplete = false.");
        console.log(`%c[Controller] <<< onVisualAnimationComplete finished.`, 'color: green; font-weight: bold;');
    }

    /** Handles the notification that a hand has been logically modified. */
    private onHandModified(update: HandModificationUpdate): void {
        const type = update.type;
        const target = update.isPlayer ? `Player Hand ${update.handIndex}` : 'Dealer';
        console.log(`%c[Controller] <<< onHandModified called. Type: ${type}, Target: ${target}`, 'color: #FF6347; font-weight: bold;'); // Tomato

        // If a split occurred, we need to tell CardVisualizer to re-render to show the new hand structure.
        // A more sophisticated approach would be specific animations for the split card moving.
        // For now, a full re-render will place cards correctly.
        if (update.type === 'split' || (update.type === 'set' && update.isPlayer)) {
            console.log(`%c[Controller]     Hand modification type '${update.type}' on player hand. Requesting CardVisualizer.renderCards().`, 'color: #FF6347;');
            this.cardVisualizer.renderCards(false); // false because it's not a full game state restoration
        }

        this.debugManager.updateDebugHandDisplay(); // Update debug display regardless
        this.update(); // Update main UI
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
        console.log("[Controller]     Processing: Updating UI and debug displays...");

        this.update(); // Update UI
        this.debugManager.updateDebugHandDisplay(); // Update debug display

        // DO NOT call this.blackjackGame.getGameActions().onAnimationComplete(); here.
        // GameActions.onAnimationComplete() is primarily triggered by onVisualAnimationComplete
        // or by GameActions itself if it needs to signal a purely logical state finalization.
        // If GameActions initiated this onGameActionComplete (e.g. after a non-visual logical step),
        // it means GameActions has already run its onAnimationComplete or equivalent logic for that step.

        const currentGameState = this.blackjackGame.getGameState();
        // If we've entered a state where cards should definitely be laid out and stable:
        if (currentGameState === GameState.PlayerTurn ||
            currentGameState === GameState.DealerTurn ||
            currentGameState === GameState.GameOver) {

            // Check if CardVisualizer thinks an animation is running.
            if (!this.cardVisualizer.isAnimationInProgress()) {
                console.log(`%c[Controller] onGameActionComplete: Requesting renderCards for state ${GameState[currentGameState]} as no major animation is in progress.`, 'color: purple');
                this.cardVisualizer.renderCards(false); // false = not restoring from save
            } else {
                console.log(`%c[Controller] onGameActionComplete: Skipping renderCards for state ${GameState[currentGameState]} due to CardVisualizer.isAnimationInProgress() being true. Will attempt after a short delay.`, 'color: purple');
                // If an animation is still flagged, it might be the very tail end of the last deal animation.
                // A small delay can help ensure it's truly finished before re-rendering.
                setTimeout(() => {
                    if (!this.cardVisualizer.isAnimationInProgress()) {
                        console.log(`%c[Controller] onGameActionComplete (delayed): Requesting renderCards for state ${GameState[currentGameState]}.`, 'color: purple');
                        this.cardVisualizer.renderCards(false);
                    } else {
                        console.warn(`%c[Controller] onGameActionComplete (delayed): renderCards still skipped for state ${GameState[currentGameState]} as animation is STILL in progress.`, 'color: orange');
                    }
                }, 100); // 100ms delay, adjust if needed
            }
        }


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
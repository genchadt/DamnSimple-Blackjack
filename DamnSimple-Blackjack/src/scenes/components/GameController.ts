// src/scenes/components/gamecontroller-ts (Major rewrite for async flow)
import { Scene } from "@babylonjs/core";
import { BlackjackGame } from "../../game/BlackjackGame";
import { GameState } from "../../game/GameState";
import { GameUI } from "../../ui/GameUI";
import { CardVisualizer } from "./CardVisualizer";
import { Card } from "../../game/Card"; // Import Card

export class GameController {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private gameUI: GameUI;
    private cardVisualizer: CardVisualizer;
    private gameStateRestored: boolean = false;
    private isProcessingAnimationComplete: boolean = false; // Prevent re-entrancy


    constructor(scene: Scene, blackjackGame: BlackjackGame, gameUI: GameUI, cardVisualizer: CardVisualizer) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;
        this.gameUI = gameUI;
        this.cardVisualizer = cardVisualizer;

        // Link game logic back to controller for animation completion
        this.blackjackGame.setAnimationCompleteCallback(this.onGameActionComplete.bind(this));
        // Link visualizer animation completion to controller
        this.cardVisualizer.setOnAnimationCompleteCallback(this.onVisualAnimationComplete.bind(this));
         // Link card deal requests from GameActions to CardVisualizer
         this.blackjackGame.notifyCardDealt = this.requestCardDealAnimation.bind(this);


        // Setup game state monitoring (optional, UI update might be sufficient)
        // this.setupGameStateMonitoring(); // Can be simplified if UI update handles everything

        // Check if we need to restore a game in progress
        if (this.blackjackGame.getGameState() !== GameState.Initial) {
            console.log("Game state was restored:", GameState[this.blackjackGame.getGameState()]);
            this.gameStateRestored = true;
            // Render the cards for the restored game AFTER scene is ready
            this.scene.executeWhenReady(() => {
                console.log("Scene ready, rendering restored cards...");
                this.cardVisualizer.renderCards(true); // Pass true to indicate restoration
                this.update(); // Update UI based on restored state
                 // If restored into DealerTurn, start the dealer logic
                 if (this.blackjackGame.getGameState() === GameState.DealerTurn) {
                     console.log("Restored into DealerTurn, initiating dealer logic.");
                     // Ensure hole card is visually revealed if needed
                     const dealerHand = this.blackjackGame.getDealerHand();
                     if(dealerHand.length > 0 && !dealerHand[0].isFaceUp()){
                         // If hole card is down, flip it visually without animation delay logic for restore
                         dealerHand[0].flip();
                     }
                     this.blackjackGame.getGameActions().executeDealerTurn();
                 }
            });
        } else {
             this.update(); // Initial UI update even if not restored
        }
    }

    /**
     * Called by GameActions when a card needs to be dealt visually.
     */
    private requestCardDealAnimation(card: Card, index: number, isPlayer: boolean, faceUp: boolean): void {
         console.log(`Controller: Requesting deal animation for ${card.toString()} to ${isPlayer ? 'Player' : 'Dealer'} index ${index}, faceUp: ${faceUp}`);
         // CardVisualizer creates the mesh and starts the animation.
         // It will call onVisualAnimationComplete when done.
         this.cardVisualizer.createCardMesh(card, index, isPlayer, faceUp);
    }


    /**
     * Callback triggered by CardVisualizer when ANY visual animation completes.
     */
    private onVisualAnimationComplete(): void {
        console.log("Controller: Visual animation complete.");
        // Notify the core game logic that an animation finished.
        // The game logic (GameActions) will decide what to do next based on the game state
        // and the last action performed.
        this.blackjackGame.getGameActions().onAnimationComplete();
    }

    /**
     * Callback triggered by GameActions AFTER it has processed the completion
     * of a game logic step that followed an animation.
     * This is primarily used to update the UI.
     */
     private onGameActionComplete(): void {
         if (this.isProcessingAnimationComplete) return; // Avoid loops
         this.isProcessingAnimationComplete = true;

         console.log("Controller: Game action complete notification received. Updating UI.");
         this.update(); // Update UI to reflect any state changes

         // If the game is now in DealerTurn (e.g., after player stands or double down),
         // and no animation is currently running (important check!), trigger the dealer's first move.
         // Note: Subsequent dealer moves are triggered recursively within GameActions via onAnimationComplete.
         // This check might be redundant if playerStand/completeDoubleDown correctly call executeDealerTurn.
         // Let's rely on GameActions triggering the first executeDealerTurn.
         /*
         if (this.blackjackGame.getGameState() === GameState.DealerTurn && !this.isAnimating()) {
             console.log("Controller: State is DealerTurn after action, ensuring dealer turn executes.");
             // Small delay might be needed if state changes rapidly? Test without first.
             // setTimeout(() => {
                  this.blackjackGame.getGameActions().executeDealerTurn();
             // }, 100); // Short delay
         }
         */

         this.isProcessingAnimationComplete = false;
     }


    /**
     * Starts a new game with the specified bet amount.
     */
    public startNewGame(bet: number = 10): void {
        console.log("Controller: Starting new game request...");
        // 1. Clear the table visually
        this.clearTable();

        // 2. Start the game logic (deducts bet, resets hands, queues initial deal)
        const success = this.blackjackGame.startNewGame(bet);

        // 3. Update UI immediately (shows bet, funds, initial state before cards land)
        this.update();

        // Card rendering happens automatically as GameActions calls notifyCardDealt -> requestCardDealAnimation
    }

    /**
     * Updates the game UI and potentially triggers game logic based on state.
     * Primarily responsible for keeping the UI in sync.
     */
    public update(): void {
        // Always update the UI based on the current game state
        this.gameUI.update(this.isAnimating());

        // Re-render cards? Usually not needed here as renderCards is called on demand
        // or during initial deal/restore. Might need repositioning if hand sizes change drastically outside deal flow.
        // this.cardVisualizer.repositionCards(true);
        // this.cardVisualizer.repositionCards(false);

        console.log("Controller: Update complete. Current State:", GameState[this.blackjackGame.getGameState()]);
    }

    /**
     * Clears the game table visually.
     */
    public clearTable(): void {
        console.log("Controller: Clearing table visuals.");
        this.cardVisualizer.clearTable();
    }

    /**
     * Checks if any card animation is currently in progress.
     * @returns {boolean} True if an animation is running, false otherwise.
     */
    public isAnimating(): boolean {
        return this.cardVisualizer.isAnimationInProgress();
    }

    // Remove setupGameStateMonitoring polling logic
    // Remove processDealerTurn logic (handled by GameActions.executeDealerTurn triggered by callbacks)
}

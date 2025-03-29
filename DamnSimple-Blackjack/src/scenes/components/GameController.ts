// src/scenes/components/gamecontroller-ts (Add re-entrancy guards)
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

        // --- Setup Callbacks (Revised Order/Logic) ---
        // 1. CardVisualizer animation finishes -> Calls GameController.onVisualAnimationComplete
        this.cardVisualizer.setOnAnimationCompleteCallback(this.onVisualAnimationComplete.bind(this));

        // 2. GameActions logic step finishes -> Calls BlackjackGame.notifyAnimationComplete -> GameController.onGameActionComplete -> GameUI.update
        this.blackjackGame.setAnimationCompleteCallback(this.onGameActionComplete.bind(this));

        // 3. GameActions needs to trigger visual dealing -> Calls BlackjackGame.notifyCardDealt -> GameController.requestCardDealAnimation -> CardVisualizer.createCardMesh
        this.blackjackGame.notifyCardDealt = this.requestCardDealAnimation.bind(this);

        // --- Game State Restoration ---
        if (this.blackjackGame.getGameState() !== GameState.Initial) {
            console.log("%cGame state was restored: %s", "color: blue; font-weight: bold;", GameState[this.blackjackGame.getGameState()]);
            this.gameStateRestored = true;
            // Defer visual setup until scene is ready
            this.scene.executeWhenReady(() => {
                console.log("Scene ready, rendering restored cards...");
                // Render cards instantly in their restored positions/states
                this.cardVisualizer.renderCards(true);
                // Update UI to match restored state
                this.update();

                // If restored into DealerTurn, ensure dealer logic continues
                if (this.blackjackGame.getGameState() === GameState.DealerTurn) {
                    console.log("Restored into DealerTurn, initiating dealer logic.");
                    const dealerHand = this.blackjackGame.getDealerHand();
                    // Ensure hole card is visually revealed if needed (logic should handle flip)
                    if(dealerHand.length > 0 && !dealerHand[0].isFaceUp()){
                        console.log("Restored dealer hole card is face down. Flipping visually.");
                        // Trigger the standard flip which will animate and trigger callbacks
                        // Use a timeout to ensure the scene has rendered the card before flipping
                        setTimeout(() => {
                            dealerHand[0].flip();
                            // The dealer logic should resume AFTER the flip animation via the callback chain
                        }, 100); // Small delay for rendering
                    } else {
                        // Hole card already up or no cards, proceed directly
                        console.log("Restored dealer hole card is face up or no cards. Executing dealer turn.");
                        // Use a small delay to ensure visuals are rendered before logic runs
                        setTimeout(() => {
                            this.blackjackGame.getGameActions().executeDealerTurn();
                        }, 100); // Small delay
                    }
                } else if (this.blackjackGame.getGameState() === GameState.PlayerTurn) {
                     // Check for bust state on restore
                    if (this.blackjackGame.getPlayerScore() > 21) {
                        console.warn("Restored into PlayerTurn but player is bust. Setting to GameOver.");
                        this.blackjackGame.getGameActions().setGameResult(GameResult.DealerWins);
                        this.blackjackGame.getGameActions().setGameState(GameState.GameOver, true);
                        this.update(); // Update UI to reflect game over
                    } else {
                        // Ensure UI is updated for player's turn actions
                        this.update();
                    }
                } else {
                    // Ensure UI is updated for other states like GameOver or Betting
                    this.update();
                }
            });
        } else {
            // If starting fresh (Initial state), update UI once
            this.update();
        }
    }


    // Called by BlackjackGame when GameActions requests a card visual
    private requestCardDealAnimation(card: Card, index: number, isPlayer: boolean, faceUp: boolean): void {
        // console.log(`%cCONTROLLER: Requesting deal animation: ${card.toString()} to ${isPlayer ? 'Player' : 'Dealer'} idx ${index}, faceUp: ${faceUp}`, 'color: teal');
        this.cardVisualizer.createCardMesh(card, index, isPlayer, faceUp);
    }

    // Called by CardVisualizer when its animation finishes
    private onVisualAnimationComplete(): void {
        // *** FIX: Add guard against re-entrancy ***
        if (this.isProcessingVisualComplete) {
             // console.log("CONTROLLER: Already processing visual complete. Skipping."); // Reduce log noise
            return;
        }
        this.isProcessingVisualComplete = true;
        // console.log("%cCONTROLLER: Visual animation complete. Notifying game logic.", 'color: green');

        // This tells GameActions that the visual part it was waiting for (deal, flip) is done.
        this.blackjackGame.getGameActions().onAnimationComplete();

        // DO NOT update UI here directly. Let the game logic completion trigger the UI update.
        this.isProcessingVisualComplete = false; // Reset flag
    }

     // Called by BlackjackGame when GameActions signals its logical step is done
     // (often triggered *by* onVisualAnimationComplete)
    private onGameActionComplete(): void {
        // *** FIX: Add guard against re-entrancy ***
        if (this.isProcessingGameActionComplete) {
            // console.log("CONTROLLER: Already processing game action complete. Skipping update."); // Reduce log noise
            return;
        }
        this.isProcessingGameActionComplete = true;
        // console.log("%cCONTROLLER: Game logic step complete. Updating UI.", 'color: purple');

        // Update UI based on the new game state resulting from the completed action
        this.update();

        this.isProcessingGameActionComplete = false; // Reset flag
    }

    // Triggered by UI (e.g., Confirm Bet) via GameUI -> BlackjackGame
    public startNewGame(bet: number = 10): void {
        // This method isn't directly called anymore, GameUI calls blackjackGame.startNewGame
        console.warn("CONTROLLER: startNewGame was called directly. This should be handled via BlackjackGame instance.");
        // this.clearTable(); // Clearing is handled by GameActions/Visualizer as needed
        // const success = this.blackjackGame.startNewGame(bet);
        // this.update();
    }

    // Central UI update function
    public update(): void {
        const animating = this.isAnimating();
        // console.log(`CONTROLLER: Updating UI. Animating: ${animating}. State: ${GameState[this.blackjackGame.getGameState()]}`);
        this.gameUI.update(animating); // Pass animation status to UI
        // console.log("CONTROLLER: Update complete.");
    }

    // Clears visual elements via CardVisualizer
    public clearTable(): void {
        // console.log("CONTROLLER: Clearing table visuals."); // Reduce log noise
        this.cardVisualizer.clearTable();
    }

    // Checks if CardVisualizer has animations in progress
    public isAnimating(): boolean {
        return this.cardVisualizer.isAnimationInProgress();
    }
}

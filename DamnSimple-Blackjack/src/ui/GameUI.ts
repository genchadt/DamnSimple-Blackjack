// src/ui/gameui-ts
// Added debug logs to handlers
import { Scene } from "@babylonjs/core";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState } from "../game/GameState";
import { BettingUI } from "./BettingUI";
import { GameActionUI } from "./GameActionUI";
import { StatusUI } from "./StatusUI";
import { NavigationUI } from "./NavigationUI";

export class GameUI {
    private scene: Scene;
    private game: BlackjackGame;
    private bettingUI: BettingUI;
    private gameActionUI: GameActionUI;
    private statusUI: StatusUI;
    private navigationUI: NavigationUI;

    private onOpenSettings: () => void;
    /** Callback to GameController/GameScene to request clearing visual elements (cards). */
    private onClearTableRequest: () => void;

    private currencySign: string = "$"; // Default currency sign

    constructor(
        scene: Scene,
        game: BlackjackGame,
        onOpenSettings: () => void,
        onClearTableRequest: () => void // Callback to clear visuals
    ) {
        this.scene = scene;
        this.game = game;
        this.onOpenSettings = onOpenSettings;
        this.onClearTableRequest = onClearTableRequest; // Store the callback
        console.log("[GameUI] Initializing...");

        // Initialize UI components
        // Status and Navigation are generally always present
        this.statusUI = new StatusUI(scene, game);
        this.navigationUI = new NavigationUI(
            scene, game,
            this.onSitDown.bind(this),       // Handler for "Sit Down" button
            this.onLeaveTable.bind(this),    // Handler for "Leave Table" button
            this.onNewGameRequest.bind(this),// Handler for "Same Bet" (passed to GameActionUI)
            this.onOpenSettings              // Handler for Settings button
        );
        // Betting and Game Actions are context-dependent
        this.bettingUI = new BettingUI(scene, game, this.onConfirmBet.bind(this)); // Handler for "Confirm Bet"
        // Pass the "Same Bet" handler to GameActionUI for the repurposed button in GameOver state
        this.gameActionUI = new GameActionUI(scene, game, this.onNewGameRequest.bind(this));

        console.log("[GameUI] Initialized");
        this.update(); // Perform initial UI setup based on loaded game state
    }

    // --- UI Action Handlers ---

    /** Handles the "Sit Down" action from NavigationUI. */
    private onSitDown(): void {
        console.log("[GameUI] === Sit Down action triggered ===");
        // Sitting down transitions the game logic to the Betting state
        this.game.getGameActions().setGameState(GameState.Betting);
        this.update(); // Update UI immediately to show betting panel etc.
    }

    /** Handles the "Confirm Bet" action from BettingUI. */
    private onConfirmBet(bet: number): void {
        console.log(`[GameUI] === Confirm Bet action triggered. Bet: ${bet} ===`);
        // 1. Request visual table clear via the callback to GameController/Scene
        console.log("[GameUI]   -> Requesting table clear...");
        this.onClearTableRequest();
        // 2. Attempt to start the game logic with the confirmed bet
        //    This will handle fund deduction and initial card dealing logic.
        console.log("[GameUI]   -> Calling game.startNewGame...");
        const success = this.game.startNewGame(bet);
        // 3. Update UI based on whether the game start was initiated
        if (success) {
            console.log("[GameUI]   -> game.startNewGame returned true. Performing immediate UI update.");
            // If successful, game logic proceeds, and subsequent UI updates
            // will happen via the animation complete callback chain.
            // An immediate update here can hide the betting UI faster.
            this.update();
        } else {
            // If starting failed (e.g., insufficient funds after final check),
            // update the UI to reflect the current state (likely still Betting).
            console.error("[GameUI]   -> game.startNewGame returned false. Performing UI update.");
            this.update(); // Refresh UI (might show error or just betting panel again)
        }
    }

    /** Handles the "Leave Table" action from NavigationUI. */
    private onLeaveTable(): void {
        console.log("[GameUI] === Leave Table action triggered ===");
        const currentState = this.game.getGameState();
        // Allow leaving only if not in the middle of an active turn (Player or Dealer)
        if (currentState === GameState.Betting || currentState === GameState.GameOver || currentState === GameState.Initial) {
             console.log("[GameUI]   -> Setting game state to Initial.");
            this.game.getGameActions().setGameState(GameState.Initial); // Revert logic to initial state
            this.game.setCurrentBet(0); // Reset logical bet
            console.log("[GameUI]   -> Requesting table clear.");
            this.onClearTableRequest(); // Clear visual cards
            this.update(); // Update UI to show "Sit Down" button, hide others
        } else {
            console.warn(`[GameUI] Cannot leave table during active player/dealer turn (State: ${GameState[currentState]}).`);
            // Optionally provide user feedback here (e.g., temporary message)
        }
    }

    /**
     * Handles the request to start a new game using the previous bet amount.
     * Triggered by the repurposed "Hit" button ("Same Bet") in the GameOver state via GameActionUI.
     */
    private onNewGameRequest(): void {
        console.log("[GameUI] === New Game request action (Same Bet) triggered ===");

        // Ensure this action is only valid from GameOver state
        if (this.game.getGameState() !== GameState.GameOver) {
            console.warn(`[GameUI] New Game request ignored: Not in GameOver state (State: ${GameState[this.game.getGameState()]}).`);
            return;
        }

        // Get the last bet amount stored in GameActions
        const lastBet = this.game.getGameActions().getLastBet();
        console.log(`[GameUI]   -> Attempting to use last bet amount: ${lastBet}`);

        // Perform similar actions as confirming a bet, but use the lastBet value
        console.log("[GameUI]   -> Requesting table clear...");
        this.onClearTableRequest(); // Clear visuals first
        console.log("[GameUI]   -> Calling game.startNewGame with last bet...");
        const success = this.game.startNewGame(lastBet); // Start logic with lastBet

        if (success) {
            console.log("[GameUI]   -> game.startNewGame returned true. Performing immediate UI update.");
            // Game logic will proceed, UI updates follow via animation chain.
            // Immediate update hides GameOver buttons faster.
            this.update();
        } else {
            // If starting failed (e.g., funds became insufficient somehow?),
            // switch to Betting state so user can place a valid bet.
            console.error("[GameUI]   -> game.startNewGame returned false. Switching to Betting state.");
            this.game.getGameActions().setGameState(GameState.Betting);
            this.update(); // Update UI to show betting panel
        }
    }

    // --- Other Methods ---

    /** Sets the currency sign used across relevant UI components. */
    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        // Propagate the change to sub-UIs that display currency
        this.statusUI.setCurrencySign(sign);
        this.bettingUI.setCurrencySign(sign);
        // Update immediately to show the change
        this.update(); // Trigger a general update which calls update on sub-UIs
    }

    /**
     * Central update function for the entire Game UI.
     * Calls update on all sub-UI components, passing the animation status.
     * @param isAnimating Flag indicating if a visual animation (deal, flip) is in progress.
     */
    public update(isAnimating: boolean = false): void {
        // console.log(`[GameUI] Update called. Animating: ${isAnimating}`); // Reduce log noise
        // Update all UI components. Order can matter for visibility/layering if complex.
        this.statusUI.update(); // Always update status (scores, funds, messages)
        this.navigationUI.update(); // Update nav buttons (Sit/Leave/Settings visibility/state)
        this.bettingUI.update(); // Update betting panel (shows/hides/updates based on state)
        // Pass animation state to GameActionUI so it can disable buttons during animations
        this.gameActionUI.update(isAnimating);
    }

     /** Disposes all UI elements managed by GameUI. */
     public dispose(): void {
         console.log("[GameUI] Disposing GameUI elements");
         // Call dispose on each sub-UI component
         this.statusUI?.dispose();
         this.navigationUI?.dispose();
         this.bettingUI?.dispose();
         this.gameActionUI?.dispose();
         // Nullify references if strict cleanup is needed, though JS garbage collection handles it
         // this.statusUI = null; this.navigationUI = null; etc.
     }
}

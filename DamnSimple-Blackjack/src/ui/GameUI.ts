// src/ui/gameui-ts (Coordinates sub-UIs, handles callbacks)
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

    // Callbacks provided by GameScene/Game
    private onOpenSettings: () => void;
    private onClearTableRequest: () => void; // Renamed for clarity

    private currencySign: string = "$";

    constructor(
        scene: Scene,
        game: BlackjackGame,
        onOpenSettings: () => void,
        onClearTableRequest: () => void
    ) {
        this.scene = scene;
        this.game = game;
        this.onOpenSettings = onOpenSettings;
        this.onClearTableRequest = onClearTableRequest;

        // Create UI components in logical order
        this.statusUI = new StatusUI(scene, game);
        this.navigationUI = new NavigationUI(
            scene, game,
            this.onSitDown.bind(this),      // Handle Sit Down
            this.onLeaveTable.bind(this),   // Handle Leave Table
            this.onNewGameRequest.bind(this),// Handle New Game (from GameOver state)
            this.onOpenSettings           // Pass through Open Settings
        );
        this.bettingUI = new BettingUI(scene, game, this.onConfirmBet.bind(this)); // Handle Confirm Bet
        this.gameActionUI = new GameActionUI(scene, game, this.update.bind(this)); // Pass general update callback

        console.log("GameUI Initialized");
        this.update(); // Initial UI sync
    }

    /** Called by NavigationUI when "Sit Down" is clicked */
    private onSitDown(): void {
        console.log("UI: Sit Down action");
        // Game state change should happen here or be triggered by this
        this.game.getGameActions().setGameState(GameState.Betting);
        this.update(); // Update all UI to reflect Betting state
    }

    /** Called by BettingUI when "Confirm Bet" is clicked */
    private onConfirmBet(bet: number): void {
        console.log("UI: Confirm Bet action with bet:", bet);

        // *** FIX: Request table clear BEFORE starting new game logic ***
        this.onClearTableRequest();

        // Start the game logic (which deals new cards)
        const success = this.game.startNewGame(bet);
        // The update() might be implicitly called by the animation chain,
        // but an immediate update can hide the betting UI faster.
        if (success) {
            this.update(); // Update UI immediately (e.g., hide betting)
        } else {
            // If starting failed (e.g., insufficient funds after a race condition?),
            // ensure UI reflects the current state (likely back to Betting).
            this.update();
        }
    }

    /** Called by NavigationUI when "Leave Table" is clicked */
    private onLeaveTable(): void {
        console.log("UI: Leave Table action");
        const currentState = this.game.getGameState();
        // Allow leaving from Betting, GameOver, or Initial
        if (currentState === GameState.Betting || currentState === GameState.GameOver || currentState === GameState.Initial) {
            this.game.getGameActions().setGameState(GameState.Initial); // Set state to Initial
            this.game.setCurrentBet(0); // Reset logical bet
            this.onClearTableRequest(); // Request visual table clearing
            this.update(); // Update UI to show Initial state (Sit Down button)
        } else {
            // Optionally provide feedback or just ignore
            console.warn("Cannot leave table during active player/dealer turn.");
            // You could add a brief message to the StatusUI here if desired
        }
    }

    /** Called by GameActionUI (repurposed Hit button) or NavigationUI when "New Game" is requested */
    private onNewGameRequest(): void {
        console.log("UI: New Game request action");
        // Go to betting state to allow bet adjustment
        this.game.getGameActions().setGameState(GameState.Betting);
        this.update(); // Update UI to show betting panel
    }

    /** Updates the currency sign in relevant sub-UIs */
    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        this.statusUI.setCurrencySign(sign);
        this.bettingUI.setCurrencySign(sign);
        // Update immediately if needed, though update() will catch it too
        this.statusUI.update();
        this.bettingUI.update();
    }

    /**
     * Updates all UI components based on the current game state and animation status.
     * @param isAnimating - Passed down from GameController update loop.
     */
     public update(isAnimating: boolean = false): void {
        // console.log("GameUI Update called. Animating:", isAnimating);
        this.statusUI.update();
        this.navigationUI.update(); // Update nav buttons first (Sit Down/Leave)
        this.bettingUI.update();    // Update betting panel (visibility)
        this.gameActionUI.update(isAnimating); // Update action buttons (visibility, text, enabled state)
    }

     /** Dispose all sub-UI components */
     public dispose(): void {
         this.statusUI?.dispose();
         this.navigationUI?.dispose();
         this.bettingUI?.dispose();
         this.gameActionUI?.dispose();
     }
}

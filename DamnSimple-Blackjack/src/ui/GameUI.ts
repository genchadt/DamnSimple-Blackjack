// src/ui/gameui-ts
// Pass the new callback to GameActionUI constructor
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
        this.onClearTableRequest = onClearTableRequest;
        console.log("[GameUI] Initializing...");

        this.statusUI = new StatusUI(scene, game);
        this.navigationUI = new NavigationUI(
            scene, game,
            this.onSitDown.bind(this),
            this.onLeaveTable.bind(this),
            this.onNewGameRequest.bind(this),
            this.onOpenSettings
        );
        this.bettingUI = new BettingUI(scene, game, this.onConfirmBet.bind(this));

        this.gameActionUI = new GameActionUI(
            scene,
            game,
            this.onNewGameRequest.bind(this),
            () => this.update()
        );

        console.log("[GameUI] Initialized");
        this.update();
    }

    // --- UI Action Handlers ---

    /** Handles the "Sit Down" action from NavigationUI. */
    private onSitDown(): void {
        console.log("[GameUI] === Sit Down action triggered ===");
        this.game.getGameActions().setGameState(GameState.Betting);
        this.update();
    }

    /** Handles the "Confirm Bet" action from BettingUI. */
    private onConfirmBet(bet: number): void {
        console.log(`[GameUI] === Confirm Bet action triggered. Bet: ${bet} ===`);
        console.log("[GameUI]   -> Requesting table clear...");
        this.onClearTableRequest();
        console.log("[GameUI]   -> Calling game.startNewGame...");
        const success = this.game.startNewGame(bet);
        if (success) {
            console.log("[GameUI]   -> game.startNewGame returned true. Performing immediate UI update.");
            this.update();
        } else {
            console.error("[GameUI]   -> game.startNewGame returned false. Performing UI update.");
            this.update();
        }
    }

    /** Handles the "Leave Table" action from NavigationUI. */
    private onLeaveTable(): void {
        console.log("[GameUI] === Leave Table action triggered ===");
        const currentState = this.game.getGameState();
        if (currentState === GameState.Betting || currentState === GameState.GameOver || currentState === GameState.Initial) {
            console.log("[GameUI]   -> Setting game state to Initial.");
            this.game.getGameActions().setGameState(GameState.Initial);
            this.game.setCurrentBet(0);
            console.log("[GameUI]   -> Requesting table clear.");
            this.onClearTableRequest();
            this.update();
        } else {
            console.warn(`[GameUI] Cannot leave table during active player/dealer turn (State: ${GameState[currentState]}).`);
        }
    }

    /**
     * Handles the request to start a new game using the previous bet amount.
     * Triggered by the repurposed "Hit" button ("Same Bet") in the GameOver state via GameActionUI.
     */
    private onNewGameRequest(): void {
        console.log("[GameUI] === New Game request action (Same Bet) triggered ===");

        if (this.game.getGameState() !== GameState.GameOver) {
            console.warn(`[GameUI] New Game request ignored: Not in GameOver state (State: ${GameState[this.game.getGameState()]}).`);
            return;
        }

        const lastBet = this.game.getGameActions().getLastBet();
        console.log(`[GameUI]   -> Attempting to use last bet amount: ${lastBet}`);

        console.log("[GameUI]   -> Requesting table clear...");
        this.onClearTableRequest();
        console.log("[GameUI]   -> Calling game.startNewGame with last bet...");
        const success = this.game.startNewGame(lastBet);

        if (success) {
            console.log("[GameUI]   -> game.startNewGame returned true. Performing immediate UI update.");
            this.update();
        } else {
            console.error("[GameUI]   -> game.startNewGame returned false. Switching to Betting state.");
            this.game.getGameActions().setGameState(GameState.Betting);
            this.update();
        }
    }

    // --- Other Methods ---

    /** Sets the currency sign used across relevant UI components. */
    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        this.statusUI.setCurrencySign(sign);
        this.bettingUI.setCurrencySign(sign);
        this.update();
    }

    /**
     * Applies a UI scale factor to all sub-UI components.
     * @param scaleFactor The scale factor to apply.
     */
    public applyUIScale(scaleFactor: number): void {
        console.log(`%c[GameUI] Applying UI Scale: ${scaleFactor}`, 'color: orange');
        this.statusUI.applyUIScale(scaleFactor);
        this.navigationUI.applyUIScale(scaleFactor);
        this.bettingUI.applyUIScale(scaleFactor);
        this.gameActionUI.applyUIScale(scaleFactor);
    }

    /**
     * Central update function for the entire Game UI.
     * Calls update on all sub-UI components, passing the animation status.
     * @param isAnimating Flag indicating if a visual animation (deal, flip) is in progress.
     */
    public update(isAnimating: boolean = false): void {
        console.log(`%c[GameUI] Update called. State: ${GameState[this.game.getGameState()]}, Animating: ${isAnimating}`, 'color: dodgerblue');
        this.statusUI.update();
        this.navigationUI.update();
        this.bettingUI.update();
        this.gameActionUI.update(isAnimating);
    }

    /** Disposes all UI elements managed by GameUI. */
    public dispose(): void {
        console.log("[GameUI] Disposing GameUI elements");
        this.statusUI?.dispose();
        this.navigationUI?.dispose();
        this.bettingUI?.dispose();
        this.gameActionUI?.dispose();
    }
}

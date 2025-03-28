// src/ui/gameui-ts (Pass correct callback, implement onNewGameRequest logic)
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
    private onClearTableRequest: () => void;

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

        this.statusUI = new StatusUI(scene, game);
        this.navigationUI = new NavigationUI(
            scene, game,
            this.onSitDown.bind(this),
            this.onLeaveTable.bind(this),
            this.onNewGameRequest.bind(this), // Pass the actual new game request handler
            this.onOpenSettings
        );
        this.bettingUI = new BettingUI(scene, game, this.onConfirmBet.bind(this));
        // *** Pass the correct callback to GameActionUI ***
        this.gameActionUI = new GameActionUI(scene, game, this.onNewGameRequest.bind(this));

        console.log("GameUI Initialized");
        this.update();
    }

    private onSitDown(): void {
        console.log("UI: Sit Down action");
        this.game.getGameActions().setGameState(GameState.Betting);
        this.update();
    }

    private onConfirmBet(bet: number): void {
        console.log("UI: Confirm Bet action with bet:", bet);
        this.onClearTableRequest();
        const success = this.game.startNewGame(bet);
        if (success) {
            this.update();
        } else {
            this.update();
        }
    }

    private onLeaveTable(): void {
        console.log("UI: Leave Table action");
        const currentState = this.game.getGameState();
        if (currentState === GameState.Betting || currentState === GameState.GameOver || currentState === GameState.Initial) {
            this.game.getGameActions().setGameState(GameState.Initial);
            this.game.setCurrentBet(0);
            this.onClearTableRequest();
            this.update();
        } else {
            console.warn("Cannot leave table during active player/dealer turn.");
        }
    }

    // *** MODIFIED: Implement actual game start logic for "Same Bet" ***
    /** Called by GameActionUI (repurposed Hit button) when "Same Bet" is requested */
    private onNewGameRequest(): void {
        console.log("UI: New Game request action (Same Bet)");

        // Ensure we are in GameOver state before proceeding
        if (this.game.getGameState() !== GameState.GameOver) {
            console.warn("New Game request ignored: Not in GameOver state.");
            // Optionally switch to Betting state as a fallback?
            // this.game.getGameActions().setGameState(GameState.Betting);
            // this.update();
            return;
        }

        // Get the last bet amount
        const lastBet = this.game.getGameActions().getLastBet();
        console.log(`   Using last bet amount: ${lastBet}`);

        // Perform the same actions as confirming a bet
        this.onClearTableRequest();
        const success = this.game.startNewGame(lastBet); // Use lastBet
        if (success) {
            // Game logic will eventually call update via animation chain
            // but an immediate update helps hide the GameOver buttons faster
            this.update();
        } else {
            // If starting failed (e.g. funds somehow became insufficient?),
            // go to Betting state so user can fix it.
            console.error("Failed to start new game with last bet. Switching to Betting state.");
            this.game.getGameActions().setGameState(GameState.Betting);
            this.update();
        }
    }

    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        this.statusUI.setCurrencySign(sign);
        this.bettingUI.setCurrencySign(sign);
        this.statusUI.update();
        this.bettingUI.update();
    }

    public update(isAnimating: boolean = false): void {
        // console.log("GameUI Update called. Animating:", isAnimating);
        this.statusUI.update();
        this.navigationUI.update();
        this.bettingUI.update();
        // Pass the general update method to GameActionUI if needed elsewhere,
        // but the primary callback for "Same Bet" is now onNewGameRequest
        this.gameActionUI.update(isAnimating);
    }

     public dispose(): void {
         this.statusUI?.dispose();
         this.navigationUI?.dispose();
         this.bettingUI?.dispose();
         this.gameActionUI?.dispose();
     }
}

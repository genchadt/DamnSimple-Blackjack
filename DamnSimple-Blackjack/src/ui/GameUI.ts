// ui/GameUI.ts
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
    private onClearTable: () => void;
    private currencySign: string = "$";

    /**
     * Initializes a new instance of the GameUI class.
     * 
     * @param {Scene} scene - The Babylon.js scene to which the UI belongs.
     * @param {BlackjackGame} game - The game logic instance to interact with.
     * @param {() => void} onOpenSettings - Callback function to open the settings menu.
     * @param {() => void} onClearTable - Callback function to clear the game table.
     * 
     * This constructor sets up the UI components necessary for the blackjack game,
     * including the status display, betting interface, game action buttons, and navigation controls.
     * It also triggers an initial update to ensure the UI reflects the current game state.
     */
    constructor(
        scene: Scene, 
        game: BlackjackGame, 
        onOpenSettings: () => void,
        onClearTable: () => void
    ) {
        this.scene = scene;
        this.game = game;
        this.onOpenSettings = onOpenSettings;
        this.onClearTable = onClearTable;
        
        // Create UI components
        this.statusUI = new StatusUI(scene, game);
        
        this.bettingUI = new BettingUI(scene, game, (bet) => {
            this.confirmBet(bet);
        });
        
        this.gameActionUI = new GameActionUI(scene, game, () => {
            this.update();
        });
        
        this.navigationUI = new NavigationUI(
            scene, 
            game, 
            () => this.onSitDown(),
            () => this.onLeaveTable(),
            () => this.onNewGame(),
            onOpenSettings
        );
        
        // Initial update
        this.update();
    }

    /**
     * Called when the player sits down at the table. Shows the betting UI and 
     * sets the game state to Betting. Triggers an update to reflect the new
     * game state.
     */
    private onSitDown(): void {
        // Show betting UI when player sits down
        this.bettingUI.show();
        this.game.setGameState(GameState.Betting);
        this.update();
    }

    /**
     * Confirms the player's bet and starts a new game with the specified bet amount.
     * This method updates the game state and refreshes the UI to reflect the changes.
     *
     * @param {number} bet - The amount the player has decided to bet for the new game.
     */
    private confirmBet(bet: number): void {
        // Start the game with current bet
        this.game.startNewGame(bet);
        this.update();
    }

    /**
     * Handles the action of leaving the table.
     * The player can only leave the table if the game state is Betting, GameOver, or Initial.
     * Upon leaving, the game state is reset to Initial, the table is cleared, and the UI is updated.
     */
    private onLeaveTable(): void {
        // Only allow leaving at appropriate times
        if (this.game.getGameState() === GameState.Betting || 
            this.game.getGameState() === GameState.GameOver ||
            this.game.getGameState() === GameState.Initial) {
            
            // Reset to initial state
            this.game.setGameState(GameState.Initial);
            this.onClearTable();
            this.update();
        }
    }

    /**
     * Initiates the process for starting a new game by displaying the betting UI
     * and setting the game state to Betting. Triggers an update to reflect the
     * changes in the UI.
     */
    private onNewGame(): void {
        // Show betting UI for a new game
        this.bettingUI.show();
        this.game.setGameState(GameState.Betting);
        this.update();
    }

    /**
     * Updates the currency sign displayed in the UI to the specified value.
     * 
     * @param {string} sign The new currency sign to display (e.g. "$", " ", etc.).
     */
    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        this.statusUI.setCurrencySign(sign);
        this.bettingUI.setCurrencySign(sign);
    }

    /**
     * Updates all UI components to reflect the current game state.
     * This is called whenever the game state changes or when the player's
     * funds or bet amount changes. It ensures that the UI always reflects
     * the current state of the game.
     */
    public update(): void {
        // Update all UI components
        this.statusUI.update();
        this.bettingUI.update();
        this.gameActionUI.update();
        this.navigationUI.update();
    }
}

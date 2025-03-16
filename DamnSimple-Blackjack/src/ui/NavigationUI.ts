// ui/NavigationUI.ts
import { Scene } from "@babylonjs/core";
import { Button, Control } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame, GameState } from "../game/BlackjackGame";

export class NavigationUI extends BaseUI {
    private game: BlackjackGame;
    private sitDownButton!: Button;
    private leaveTableButton!: Button;
    private newGameButton!: Button;
    private settingsButton!: Button;
    private onSitDown: () => void;
    private onLeaveTable: () => void;
    private onNewGame: () => void;
    private onOpenSettings: () => void;

    /**
     * Initializes a new instance of the NavigationUI class.
     * 
     * @param {Scene} scene - The Babylon.js scene to which the UI belongs.
     * @param {BlackjackGame} game - The game logic instance to interact with.
     * @param {() => void} onSitDown - Callback function to call when the player sits down.
     * @param {() => void} onLeaveTable - Callback function to call when the player leaves the table.
     * @param {() => void} onNewGame - Callback function to call when starting a new game.
     * @param {() => void} onOpenSettings - Callback function to open the settings menu.
     * 
     * This constructor sets up the navigation UI components necessary for the blackjack game,
     * including the buttons for sitting down, leaving the table, starting a new game, and opening
     * the settings menu.
     */
    constructor(
        scene: Scene, 
        game: BlackjackGame, 
        onSitDown: () => void,
        onLeaveTable: () => void,
        onNewGame: () => void,
        onOpenSettings: () => void
    ) {
        super(scene);
        this.game = game;
        this.onSitDown = onSitDown;
        this.onLeaveTable = onLeaveTable;
        this.onNewGame = onNewGame;
        this.onOpenSettings = onOpenSettings;
        
        this.createButtons();
    }
    
    /**
     * Creates the buttons for the navigation UI: "Sit Down", "Leave Table", "New Game", and "Settings".
     * The buttons are configured with the correct text, size, color, alignment, and click handlers.
     */
    private createButtons(): void {
        // Create "Sit Down" button for initial state
        this.sitDownButton = Button.CreateSimpleButton("sitDownButton", "Sit Down");
        this.sitDownButton.width = "200px";
        this.sitDownButton.height = "60px";
        this.sitDownButton.color = "white";
        this.sitDownButton.background = "green";
        this.sitDownButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.sitDownButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.sitDownButton.onPointerClickObservable.add(() => {
            this.onSitDown();
        });
        this.guiTexture.addControl(this.sitDownButton);
        
        // Create "Leave Table" button
        this.leaveTableButton = Button.CreateSimpleButton("leaveTableButton", "Leave Table");
        this.leaveTableButton.width = "200px";
        this.leaveTableButton.height = "40px";
        this.leaveTableButton.color = "white";
        this.leaveTableButton.background = "#aa3333";
        this.leaveTableButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.leaveTableButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.leaveTableButton.left = "20px";
        this.leaveTableButton.top = "-20px";
        this.leaveTableButton.isVisible = false;
        this.leaveTableButton.onPointerClickObservable.add(() => {
            this.onLeaveTable();
        });
        this.guiTexture.addControl(this.leaveTableButton);
        
        // New Game button (appears after game over)
        this.newGameButton = Button.CreateSimpleButton("newGameButton", "New Game");
        this.newGameButton.width = "150px";
        this.newGameButton.height = "50px";
        this.newGameButton.color = "white";
        this.newGameButton.background = "blue";
        this.newGameButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.newGameButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.newGameButton.isVisible = false;
        this.newGameButton.onPointerClickObservable.add(() => {
            this.onNewGame();
        });
        this.guiTexture.addControl(this.newGameButton);
        
        // Settings button (cog in top-right)
        this.settingsButton = Button.CreateSimpleButton("settingsButton", "⚙️");
        this.settingsButton.width = "50px";
        this.settingsButton.height = "50px";
        this.settingsButton.color = "white";
        this.settingsButton.fontSize = 24;
        this.settingsButton.background = "#333333";
        this.settingsButton.cornerRadius = 25;
        this.settingsButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.settingsButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.settingsButton.top = "20px";
        this.settingsButton.left = "-20px";
        this.settingsButton.onPointerClickObservable.add(() => {
            this.onOpenSettings();
        });
        this.guiTexture.addControl(this.settingsButton);
    }
    
    /**
     * Shows the initial state of the navigation UI, with the sit down button visible.
     * This is the state of the UI when the player has not yet sat down at the table.
     */
    public showInitialState(): void {
        this.sitDownButton.isVisible = true;
        this.leaveTableButton.isVisible = false;
        this.newGameButton.isVisible = false;
    }
    
    /**
     * Updates the visibility of navigation buttons based on the current game state.
     * Hides the "Sit Down" button and shows the "Leave Table" button.
     * If the game is over, the "New Game" button is made visible.
     */
    public showGameState(): void {
        this.sitDownButton.isVisible = false;
        this.leaveTableButton.isVisible = true;
        
        if (this.game.getGameState() === GameState.GameOver) {
            this.newGameButton.isVisible = true;
        } else {
            this.newGameButton.isVisible = false;
        }
    }

    /**
     * Updates the navigation UI based on the current game state.
     * - In the initial state, only the "Sit Down" button is visible.
     * - Once the player has sat down, the "Sit Down" button is hidden and
     *   the "Leave Table" button becomes visible.
     * - The "Leave Table" button is disabled during active gameplay (PlayerTurn or DealerTurn)
     *   and enabled between hands or at the end of a game.
     * - The "New Game" button is never shown, as the repurposed "Hit" button is used instead
     *   in the GameOver state.
     */
    public update(): void {
        const gameState = this.game.getGameState();
        
        if (gameState === GameState.Initial) {
            // Initial state - show sit down button
            this.sitDownButton.isVisible = true;
            this.leaveTableButton.isVisible = false;
            this.newGameButton.isVisible = false;
        } else {
            // Player has sat down - hide sit down button
            this.sitDownButton.isVisible = false;
            
            // Show leave table button, but disable during active gameplay
            this.leaveTableButton.isVisible = true;
            
            if (gameState === GameState.PlayerTurn || gameState === GameState.DealerTurn) {
                // Disable leave table during active gameplay
                this.leaveTableButton.isEnabled = false;
                this.leaveTableButton.background = "#666666"; // Gray out the button
            } else {
                // Enable leave table between hands
                this.leaveTableButton.isEnabled = true;
                this.leaveTableButton.background = "#aa3333"; // Normal color
            }
            
            // Never show the blue New Game button when in GameOver state
            // We'll use the repurposed Hit button (W key) instead
            this.newGameButton.isVisible = false;
        }
    }
}

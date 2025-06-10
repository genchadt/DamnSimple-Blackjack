// src/ui/navigationui-ts (Handles Sit Down/Leave Table/Settings)
import { Scene } from "@babylonjs/core";
import { Button, Control } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState } from "../game/GameState";

export class NavigationUI extends BaseUI {
    private game: BlackjackGame;
    private sitDownButton!: Button;
    // private leaveTableButton!: Button; // Removed
    // private newGameButton!: Button; // Removed - New Game handled by GameActionUI
    private settingsButton!: Button;

    // Callbacks to GameUI/GameController
    private onSitDown: () => void;
    // private onLeaveTable: () => void; // Removed
    private onNewGameRequest: () => void; // Kept for potential future use, but not linked currently
    private onOpenSettings: () => void;

    constructor(
        scene: Scene,
        game: BlackjackGame,
        onSitDown: () => void,
        // onLeaveTable: () => void, // Removed
        onNewGameRequest: () => void, // Renamed parameter
        onOpenSettings: () => void
    ) {
        super(scene, "NavigationUI");
        this.game = game;
        this.onSitDown = onSitDown;
        // this.onLeaveTable = onLeaveTable; // Removed
        this.onNewGameRequest = onNewGameRequest; // Store callback
        this.onOpenSettings = onOpenSettings;

        this.createButtons();
        this.update(); // Initial update
    }

    private createButtons(): void {
        // Sit Down Button (Center, shown initially)
        this.sitDownButton = Button.CreateSimpleButton("sitDownButton", "Sit Down");
        this.sitDownButton.width = "200px";
        this.sitDownButton.height = "60px";
        this.sitDownButton.color = "white";
        this.sitDownButton.fontSize = 22;
        this.sitDownButton.background = "darkgreen";
        this.sitDownButton.cornerRadius = 10;
        this.sitDownButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.sitDownButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.sitDownButton.isVisible = false; // Initially hidden, shown by update()
        this.sitDownButton.onPointerUpObservable.add(() => {
            this.onSitDown();
        });
        this.guiTexture.addControl(this.sitDownButton);

        // Leave Table Button (Bottom Left) - REMOVED
        // this.leaveTableButton = Button.CreateSimpleButton("leaveTableButton", "Leave Table");
        // this.leaveTableButton.width = "180px"; // Slightly smaller
        // this.leaveTableButton.height = "45px";
        // this.leaveTableButton.color = "white";
        // this.leaveTableButton.fontSize = 18;
        // this.leaveTableButton.background = "#B22222"; // Firebrick red
        // this.leaveTableButton.cornerRadius = 8;
        // this.leaveTableButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        // this.leaveTableButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        // this.leaveTableButton.left = "15px";
        // this.leaveTableButton.top = "-15px";
        // this.leaveTableButton.isVisible = false; // Initially hidden
        // this.leaveTableButton.onPointerUpObservable.add(() => {
        //     if (this.leaveTableButton.isEnabled) { // Check if enabled
        //         this.onLeaveTable();
        //     }
        // });
        // this.guiTexture.addControl(this.leaveTableButton);

        // New Game Button - REMOVED (Handled by repurposed GameActionUI buttons)

        // Settings Button (Top Right Cog)
        this.settingsButton = Button.CreateSimpleButton("settingsButton", "⚙️");
        this.settingsButton.width = "45px"; // Smaller cog
        this.settingsButton.height = "45px";
        this.settingsButton.color = "white";
        this.settingsButton.fontSize = 28; // Larger cog symbol
        this.settingsButton.background = "rgba(50, 50, 50, 0.7)"; // Semi-transparent dark gray
        this.settingsButton.cornerRadius = 22.5; // Circular
        this.settingsButton.thickness = 0; // No border
        this.settingsButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.settingsButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.settingsButton.top = "15px";
        this.settingsButton.left = "-15px";
        this.settingsButton.onPointerUpObservable.add(() => {
            this.onOpenSettings();
        });
        this.guiTexture.addControl(this.settingsButton);
    }

    /**
     * Updates the visibility and enabled state of navigation buttons based on the game state.
     */
    public update(): void {
        const gameState = this.game.getGameState();

        // Sit Down button only visible in Initial state
        this.sitDownButton.isVisible = (gameState === GameState.Initial);

        // Leave Table button visible unless in Initial state - REMOVED
        // this.leaveTableButton.isVisible = (gameState !== GameState.Initial);

        // Enable/Disable Leave Table button - REMOVED
        // const canLeave = (gameState === GameState.Betting || gameState === GameState.GameOver);
        // this.leaveTableButton.isEnabled = canLeave;
        // this.leaveTableButton.alpha = canLeave ? 1.0 : 0.5; // Visual feedback

        // Settings button always visible/enabled (unless maybe during animation?)
        this.settingsButton.isVisible = true;
        this.settingsButton.isEnabled = true;

        // newGameButton is removed
    }
}
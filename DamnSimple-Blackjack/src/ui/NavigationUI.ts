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
    
    public showInitialState(): void {
        this.sitDownButton.isVisible = true;
        this.leaveTableButton.isVisible = false;
        this.newGameButton.isVisible = false;
    }
    
    public showGameState(): void {
        this.sitDownButton.isVisible = false;
        this.leaveTableButton.isVisible = true;
        
        if (this.game.getGameState() === GameState.GameOver) {
            this.newGameButton.isVisible = true;
        } else {
            this.newGameButton.isVisible = false;
        }
    }
    
    public update(): void {
        if (this.game.getGameState() === GameState.Initial) {
            this.showInitialState();
        } else {
            this.showGameState();
        }
    }
}

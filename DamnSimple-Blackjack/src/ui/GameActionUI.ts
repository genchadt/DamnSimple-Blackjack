// ui/GameActionUI.ts
import { Scene, KeyboardEventTypes } from "@babylonjs/core";
import { Button, TextBlock, Control } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame, GameState } from "../game/BlackjackGame";

export class GameActionUI extends BaseUI {
    private game: BlackjackGame;
    private hitButton!: Button;
    private standButton!: Button;
    private doubleButton!: Button;
    private splitButton!: Button;
    private onUpdate: () => void;
    
    constructor(scene: Scene, game: BlackjackGame, onUpdate: () => void) {
        super(scene);
        this.game = game;
        this.onUpdate = onUpdate;
        
        // Create action buttons in circular layout
        this.createCircularButtons();
        this.setupKeyboardControls();
    }
    
    private createCircularButtons(): void {
        // Create a center point for our circular layout
        const centerX = 0;
        const centerY = 150;
        const radius = 120;
        
        // Hit button (W key) - top
        this.hitButton = Button.CreateSimpleButton("hitButton", "Hit");
        this.hitButton.width = "120px";
        this.hitButton.height = "50px";
        this.hitButton.color = "white";
        this.hitButton.background = "green";
        this.hitButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.hitButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.hitButton.top = (centerY - radius) + "px";
        this.hitButton.isVisible = false;
        
        // Add key indicator "W"
        const hitKeyIndicator = new TextBlock();
        hitKeyIndicator.text = "W";
        hitKeyIndicator.color = "white";
        hitKeyIndicator.fontSize = 16;
        hitKeyIndicator.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        hitKeyIndicator.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        hitKeyIndicator.paddingBottom = "5px";
        this.hitButton.addControl(hitKeyIndicator);
        
        this.hitButton.onPointerClickObservable.add(() => {
            this.game.playerHit();
            this.onUpdate();
        });
        this.guiTexture.addControl(this.hitButton);
        
        // Stand button (S key) - bottom
        this.standButton = Button.CreateSimpleButton("standButton", "Stand");
        this.standButton.width = "120px";
        this.standButton.height = "50px";
        this.standButton.color = "white";
        this.standButton.background = "red";
        this.standButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.standButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.standButton.top = (centerY + radius) + "px";
        this.standButton.isVisible = false;
        
        // Add key indicator "S"
        const standKeyIndicator = new TextBlock();
        standKeyIndicator.text = "S";
        standKeyIndicator.color = "white";
        standKeyIndicator.fontSize = 16;
        standKeyIndicator.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        standKeyIndicator.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        standKeyIndicator.paddingBottom = "5px";
        this.standButton.addControl(standKeyIndicator);
        
        this.standButton.onPointerClickObservable.add(() => {
            this.game.playerStand();
            this.onUpdate();
        });
        this.guiTexture.addControl(this.standButton);
        
        // Double button (A key) - left
        this.doubleButton = Button.CreateSimpleButton("doubleButton", "Double");
        this.doubleButton.width = "120px";
        this.doubleButton.height = "50px";
        this.doubleButton.color = "white";
        this.doubleButton.background = "blue";
        this.doubleButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.doubleButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.doubleButton.left = (centerX - radius) + "px";
        this.doubleButton.top = centerY + "px";
        this.doubleButton.isVisible = false;
        
        // Add key indicator "A"
        const doubleKeyIndicator = new TextBlock();
        doubleKeyIndicator.text = "A";
        doubleKeyIndicator.color = "white";
        doubleKeyIndicator.fontSize = 16;
        doubleKeyIndicator.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        doubleKeyIndicator.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        doubleKeyIndicator.paddingBottom = "5px";
        this.doubleButton.addControl(doubleKeyIndicator);
        
        this.doubleButton.onPointerClickObservable.add(() => {
            this.game.doubleDown();
            this.onUpdate();
        });
        this.guiTexture.addControl(this.doubleButton);
        
        // Split button (D key) - right
        this.splitButton = Button.CreateSimpleButton("splitButton", "Split");
        this.splitButton.width = "120px";
        this.splitButton.height = "50px";
        this.splitButton.color = "white";
        this.splitButton.background = "purple";
        this.splitButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.splitButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.splitButton.left = (centerX + radius) + "px";
        this.splitButton.top = centerY + "px";
        this.splitButton.isVisible = false;
        
        // Add key indicator "D"
        const splitKeyIndicator = new TextBlock();
        splitKeyIndicator.text = "D";
        splitKeyIndicator.color = "white";
        splitKeyIndicator.fontSize = 16;
        splitKeyIndicator.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        splitKeyIndicator.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        splitKeyIndicator.paddingBottom = "5px";
        this.splitButton.addControl(splitKeyIndicator);
        
        this.splitButton.onPointerClickObservable.add(() => {
            // Split functionality would go here
            console.log("Split not implemented yet");
        });
        this.guiTexture.addControl(this.splitButton);
    }
    
    private setupKeyboardControls(): void {
        // Add keyboard event listeners for WASD controls
        this.scene.onKeyboardObservable.add((kbInfo) => {
            switch (kbInfo.type) {
                case KeyboardEventTypes.KEYDOWN:
                    switch (kbInfo.event.key.toLowerCase()) {
                        case 'w':
                            if (this.hitButton.isVisible && this.hitButton.isEnabled) {
                                this.game.playerHit();
                                this.onUpdate();
                            }
                            break;
                        case 's':
                            if (this.standButton.isVisible && this.standButton.isEnabled) {
                                this.game.playerStand();
                                this.onUpdate();
                            }
                            break;
                        case 'a':
                            if (this.doubleButton.isVisible && this.doubleButton.isEnabled) {
                                this.game.doubleDown();
                                this.onUpdate();
                            }
                            break;
                        case 'd':
                            if (this.splitButton.isVisible && this.splitButton.isEnabled) {
                                // Split functionality would go here
                                console.log("Split not implemented yet");
                            }
                            break;
                    }
                    break;
            }
        });
    }
    
    public showForPlayerTurn(): void {
        this.hitButton.isVisible = true;
        this.standButton.isVisible = true;
        this.doubleButton.isVisible = this.game.getPlayerHand().length === 2;
        this.splitButton.isVisible = this.game.canSplit();
    }
    
    public hideAll(): void {
        this.hitButton.isVisible = false;
        this.standButton.isVisible = false;
        this.doubleButton.isVisible = false;
        this.splitButton.isVisible = false;
    }
    
    public update(): void {
        if (this.game.getGameState() === GameState.PlayerTurn) {
            // Show normal game action buttons during player's turn
            this.hitButton.isVisible = true;
            this.hitButton.textBlock!.text = "Hit";
            this.standButton.isVisible = true;
            this.standButton.textBlock!.text = "Stand";
            this.doubleButton.isVisible = this.game.getPlayerHand().length === 2;
            this.splitButton.isVisible = this.game.canSplit();
            
        } else if (this.game.getGameState() === GameState.GameOver) {
            // Show "New Game" and "Change Bet" after game over
            this.hitButton.isVisible = true;
            this.hitButton.textBlock!.text = "New Game";
            this.standButton.isVisible = true;
            this.standButton.textBlock!.text = "Change Bet";
            this.doubleButton.isVisible = false;
            this.splitButton.isVisible = false;
            
            // Update click handlers for the repurposed buttons
            this.hitButton.onPointerClickObservable.clear();
            this.hitButton.onPointerClickObservable.add(() => {
                // Start new game with same bet
                this.game.startNewGame(this.game.getCurrentBet());
                this.onUpdate();
            });
            
            this.standButton.onPointerClickObservable.clear();
            this.standButton.onPointerClickObservable.add(() => {
                // Show betting UI to change bet
                this.game.setGameState(GameState.Betting);
                this.onUpdate();
            });
        } else {
            // Hide all buttons for other game states
            this.hitButton.isVisible = false;
            this.standButton.isVisible = false;
            this.doubleButton.isVisible = false;
            this.splitButton.isVisible = false;
            
            // Restore original click handlers
            this.hitButton.onPointerClickObservable.clear();
            this.hitButton.onPointerClickObservable.add(() => {
                this.game.playerHit();
                this.onUpdate();
            });
            
            this.standButton.onPointerClickObservable.clear();
            this.standButton.onPointerClickObservable.add(() => {
                this.game.playerStand();
                this.onUpdate();
            });
        }
    }
}

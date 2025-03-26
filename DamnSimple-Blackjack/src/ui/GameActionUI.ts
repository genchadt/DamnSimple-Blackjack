// src/ui/gameactionui-ts (Removed split, handles animation disabling)
import { Scene, KeyboardEventTypes } from "@babylonjs/core";
import { Button, TextBlock, Control, Rectangle } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState } from "../game/GameState";

export class GameActionUI extends BaseUI {
    private game: BlackjackGame;
    private hitButton!: Button;
    private standButton!: Button;
    private doubleButton!: Button;
    // private splitButton!: Button; // Removed split
    private onUpdate: () => void; // Callback to notify GameUI/Controller to update everything

    // Store original actions for easy switching
    private originalHitAction: () => void;
    private originalStandAction: () => void;
    private originalDoubleAction: () => void;

    constructor(scene: Scene, game: BlackjackGame, onUpdate: () => void) {
        super(scene, "GameActionUI");
        this.game = game;
        this.onUpdate = onUpdate;

        // Define original actions
        this.originalHitAction = () => {
            console.log("UI: Hit action triggered");
            this.game.playerHit();
            this.onUpdate(); // Notify for general update (will disable buttons during animation)
        };
        this.originalStandAction = () => {
            console.log("UI: Stand action triggered");
            this.game.playerStand();
            this.onUpdate();
        };
        this.originalDoubleAction = () => {
            console.log("UI: Double action triggered");
            this.game.doubleDown();
            this.onUpdate();
        };

        this.createCircularButtons();
        this.setupKeyboardControls();
        this.update(); // Initial setup
    }

    private createActionButton(
        name: string, text: string, key: string, color: string,
        x: number, y: number, action: () => void
    ): Button {
        const button = Button.CreateSimpleButton(name, ""); // Text set later
        button.width = "110px"; // Slightly smaller
        button.height = "80px";
        button.color = "white"; // Text color
        button.background = color;
        button.cornerRadius = 10;
        button.thickness = 2;
        button.shadowBlur = 5;
        button.shadowColor = "#333";

        // Positioning
        button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        button.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM; // Anchor to bottom center
        button.left = `${x}px`;
        button.top = `${y - 20}px`; // Adjust Y position relative to bottom (e.g., -20px from bottom edge)

        button.isVisible = false; // Initially hidden

        // Container for Key + Text
        const contentStack = new StackPanel(`${name}ContentStack`);
        contentStack.isVertical = true;
        button.addControl(contentStack);

        // Key Indicator (smaller)
        const keyContainer = new Rectangle(`${name}KeyRect`);
        keyContainer.width = "25px";
        keyContainer.height = "20px";
        keyContainer.background = "rgba(255, 255, 255, 0.8)";
        keyContainer.color = "black"; // Border color for key rect
        keyContainer.cornerRadius = 4;
        keyContainer.thickness = 1;
        keyContainer.paddingTop = "3px"; // Space above key
        contentStack.addControl(keyContainer);

        const keyText = new TextBlock(`${name}KeyText`, key);
        keyText.color = "black";
        keyText.fontSize = 12;
        keyContainer.addControl(keyText);

        // Button Action Text
        const buttonText = new TextBlock(`${name}ActionText`, text);
        buttonText.color = "white";
        buttonText.fontSize = 16;
        buttonText.paddingTop = "5px"; // Space between key and text
        contentStack.addControl(buttonText);

        // Add action
        button.onPointerUpObservable.add(action); // Use onPointerUp

        this.guiTexture.addControl(button);
        return button;
    }

    private createCircularButtons(): void {
        const centerX = 0;
        const centerY = -100; // Y offset from bottom center
        const radius = 100; // Radius of the circle

        // Create buttons using original actions
        this.hitButton = this.createActionButton(
            "hitButton", "Hit", "W", "darkgreen",
            centerX, centerY - radius, this.originalHitAction
        );
        this.standButton = this.createActionButton(
            "standButton", "Stand", "S", "darkred",
            centerX, centerY + radius, this.originalStandAction
        );
        this.doubleButton = this.createActionButton(
            "doubleButton", "Double", "A", "darkblue",
            centerX - radius, centerY, this.originalDoubleAction
        );
        // Split button removed
    }

    private setupKeyboardControls(): void {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
                 // Check if buttons are visible and enabled before triggering action
                switch (kbInfo.event.key.toLowerCase()) {
                    case 'w':
                        if (this.hitButton.isVisible && this.hitButton.isEnabled) {
                            this.hitButton.onPointerUpObservable.notifyObservers(null); // Simulate click
                        }
                        break;
                    case 's':
                        if (this.standButton.isVisible && this.standButton.isEnabled) {
                            this.standButton.onPointerUpObservable.notifyObservers(null);
                        }
                        break;
                    case 'a':
                        if (this.doubleButton.isVisible && this.doubleButton.isEnabled) {
                            this.doubleButton.onPointerUpObservable.notifyObservers(null);
                        }
                        break;
                    // 'd' for split removed
                }
            }
        });
    }

    /**
     * Updates the GameActionUI based on game state and animation status.
     * @param isAnimating - Whether a card animation is currently in progress.
     */
     public update(isAnimating: boolean = false): void {
        const gameState = this.game.getGameState();
        let showHit = false, showStand = false, showDouble = false;
        let hitText = "Hit", standText = "Stand", doubleText = "Double";
        let hitAction = this.originalHitAction;
        let standAction = this.originalStandAction;
        let doubleAction = this.originalDoubleAction;

        if (gameState === GameState.PlayerTurn) {
            showHit = true;
            showStand = true;
            // Double Down only available on first action (2 cards) and enough funds
            showDouble = this.game.getPlayerHand().length === 2 &&
                         this.game.getPlayerFunds() >= this.game.getCurrentBet();

            hitText = "Hit";
            standText = "Stand";
            doubleText = "Double";
            hitAction = this.originalHitAction;
            standAction = this.originalStandAction;
            doubleAction = this.originalDoubleAction;

        } else if (gameState === GameState.GameOver) {
            // Repurpose Hit/Stand for New Game / Change Bet
            showHit = true;
            showStand = true;
            showDouble = false; // Never show double in game over

            hitText = "New Game";
            standText = "Change Bet";
            hitAction = () => { // New Game action
                 console.log("UI: New Game action triggered");
                 // GameController handles clearing table etc. via GameUI callback
                 this.onUpdate(); // Notify GameUI first
                 // GameUI's onNewGame callback (passed during construction) will handle it
            };
            standAction = () => { // Change Bet action
                 console.log("UI: Change Bet action triggered");
                 this.game.getGameActions().setGameState(GameState.Betting); // Go to betting state
                 this.onUpdate(); // Update UI
            };
        }

        // Update Visibility
        this.hitButton.isVisible = showHit;
        this.standButton.isVisible = showStand;
        this.doubleButton.isVisible = showDouble;
        // this.splitButton.isVisible = false; // Always false

        // Update Text and Actions (only if visibility is true)
        if (showHit) {
             this.updateButtonLabel(this.hitButton, hitText);
             this.updateButtonAction(this.hitButton, hitAction);
        }
         if (showStand) {
             this.updateButtonLabel(this.standButton, standText);
             this.updateButtonAction(this.standButton, standAction);
         }
         if (showDouble) {
             this.updateButtonLabel(this.doubleButton, doubleText);
             this.updateButtonAction(this.doubleButton, doubleAction);
         }

         // Enable/Disable based on animation state
         const enable = !isAnimating;
         this.hitButton.isEnabled = enable && showHit;
         this.standButton.isEnabled = enable && showStand;
         this.doubleButton.isEnabled = enable && showDouble;

         // Visual feedback for disabled state
         this.hitButton.alpha = this.hitButton.isEnabled ? 1.0 : 0.5;
         this.standButton.alpha = this.standButton.isEnabled ? 1.0 : 0.5;
         this.doubleButton.alpha = this.doubleButton.isEnabled ? 1.0 : 0.5;
    }


    private updateButtonAction(button: Button, action: () => void): void {
        button.onPointerUpObservable.clear(); // Clear previous actions
        button.onPointerUpObservable.add(action); // Add the new action
    }

    private updateButtonLabel(button: Button, text: string): void {
        // Find the text block within the button's content stack
        const contentStack = button.getChildByName(`${button.name}ContentStack`) as StackPanel;
        if (contentStack) {
            const textBlock = contentStack.getChildByName(`${button.name}ActionText`) as TextBlock;
            if (textBlock) {
                textBlock.text = text;
            }
        }
    }
}

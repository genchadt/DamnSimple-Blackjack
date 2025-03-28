// src/ui/gameactionui-ts (Moved Vector2WithInfo import to @babylonjs/gui)
import { Scene, KeyboardEventTypes, Vector2 } from "@babylonjs/core"; // Vector2 stays here
// *** MOVED Vector2WithInfo import here ***
import { Button, TextBlock, Control, Rectangle, StackPanel, Vector2WithInfo } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState } from "../game/GameState";

export class GameActionUI extends BaseUI {
    private game: BlackjackGame;
    private hitButton!: Button;
    private standButton!: Button;
    private doubleButton!: Button;
    private onUpdate: () => void;
    private originalHitAction: () => void;
    private originalStandAction: () => void;
    private originalDoubleAction: () => void;

    constructor(scene: Scene, game: BlackjackGame, onUpdate: () => void) {
        super(scene, "GameActionUI");
        this.game = game;
        this.onUpdate = onUpdate;
        this.originalHitAction = () => { console.log("UI: Hit action triggered"); this.game.playerHit(); this.onUpdate(); };
        this.originalStandAction = () => { console.log("UI: Stand action triggered"); this.game.playerStand(); this.onUpdate(); };
        this.originalDoubleAction = () => { console.log("UI: Double action triggered"); this.game.doubleDown(); this.onUpdate(); };
        this.createCircularButtons();
        this.setupKeyboardControls();
        this.update();
    }

    private createActionButton(name: string, initialText: string, key: string, color: string, x: number, y: number, action: () => void): Button {
        const button = Button.CreateSimpleButton(name, "");
        button.width = "110px"; button.height = "80px";
        button.color = "white";
        button.background = color;
        button.cornerRadius = 10; button.thickness = 2; button.shadowBlur = 5; button.shadowColor = "#333";
        button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        button.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        button.left = `${x}px`; button.top = `${y - 20}px`;
        button.isVisible = false;

        const contentStack = new StackPanel(`${name}ContentStack`);
        contentStack.isVertical = true;
        contentStack.spacing = 2;
        button.addControl(contentStack);

        const keyContainer = new Rectangle(`${name}KeyRect`);
        keyContainer.width = "25px"; keyContainer.height = "20px";
        keyContainer.background = "rgba(255, 255, 255, 0.8)";
        keyContainer.color = "black";
        keyContainer.cornerRadius = 4;
        keyContainer.thickness = 0;
        keyContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        contentStack.addControl(keyContainer);

        const keyText = new TextBlock(`${name}KeyText`, key);
        keyText.color = "black";
        keyText.fontSize = 12;
        keyText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        keyText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        keyContainer.addControl(keyText);

        const buttonText = new TextBlock(`${name}ActionText`, initialText);
        buttonText.color = "white";
        buttonText.fontSize = 16;
        buttonText.textWrapping = true;
        buttonText.resizeToFit = true;
        contentStack.addControl(buttonText);

        button.onPointerUpObservable.add(action);
        this.guiTexture.addControl(button);
        return button;
    }


    private createCircularButtons(): void {
        const centerX = 0; const centerY = -100; const radius = 100;
        this.hitButton = this.createActionButton("hitButton", "Hit", "W", "darkgreen", centerX, centerY - radius, this.originalHitAction);
        this.standButton = this.createActionButton("standButton", "Stand", "S", "darkred", centerX, centerY + radius, this.originalStandAction);
        this.doubleButton = this.createActionButton("doubleButton", "Double", "A", "darkblue", centerX - radius, centerY, this.originalDoubleAction);
    }

    private setupKeyboardControls(): void {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
                const gameState = this.game.getGameState();

                // Create a dummy Vector2WithInfo for simulated clicks
                const dummyPointerInfo = new Vector2WithInfo(new Vector2(0, 0), 0); // Vector2 still comes from @babylonjs/core

                switch (kbInfo.event.key.toLowerCase()) {
                    case 'w': // Hit or New Game (Action mapping)
                        if (this.hitButton.isVisible && this.hitButton.isEnabled) {
                            if (gameState === GameState.PlayerTurn || gameState === GameState.GameOver) {
                                console.log(`UI: Keyboard 'W' triggered action for Hit button`);
                                this.hitButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            }
                        }
                        break;
                    case 's': // Stand or Change Bet (Action mapping)
                        if (this.standButton.isVisible && this.standButton.isEnabled) {
                           if (gameState === GameState.PlayerTurn || gameState === GameState.GameOver) {
                                console.log(`UI: Keyboard 'S' triggered action for Stand button`);
                                this.standButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            }
                        }
                        break;
                    case 'a': // Double (Action mapping)
                        if (this.doubleButton.isVisible && this.doubleButton.isEnabled) {
                             if (gameState === GameState.PlayerTurn) { // Double only valid in player turn
                                console.log(`UI: Keyboard 'A' triggered action for Double button`);
                                this.doubleButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            }
                        }
                        break;
                }
            }
        });
    }

    public update(isAnimating: boolean = false): void {
        const gameState = this.game.getGameState();
        let showHit = false, showStand = false, showDouble = false;
        let hitText = "Hit";
        let standText = "Stand";
        let doubleText = "Double";
        let hitAction = this.originalHitAction;
        let standAction = this.originalStandAction;
        let doubleAction = this.originalDoubleAction;

        if (gameState === GameState.PlayerTurn) {
            showHit = true; showStand = true;
            showDouble = this.game.getPlayerHand().length === 2 && this.game.getPlayerFunds() >= this.game.getCurrentBet();
        } else if (gameState === GameState.GameOver) {
            showHit = true; showStand = true; showDouble = false;
            hitText = "Same Bet";
            standText = "Change Bet";
            hitAction = () => { console.log("UI: 'Same Bet' action triggered (requests New Game)"); this.onUpdate(); };
            standAction = () => { console.log("UI: 'Change Bet' action triggered"); this.game.getGameActions().setGameState(GameState.Betting); this.onUpdate(); };
        }

        this.hitButton.isVisible = showHit;
        this.standButton.isVisible = showStand;
        this.doubleButton.isVisible = showDouble;

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

        const enable = !isAnimating;
        this.hitButton.isEnabled = enable && showHit;
        this.standButton.isEnabled = enable && showStand;
        this.doubleButton.isEnabled = enable && showDouble;

        this.hitButton.alpha = this.hitButton.isEnabled ? 1.0 : 0.5;
        this.standButton.alpha = this.standButton.isEnabled ? 1.0 : 0.5;
        this.doubleButton.alpha = this.doubleButton.isEnabled ? 1.0 : 0.5;
    }

    private updateButtonAction(button: Button, action: () => void): void {
        button.onPointerUpObservable.clear();
        button.onPointerUpObservable.add(action);
    }

    private updateButtonLabel(button: Button, text: string): void {
        const contentStack = button.getChildByName(`${button.name}ContentStack`) as StackPanel;
        if (contentStack) {
            const textBlock = contentStack.getChildByName(`${button.name}ActionText`) as TextBlock;
            if (textBlock) {
                textBlock.text = text;
            } else {
                console.warn(`Could not find ActionText for button ${button.name}`);
            }
        } else {
            console.warn(`Could not find ContentStack for button ${button.name}`);
        }
    }
}

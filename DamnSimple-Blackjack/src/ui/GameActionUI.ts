// src/ui/GameActionUI.ts
// Added onRequiresGlobalUpdate callback
// Updated insurance button logic
// Updated for split button and multi-hand context
import { Scene, KeyboardEventTypes, Vector2 } from "@babylonjs/core";
import { Button, TextBlock, Control, Rectangle, StackPanel, Vector2WithInfo } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame, PlayerHandInfo } from "../game/BlackjackGame"; // Import PlayerHandInfo
import { GameState } from "../game/GameState";
import { Constants } from "../Constants"; // Import Constants

interface ActionButtonDescriptor {
    id: 'hitButton' | 'standButton' | 'doubleButton' | 'splitButton' | 'insuranceButton' | 'leaveTableButton'; // Unique ID for the button instance
    name: string; // For Control.name, e.g., "hitButton", "leaveButton"
    initialText: string;
    key: string;
    color: string;
    action: () => void;
    instanceRef: (button: Button) => void; // Callback to assign the created button to the class property
}

export class GameActionUI extends BaseUI {
    private game: BlackjackGame;
    private hitButton!: Button;
    private standButton!: Button;
    private doubleButton!: Button;
    private splitButton!: Button;
    private insuranceButton!: Button;
    private leaveTableButton!: Button;

    private onNewGameRequest: () => void;
    private originalHitAction: () => void;
    private originalStandAction: () => void;
    private originalDoubleAction: () => void;
    private originalSplitAction: () => void;
    private originalInsuranceAction: () => void;
    private onChangeBetRequest: () => void;
    private onRequiresGlobalUpdate: () => void;
    private onLeaveTableRequest: () => void;

    constructor(
        scene: Scene,
        game: BlackjackGame,
        onNewGameRequest: () => void,
        onRequiresGlobalUpdate: () => void,
        onLeaveTableRequest: () => void
    ) {
        super(scene, "GameActionUI");
        this.game = game;
        this.onNewGameRequest = onNewGameRequest;
        this.onRequiresGlobalUpdate = onRequiresGlobalUpdate;
        this.onLeaveTableRequest = onLeaveTableRequest;

        this.originalHitAction = () => {
            if (!this.isGameBusy()) this.game.playerHit();
        };
        this.originalStandAction = () => {
            if (!this.isGameBusy()) this.game.playerStand();
        };
        this.originalDoubleAction = () => {
            if (!this.isGameBusy()) this.game.doubleDown();
        };
        this.originalSplitAction = () => {
            if (!this.isGameBusy()) this.game.playerSplit();
        };
        this.originalInsuranceAction = () => {
            if (!this.isGameBusy()) this.game.playerTakeInsurance();
        };
        this.onChangeBetRequest = () => {
            console.log("UI: 'Change Bet' action triggered");
            this.game.getGameActions().setGameState(GameState.Betting);
            setTimeout(() => this.onRequiresGlobalUpdate(), 0);
        };

        this.createVerticalActionButtons();
        this.setupKeyboardControls();
        this.update();
    }

    /** Helper to check if game logic or animations might be busy */
    private isGameBusy(): boolean {
        const controller = (window as any).gameController; // Access global controller if needed
        const isAnimating = controller?.isAnimating() ?? false;
        const gameState = this.game.getGameState();
        // Allow actions during PlayerTurn, or specific actions during GameOver
        const canActPlayerTurn = gameState === GameState.PlayerTurn;
        const canActGameOver = gameState === GameState.GameOver;

        if (isAnimating && !canActGameOver) { // Animations block actions unless it's game over options
            console.log("UI Action blocked: Animation in progress.");
            return true;
        }
        if (!canActPlayerTurn && !canActGameOver) {
            if (gameState !== GameState.Betting) { // Don't log for betting as no action buttons are shown
                console.log(`UI Action blocked: Invalid state (${GameState[gameState]})`);
            }
            return true;
        }
        return false;
    }

    /** Creates a single action button with text and key indicator. */
    private createActionButton(name: string, initialText: string, key: string, color: string, x: string, y: string, action: () => void): Button {
        const button = Button.CreateSimpleButton(name, "");
        button.width = "110px"; button.height = "80px";
        button.color = "white";
        button.background = color;
        button.cornerRadius = 10;
        button.thickness = 0;
        button.shadowBlur = 3;
        button.shadowColor = "rgba(0, 0, 0, 0.5)";
        button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        button.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        button.left = x;
        button.top = y;
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
        keyContainer.addControl(keyText);

        const buttonText = new TextBlock(`${name}ActionText`, initialText);
        buttonText.color = "white";
        buttonText.fontSize = 16;
        buttonText.textWrapping = true;
        buttonText.height = "30px";
        contentStack.addControl(buttonText);

        button.onPointerUpObservable.add(action);
        this.guiTexture.addControl(button);
        return button;
    }

    /** Creates and positions action buttons and separators vertically, centered on the right side. */
    private createVerticalActionButtons(): void {
        const rightMargin = "-5px";
        const buttonHeight = 80;
        const buttonSpacing = 5;
        const alpha = "0.7";

        const allButtons: ActionButtonDescriptor[] = [
            { id: 'hitButton', name: "hitButton", initialText: "Hit", key: "W", color: `rgba(0, 100, 0, ${alpha})`, action: this.originalHitAction, instanceRef: btn => this.hitButton = btn },
            { id: 'standButton', name: "standButton", initialText: "Stand", key: "S", color: `rgba(139, 0, 0, ${alpha})`, action: this.originalStandAction, instanceRef: btn => this.standButton = btn },
            { id: 'doubleButton', name: "doubleButton", initialText: "Double", key: "A", color: `rgba(0, 0, 139, ${alpha})`, action: this.originalDoubleAction, instanceRef: btn => this.doubleButton = btn },
            { id: 'splitButton', name: "splitButton", initialText: "Split", key: "E", color: `rgba(138, 43, 226, ${alpha})`, action: this.originalSplitAction, instanceRef: btn => this.splitButton = btn },
            { id: 'insuranceButton', name: "insuranceButton", initialText: "Insurance", key: "F", color: `rgba(255, 165, 0, ${alpha})`, action: this.originalInsuranceAction, instanceRef: btn => this.insuranceButton = btn },
            { id: 'leaveTableButton', name: "leaveButton", initialText: "Leave", key: "Q", color: `rgba(178, 34, 34, ${alpha})`, action: this.onLeaveTableRequest, instanceRef: btn => this.leaveTableButton = btn },
        ];

        let totalLayoutHeight = 0;
        if (allButtons.length > 0) {
            totalLayoutHeight = allButtons.length * buttonHeight + (allButtons.length - 1) * buttonSpacing;
        }

        let currentTopOffset = (this.guiTexture.idealHeight - totalLayoutHeight) / 2;

        allButtons.forEach((desc, index) => {
            const button = this.createActionButton(desc.name, desc.initialText, desc.key, desc.color, rightMargin, `${currentTopOffset}px`, desc.action);
            desc.instanceRef(button);
            currentTopOffset += buttonHeight;
            if (index < allButtons.length - 1) {
                currentTopOffset += buttonSpacing;
            }
        });
    }

    /** Sets up keyboard shortcuts (W, S, A, E, F, Q) to trigger button actions. */
    private setupKeyboardControls(): void {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
                if (this.isGameBusy() && this.game.getGameState() !== GameState.GameOver) return;

                const dummyPointerInfo = new Vector2WithInfo(Vector2.Zero(), 0);

                switch (kbInfo.event.key.toLowerCase()) {
                    case 'w':
                        if (this.hitButton.isVisible && this.hitButton.isEnabled) {
                            this.hitButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            kbInfo.event.preventDefault();
                        }
                        break;
                    case 's':
                        if (this.standButton.isVisible && this.standButton.isEnabled) {
                            this.standButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            kbInfo.event.preventDefault();
                        }
                        break;
                    case 'a':
                        if (this.doubleButton.isVisible && this.doubleButton.isEnabled) {
                            this.doubleButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            kbInfo.event.preventDefault();
                        }
                        break;
                    case 'e': // Split
                        if (this.splitButton.isVisible && this.splitButton.isEnabled) {
                            this.splitButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            kbInfo.event.preventDefault();
                        }
                        break;
                    case 'f': // Insurance
                        if (this.insuranceButton.isVisible && this.insuranceButton.isEnabled) {
                            this.insuranceButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            kbInfo.event.preventDefault();
                        }
                        break;
                    case 'q':
                        if (this.leaveTableButton.isVisible && this.leaveTableButton.isEnabled) {
                            this.leaveTableButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            kbInfo.event.preventDefault();
                        }
                        break;
                }
            }
        });
    }

    public update(isAnimating: boolean = false): void {
        const gameState = this.game.getGameState();
        const activeHandInfo = this.game.getActivePlayerHandInfo();

        let showHit = false, showStand = false, showDouble = false, showSplit = false, showInsurance = false, showLeave = false;
        let hitText = "Hit";
        let standText = "Stand";
        let doubleText = "Double";
        let splitText = "Split";
        let insuranceText = "Insurance";
        let hitAction = this.originalHitAction;
        let standAction = this.originalStandAction;
        let doubleAction = this.originalDoubleAction;
        let splitAction = this.originalSplitAction;
        let insuranceAction = this.originalInsuranceAction;

        if (gameState === GameState.PlayerTurn && activeHandInfo && activeHandInfo.canHit && !activeHandInfo.isResolved) {
            showHit = true;
            showStand = true;
            showDouble = activeHandInfo.cards.length === 2 && this.game.getPlayerFunds() >= activeHandInfo.bet;
            showSplit = this.game.canSplit(); // Uses game.canSplit which checks active hand
            showInsurance = this.game.isInsuranceAvailable(); // Checks overall game state for insurance offer
            showLeave = true;
        } else if (gameState === GameState.GameOver) {
            showHit = true; // "Same Bet"
            showStand = true; // "Change Bet"
            showDouble = false;
            showSplit = false;
            showInsurance = false;
            showLeave = true;

            hitText = "Same Bet";
            standText = "Change Bet";
            hitAction = this.onNewGameRequest;
            standAction = this.onChangeBetRequest;
        } else if (gameState === GameState.Betting || gameState === GameState.Initial) {
            showLeave = true; // Can always leave if in betting or initial state
        }


        this.hitButton.isVisible = showHit;
        this.standButton.isVisible = showStand;
        this.doubleButton.isVisible = showDouble;
        this.splitButton.isVisible = showSplit;
        this.insuranceButton.isVisible = showInsurance;
        this.leaveTableButton.isVisible = showLeave;

        if (showHit) { this.updateButtonLabel(this.hitButton, hitText); this.updateButtonAction(this.hitButton, hitAction); }
        if (showStand) { this.updateButtonLabel(this.standButton, standText); this.updateButtonAction(this.standButton, standAction); }
        if (showDouble) { this.updateButtonLabel(this.doubleButton, doubleText); this.updateButtonAction(this.doubleButton, doubleAction); }
        if (showSplit) { this.updateButtonLabel(this.splitButton, splitText); this.updateButtonAction(this.splitButton, splitAction); }
        if (showInsurance) { this.updateButtonLabel(this.insuranceButton, insuranceText); this.updateButtonAction(this.insuranceButton, insuranceAction); }

        const enableActions = (!isAnimating || gameState === GameState.GameOver) && (gameState === GameState.PlayerTurn || gameState === GameState.GameOver);

        this.hitButton.isEnabled = enableActions && showHit && (activeHandInfo ? activeHandInfo.canHit : true); // Latter true for GameOver
        this.standButton.isEnabled = enableActions && showStand && (activeHandInfo ? activeHandInfo.canHit : true); // Latter true for GameOver

        this.doubleButton.isEnabled = enableActions && showDouble && activeHandInfo && activeHandInfo.cards.length === 2 &&
            this.game.getPlayerFunds() >= activeHandInfo.bet && activeHandInfo.canHit;
        this.splitButton.isEnabled = enableActions && showSplit && this.game.canSplit() && activeHandInfo && activeHandInfo.canHit; // canSplit already checks funds

        const insuranceCost = activeHandInfo ? activeHandInfo.bet * Constants.INSURANCE_BET_RATIO : this.game.getCurrentBet() * Constants.INSURANCE_BET_RATIO;
        this.insuranceButton.isEnabled = enableActions && showInsurance && this.game.isInsuranceAvailable() &&
            this.game.getPlayerFunds() >= insuranceCost;

        const canLeave = showLeave && (gameState === GameState.Betting || gameState === GameState.GameOver || gameState === GameState.Initial || gameState === GameState.PlayerTurn);
        this.leaveTableButton.isEnabled = (!isAnimating || gameState === GameState.GameOver) && canLeave;


        this.hitButton.alpha = this.hitButton.isEnabled ? 1.0 : 0.5;
        this.standButton.alpha = this.standButton.isEnabled ? 1.0 : 0.5;
        this.doubleButton.alpha = this.doubleButton.isEnabled ? 1.0 : 0.5;
        this.splitButton.alpha = this.splitButton.isEnabled ? 1.0 : 0.5;
        this.insuranceButton.alpha = this.insuranceButton.isEnabled ? 1.0 : 0.5;
        this.leaveTableButton.alpha = this.leaveTableButton.isEnabled ? 1.0 : 0.5;
    }

    /** Helper to safely update a button's click action. Clears previous observers first. */
    private updateButtonAction(button: Button, action: () => void): void {
        button.onPointerUpObservable.clear();
        button.onPointerUpObservable.add(action);
    }

    /** Helper to safely update the text label within a button's content stack. */
    private updateButtonLabel(button: Button, text: string): void {
        const contentStack = button.getChildByName(`${button.name}ContentStack`) as StackPanel;
        if (contentStack) {
            const textBlock = contentStack.getChildByName(`${button.name}ActionText`) as TextBlock;
            if (textBlock) {
                if (textBlock.text !== text) {
                    textBlock.text = text;
                }
            } else {
                console.warn(`Could not find ActionText for button ${button.name}`);
            }
        } else {
            console.warn(`Could not find ContentStack for button ${button.name}`);
        }
    }
}

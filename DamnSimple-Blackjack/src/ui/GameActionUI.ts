// src/ui/gameactionui-ts
// Added onRequiresGlobalUpdate callback
import { Scene, KeyboardEventTypes, Vector2 } from "@babylonjs/core";
import { Button, TextBlock, Control, Rectangle, StackPanel, Vector2WithInfo } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState } from "../game/GameState";

export class GameActionUI extends BaseUI {
    private game: BlackjackGame;
    private hitButton!: Button;
    private standButton!: Button;
    private doubleButton!: Button;
    private onNewGameRequest: () => void; // Callback for "Same Bet" action
    private originalHitAction: () => void;
    private originalStandAction: () => void;
    private originalDoubleAction: () => void;
    private onChangeBetRequest: () => void; // Callback for "Change Bet" action
    private onRequiresGlobalUpdate: () => void; // *** ADDED: Callback to trigger GameUI.update() ***

    constructor(
        scene: Scene,
        game: BlackjackGame,
        onNewGameRequest: () => void,
        onRequiresGlobalUpdate: () => void // *** ADDED: Parameter for the callback ***
    ) {
        super(scene, "GameActionUI");
        this.game = game;
        this.onNewGameRequest = onNewGameRequest; // Store the "Same Bet" callback
        this.onRequiresGlobalUpdate = onRequiresGlobalUpdate; // *** ADDED: Store the global update callback ***

        // Define original game actions
        this.originalHitAction = () => {
            if (!this.isGameBusy()) this.game.playerHit();
        };
        this.originalStandAction = () => {
            if (!this.isGameBusy()) this.game.playerStand();
        };
        this.originalDoubleAction = () => {
            if (!this.isGameBusy()) this.game.doubleDown();
        };
        // Define action for the "Change Bet" button (repurposed Stand button in GameOver)
        this.onChangeBetRequest = () => {
            // No need to check isGameBusy here, this button is only active in GameOver state
            console.log("UI: 'Change Bet' action triggered");
            this.game.getGameActions().setGameState(GameState.Betting);
            // *** CHANGED: Call the global update callback asynchronously ***
            setTimeout(() => this.onRequiresGlobalUpdate(), 0);
        };

        this.createCircularButtons();
        this.setupKeyboardControls();
        this.update();
    }

    /** Helper to check if game logic or animations might be busy */
    private isGameBusy(): boolean {
        // Check if controller reports animation in progress OR if game state prevents action
        // This provides a basic guard against clicking too fast.
        const controller = (window as any).gameController; // Access global controller if available
        const isAnimating = controller?.isAnimating() ?? false;
        const gameState = this.game.getGameState();
        // Allow actions in PlayerTurn or GameOver (for Same/Change Bet)
        const canAct = gameState === GameState.PlayerTurn || gameState === GameState.GameOver;

        // Allow clicks in GameOver even if minor animation residue exists from previous hand ending
        if (isAnimating && gameState !== GameState.GameOver) {
            console.log("UI Action blocked: Animation in progress.");
            return true;
        }
        // Block if NOT in an actionable state (PlayerTurn or GameOver)
        if (!canAct) {
             // Don't log blockage if the state is Betting, as that's expected after Change Bet
             if (gameState !== GameState.Betting) {
                console.log(`UI Action blocked: Invalid state (${GameState[gameState]})`);
             }
             return true;
        }
        return false;
    }

    /** Creates a single action button with text and key indicator. */
    private createActionButton(name: string, initialText: string, key: string, color: string, x: number, y: number, action: () => void): Button {
        const button = Button.CreateSimpleButton(name, ""); // Text set via TextBlock later
        button.width = "110px"; button.height = "80px";
        button.color = "white"; // Text color (for key indicator)
        button.background = color; // Button background color
        button.cornerRadius = 10; button.thickness = 2; button.shadowBlur = 5; button.shadowColor = "#333";
        button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        button.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        // Position relative to bottom-center alignment point
        button.left = `${x}px`; // Horizontal offset
        button.top = `${y - 40}px`; // Vertical offset (adjusting for button height)
        button.isVisible = false; // Controlled by update()

        // --- Button Content (Key + Text) ---
        const contentStack = new StackPanel(`${name}ContentStack`);
        contentStack.isVertical = true;
        contentStack.spacing = 2;
        button.addControl(contentStack);

        // Key Indicator (Small rectangle with key letter)
        const keyContainer = new Rectangle(`${name}KeyRect`);
        keyContainer.width = "25px"; keyContainer.height = "20px";
        keyContainer.background = "rgba(255, 255, 255, 0.8)"; // White background for key
        keyContainer.color = "black"; // Text color for key
        keyContainer.cornerRadius = 4;
        keyContainer.thickness = 0;
        keyContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        contentStack.addControl(keyContainer);

        const keyText = new TextBlock(`${name}KeyText`, key);
        keyText.color = "black"; // Key text color
        keyText.fontSize = 12;
        keyContainer.addControl(keyText); // Add key text to its container

        // Action Text (e.g., "Hit", "Stand")
        const buttonText = new TextBlock(`${name}ActionText`, initialText);
        buttonText.color = "white"; // Action text color
        buttonText.fontSize = 16;
        buttonText.textWrapping = true;
        buttonText.height = "30px";
        contentStack.addControl(buttonText);
        // --- End Button Content ---

        button.onPointerUpObservable.add(action); // Add initial action
        this.guiTexture.addControl(button);
        return button;
    }

    /** Creates and positions the Hit, Stand, and Double buttons in a circular layout. */
    private createCircularButtons(): void {
        const centerX = 0; // Center horizontally
        const centerY = -240; // Vertical offset from bottom edge (more negative = higher up)
        const radius = 100; // Radius of the circular layout

        // Calculate button positions
        const hitY = centerY - radius; // Top button
        const standY = centerY + radius; // Bottom button
        const doubleX = centerX - radius; // Left button

        // Create buttons
        this.hitButton = this.createActionButton("hitButton", "Hit", "W", "darkgreen", centerX, hitY, this.originalHitAction);
        this.standButton = this.createActionButton("standButton", "Stand", "S", "darkred", centerX, standY, this.originalStandAction);
        this.doubleButton = this.createActionButton("doubleButton", "Double", "A", "darkblue", doubleX, centerY, this.originalDoubleAction);
    }

    /** Sets up keyboard shortcuts (W, S, A) to trigger button actions. */
    private setupKeyboardControls(): void {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
                // Use the same busy check as button clicks
                if (this.isGameBusy()) return;

                // Create a dummy pointer info object as notifyObservers expects one
                const dummyPointerInfo = new Vector2WithInfo(Vector2.Zero(), 0);

                switch (kbInfo.event.key.toLowerCase()) {
                    case 'w':
                        if (this.hitButton.isVisible && this.hitButton.isEnabled) {
                            this.hitButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            kbInfo.event.preventDefault(); // Prevent default browser action
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
                }
            }
        });
    }

    /**
     * Updates the visibility, text, actions, and enabled state of the action buttons
     * based on the current game state and animation status.
     * @param isAnimating True if a visual animation is currently in progress.
     */
    public update(isAnimating: boolean = false): void {
        const gameState = this.game.getGameState();
        let showHit = false, showStand = false, showDouble = false;
        let hitText = "Hit";
        let standText = "Stand";
        let doubleText = "Double";
        let hitAction = this.originalHitAction;
        let standAction = this.originalStandAction;
        let doubleAction = this.originalDoubleAction;

        // Determine button visibility, text, and actions based on game state
        if (gameState === GameState.PlayerTurn) {
            showHit = true;
            showStand = true;
            // Show Double only if player has 2 cards and enough funds for the *current* bet
            showDouble = this.game.getPlayerHand().length === 2 &&
                         this.game.getPlayerFunds() >= this.game.getCurrentBet();
            // Actions are the original game actions
        } else if (gameState === GameState.GameOver) {
            showHit = true;  // Repurpose Hit button for "Same Bet" (New Game)
            showStand = true; // Repurpose Stand button for "Change Bet" (Go to Betting)
            showDouble = false; // Hide Double button

            hitText = "Same Bet"; // Text for New Game
            standText = "Change Bet"; // Text for going to Betting state
            hitAction = this.onNewGameRequest; // Action is the callback passed in constructor
            standAction = this.onChangeBetRequest; // Action to switch to Betting state
        }
        // In other states (Initial, Betting, DealerTurn), all action buttons are hidden

        // Update visibility first
        this.hitButton.isVisible = showHit;
        this.standButton.isVisible = showStand;
        this.doubleButton.isVisible = showDouble;

        // Update labels and actions only for buttons that *should* be visible
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

        // Update enabled state based on animation status and specific conditions
        // Generally, buttons are disabled if animating, except maybe in GameOver
        const enable = !isAnimating || gameState === GameState.GameOver; // Allow clicks in GameOver even if animating

        this.hitButton.isEnabled = enable && showHit;
        this.standButton.isEnabled = enable && showStand;
        // Double button requires an additional check for sufficient funds *again*
        const canDouble = showDouble && this.game.getPlayerFunds() >= this.game.getCurrentBet();
        this.doubleButton.isEnabled = enable && canDouble;

        // Update visual alpha for enabled/disabled state (e.g., fade disabled buttons)
        this.hitButton.alpha = this.hitButton.isEnabled ? 1.0 : 0.5;
        this.standButton.alpha = this.standButton.isEnabled ? 1.0 : 0.5;
        this.doubleButton.alpha = this.doubleButton.isEnabled ? 1.0 : 0.5;
    }

    /** Helper to safely update a button's click action. Clears previous observers first. */
    private updateButtonAction(button: Button, action: () => void): void {
        // Check if the action is already assigned to prevent redundant clears/adds if possible
        // This requires storing the currently assigned action, which adds complexity.
        // For simplicity, always clear and add.
        button.onPointerUpObservable.clear();
        button.onPointerUpObservable.add(action);
    }

    /** Helper to safely update the text label within a button's content stack. */
    private updateButtonLabel(button: Button, text: string): void {
        // Find the TextBlock within the button's content structure
        const contentStack = button.getChildByName(`${button.name}ContentStack`) as StackPanel;
        if (contentStack) {
            const textBlock = contentStack.getChildByName(`${button.name}ActionText`) as TextBlock;
            if (textBlock) {
                if (textBlock.text !== text) { // Update only if text changed
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

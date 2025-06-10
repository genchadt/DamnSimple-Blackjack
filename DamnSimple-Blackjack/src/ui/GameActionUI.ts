// src/ui/gameactionui-ts
// Added onRequiresGlobalUpdate callback
import { Scene, KeyboardEventTypes, Vector2 } from "@babylonjs/core";
import { Button, TextBlock, Control, Rectangle, StackPanel, Vector2WithInfo } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState } from "../game/GameState";

interface ActionButtonDescriptor {
    id: 'hitButton' | 'standButton' | 'doubleButton' | 'splitButton' | 'insuranceButton' | 'leaveTableButton'; // Unique ID for the button instance
    name: string; // For Control.name, e.g., "hitButton", "leaveButton"
    initialText: string;
    key: string;
    color: string;
    action: () => void;
    instanceRef: (button: Button) => void; // Callback to assign the created button to the class property
    // group: 'main' | 'leave'; // Removed, grouping handled by buttonGroups structure
}

export class GameActionUI extends BaseUI {
    private game: BlackjackGame;
    private hitButton!: Button;
    private standButton!: Button;
    private doubleButton!: Button;
    private splitButton!: Button; // Added
    private insuranceButton!: Button; // Added
    private leaveTableButton!: Button;
    // private mainActionSeparator!: Rectangle; // Removed

    private onNewGameRequest: () => void;
    private originalHitAction: () => void;
    private originalStandAction: () => void;
    private originalDoubleAction: () => void;
    private originalSplitAction: () => void; // Added
    private originalInsuranceAction: () => void; // Added
    private onChangeBetRequest: () => void; // Callback for "Change Bet" action
    private onRequiresGlobalUpdate: () => void; // *** ADDED: Callback to trigger GameUI.update() ***
    private onLeaveTableRequest: () => void; // Added for Leave Table action

    constructor(
        scene: Scene,
        game: BlackjackGame,
        onNewGameRequest: () => void,
        onRequiresGlobalUpdate: () => void, // *** ADDED: Parameter for the callback ***
        onLeaveTableRequest: () => void // Added
    ) {
        super(scene, "GameActionUI");
        this.game = game;
        this.onNewGameRequest = onNewGameRequest; // Store the "Same Bet" callback
        this.onRequiresGlobalUpdate = onRequiresGlobalUpdate; // *** ADDED: Store the global update callback ***
        this.onLeaveTableRequest = onLeaveTableRequest; // Store the Leave Table callback

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
        this.originalSplitAction = () => { // Added
            // Placeholder: Implement game.playerSplit()
            if (!this.isGameBusy()) console.log("Player Split action (not implemented)");
            // if (!this.isGameBusy()) this.game.playerSplit(); 
        };
        this.originalInsuranceAction = () => { // Added
            // Placeholder: Implement game.playerTakeInsurance()
            if (!this.isGameBusy()) console.log("Player Insurance action (not implemented)");
            // if (!this.isGameBusy()) this.game.playerTakeInsurance();
        };
        // Define action for the "Change Bet" button (repurposed Stand button in GameOver)
        this.onChangeBetRequest = () => {
            // No need to check isGameBusy here, this button is only active in GameOver state
            console.log("UI: 'Change Bet' action triggered");
            this.game.getGameActions().setGameState(GameState.Betting);
            // *** CHANGED: Call the global update callback asynchronously ***
            setTimeout(() => this.onRequiresGlobalUpdate(), 0);
        };

        this.createVerticalActionButtons(); // Renamed from createCircularButtons
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
    private createActionButton(name: string, initialText: string, key: string, color: string, x: string, y: string, action: () => void): Button {
        const button = Button.CreateSimpleButton(name, ""); // Text set via TextBlock later
        button.width = "110px"; button.height = "80px";
        button.color = "white"; // Text color (for key indicator)
        button.background = color; // Button background color - will be an RGBA string
        button.cornerRadius = 10; 
        button.thickness = 0; // Remove border
        button.shadowBlur = 3; // Slightly reduced shadow blur
        button.shadowColor = "rgba(0, 0, 0, 0.5)"; // Slightly softer shadow color
        button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT; // Align to the right edge
        button.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;   // Align to the top for stacking
        // Position relative to top-right alignment point
        button.left = x; // Horizontal offset from right edge (e.g., "-5px")
        button.top = y;  // Vertical offset from top edge (e.g., "150px")
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

    /** Creates and positions action buttons and separators vertically, centered on the right side. */
    private createVerticalActionButtons(): void {
        const rightMargin = "-5px";
        // const buttonWidth = "110px"; // Match button.width in createActionButton - not needed here directly
        const buttonHeight = 80;    // Match button.height in createActionButton
        const buttonSpacing = 5;    // Vertical spacing between all buttons
        const alpha = "0.7"; // Alpha for mica-like transparency

        // Define all buttons in a single list, in the order they should appear vertically.
        const allButtons: ActionButtonDescriptor[] = [
            { id: 'hitButton', name: "hitButton", initialText: "Hit", key: "W", color: `rgba(0, 100, 0, ${alpha})`, action: this.originalHitAction, instanceRef: btn => this.hitButton = btn }, // Dark Green Mica
            { id: 'standButton', name: "standButton", initialText: "Stand", key: "S", color: `rgba(139, 0, 0, ${alpha})`, action: this.originalStandAction, instanceRef: btn => this.standButton = btn }, // Dark Red Mica
            { id: 'doubleButton', name: "doubleButton", initialText: "Double", key: "A", color: `rgba(0, 0, 139, ${alpha})`, action: this.originalDoubleAction, instanceRef: btn => this.doubleButton = btn }, // Dark Blue Mica
            { id: 'splitButton', name: "splitButton", initialText: "Split", key: "E", color: `rgba(138, 43, 226, ${alpha})`, action: this.originalSplitAction, instanceRef: btn => this.splitButton = btn }, // BlueViolet Mica
            { id: 'insuranceButton', name: "insuranceButton", initialText: "Insurance", key: "F", color: `rgba(255, 165, 0, ${alpha})`, action: this.originalInsuranceAction, instanceRef: btn => this.insuranceButton = btn }, // Orange Mica
            { id: 'leaveTableButton', name: "leaveButton", initialText: "Leave", key: "Q", color: `rgba(178, 34, 34, ${alpha})`, action: this.onLeaveTableRequest, instanceRef: btn => this.leaveTableButton = btn }, // Firebrick Red Mica
        ];

        // Calculate total layout height for centering
        let totalLayoutHeight = 0;
        if (allButtons.length > 0) {
            totalLayoutHeight = allButtons.length * buttonHeight + (allButtons.length - 1) * buttonSpacing;
        }
        
        let currentTopOffset = (this.guiTexture.idealHeight - totalLayoutHeight) / 2;

        // Create buttons one by one
        allButtons.forEach((desc, index) => {
            const button = this.createActionButton(desc.name, desc.initialText, desc.key, desc.color, rightMargin, `${currentTopOffset}px`, desc.action);
            desc.instanceRef(button);
            currentTopOffset += buttonHeight;
            if (index < allButtons.length - 1) { // Add spacing if not the last button
                currentTopOffset += buttonSpacing;
            }
        });
    }

    /** Sets up keyboard shortcuts (W, S, A, Q) to trigger button actions. */
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
                    case 'e': // Added for Split
                        if (this.splitButton.isVisible && this.splitButton.isEnabled) {
                            this.splitButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            kbInfo.event.preventDefault();
                        }
                        break;
                    case 'f': // Added for Insurance
                        if (this.insuranceButton.isVisible && this.insuranceButton.isEnabled) {
                            this.insuranceButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
                            kbInfo.event.preventDefault();
                        }
                        break;
                    case 'q': // Added for Leave Table
                        if (this.leaveTableButton.isVisible && this.leaveTableButton.isEnabled) {
                            this.leaveTableButton.onPointerUpObservable.notifyObservers(dummyPointerInfo);
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
        let showHit = false, showStand = false, showDouble = false, showSplit = false, showInsurance = false, showLeave = false;
        let hitText = "Hit";
        let standText = "Stand";
        let doubleText = "Double";
        let splitText = "Split"; // Added
        let insuranceText = "Insurance"; // Added
        let hitAction = this.originalHitAction;
        let standAction = this.originalStandAction;
        let doubleAction = this.originalDoubleAction;
        let splitAction = this.originalSplitAction; // Added
        let insuranceAction = this.originalInsuranceAction; // Added

        // Determine button visibility, text, and actions based on game state
        if (gameState === GameState.PlayerTurn) {
            showHit = true;
            showStand = true;
            // Show Double only if player has 2 cards and enough funds for the *current* bet
            showDouble = this.game.getPlayerHand().length === 2 &&
                         this.game.getPlayerFunds() >= this.game.getCurrentBet();
            
            // Placeholder: Assume game object has methods to check for these conditions
            // @ts-ignore - Assuming game.canSplit and game.isInsuranceAvailable will be implemented
            showSplit = this.game.canSplit ? this.game.canSplit() : false; 
            // @ts-ignore
            showInsurance = this.game.isInsuranceAvailable ? this.game.isInsuranceAvailable() : false;

            // Actions are the original game actions
            showLeave = true; // Leave button is generally available when actions are
        } else if (gameState === GameState.GameOver) {
            showHit = true;  // Repurpose Hit button for "Same Bet" (New Game)
            showStand = true; // Repurpose Stand button for "Change Bet" (Go to Betting)
            showDouble = false; // Hide Double button
            showSplit = false; // Hide Split button
            showInsurance = false; // Hide Insurance button
            showLeave = true; // Leave button available in GameOver

            hitText = "Same Bet"; // Text for New Game
            standText = "Change Bet"; // Text for going to Betting state
            hitAction = this.onNewGameRequest; // Action is the callback passed in constructor
            standAction = this.onChangeBetRequest; // Action to switch to Betting state
        } else if (gameState === GameState.Betting) {
            showLeave = true; // Allow leaving during betting
        }
        // In other states (Initial, DealerTurn), all action buttons are hidden, except Leave if not Initial
        if (gameState !== GameState.Initial) {
            showLeave = true;
        }


        // Update visibility first
        this.hitButton.isVisible = showHit;
        this.standButton.isVisible = showStand;
        this.doubleButton.isVisible = showDouble;
        this.splitButton.isVisible = showSplit; // Added
        this.insuranceButton.isVisible = showInsurance; // Added
        this.leaveTableButton.isVisible = showLeave;

        // Separator visibility: - REMOVED
        // if (this.mainActionSeparator) { 
        //     const anyMainActionVisible = showHit || showStand || showDouble;
        //     this.mainActionSeparator.isVisible = anyMainActionVisible && showLeave;
        // }

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
        if (showSplit) { // Added
            this.updateButtonLabel(this.splitButton, splitText);
            this.updateButtonAction(this.splitButton, splitAction);
        }
        if (showInsurance) { // Added
            this.updateButtonLabel(this.insuranceButton, insuranceText);
            this.updateButtonAction(this.insuranceButton, insuranceAction);
        }
        // Leave button label and action are fixed, no need to update them here unless they change dynamically

        // Update enabled state based on animation status and specific conditions
        // Generally, buttons are disabled if animating, except maybe in GameOver
        const enable = !isAnimating || gameState === GameState.GameOver; // Allow clicks in GameOver even if animating

        this.hitButton.isEnabled = enable && showHit;
        this.standButton.isEnabled = enable && showStand;
        // Double button requires an additional check for sufficient funds *again*
        const canDouble = showDouble && this.game.getPlayerFunds() >= this.game.getCurrentBet();
        this.doubleButton.isEnabled = enable && canDouble;

        // Split button enabled state (placeholder, assumes game.canSplit checks funds etc.)
        // @ts-ignore
        const canSplit = showSplit && (this.game.canSplit ? this.game.canSplit() : false);
        this.splitButton.isEnabled = enable && canSplit; // Added

        // Insurance button enabled state (placeholder)
        // @ts-ignore
        const canTakeInsurance = showInsurance && (this.game.isInsuranceAvailable ? this.game.isInsuranceAvailable() : false);
        this.insuranceButton.isEnabled = enable && canTakeInsurance; // Added


        // Leave Table button enabled statesssw
        const canLeave = showLeave && (gameState === GameState.Betting || gameState === GameState.GameOver || gameState === GameState.PlayerTurn);
        this.leaveTableButton.isEnabled = enable && canLeave;


        // Update visual alpha for enabled/disabled state (e.g., fade disabled buttons)
        this.hitButton.alpha = this.hitButton.isEnabled ? 1.0 : 0.5;
        this.standButton.alpha = this.standButton.isEnabled ? 1.0 : 0.5;
        this.doubleButton.alpha = this.doubleButton.isEnabled ? 1.0 : 0.5;
        this.splitButton.alpha = this.splitButton.isEnabled ? 1.0 : 0.5; // Added
        this.insuranceButton.alpha = this.insuranceButton.isEnabled ? 1.0 : 0.5; // Added
        this.leaveTableButton.alpha = this.leaveTableButton.isEnabled ? 1.0 : 0.5;
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
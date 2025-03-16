// ui/GameActionUI.ts
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
    private splitButton!: Button;
    private onUpdate: () => void;

    /**
     * Initializes a new instance of the GameActionUI class.
     * 
     * @param {Scene} scene - The Babylon.js scene to which the UI belongs.
     * @param {BlackjackGame} game - The game logic instance to interact with.
     * @param {() => void} onUpdate - Callback function to call when the UI should be updated.
     * 
     * This constructor sets up the UI components necessary for the blackjack game
     * actions (Hit, Stand, Double, Split) and their corresponding keyboard shortcuts.
     * It also triggers an initial update to ensure the UI reflects the current game state.
     */
    constructor(scene: Scene, game: BlackjackGame, onUpdate: () => void) {
        super(scene);
        this.game = game;
        this.onUpdate = onUpdate;
        
        // Create action buttons in circular layout
        this.createCircularButtons();
        this.setupKeyboardControls();
    }

    /**
     * Creates a new action button with the given properties and adds it to the UI.
     * The button is configured with a white background, a key indicator with the given key,
     * and the given text below the key indicator.
     * 
     * @param {string} name - The name of the button.
     * @param {string} text - The text to display on the button.
     * @param {string} key - The key to display on the button.
     * @param {string} color - The background color of the button.
     * @param {number} x - The x-coordinate of the button.
     * @param {number} y - The y-coordinate of the button.
     * @param {() => void} action - The callback function to call when the button is clicked.
     * @returns The newly created button.
     */
    private createActionButton(name: string, text: string, key: string, color: string, x: number, y: number, action: () => void): Button {
        const button = Button.CreateSimpleButton(name, "");
        button.width = "120px";
        button.height = "60px";
        button.color = "white";
        button.background = color;
        button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        button.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        button.left = x + "px";
        button.top = y + "px";
        button.isVisible = false;
        button.thickness = 2;
        
        // Create the key indicator
        const keyContainer = new Rectangle();
        keyContainer.width = "30px";
        keyContainer.height = "24px";
        keyContainer.background = "white";
        keyContainer.color = "black";
        keyContainer.cornerRadius = 4;
        keyContainer.thickness = 1;
        keyContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        keyContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        keyContainer.top = "5px"; // Position it inside the button
        button.addControl(keyContainer);
        
        const keyText = new TextBlock();
        keyText.text = key;
        keyText.color = "black";
        keyText.fontSize = 14;
        keyContainer.addControl(keyText);
        
        // Add the button text below the key indicator
        const buttonText = new TextBlock();
        buttonText.text = text;
        buttonText.color = "white";
        buttonText.fontSize = 18;
        buttonText.top = "30px"; // Position it below the key indicator
        button.addControl(buttonText);
        
        // Add the action
        button.onPointerClickObservable.add(action);
        this.guiTexture.addControl(button);
        
        // Store the button in the appropriate property
        if (name === "hitButton") this.hitButton = button;
        else if (name === "standButton") this.standButton = button;
        else if (name === "doubleButton") this.doubleButton = button;
        else if (name === "splitButton") this.splitButton = button;
        
        return button;
    }

    /**
     * Creates and positions the action buttons ("Hit", "Stand", "Double", "Split") in a circular layout.
     * The buttons are arranged around a central point with a specified radius.
     * Each button is associated with a keyboard key ("W", "S", "A", "D") and executes a specific game
     * action when clicked, updating the UI accordingly.
     */
    private createCircularButtons(): void {
        // Create a center point for our circular layout
        const centerX = 0;
        const centerY = 150;
        const radius = 120;
        
        // Create the buttons with proper structure
        this.createActionButton("hitButton", "Hit", "W", "green", centerX, centerY - radius, () => {
            this.game.playerHit();
            this.onUpdate();
        });
        
        this.createActionButton("standButton", "Stand", "S", "red", centerX, centerY + radius, () => {
            this.game.playerStand();
            this.onUpdate();
        });
        
        this.createActionButton("doubleButton", "Double", "A", "blue", centerX - radius, centerY, () => {
            this.game.doubleDown();
            this.onUpdate();
        });
        
        this.createActionButton("splitButton", "Split", "D", "purple", centerX + radius, centerY, () => {
            // Split functionality would go here
            console.log("Split not implemented yet");
        });
    }

    /**
     * Sets up keyboard event listeners for the WASD controls, binding the proper
     * game actions to each key. This allows the player to interact with the game
     * using the keyboard in addition to the on-screen buttons.
     */
    private setupKeyboardControls(): void {
        // Add keyboard event listeners for WASD controls
        this.scene.onKeyboardObservable.add((kbInfo) => {
            switch (kbInfo.type) {
                case KeyboardEventTypes.KEYDOWN:
                    switch (kbInfo.event.key.toLowerCase()) {
                        case 'w':
                            if (this.hitButton.isVisible && this.hitButton.isEnabled) {
                                // Just trigger the action directly
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
                                console.log("Split not implemented yet");
                            }
                            break;
                    }
                    break;
            }
        });
    }

    /**
     * Displays the action buttons for the player's turn.
     * - The "Hit" and "Stand" buttons are always visible.
     * - The "Double" button is visible only when the player has exactly two cards.
     * - The "Split" button is visible only if the player can split their hand.
     */
    public showForPlayerTurn(): void {
        this.hitButton.isVisible = true;
        this.standButton.isVisible = true;
        this.doubleButton.isVisible = this.game.getPlayerHand().length === 2;
        this.splitButton.isVisible = this.game.canSplit();
    }
    
    /**
     * Hides all action buttons, so that they do not appear on the UI.
     * This is called when the player's turn is over, and the buttons should not
     * be visible until the next player turn.
     */
    public hideAll(): void {
        this.hitButton.isVisible = false;
        this.standButton.isVisible = false;
        this.doubleButton.isVisible = false;
        this.splitButton.isVisible = false;
    }

    /**
     * Updates the GameActionUI to reflect the current state of the game.
     * If the game is in the PlayerTurn state, shows the "Hit", "Stand", "Double", and "Split" buttons
     * with the appropriate text and behaviors. If the game is in the GameOver state, shows the
     * "New Game" and "Change Bet" buttons with the appropriate text and behaviors. In all other
     * states, hides all buttons.
     */
    public update(): void {
        if (this.game.getGameState() === GameState.PlayerTurn) {
            // Show normal game action buttons during player's turn
            this.hitButton.isVisible = true;
            this.standButton.isVisible = true;
            
            // Double Down only available on first action (2 cards)
            this.doubleButton.isVisible = this.game.getPlayerHand().length === 2;
            
            // Split only when player has two cards of the same value
            this.splitButton.isVisible = this.game.canSplit();
            
            // Update button text
            this.updateButtonText("Hit", "Stand", "Double", "Split");
            
        } else if (this.game.getGameState() === GameState.GameOver) {
            // Show "New Game" and "Change Bet" after game over
            this.hitButton.isVisible = true;
            this.standButton.isVisible = true;
            this.doubleButton.isVisible = false;
            this.splitButton.isVisible = false;
            
            // Update button text
            this.updateButtonText("New Game", "Change Bet", "", "");
            
            // Update the functional behavior for these buttons
            this.updateButtonActions(
                // Hit button now starts new game
                () => {
                    this.game.startNewGame(this.game.getCurrentBet());
                    this.onUpdate();
                },
                // Stand button now shows betting UI
                () => {
                    this.game.setGameState(GameState.Betting);
                    this.onUpdate();
                }
            );
        } else {
            // Hide all buttons for other game states
            this.hideAll();
        }
    }

    /**
     * Updates the functional behavior of the Hit and Stand buttons.
     * Clears any existing click actions from the buttons and adds new
     * actions as specified by the parameters. The Hit button is given the
     * hitAction and the Stand button is given the standAction.
     * 
     * @param hitAction the action to perform when the Hit button is clicked
     * @param standAction the action to perform when the Stand button is clicked
     */
    private updateButtonActions(hitAction: () => void, standAction: () => void): void {
        // Clear existing actions
        this.hitButton.onPointerClickObservable.clear();
        this.standButton.onPointerClickObservable.clear();
        
        // Add new actions
        this.hitButton.onPointerClickObservable.add(hitAction);
        this.standButton.onPointerClickObservable.add(standAction);
    }

    /**
     * Updates the text displayed on the action buttons.
     * Each button's label is updated with the provided text for the corresponding action.
     * This is used during different game states to set the appropriate labels for
     * "Hit", "Stand", "Double", and "Split" buttons.
     * 
     * @param hitText - The text to display on the "Hit" button.
     * @param standText - The text to display on the "Stand" button.
     * @param doubleText - The text to display on the "Double" button.
     * @param splitText - The text to display on the "Split" button.
     */
    private updateButtonText(hitText: string, standText: string, doubleText: string, splitText: string): void {
        // Find the text blocks in each button and update them
        this.updateButtonLabel(this.hitButton, hitText);
        this.updateButtonLabel(this.standButton, standText);
        this.updateButtonLabel(this.doubleButton, doubleText);
        this.updateButtonLabel(this.splitButton, splitText);
    }

    /**
     * Updates the text displayed on a button.
     * Finds the main TextBlock for the button (ignoring any key indicator TextBlock)
     * and sets its text to the provided value.
     * 
     * @param button - The Button to update.
     * @param text - The text to display on the button.
     */
    private updateButtonLabel(button: Button, text: string): void {
        // Find the main text block (not the key indicator)
        if (button && button.children) {
            for (let i = 0; i < button.children.length; i++) {
                const child = button.children[i];
                if (child instanceof TextBlock && 
                    !(child.parent instanceof Rectangle)) { // Skip text in key container
                    child.text = text;
                    break;
                }
            }
        }
    }
}

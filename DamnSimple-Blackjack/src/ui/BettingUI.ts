// src/ui/bettingui-ts
// Use centralized constants
import { Scene } from "@babylonjs/core";
import { Button, TextBlock, StackPanel, Control, Rectangle } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState } from "../game/GameState";
import { Constants } from "../Constants"; // *** IMPORT Constants ***

export class BettingUI extends BaseUI {
    private game: BlackjackGame;
    private currentBet: number = Constants.DEFAULT_BET; // *** USE Constant ***
    private currencySign: string = "$";
    private betPanel!: Rectangle;
    private currentBetText!: TextBlock;
    private confirmBetButton!: Button;
    private decreaseBetButton!: Button;
    private increaseBetButton!: Button;
    private onConfirmBet: (bet: number) => void;

    /**
     * Initializes a new instance of the BettingUI class.
     *
     * @param scene - The Babylon.js scene object.
     * @param game - The BlackjackGame instance providing game logic and state.
     * @param onConfirmBet - Callback function to handle bet confirmation, receiving the bet amount.
     */
    constructor(scene: Scene, game: BlackjackGame, onConfirmBet: (bet: number) => void) {
        super(scene, "BettingUI");
        this.game = game;
        this.onConfirmBet = onConfirmBet;

        const lastBet = this.game.getGameActions().getLastBet();
        // *** USE Constant for default/min bet comparison ***
        this.currentBet = lastBet >= Constants.MIN_BET ? lastBet : Constants.DEFAULT_BET;

        this.createControls();
        this.update();
    }

    /**
     * Creates the controls for the betting UI panel.
     *
     * @remarks
     * This method creates the controls for the betting UI panel, including the
     * panel itself, the title, the bet adjustment buttons, the current bet
     * display, and the confirm bet button.
     */
    private createControls(): void {
        this.betPanel = new Rectangle("betPanel");
        this.betPanel.width = "350px"; this.betPanel.height = "180px";
        this.betPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.betPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.betPanel.background = "rgba(40, 40, 40, 0.85)"; this.betPanel.cornerRadius = 15;
        this.betPanel.thickness = 1; this.betPanel.color = "#666"; this.betPanel.isVisible = false;
        this.guiTexture.addControl(this.betPanel);
        const mainStack = new StackPanel("betMainStack");
        mainStack.paddingTop = "10px"; mainStack.paddingBottom = "10px";
        this.betPanel.addControl(mainStack);
        const betTitle = new TextBlock("betTitle", "Place Your Bet");
        betTitle.color = "white"; betTitle.fontSize = 24; betTitle.height = "40px";
        mainStack.addControl(betTitle);
        const betControlsPanel = new StackPanel("betControlsStack");
        betControlsPanel.isVertical = false; betControlsPanel.height = "60px";
        betControlsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        betControlsPanel.spacing = 15;
        mainStack.addControl(betControlsPanel);
        // *** USE Constant for bet increment ***
        this.decreaseBetButton = this.createBetAdjustButton("decreaseBetButton", "-", -Constants.BET_INCREMENT);
        betControlsPanel.addControl(this.decreaseBetButton);
        this.currentBetText = new TextBlock("currentBetText");
        this.currentBetText.text = `${this.currencySign}${this.currentBet}`;
        this.currentBetText.color = "white"; this.currentBetText.fontSize = 28;
        this.currentBetText.fontWeight = "bold"; this.currentBetText.width = "120px";
        this.currentBetText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        betControlsPanel.addControl(this.currentBetText);
         // *** USE Constant for bet increment ***
        this.increaseBetButton = this.createBetAdjustButton("increaseBetButton", "+", Constants.BET_INCREMENT);
        betControlsPanel.addControl(this.increaseBetButton);
        this.confirmBetButton = Button.CreateSimpleButton("confirmBetButton", "Confirm Bet");
        this.confirmBetButton.width = "180px"; this.confirmBetButton.height = "50px";
        this.confirmBetButton.color = "white"; this.confirmBetButton.fontSize = 20;
        this.confirmBetButton.background = "green"; this.confirmBetButton.cornerRadius = 8;
        this.confirmBetButton.paddingTop = "10px";
        this.confirmBetButton.onPointerUpObservable.add(() => { this.confirmBet(); });
        mainStack.addControl(this.confirmBetButton);
    }

     /**
      * Creates a button for adjusting the current bet amount.
      *
      * @param name - The name of the button control.
      * @param text - The text to display on the button.
      * @param amount - The amount to add to the current bet when the button is clicked.
      * @returns The created button control.
      */
     private createBetAdjustButton(name: string, text: string, amount: number): Button {
        const button = Button.CreateSimpleButton(name, text);
        button.width = "50px"; button.height = "50px"; button.color = "white";
        button.fontSize = 24; button.background = "cornflowerblue"; button.cornerRadius = 25;
        button.onPointerUpObservable.add(() => { this.adjustBet(amount); });
        return button;
    }

    /**
     * Adjusts the current bet amount by the specified amount, ensuring it remains
     * within the player's available funds and the minimum bet limit.
     *
     * @param amount - The amount to adjust the current bet by. Can be positive or negative.
     *
     * @remarks
     * The new bet amount is clamped between the minimum bet and the player's funds.
     * If the bet amount changes, the display is updated and the game's current bet is set.
     */
    private adjustBet(amount: number): void {
        const playerFunds = this.game.getPlayerFunds();
        // *** USE Constant for min bet ***
        const minBet = Constants.MIN_BET;
        let newBet = this.currentBet + amount;
        newBet = Math.max(minBet, Math.min(newBet, playerFunds));
        if (newBet !== this.currentBet) {
            this.currentBet = newBet; this.updateBetDisplay();
            this.game.setCurrentBet(this.currentBet);
        }
    }

     /**
      * Updates the display of the current bet amount, enabling/disabling the
      * increase/decrease buttons and the confirm button as appropriate.
      *
      * @remarks
      * This method is called by the `adjustBet` method after the bet amount has changed.
      * It updates the display of the current bet amount and enables/disables the buttons
      * based on whether the bet amount is within the player's funds and the minimum bet limit.
      */
     private updateBetDisplay(): void {
        this.currentBetText.text = `${this.currencySign}${this.currentBet}`;
        const playerFunds = this.game.getPlayerFunds();
        // *** USE Constant for min bet comparison ***
        const minBet = Constants.MIN_BET;
        this.decreaseBetButton.isEnabled = this.currentBet > minBet;
        this.increaseBetButton.isEnabled = this.currentBet < playerFunds;
        this.confirmBetButton.isEnabled = this.currentBet >= minBet && this.currentBet <= playerFunds;
        this.decreaseBetButton.alpha = this.decreaseBetButton.isEnabled ? 1.0 : 0.5;
        this.increaseBetButton.alpha = this.increaseBetButton.isEnabled ? 1.0 : 0.5;
        this.confirmBetButton.alpha = this.confirmBetButton.isEnabled ? 1.0 : 0.5;
    }

    /**
     * Confirms the current bet amount if the confirm button is enabled.
     *
     * @remarks
     * This method logs the confirmed bet amount, hides the betting UI, and
     * invokes the callback function with the current bet amount.
     */
    private confirmBet(): void { if (this.confirmBetButton.isEnabled) { console.log("Bet confirmed:", this.currentBet); this.hide(); this.onConfirmBet(this.currentBet); } }

    /**
     * Shows the betting UI and updates the current bet amount if necessary.
     *
     * @remarks
     * This method is called when the game state changes to `GameState.Betting`.
     * It updates the current bet amount to be within the player's funds and the
     * minimum bet limit, updates the display, and shows the betting UI.
     */
    public show(): void {
        const playerFunds = this.game.getPlayerFunds();
        // *** USE Constant for min bet ***
        this.currentBet = Math.max(Constants.MIN_BET, Math.min(this.currentBet, playerFunds));
        this.game.setCurrentBet(this.currentBet);
        this.updateBetDisplay();
        this.betPanel.isVisible = true;
        console.log("Betting UI shown.");
    }

    /**
     * Hides the betting UI and logs that the UI is hidden.
     */
    public hide(): void { this.betPanel.isVisible = false; console.log("Betting UI hidden."); }


    /**
     * Sets the currency sign to be used when displaying the current bet amount.
     * Updates the display immediately.
     * @param sign The currency sign to use.
     */
    public setCurrencySign(sign: string): void { this.currencySign = sign; this.updateBetDisplay(); }


    /**
     * Updates the betting UI's visibility and current bet amount based on the game's state.
     *
     * If the game is in the `GameState.Betting` state, shows the betting UI if it's not already visible,
     * and updates the current bet amount display. If the game is in any other state, hides the betting UI
     * if it's visible.
     */
    public update(): void {
        if (this.game.getGameState() === GameState.Betting) {
            if (!this.betPanel.isVisible) {
                 this.show();
            } else {
                 this.updateBetDisplay();
            }
        } else {
            if (this.betPanel.isVisible) {
                 this.hide();
            }
        }
    }
}

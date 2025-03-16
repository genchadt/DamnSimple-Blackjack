// ui/BettingUI.ts
import { Scene } from "@babylonjs/core";
import { Button, TextBlock, StackPanel, Control, Rectangle } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame, GameState } from "../game/BlackjackGame";

export class BettingUI extends BaseUI {
    private game: BlackjackGame;
    private currentBet: number = 10;
    private currencySign: string = "$";
    private betPanel!: StackPanel;
    private currentBetInput!: TextBlock;
    private onConfirmBet: (bet: number) => void;

    /**
     * Initializes a new instance of the BettingUI class, setting up the UI elements
     * for placing and confirming bets in the blackjack game.
     *
     * @param {Scene} scene - The Babylon.js scene to which the UI belongs.
     * @param {BlackjackGame} game - The game logic instance to interact with.
     * @param {(bet: number) => void} onConfirmBet - Callback function to be called when the bet is confirmed.
     */
    constructor(scene: Scene, game: BlackjackGame, onConfirmBet: (bet: number) => void) {
        super(scene);
        this.game = game;
        this.onConfirmBet = onConfirmBet;
        
        // Create betting UI elements
        this.betPanel = new StackPanel();
        this.betPanel.width = "400px";
        this.betPanel.height = "200px";
        this.betPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.betPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.betPanel.background = "#333333";
        this.betPanel.isVisible = false;
        this.guiTexture.addControl(this.betPanel);
        
        const betTitle = new TextBlock();
        betTitle.text = "Place Your Bet";
        betTitle.color = "white";
        betTitle.fontSize = 24;
        betTitle.height = "40px";
        this.betPanel.addControl(betTitle);
        
        // Bet amount controls
        const betControlsPanel = new StackPanel();
        betControlsPanel.isVertical = false;
        betControlsPanel.height = "60px";
        this.betPanel.addControl(betControlsPanel);
        
        const decreaseBetButton = Button.CreateSimpleButton("decreaseBetButton", "-");
        decreaseBetButton.width = "40px";
        decreaseBetButton.height = "40px";
        decreaseBetButton.color = "white";
        decreaseBetButton.background = "blue";
        decreaseBetButton.onPointerClickObservable.add(() => {
            this.adjustBet(-10);
        });
        betControlsPanel.addControl(decreaseBetButton);
        
        this.currentBetInput = new TextBlock();
        this.currentBetInput.text = `${this.currencySign}${this.currentBet}`;
        this.currentBetInput.color = "white";
        this.currentBetInput.fontSize = 24;
        this.currentBetInput.width = "100px";
        this.currentBetInput.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        betControlsPanel.addControl(this.currentBetInput);
        
        const increaseBetButton = Button.CreateSimpleButton("increaseBetButton", "+");
        increaseBetButton.width = "40px";
        increaseBetButton.height = "40px";
        increaseBetButton.color = "white";
        increaseBetButton.background = "blue";
        increaseBetButton.onPointerClickObservable.add(() => {
            this.adjustBet(10);
        });
        betControlsPanel.addControl(increaseBetButton);
        
        // Confirm bet button
        const confirmBetButton = Button.CreateSimpleButton("confirmBetButton", "Confirm Bet");
        confirmBetButton.width = "150px";
        confirmBetButton.height = "40px";
        confirmBetButton.color = "white";
        confirmBetButton.background = "green";
        confirmBetButton.onPointerClickObservable.add(() => {
            this.confirmBet();
        });
        this.betPanel.addControl(confirmBetButton);
    }

    /**
     * Adjusts the current bet by the specified amount (in dollars). If the new bet
     * is within the valid range (i.e. between 10 and the player's current funds),
     * it updates the current bet value and displays the new value in the UI.
     * 
     * @param amount The amount to adjust the current bet by (positive or negative).
     */
    private adjustBet(amount: number): void {
        const newBet = this.currentBet + amount;
        if (newBet >= 10 && newBet <= this.game.getPlayerFunds()) {
            this.currentBet = newBet;
            this.currentBetInput.text = `${this.currencySign}${this.currentBet}`;
        }
    }

    /**
     * Hides the betting UI and calls the onConfirmBet callback with the current
     * bet amount. This is called when the player confirms their bet.
     */
    private confirmBet(): void {
        this.betPanel.isVisible = false;
        this.onConfirmBet(this.currentBet);
    }

    /**
     * Shows the betting UI and updates the current bet to match the game's current
     * bet amount. If the game's current bet is 0, the current bet is not changed.
     */
    public show(): void {
        // Update current bet to match the game's current bet
        this.currentBet = this.game.getCurrentBet() > 0 ? 
            this.game.getCurrentBet() : this.currentBet;
        
        this.currentBetInput.text = `${this.currencySign}${this.currentBet}`;
        this.betPanel.isVisible = true;
    }

    /**
     * Hides the betting UI from the scene.
     */
    public hide(): void {
        this.betPanel.isVisible = false;
    }

    /**
     * Updates the currency sign used in the betting UI to the specified value.
     * This is called from the game when the currency sign is changed.
     * 
     * @param sign The new currency sign to use (e.g. "$", " ", etc.).
     */
    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        this.currentBetInput.text = `${this.currencySign}${this.currentBet}`;
    }

    /**
     * Updates the betting UI based on the current game state. If the current bet
     * exceeds the player's funds, the current bet is adjusted to match the player's
     * funds. The betting UI is shown when the game is in the Betting state.
     */
    public update(): void {
        // Update bet limits based on player funds
        if (this.currentBet > this.game.getPlayerFunds()) {
            this.currentBet = this.game.getPlayerFunds();
            this.currentBetInput.text = `${this.currencySign}${this.currentBet}`;
        }
        
        // Show betting UI when in Betting state
        if (this.game.getGameState() === GameState.Betting) {
            this.show();
        }
    }
}

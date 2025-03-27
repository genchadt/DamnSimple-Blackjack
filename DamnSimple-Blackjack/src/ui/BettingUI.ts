// src/ui/bettingui-ts (Access lastBet via getter)
import { Scene } from "@babylonjs/core";
import { Button, TextBlock, StackPanel, Control, Rectangle } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState } from "../game/GameState";

export class BettingUI extends BaseUI {
    private game: BlackjackGame;
    private currentBet: number = 10;
    private currencySign: string = "$";
    private betPanel!: Rectangle;
    private currentBetText!: TextBlock;
    private confirmBetButton!: Button;
    private decreaseBetButton!: Button;
    private increaseBetButton!: Button;
    private onConfirmBet: (bet: number) => void;

    constructor(scene: Scene, game: BlackjackGame, onConfirmBet: (bet: number) => void) {
        super(scene, "BettingUI");
        this.game = game;
        this.onConfirmBet = onConfirmBet;

        // *** FIXED: Use getter for lastBet ***
        const lastBet = this.game.getGameActions().getLastBet();
        this.currentBet = lastBet > 0 ? lastBet : 10;

        this.createControls();
        this.update();
    }

    // ... rest of BettingUI remains the same ...
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
        this.decreaseBetButton = this.createBetAdjustButton("decreaseBetButton", "-", -10);
        betControlsPanel.addControl(this.decreaseBetButton);
        this.currentBetText = new TextBlock("currentBetText");
        this.currentBetText.text = `${this.currencySign}${this.currentBet}`;
        this.currentBetText.color = "white"; this.currentBetText.fontSize = 28;
        this.currentBetText.fontWeight = "bold"; this.currentBetText.width = "120px";
        this.currentBetText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        betControlsPanel.addControl(this.currentBetText);
        this.increaseBetButton = this.createBetAdjustButton("increaseBetButton", "+", 10);
        betControlsPanel.addControl(this.increaseBetButton);
        this.confirmBetButton = Button.CreateSimpleButton("confirmBetButton", "Confirm Bet");
        this.confirmBetButton.width = "180px"; this.confirmBetButton.height = "50px";
        this.confirmBetButton.color = "white"; this.confirmBetButton.fontSize = 20;
        this.confirmBetButton.background = "green"; this.confirmBetButton.cornerRadius = 8;
        this.confirmBetButton.paddingTop = "10px";
        this.confirmBetButton.onPointerUpObservable.add(() => { this.confirmBet(); });
        mainStack.addControl(this.confirmBetButton);
    }
     private createBetAdjustButton(name: string, text: string, amount: number): Button {
        const button = Button.CreateSimpleButton(name, text);
        button.width = "50px"; button.height = "50px"; button.color = "white";
        button.fontSize = 24; button.background = "cornflowerblue"; button.cornerRadius = 25;
        button.onPointerUpObservable.add(() => { this.adjustBet(amount); });
        return button;
    }
    private adjustBet(amount: number): void {
        const playerFunds = this.game.getPlayerFunds(); const minBet = 10;
        let newBet = this.currentBet + amount;
        newBet = Math.max(minBet, Math.min(newBet, playerFunds));
        if (newBet !== this.currentBet) {
            this.currentBet = newBet; this.updateBetDisplay();
            this.game.setCurrentBet(this.currentBet);
        }
    }
     private updateBetDisplay(): void {
        this.currentBetText.text = `${this.currencySign}${this.currentBet}`;
        const playerFunds = this.game.getPlayerFunds();
        this.decreaseBetButton.isEnabled = this.currentBet > 10;
        this.increaseBetButton.isEnabled = this.currentBet < playerFunds;
        this.confirmBetButton.isEnabled = this.currentBet >= 10 && this.currentBet <= playerFunds;
        this.decreaseBetButton.alpha = this.decreaseBetButton.isEnabled ? 1.0 : 0.5;
        this.increaseBetButton.alpha = this.increaseBetButton.isEnabled ? 1.0 : 0.5;
        this.confirmBetButton.alpha = this.confirmBetButton.isEnabled ? 1.0 : 0.5;
    }
    private confirmBet(): void { if (this.confirmBetButton.isEnabled) { console.log("Bet confirmed:", this.currentBet); this.hide(); this.onConfirmBet(this.currentBet); } }
    public show(): void { const playerFunds = this.game.getPlayerFunds(); this.currentBet = Math.max(10, Math.min(this.currentBet, playerFunds)); this.game.setCurrentBet(this.currentBet); this.updateBetDisplay(); this.betPanel.isVisible = true; console.log("Betting UI shown."); }
    public hide(): void { this.betPanel.isVisible = false; console.log("Betting UI hidden."); }
    public setCurrencySign(sign: string): void { this.currencySign = sign; this.updateBetDisplay(); }
    public update(): void { if (this.game.getGameState() === GameState.Betting) { if (!this.betPanel.isVisible) { this.show(); } else { this.updateBetDisplay(); } } else { if (this.betPanel.isVisible) { this.hide(); } } }
}

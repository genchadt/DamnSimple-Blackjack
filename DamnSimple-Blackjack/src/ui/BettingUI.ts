// ui/BettingUI.ts
import { Scene } from "@babylonjs/core";
import { Button, TextBlock, StackPanel, Control, Rectangle } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame } from "../game/BlackjackGame";

export class BettingUI extends BaseUI {
    private game: BlackjackGame;
    private currentBet: number = 10;
    private currencySign: string = "$";
    private betPanel!: StackPanel;
    private currentBetInput!: TextBlock;
    private onConfirmBet: (bet: number) => void;
    
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
    
    private adjustBet(amount: number): void {
        const newBet = this.currentBet + amount;
        if (newBet >= 10 && newBet <= this.game.getPlayerFunds()) {
            this.currentBet = newBet;
            this.currentBetInput.text = `${this.currencySign}${this.currentBet}`;
        }
    }
    
    private confirmBet(): void {
        this.betPanel.isVisible = false;
        this.onConfirmBet(this.currentBet);
    }
    
    public show(): void {
        // Update current bet to match the game's current bet
        this.currentBet = this.game.getCurrentBet() > 0 ? 
            this.game.getCurrentBet() : this.currentBet;
        
        this.currentBetInput.text = `${this.currencySign}${this.currentBet}`;
        this.betPanel.isVisible = true;
    }
    
    public hide(): void {
        this.betPanel.isVisible = false;
    }
    
    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        this.currentBetInput.text = `${this.currencySign}${this.currentBet}`;
    }
    
    public update(): void {
        // Update bet limits based on player funds
        if (this.currentBet > this.game.getPlayerFunds()) {
            this.currentBet = this.game.getPlayerFunds();
            this.currentBetInput.text = `${this.currencySign}${this.currentBet}`;
        }
    }
}

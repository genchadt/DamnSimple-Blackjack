// src/ui/StatusUI.ts (Refine dealer score logic)
import { Scene } from "@babylonjs/core";
import { TextBlock, Control, Rectangle, StackPanel } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState, GameResult } from "../game/GameState";
import { ScoreCalculator } from "../game/ScoreCalculator"; // Make sure this is imported

export class StatusUI extends BaseUI {
    private game: BlackjackGame;
    private playerScoreText!: TextBlock;
    private dealerScoreText!: TextBlock;
    private gameStatusText!: TextBlock;
    private fundsText!: TextBlock;
    private betText!: TextBlock;
    private currencySign: string = "$";

    constructor(scene: Scene, game: BlackjackGame) {
        super(scene, "StatusUI");
        this.game = game;
        this.createControls();
        this.update();
    }

    private createControls(): void {
        const scoreOptions = {
            color: "white", fontSize: 22, height: "30px",
            shadowColor: "#000000", shadowBlur: 2, shadowOffsetX: 1, shadowOffsetY: 1
        };
        const textOptions = {
            color: "white", fontSize: 18, height: "28px",
            textHorizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
        };

        // Player Score
        this.playerScoreText = new TextBlock("playerScore", "Player: 0");
        Object.assign(this.playerScoreText, scoreOptions);
        this.playerScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerScoreText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerScoreText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.playerScoreText.left = "20px"; this.playerScoreText.top = "-80px"; // Adjusted slightly higher
        this.guiTexture.addControl(this.playerScoreText);

        // Dealer Score
        this.dealerScoreText = new TextBlock("dealerScore", "Dealer: ?");
        Object.assign(this.dealerScoreText, scoreOptions);
        this.dealerScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.dealerScoreText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.dealerScoreText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.dealerScoreText.left = "20px"; this.dealerScoreText.top = "20px";
        this.guiTexture.addControl(this.dealerScoreText);

        // Game Status (Center Top)
        this.gameStatusText = new TextBlock("gameStatus", "");
        this.gameStatusText.color = "white"; this.gameStatusText.fontSize = 32; this.gameStatusText.fontWeight = "bold";
        this.gameStatusText.height = "40px"; this.gameStatusText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.gameStatusText.top = "20px"; this.gameStatusText.shadowColor = "#000000"; this.gameStatusText.shadowBlur = 3;
        this.guiTexture.addControl(this.gameStatusText);

        // Funds Panel (Top Right)
        const fundsPanel = new Rectangle("fundsPanel");
        fundsPanel.width = "220px"; fundsPanel.height = "70px"; fundsPanel.cornerRadius = 10;
        fundsPanel.background = "rgba(0, 0, 0, 0.6)"; fundsPanel.thickness = 1; fundsPanel.color = "#888";
        fundsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        fundsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        fundsPanel.top = "15px"; fundsPanel.left = "-15px"; // Use left with negative for right alignment padding
        this.guiTexture.addControl(fundsPanel);

        const fundsStack = new StackPanel("fundsStack");
        fundsStack.paddingTop = "5px"; fundsStack.paddingBottom = "5px";
        fundsPanel.addControl(fundsStack);

        this.fundsText = new TextBlock("fundsText", `Funds: ${this.currencySign}0`);
        Object.assign(this.fundsText, textOptions);
        fundsStack.addControl(this.fundsText);

        this.betText = new TextBlock("betText", `Bet: ${this.currencySign}0`);
        Object.assign(this.betText, textOptions);
        fundsStack.addControl(this.betText);
    }

    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        this.update(); // Update display immediately when sign changes
    }

    public update(): void {
        const gameState = this.game.getGameState();
        const playerHand = this.game.getPlayerHand();
        const dealerHand = this.game.getDealerHand();
        const playerScore = this.game.getPlayerScore(); // Calculate once

        // console.log(`StatusUI Update - State: ${GameState[gameState]}`); // Add logging

        // Update Player Score
        this.playerScoreText.text = `Player: ${playerScore > 0 ? playerScore : ""}`;
        if (gameState === GameState.Initial || playerHand.length === 0) {
             this.playerScoreText.text = "Player: ";
        }

        // --- Refined Dealer Score Logic ---
        let dealerScoreDisplay = "?";
        // Use the dedicated getDealerScore method which handles state logic
        const dealerVisibleScore = this.game.getDealerScore();

        if (gameState === GameState.Initial || dealerHand.length === 0) {
            dealerScoreDisplay = "?";
             // console.log(`StatusUI Update (Initial/No Cards) - Dealer Score: ?`); // Add logging
        } else if (gameState === GameState.PlayerTurn || gameState === GameState.Betting) {
            // getDealerScore() already returns the score of visible cards or 0 if none are visible
            if (dealerVisibleScore > 0) {
                dealerScoreDisplay = `${dealerVisibleScore}`;
                // console.log(`StatusUI Update (PlayerTurn/Betting) - Dealer Visible Score: ${dealerVisibleScore}`); // Add logging
            } else {
                // This case means only the hole card is dealt (and face down)
                dealerScoreDisplay = "?";
                // console.log(`StatusUI Update (PlayerTurn/Betting) - Dealer Visible Score: ? (Only hole card?)`); // Add logging
            }
        } else if (gameState === GameState.DealerTurn || gameState === GameState.GameOver) {
            // Show the full score in these states
            const dealerFullScore = this.game.getDealerFullScore();
            dealerScoreDisplay = `${dealerFullScore}`;
            // console.log(`StatusUI Update (DealerTurn/GameOver) - Dealer Full Score: ${dealerFullScore}`); // Add logging
        }
        // Fallback just in case
        else {
             dealerScoreDisplay = "?";
             console.warn(`StatusUI: Unexpected state (${GameState[gameState]}) for dealer score display.`);
        }

        this.dealerScoreText.text = `Dealer: ${dealerScoreDisplay}`;
        // --- End Refined Dealer Score Logic ---

        // Update funds and bet display
        this.fundsText.text = `Funds: ${this.currencySign}${this.game.getPlayerFunds()}`;
        const currentBet = this.game.getCurrentBet();
        this.betText.text = `Bet: ${currentBet > 0 ? this.currencySign + currentBet : "--"}`;
        // Show bet amount only after betting is done and game is in progress/over
        this.betText.isVisible = (gameState !== GameState.Initial && gameState !== GameState.Betting);

        // Update game status text and color
        let status = ""; let statusColor = "white";
        switch (gameState) {
            case GameState.Initial: status = "Sit Down to Play"; break;
            case GameState.Betting: status = "Place Your Bet"; break;
            case GameState.PlayerTurn:
                status = "Your Turn";
                if (playerScore > 21) { status = "Bust!"; statusColor = "tomato"; }
                // Check for Blackjack (2 cards totaling 21)
                else if (playerScore === 21 && playerHand.length === 2) { status = "Blackjack!"; statusColor = "gold"; }
                break;
            case GameState.DealerTurn: status = "Dealer's Turn"; break;
            case GameState.GameOver:
                const gameResult = this.game.getGameResult();
                const finalDealerScore = this.game.getDealerFullScore(); // Get final score for message
                switch (gameResult) {
                    case GameResult.PlayerWins: status = finalDealerScore > 21 ? "Dealer Bust! You Win!" : "You Win!"; statusColor = "lime"; break;
                    case GameResult.DealerWins: status = playerScore > 21 ? "Bust! Dealer Wins" : "Dealer Wins"; statusColor = "tomato"; break;
                    case GameResult.Push: status = "Push!"; statusColor = "yellow"; break;
                    case GameResult.PlayerBlackjack: status = "Blackjack!"; statusColor = "gold"; break;
                    default: status = "Game Over"; break; // Fallback
                } break;
            default: status = ""; break; // Should not happen
        }
        this.gameStatusText.text = status; this.gameStatusText.color = statusColor;
    }
}

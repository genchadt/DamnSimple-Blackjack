// src/ui/statusui-ts (Adjusted layout, uses game state correctly)
import { Scene } from "@babylonjs/core";
import { TextBlock, Control, Rectangle, StackPanel } from "@babylonjs/gui"; // Import StackPanel
import { BaseUI } from "./BaseUI";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState, GameResult } from "../game/GameState";

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
        this.update(); // Initial update
    }

    private createControls(): void {
        // --- Score Displays ---
        const scoreOptions = {
            color: "white",
            fontSize: 22,
            height: "30px",
            shadowColor: "#000000",
            shadowBlur: 2,
            shadowOffsetX: 1,
            shadowOffsetY: 1
        };

        this.playerScoreText = new TextBlock("playerScore", "Player: 0", { ...scoreOptions });
        this.playerScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerScoreText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerScoreText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.playerScoreText.left = "20px"; // Position from left
        this.playerScoreText.top = "-80px"; // Position from bottom
        this.guiTexture.addControl(this.playerScoreText);

        this.dealerScoreText = new TextBlock("dealerScore", "Dealer: ?", { ...scoreOptions });
        this.dealerScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.dealerScoreText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.dealerScoreText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.dealerScoreText.left = "20px"; // Position from left
        this.dealerScoreText.top = "20px";  // Position from top
        this.guiTexture.addControl(this.dealerScoreText);

        // --- Game Status Display (Center Top) ---
        this.gameStatusText = new TextBlock("gameStatus", "");
        this.gameStatusText.color = "white";
        this.gameStatusText.fontSize = 32; // Slightly smaller
        this.gameStatusText.fontWeight = "bold";
        this.gameStatusText.height = "40px";
        this.gameStatusText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.gameStatusText.top = "20px";
        this.gameStatusText.shadowColor = "#000000";
        this.gameStatusText.shadowBlur = 3;
        this.guiTexture.addControl(this.gameStatusText);

        // --- Funds and Bet Display (Top Right) ---
        const fundsPanel = new Rectangle("fundsPanel");
        fundsPanel.width = "220px"; // Wider
        fundsPanel.height = "70px"; // Taller
        fundsPanel.cornerRadius = 10;
        fundsPanel.background = "rgba(0, 0, 0, 0.6)"; // Semi-transparent black
        fundsPanel.thickness = 1;
        fundsPanel.color = "#888"; // Border color
        fundsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        fundsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        fundsPanel.top = "15px"; // Adjust position
        fundsPanel.left = "-15px";
        this.guiTexture.addControl(fundsPanel);

        const fundsStack = new StackPanel("fundsStack");
        fundsStack.paddingTop = "5px";
        fundsStack.paddingBottom = "5px";
        fundsPanel.addControl(fundsStack);

        const textOptions = {
            color: "white",
            fontSize: 18, // Smaller font inside panel
            height: "28px", // Adjust height
            textHorizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
        };

        this.fundsText = new TextBlock("fundsText", `Funds: ${this.currencySign}0`, { ...textOptions });
        fundsStack.addControl(this.fundsText);

        this.betText = new TextBlock("betText", `Bet: ${this.currencySign}0`, { ...textOptions });
        fundsStack.addControl(this.betText);
    }

    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        this.update(); // Update display immediately
    }

    public update(): void {
        const gameState = this.game.getGameState();
        const playerHand = this.game.getPlayerHand();
        const dealerHand = this.game.getDealerHand();

        // Update scores
        const playerScore = this.game.getPlayerScore(); // Calculates based on face-up always for player
        this.playerScoreText.text = `Player: ${playerScore > 0 ? playerScore : ""}`; // Show score or empty

        // Dealer score visibility depends on state
        let dealerScoreDisplay = "?";
        if (gameState === GameState.DealerTurn || gameState === GameState.GameOver) {
            // Show full score only when dealer plays or game ends
            const dealerFullScore = this.game.getDealerFullScore();
            dealerScoreDisplay = `${dealerFullScore}`;
        } else if (dealerHand.length > 0) {
            // Show score of face-up cards only during player turn/betting
            const visibleScore = ScoreCalculator.calculateHandValue(dealerHand.filter(c => c.isFaceUp()));
            dealerScoreDisplay = `${visibleScore > 0 ? visibleScore : "?"}`; // Show visible score or ?
        }
         this.dealerScoreText.text = `Dealer: ${dealerScoreDisplay}`;


        // Update funds and bet
        this.fundsText.text = `Funds: ${this.currencySign}${this.game.getPlayerFunds()}`;
        const currentBet = this.game.getCurrentBet();
        this.betText.text = `Bet: ${currentBet > 0 ? this.currencySign + currentBet : "--"}`;
        this.betText.isVisible = (gameState !== GameState.Initial); // Hide bet in initial state

        // Update game status text
        let status = "";
        let statusColor = "white";

        switch (gameState) {
            case GameState.Initial:
                status = "Sit Down to Play"; // Prompt to start
                this.playerScoreText.text = "Player: ";
                this.dealerScoreText.text = "Dealer: ";
                break;
            case GameState.Betting:
                status = "Place Your Bet";
                break;
            case GameState.PlayerTurn:
                status = "Your Turn";
                if (playerScore > 21) status = "Bust!"; // Show bust immediately
                break;
            case GameState.DealerTurn:
                status = "Dealer's Turn";
                break;
            case GameState.GameOver:
                const gameResult = this.game.getGameResult();
                const finalPlayerScore = this.game.getPlayerScore(); // Use final calculated score
                const finalDealerScore = this.game.getDealerFullScore(); // Use final dealer score

                switch (gameResult) {
                    case GameResult.PlayerWins:
                        status = finalDealerScore > 21 ? "Dealer Bust! You Win!" : "You Win!";
                        statusColor = "lime"; // Brighter green
                        break;
                    case GameResult.DealerWins:
                        status = finalPlayerScore > 21 ? "Bust! Dealer Wins" : "Dealer Wins";
                        statusColor = "tomato"; // Red
                        break;
                    case GameResult.Push:
                        status = "Push!";
                        statusColor = "yellow";
                        break;
                    case GameResult.PlayerBlackjack:
                        status = "Blackjack!";
                        statusColor = "gold";
                        break;
                     case GameResult.InProgress: // Should ideally not be InProgress in GameOver state
                         status = "Game Over";
                         break;
                }
                break;
        }

        this.gameStatusText.text = status;
        this.gameStatusText.color = statusColor;
    }
}

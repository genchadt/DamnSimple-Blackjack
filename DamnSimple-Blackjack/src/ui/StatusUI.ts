// src/ui/statusui-ts
// Added debug log for dealer score calculation
// Added insurance bet display
// Added "Dealing Cards..." message
import { Scene } from "@babylonjs/core";
import { TextBlock, Control, Rectangle, StackPanel } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState, GameResult } from "../game/GameState";
import { ScoreCalculator } from "../game/ScoreCalculator";

export class StatusUI extends BaseUI {
    private game: BlackjackGame;
    private playerScoreText!: TextBlock;
    private dealerScoreText!: TextBlock;
    private gameStatusText!: TextBlock;
    private fundsText!: TextBlock;
    private betText!: TextBlock;
    private insuranceBetText!: TextBlock;
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
        const smallTextOptions = {
            color: "#FFD700", fontSize: 16, height: "24px",
            textHorizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
        };


        // Player Score
        this.playerScoreText = new TextBlock("playerScore", "Player: 0");
        Object.assign(this.playerScoreText, scoreOptions);
        this.playerScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerScoreText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerScoreText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.playerScoreText.left = "20px"; this.playerScoreText.top = "-80px";
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
        fundsPanel.width = "220px";
        fundsPanel.adaptHeightToChildren = true;
        fundsPanel.cornerRadius = 10;
        fundsPanel.background = "rgba(0, 0, 0, 0.6)"; fundsPanel.thickness = 1; fundsPanel.color = "#888";
        fundsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        fundsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        fundsPanel.top = "15px"; fundsPanel.left = "-15px";
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

        this.insuranceBetText = new TextBlock("insuranceBetText", "");
        Object.assign(this.insuranceBetText, smallTextOptions);
        this.insuranceBetText.isVisible = false;
        fundsStack.addControl(this.insuranceBetText);
    }

    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        this.update();
    }

    public update(): void {
        const gameState = this.game.getGameState();
        const playerHand = this.game.getPlayerHand();
        const dealerHand = this.game.getDealerHand();
        const playerScore = this.game.getPlayerScore();

        this.playerScoreText.text = `Player: ${playerScore > 0 ? playerScore : ""}`;
        if (gameState === GameState.Initial || playerHand.length === 0) {
            this.playerScoreText.text = "Player: ";
        }

        let dealerScoreDisplay = "?";
        const dealerVisibleScore = this.game.getDealerScore();
        const dealerFullScore = this.game.getDealerFullScore();

        if (gameState === GameState.Initial || dealerHand.length === 0) {
            dealerScoreDisplay = "?";
        } else if (gameState === GameState.PlayerTurn || gameState === GameState.Betting || gameState === GameState.Dealing) { // Include Dealing
            if (dealerVisibleScore > 0) {
                dealerScoreDisplay = `${dealerVisibleScore}`;
            } else {
                dealerScoreDisplay = "?"; // Keep '?' if only hole card is dealt (score 0)
            }
        } else if (gameState === GameState.DealerTurn || gameState === GameState.GameOver) {
            dealerScoreDisplay = `${dealerFullScore}`;
        }
        else {
            dealerScoreDisplay = "?";
            console.warn(`[StatusUI] Unexpected state (${GameState[gameState]}) for dealer score display.`);
        }
        this.dealerScoreText.text = `Dealer: ${dealerScoreDisplay}`;

        this.fundsText.text = `Funds: ${this.currencySign}${this.game.getPlayerFunds()}`;
        const currentBet = this.game.getCurrentBet();
        this.betText.text = `Bet: ${currentBet > 0 ? this.currencySign + currentBet : "--"}`;
        this.betText.isVisible = (gameState !== GameState.Initial && gameState !== GameState.Betting);

        const insuranceBet = this.game.insuranceBetPlaced;
        if (insuranceBet > 0 && (gameState === GameState.PlayerTurn || gameState === GameState.DealerTurn || gameState === GameState.GameOver || gameState === GameState.Dealing)) {
            this.insuranceBetText.text = `Insurance: ${this.currencySign}${insuranceBet}`;
            this.insuranceBetText.isVisible = true;
        } else {
            this.insuranceBetText.isVisible = false;
        }


        let status = ""; let statusColor = "white";
        switch (gameState) {
            case GameState.Initial: status = "Sit Down to Play"; break;
            case GameState.Betting: status = "Place Your Bet"; break;
            case GameState.Dealing: status = "Dealing Cards..."; statusColor = "#ADD8E6"; break; // Light blue for dealing
            case GameState.PlayerTurn:
                status = "Your Turn";
                if (playerScore > 21) { status = "Bust!"; statusColor = "tomato"; }
                else if (playerScore === 21 && playerHand.length === 2) { status = "Blackjack!"; statusColor = "gold"; }
                else if (this.game.isInsuranceAvailable()) { status = "Insurance Available"; statusColor = "orange"; }
                break;
            case GameState.DealerTurn: status = "Dealer's Turn"; break;
            case GameState.GameOver:
                const gameResult = this.game.getGameResult();
                const finalDealerScore = this.game.getDealerFullScore();
                switch (gameResult) {
                    case GameResult.PlayerWins: status = finalDealerScore > 21 ? "Dealer Bust! You Win!" : "You Win!"; statusColor = "lime"; break;
                    case GameResult.DealerWins: status = playerScore > 21 ? "Bust! Dealer Wins" : "Dealer Wins"; statusColor = "tomato"; break;
                    case GameResult.Push: status = "Push!"; statusColor = "yellow"; break;
                    case GameResult.PlayerBlackjack: status = "Blackjack!"; statusColor = "gold"; break;
                    default: status = "Game Over"; break;
                } break;
            default: status = ""; break;
        }
        this.gameStatusText.text = status; this.gameStatusText.color = statusColor;
    }
}

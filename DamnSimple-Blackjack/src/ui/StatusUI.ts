// src/ui/StatusUI.ts
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

        // *** FIXED TextBlock Creation ***
        this.playerScoreText = new TextBlock("playerScore", "Player: 0");
        Object.assign(this.playerScoreText, scoreOptions); // Assign properties after creation
        this.playerScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerScoreText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerScoreText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.playerScoreText.left = "20px"; this.playerScoreText.top = "-80px";
        this.guiTexture.addControl(this.playerScoreText);

        this.dealerScoreText = new TextBlock("dealerScore", "Dealer: ?");
        Object.assign(this.dealerScoreText, scoreOptions);
        this.dealerScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.dealerScoreText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.dealerScoreText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.dealerScoreText.left = "20px"; this.dealerScoreText.top = "20px";
        this.guiTexture.addControl(this.dealerScoreText);

        this.gameStatusText = new TextBlock("gameStatus", "");
        this.gameStatusText.color = "white"; this.gameStatusText.fontSize = 32; this.gameStatusText.fontWeight = "bold";
        this.gameStatusText.height = "40px"; this.gameStatusText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.gameStatusText.top = "20px"; this.gameStatusText.shadowColor = "#000000"; this.gameStatusText.shadowBlur = 3;
        this.guiTexture.addControl(this.gameStatusText);

        const fundsPanel = new Rectangle("fundsPanel");
        fundsPanel.width = "220px"; fundsPanel.height = "70px"; fundsPanel.cornerRadius = 10;
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

        let dealerScoreDisplay = "?";
        let dealerFullScore = 0; // For logging

        // Determine dealer score display based on state
        if (gameState === GameState.DealerTurn || gameState === GameState.GameOver) {
            // In these states, the hole card should be revealed (or game is over)
            dealerFullScore = this.game.getDealerFullScore(); // Calculate score using all cards
            dealerScoreDisplay = `${dealerFullScore}`;
        } else if (dealerHand.length > 0 && (gameState === GameState.PlayerTurn || gameState === GameState.Betting || gameState === GameState.Initial)) {
            // In these states, show only the value of face-up cards
            const visibleScore = ScoreCalculator.calculateHandValue(dealerHand.filter(c => c.isFaceUp()));
            // Show "?" if the only card is face down, otherwise show the visible score
            dealerScoreDisplay = `${visibleScore > 0 ? visibleScore : "?"}`;
        } else {
             // If no dealer cards or in an unexpected state, show "?"
             dealerScoreDisplay = "?";
        }

        // *** Add Logging (Optional - uncomment if needed for debugging) ***
        // console.log(`StatusUI Update: State=${GameState[gameState]}, DealerHand=${dealerHand.map(c=>c.toString()+ (c.isFaceUp()?'(U)':'(D)'))}, FullScoreCalc=${dealerFullScore}, Display='${dealerScoreDisplay}'`);

        this.dealerScoreText.text = `Dealer: ${dealerScoreDisplay}`;

        // Update funds and bet display
        this.fundsText.text = `Funds: ${this.currencySign}${this.game.getPlayerFunds()}`;
        const currentBet = this.game.getCurrentBet();
        this.betText.text = `Bet: ${currentBet > 0 ? this.currencySign + currentBet : "--"}`;
        this.betText.isVisible = (gameState !== GameState.Initial);

        // Update game status text and color
        let status = ""; let statusColor = "white";
        switch (gameState) {
            case GameState.Initial: status = "Sit Down to Play"; this.playerScoreText.text = "Player: "; this.dealerScoreText.text = "Dealer: "; break;
            case GameState.Betting: status = "Place Your Bet"; break;
            case GameState.PlayerTurn: status = "Your Turn"; if (playerScore > 21) { status = "Bust!"; statusColor = "tomato"; } break; // Added color for bust during player turn
            case GameState.DealerTurn: status = "Dealer's Turn"; break;
            case GameState.GameOver:
                const gameResult = this.game.getGameResult();
                // Use the already calculated full score for status message consistency
                const finalPlayerScore = playerScore; // Use score calculated at start of update
                // Recalculate dealer score here for GameOver state specifically if needed, or rely on the value calculated above
                const finalDealerScore = this.game.getDealerFullScore();
                switch (gameResult) {
                    case GameResult.PlayerWins: status = finalDealerScore > 21 ? "Dealer Bust! You Win!" : "You Win!"; statusColor = "lime"; break;
                    case GameResult.DealerWins: status = finalPlayerScore > 21 ? "Bust! Dealer Wins" : "Dealer Wins"; statusColor = "tomato"; break;
                    case GameResult.Push: status = "Push!"; statusColor = "yellow"; break;
                    case GameResult.PlayerBlackjack: status = "Blackjack!"; statusColor = "gold"; break;
                    case GameResult.InProgress: status = "Game Over (Error?)"; break; // Should not happen in GameOver state
                } break;
        }
        this.gameStatusText.text = status; this.gameStatusText.color = statusColor;
    }
}

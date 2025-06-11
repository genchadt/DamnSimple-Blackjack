// src/ui/StatusUI.ts
// Added debug log for dealer score calculation
// Added insurance bet display
// Added "Dealing Cards..." message
// Updated for multiple player hands
import { Scene } from "@babylonjs/core";
import { TextBlock, Control, Rectangle, StackPanel } from "@babylonjs/gui";
import { BaseUI } from "./BaseUI";
import { BlackjackGame, PlayerHandInfo } from "../game/BlackjackGame"; // Import PlayerHandInfo
import { GameState, GameResult } from "../game/GameState";
import { ScoreCalculator } from "../game/ScoreCalculator";

export class StatusUI extends BaseUI {
    private game: BlackjackGame;
    private playerScoreText!: TextBlock;
    private dealerScoreText!: TextBlock;
    private gameStatusText!: TextBlock;
    private fundsText!: TextBlock;
    private betText!: TextBlock; // Displays bet for the active hand or total bet
    private insuranceBetText!: TextBlock;
    private handIndicatorText!: TextBlock; // To show "Hand 1 of 2" etc.
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

        // Hand Indicator (e.g., "Hand 1 of 2")
        this.handIndicatorText = new TextBlock("handIndicator", "");
        Object.assign(this.handIndicatorText, { ...scoreOptions, fontSize: 18, top: "-55px" }); // Position below player score
        this.handIndicatorText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.handIndicatorText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.handIndicatorText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.handIndicatorText.left = "20px";
        this.handIndicatorText.isVisible = false;
        this.guiTexture.addControl(this.handIndicatorText);


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
        const playerHands = this.game.getPlayerHands();
        const activeHandInfo = this.game.getActivePlayerHandInfo();
        const dealerHand = this.game.getDealerHand();
        const playerScore = activeHandInfo ? ScoreCalculator.calculateHandValue(activeHandInfo.cards) : 0;

        this.playerScoreText.text = `Player: ${playerScore > 0 ? playerScore : ""}`;
        if (gameState === GameState.Initial || !activeHandInfo || activeHandInfo.cards.length === 0) {
            this.playerScoreText.text = "Player: ";
        }

        if (playerHands.length > 1 && (gameState === GameState.PlayerTurn || gameState === GameState.DealerTurn || gameState === GameState.GameOver)) {
            this.handIndicatorText.text = `(Hand ${this.game.getActivePlayerHandIndex() + 1} of ${playerHands.length})`;
            this.handIndicatorText.isVisible = true;
        } else {
            this.handIndicatorText.isVisible = false;
        }


        let dealerScoreDisplay = "?";
        const dealerVisibleScore = this.game.getDealerScore(); // Score of face-up cards
        const dealerFullScore = this.game.getDealerFullScore(); // Score of all cards

        if (gameState === GameState.Initial || dealerHand.length === 0) {
            dealerScoreDisplay = ""; // Empty if no cards
        } else if (gameState === GameState.PlayerTurn || gameState === GameState.Betting || gameState === GameState.Dealing) {
            dealerScoreDisplay = dealerVisibleScore > 0 ? `${dealerVisibleScore}` : "?";
        } else if (gameState === GameState.DealerTurn || gameState === GameState.GameOver) {
            dealerScoreDisplay = `${dealerFullScore}`;
        }
        this.dealerScoreText.text = `Dealer: ${dealerScoreDisplay}`;


        this.fundsText.text = `Funds: ${this.currencySign}${this.game.getPlayerFunds()}`;

        // Bet display: Show active hand's bet during play, or total if multiple hands in game over
        let currentBetDisplay = 0;
        if (gameState === GameState.GameOver && playerHands.length > 1) {
            currentBetDisplay = playerHands.reduce((sum, hand) => sum + hand.bet, 0);
            this.betText.text = `Total Bet: ${currentBetDisplay > 0 ? this.currencySign + currentBetDisplay : "--"}`;
        } else if (activeHandInfo) {
            currentBetDisplay = activeHandInfo.bet;
            this.betText.text = `Bet: ${currentBetDisplay > 0 ? this.currencySign + currentBetDisplay : "--"}`;
        } else if (gameState === GameState.Betting || gameState === GameState.Initial) { // Show the bet being configured
            this.betText.text = `Bet: ${this.game.getCurrentBet() > 0 ? this.currencySign + this.game.getCurrentBet() : "--"}`;
        } else { // Fallback for other states if no active hand (e.g., dealing)
            this.betText.text = `Bet: ${this.game.getCurrentBet() > 0 ? this.currencySign + this.game.getCurrentBet() : "--"}`;
        }

        // Visibility of bet text (always show if not initial, betting UI handles its own bet display)
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
            case GameState.Dealing: status = "Dealing Cards..."; statusColor = "#ADD8E6"; break; // LightBlue
            case GameState.PlayerTurn:
                status = "Your Turn";
                if (activeHandInfo) {
                    if (playerScore > 21) {
                        status = `Hand ${this.game.getActivePlayerHandIndex() + 1} Bust!`; statusColor = "tomato";
                    } else if (activeHandInfo.isBlackjack) { // Check the flag set by GameActions
                        status = `Hand ${this.game.getActivePlayerHandIndex() + 1} Blackjack!`; statusColor = "gold";
                    } else if (playerScore === 21) {
                        status = `Hand ${this.game.getActivePlayerHandIndex() + 1} is 21!`; statusColor = "lime";
                    }
                    if (this.game.isInsuranceAvailable()) { status = "Insurance Available"; statusColor = "orange"; }
                }
                break;
            case GameState.DealerTurn: status = "Dealer's Turn"; break;
            case GameState.GameOver:
                // For GameOver, summarize results based on all player hands
                if (playerHands.length > 0) {
                    let allPlayerBust = true;
                    let anyPlayerWinsOrBlackjack = false;
                    let anyPush = false;
                    let hasBlackjack = false;

                    playerHands.forEach(hand => {
                        if (!hand.isResolved || (hand.result !== GameResult.DealerWins && ScoreCalculator.calculateHandValue(hand.cards) <= 21)) {
                            allPlayerBust = false; // If any hand is not a resolved bust or dealer win
                        }
                        if (hand.result === GameResult.PlayerWins) anyPlayerWinsOrBlackjack = true;
                        if (hand.result === GameResult.PlayerBlackjack) {
                            anyPlayerWinsOrBlackjack = true;
                            hasBlackjack = true;
                        }
                        if (hand.result === GameResult.Push) anyPush = true;
                    });

                    const allHandsEffectivelyBusted = playerHands.every(h => ScoreCalculator.calculateHandValue(h.cards) > 21 && h.result === GameResult.DealerWins);

                    if (allHandsEffectivelyBusted) {
                        if (playerHands.length > 1) {
                            status = "Bust - All Hands!";
                        } else {
                            status = "Bust!";
                        }
                        statusColor = "tomato";
                    } else if (hasBlackjack) {
                        status = "Blackjack!"; statusColor = "gold";
                    } else if (anyPlayerWinsOrBlackjack) {
                        status = "You Win!"; statusColor = "lime";
                    } else if (anyPush && playerHands.every(h => h.result === GameResult.Push || h.result === GameResult.DealerWins)) {
                        status = "Push!"; statusColor = "yellow";
                    } else { // Default to dealer wins if no other positive outcome for player
                        status = "Dealer Wins"; statusColor = "tomato";
                    }
                } else { // Should not happen if game was played
                    status = "Round Over";
                }
                break;
            default: status = ""; break;
        }
        this.gameStatusText.text = status; this.gameStatusText.color = statusColor;
    }
}
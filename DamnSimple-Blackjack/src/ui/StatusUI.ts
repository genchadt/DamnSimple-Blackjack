// ui/StatusUI.ts
import { Scene } from "@babylonjs/core";
import { TextBlock, Control, Rectangle } from "@babylonjs/gui";
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
    
    /**
     * Creates a new StatusUI, which displays the player's current score, the dealer's current score, and
     * the current game status. Also displays the player's current funds and current bet.
     * 
     * @param {Scene} scene The scene to add the UI elements to.
     * @param {BlackjackGame} game The game object to monitor for updates.
     */
    constructor(scene: Scene, game: BlackjackGame) {
        super(scene);
        this.game = game;
        
        // Create score displays
        this.playerScoreText = new TextBlock();
        this.playerScoreText.text = "Player: 0";
        this.playerScoreText.color = "white";
        this.playerScoreText.fontSize = 24;
        this.playerScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerScoreText.left = "50px";
        this.playerScoreText.top = "300px";
        this.guiTexture.addControl(this.playerScoreText);
        
        this.dealerScoreText = new TextBlock();
        this.dealerScoreText.text = "Dealer: ?";
        this.dealerScoreText.color = "white";
        this.dealerScoreText.fontSize = 24;
        this.dealerScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.dealerScoreText.left = "50px";
        this.dealerScoreText.top = "-300px";
        this.guiTexture.addControl(this.dealerScoreText);
        
        this.gameStatusText = new TextBlock();
        this.gameStatusText.text = "";
        this.gameStatusText.color = "white";
        this.gameStatusText.fontSize = 36;
        this.gameStatusText.top = "-100px";
        this.guiTexture.addControl(this.gameStatusText);
        
        // Create funds display with better layout
        const fundsPanel = new Rectangle();
        fundsPanel.width = "200px";
        fundsPanel.height = "80px";
        fundsPanel.cornerRadius = 10;
        fundsPanel.background = "#333333";
        fundsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        fundsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        fundsPanel.top = "80px";
        fundsPanel.left = "-20px";
        this.guiTexture.addControl(fundsPanel);
        
        this.fundsText = new TextBlock();
        this.fundsText.text = `Funds: ${this.currencySign}${this.game.getPlayerFunds()}`;
        this.fundsText.color = "white";
        this.fundsText.fontSize = 24;
        this.fundsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        fundsPanel.addControl(this.fundsText);
        
        this.betText = new TextBlock();
        this.betText.text = `Bet: ${this.currencySign}${this.game.getCurrentBet()}`;
        this.betText.color = "white";
        this.betText.fontSize = 24;
        this.betText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.betText.top = "30px";
        fundsPanel.addControl(this.betText);
    }
    
    /**
     * Updates the currency sign displayed on the UI (e.g. "$" or "GBP").
     * 
     * @param {string} sign The new currency sign to display.
     */
    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        this.update();
    }
    
    /**
     * Updates the UI to reflect the current game state. This includes updating
     * the player's and dealer's scores, the player's available funds, the current bet amount,
     * and the game status message. The dealer's full score is shown only when it's their turn
     * or when the game is over. The game status message provides more descriptive feedback 
     * based on the outcome of the game or the player's current turn.
     */
    public update(): void {
        // Update scores
        this.playerScoreText.text = `Player: ${this.game.getPlayerScore()}`;
        
        // Only show dealer's full score when appropriate
        if (this.game.getGameState() === GameState.DealerTurn || 
            this.game.getGameState() === GameState.GameOver) {
            this.dealerScoreText.text = `Dealer: ${this.game.getDealerScore()}`;
        } else {
            this.dealerScoreText.text = "Dealer: ?";
        }
        
        // Update funds and bet
        this.fundsText.text = `Funds: ${this.currencySign}${this.game.getPlayerFunds()}`;
        this.betText.text = `Bet: ${this.currencySign}${this.game.getCurrentBet()}`;
        
        // Update game status with more descriptive messages
        if (this.game.getGameState() === GameState.GameOver) {
            const playerScore = this.game.getPlayerScore();
            const dealerScore = this.game.getDealerScore();
            
            switch (this.game.getGameResult()) {
                case GameResult.PlayerWins:
                    if (dealerScore > 21) {
                        this.gameStatusText.text = "Dealer Bust! You Win!";
                    } else {
                        this.gameStatusText.text = "You Win!";
                    }
                    this.gameStatusText.color = "green";
                    break;
                case GameResult.DealerWins:
                    if (playerScore > 21) {
                        this.gameStatusText.text = "Bust! Dealer Wins";
                    } else {
                        this.gameStatusText.text = "Dealer Wins";
                    }
                    this.gameStatusText.color = "red";
                    break;
                case GameResult.Push:
                    this.gameStatusText.text = "Push - It's a Tie!";
                    this.gameStatusText.color = "white";
                    break;
                case GameResult.PlayerBlackjack:
                    this.gameStatusText.text = "Blackjack! You Win!";
                    this.gameStatusText.color = "gold";
                    break;
            }
        } else if (this.game.getGameState() === GameState.PlayerTurn) {
            this.gameStatusText.text = "Your Turn";
            this.gameStatusText.color = "white";
        } else if (this.game.getGameState() === GameState.Initial) {
            this.gameStatusText.text = "";
            this.playerScoreText.text = "Player: ";
            this.dealerScoreText.text = "Dealer: ";
        } else if (this.game.getGameState() === GameState.DealerTurn) {
            this.gameStatusText.text = "Dealer's Turn";
            this.gameStatusText.color = "white";
        } else {
            this.gameStatusText.text = "";
        }
    }
}

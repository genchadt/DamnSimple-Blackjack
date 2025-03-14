// ui/GameUI.ts
import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, TextBlock, StackPanel, Control } from "@babylonjs/gui";
import { BlackjackGame, GameState, GameResult } from "../game/BlackjackGame";

export class GameUI {
    private scene: Scene;
    private game: BlackjackGame;
    private guiTexture: AdvancedDynamicTexture;
    private playerScoreText: TextBlock;
    private dealerScoreText: TextBlock;
    private gameStatusText: TextBlock;
    private actionPanel: StackPanel;
    private hitButton: Button;
    private standButton: Button;
    private newGameButton: Button;

    constructor(scene: Scene, game: BlackjackGame) {
        this.scene = scene;
        this.game = game;
        this.createUI();
    }

    private createUI(): void {
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);
        
        // Create score displays
        this.playerScoreText = new TextBlock();
        this.playerScoreText.text = "Player: 0";
        this.playerScoreText.color = "white";
        this.playerScoreText.fontSize = 24;
        this.playerScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerScoreText.left = "100px";
        this.playerScoreText.top = "200px";
        this.guiTexture.addControl(this.playerScoreText);
        
        this.dealerScoreText = new TextBlock();
        this.dealerScoreText.text = "Dealer: ?";
        this.dealerScoreText.color = "white";
        this.dealerScoreText.fontSize = 24;
        this.dealerScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.dealerScoreText.left = "100px";
        this.dealerScoreText.top = "-200px";
        this.guiTexture.addControl(this.dealerScoreText);
        
        this.gameStatusText = new TextBlock();
        this.gameStatusText.text = "";
        this.gameStatusText.color = "white";
        this.gameStatusText.fontSize = 36;
        this.gameStatusText.top = "-100px";
        this.guiTexture.addControl(this.gameStatusText);
        
        // Create action buttons
        this.actionPanel = new StackPanel();
        this.actionPanel.width = "200px";
        this.actionPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.actionPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.actionPanel.top = "-50px";
        this.actionPanel.left = "-50px";
        this.guiTexture.addControl(this.actionPanel);
        
        this.hitButton = Button.CreateSimpleButton("hitButton", "Hit");
        this.hitButton.width = "150px";
        this.hitButton.height = "40px";
        this.hitButton.color = "white";
        this.hitButton.background = "green";
        this.hitButton.onPointerClickObservable.add(() => {
            this.game.playerHit();
            this.update();
        });
        this.actionPanel.addControl(this.hitButton);
        
        this.standButton = Button.CreateSimpleButton("standButton", "Stand");
        this.standButton.width = "150px";
        this.standButton.height = "40px";
        this.standButton.color = "white";
        this.standButton.background = "red";
        this.standButton.paddingTop = "10px";
        this.standButton.onPointerClickObservable.add(() => {
            this.game.playerStand();
            this.update();
        });
        this.actionPanel.addControl(this.standButton);
        
        this.newGameButton = Button.CreateSimpleButton("newGameButton", "New Game");
        this.newGameButton.width = "150px";
        this.newGameButton.height = "40px";
        this.newGameButton.color = "white";
        this.newGameButton.background = "blue";
        this.newGameButton.paddingTop = "10px";
        this.newGameButton.isVisible = false;
        this.newGameButton.onPointerClickObservable.add(() => {
            this.game.startNewGame();
            this.update();
        });
        this.actionPanel.addControl(this.newGameButton);
        
        // Initial update
        this.update();
    }

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
        
        // Update game status
        if (this.game.getGameState() === GameState.GameOver) {
            switch (this.game.getGameResult()) {
                case GameResult.PlayerWins:
                    this.gameStatusText.text = "You Win!";
                    this.gameStatusText.color = "green";
                    break;
                case GameResult.DealerWins:
                    this.gameStatusText.text = "Dealer Wins";
                    this.gameStatusText.color = "red";
                    break;
                case GameResult.Push:
                    this.gameStatusText.text = "Push";
                    this.gameStatusText.color = "white";
                    break;
                case GameResult.PlayerBlackjack:
                    this.gameStatusText.text = "Blackjack!";
                    this.gameStatusText.color = "gold";
                    break;
            }
            
            // Show new game button, hide hit/stand
            this.hitButton.isVisible = false;
            this.standButton.isVisible = false;
            this.newGameButton.isVisible = true;
        } else {
            this.gameStatusText.text = "";
            this.hitButton.isVisible = true;
            this.standButton.isVisible = true;
            this.newGameButton.isVisible = false;
        }
    }
}

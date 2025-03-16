// Add a new file: debug/DebugManager.ts

import { Scene, Vector3 } from "@babylonjs/core";
import { BlackjackGame, GameState, GameResult } from "../game/BlackjackGame";
import { Card, Suit, Rank } from "../game/Card";
import { GameScene } from "../scenes/GameScene";
import { CardVisualizer } from "../scenes/components/CardVisualizer";
import { GameUI } from "../ui/GameUI";

export class DebugManager {
    private gameScene: GameScene;
    private blackjackGame: BlackjackGame;
    private cardVisualizer: CardVisualizer;
    private gameUI: GameUI;

    /**
     * Initializes a new instance of the DebugManager class.
     * 
     * @param {GameScene} gameScene - The game scene containing the game logic and UI components.
     * @param {CardVisualizer} cardVisualizer - The visualizer instance for rendering cards.
     * 
     * This constructor sets up the DebugManager by binding game scene components and
     * card visualizer, and exposing them globally for console access and manipulation.
     * It provides the ability to access game objects directly from the console and
     * logs initialization information.
     */
    constructor(gameScene: GameScene, cardVisualizer: CardVisualizer) {
        this.gameScene = gameScene;
        this.blackjackGame = gameScene.getBlackjackGame();
        this.cardVisualizer = cardVisualizer;
        this.gameUI = gameScene.getGameUI();
        
        // Register this instance globally for console access
        (window as any).debug = this;
        
        // Expose game objects globally for direct console manipulation
        (window as any).game = this.blackjackGame;
        (window as any).scene = gameScene.getScene();
        (window as any).cardViz = this.cardVisualizer;
        (window as any).gameUI = this.gameUI;
        
        console.log("Debug manager initialized. Type 'debug.help()' for available commands.");
    }

    /**
     * Prints a list of available debug commands and their descriptions.
     * 
     * Example usage: debug.help()
     */
    public help(): void {
        console.log("%cBlackjack Debug Commands", "font-size: 16px; font-weight: bold; color: #4CAF50;");
        console.log("%cGame State Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setGameState(state) - Set game state (0=Initial, 1=Betting, 2=PlayerTurn, 3=DealerTurn, 4=GameOver)");
        console.log("  debug.setGameResult(result) - Set game result (0=PlayerWins, 1=DealerWins, 2=Push, 3=PlayerBlackjack, 4=InProgress)");
        console.log("  debug.resetGame() - Reset the game to initial state");
        console.log("  debug.startNewGame(bet) - Start a new game with specified bet");
        console.log("  debug.getState() - Get current game state information");
        
        console.log("%cCard Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.addCard(isPlayer, suit, rank, faceUp) - Add a card to player or dealer hand");
        console.log("  debug.clearCards(isPlayer) - Clear all cards from player or dealer hand");
        console.log("  debug.flipCard(isPlayer, index) - Flip a specific card");
        console.log("  debug.dealRandomCard(isPlayer, faceUp) - Deal a random card");
        console.log("  debug.renderCards() - Force re-render all cards");
        
        console.log("%cFunds Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setFunds(amount) - Set player funds to specific amount");
        console.log("  debug.setBet(amount) - Set current bet to specific amount");
        
        console.log("%cUI Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.updateUI() - Force UI update");
        console.log("  debug.toggleInspector() - Toggle Babylon.js inspector");
        
        console.log("%cExamples:", "font-weight: bold; color: #FF9800;");
        console.log("  debug.setGameState(2) - Set game to PlayerTurn");
        console.log("  debug.addCard(true, 'Hearts', 'A', true) - Add Ace of Hearts to player's hand face up");
        console.log("  debug.dealRandomCard(false, false) - Deal random card to dealer face down");
    }
    
    /**
     * Set the game state
     * 
     * @param state GameState value (0=Initial, 1=Betting, 2=PlayerTurn, 3=DealerTurn, 4=GameOver)
     */
    public setGameState(state: number): void {
        if (state < 0 || state > 4) {
            console.error("Invalid game state. Use 0-4.");
            return;
        }
        this.blackjackGame.setGameState(state as GameState);
        this.updateUI();
        console.log(`Game state set to ${GameState[state]}`);
    }
    
    /**
     * Set the game result
     * 
     * @param result GameResult value (0=PlayerWins, 1=DealerWins, 2=Push, 3=PlayerBlackjack, 4=InProgress)
     */
    public setGameResult(result: number): void {
        if (result < 0 || result > 4) {
            console.error("Invalid game result. Use 0-4.");
            return;
        }
        
        // Access private gameResult field using an ugly but effective approach
        (this.blackjackGame as any).gameResult = result;
        this.updateUI();
        console.log(`Game result set to ${GameResult[result]}`);
    }
    
    /**
     * Reset the game to initial state
     */
    public resetGame(): void {
        // Clear all cards
        this.clearCards(true);
        this.clearCards(false);
        
        // Reset game state
        this.blackjackGame.setGameState(GameState.Initial);
        this.updateUI();
        console.log("Game reset to initial state");
    }
    
    /**
     * Start a new game with specified bet
     * 
     * @param bet Bet amount
     */
    public startNewGame(bet: number = 10): void {
        this.blackjackGame.startNewGame(bet);
        this.updateUI();
        console.log(`Started new game with bet: ${bet}`);
    }
    
    /**
     * Get current game state information
     */
    public getState(): void {
        const gameState = this.blackjackGame.getGameState();
        const gameResult = this.blackjackGame.getGameResult();
        const playerScore = this.blackjackGame.getPlayerScore();
        const dealerScore = this.blackjackGame.getDealerScore();
        const playerFunds = this.blackjackGame.getPlayerFunds();
        const currentBet = this.blackjackGame.getCurrentBet();
        
        console.log("%cGame State Information", "font-weight: bold; color: #4CAF50;");
        console.log(`Game State: ${GameState[gameState]} (${gameState})`);
        console.log(`Game Result: ${GameResult[gameResult]} (${gameResult})`);
        console.log(`Player Score: ${playerScore}`);
        console.log(`Dealer Score: ${dealerScore}`);
        console.log(`Player Funds: ${playerFunds}`);
        console.log(`Current Bet: ${currentBet}`);
        
        console.log("%cPlayer Hand:", "font-weight: bold; color: #2196F3;");
        this.blackjackGame.getPlayerHand().forEach((card, index) => {
            console.log(`  ${index}: ${card.toString()} (${card.isFaceUp() ? 'face up' : 'face down'})`);
        });
        
        console.log("%cDealer Hand:", "font-weight: bold; color: #2196F3;");
        this.blackjackGame.getDealerHand().forEach((card, index) => {
            console.log(`  ${index}: ${card.toString()} (${card.isFaceUp() ? 'face up' : 'face down'})`);
        });
    }
    
    /**
     * Add a card to player or dealer hand
     * 
     * @param isPlayer True for player, false for dealer
     * @param suit Card suit (Hearts, Diamonds, Clubs, Spades)
     * @param rank Card rank (2-10, J, Q, K, A)
     * @param faceUp Whether the card should be face up
     */
    public addCard(isPlayer: boolean, suit: string, rank: string, faceUp: boolean = true): void {
        // Validate suit and rank
        if (!Object.values(Suit).includes(suit as Suit)) {
            console.error(`Invalid suit: ${suit}. Use Hearts, Diamonds, Clubs, or Spades.`);
            return;
        }
        
        if (!Object.values(Rank).includes(rank as Rank)) {
            console.error(`Invalid rank: ${rank}. Use 2-10, J, Q, K, or A.`);
            return;
        }
        
        // Create the card
        const card = new Card(suit as Suit, rank as Rank);
        card.setFaceUp(faceUp);
        
        // Add to appropriate hand
        const hand = isPlayer ? 
            (this.blackjackGame as any).playerHand : 
            (this.blackjackGame as any).dealerHand;
        
        hand.push(card);
        
        // Register flip callback
        this.blackjackGame.addCardFlipCallback((flippedCard) => {
            this.cardVisualizer.updateCardVisual(flippedCard);
        });
        
        // Render the new card
        this.renderCards();
        this.updateUI();
        
        console.log(`Added ${card.toString()} to ${isPlayer ? 'player' : 'dealer'}'s hand (${faceUp ? 'face up' : 'face down'})`);
    }
    
    /**
     * Clear all cards from player or dealer hand
     * 
     * @param isPlayer True for player, false for dealer
     */
    public clearCards(isPlayer: boolean): void {
        // Access private hand fields
        if (isPlayer) {
            (this.blackjackGame as any).playerHand = [];
        } else {
            (this.blackjackGame as any).dealerHand = [];
        }
        
        // Clear card visualizations
        this.cardVisualizer.clearTable();
        this.updateUI();
        
        console.log(`Cleared ${isPlayer ? 'player' : 'dealer'}'s hand`);
    }
    
    /**
     * Flip a specific card
     * 
     * @param isPlayer True for player, false for dealer
     * @param index Card index in hand
     */
    public flipCard(isPlayer: boolean, index: number): void {
        const hand = isPlayer ? 
            this.blackjackGame.getPlayerHand() : 
            this.blackjackGame.getDealerHand();
        
        if (index < 0 || index >= hand.length) {
            console.error(`Invalid card index: ${index}. Hand has ${hand.length} cards.`);
            return;
        }
        
        hand[index].flip();
        this.updateUI();
        
        console.log(`Flipped ${isPlayer ? 'player' : 'dealer'}'s card at index ${index}`);
    }
    
    /**
     * Deal a random card to player or dealer
     * 
     * @param isPlayer True for player, false for dealer
     * @param faceUp Whether the card should be face up
     */
    public dealRandomCard(isPlayer: boolean, faceUp: boolean = true): void {
        // Get a random suit and rank
        const suits = Object.values(Suit);
        const ranks = Object.values(Rank);
        
        const randomSuit = suits[Math.floor(Math.random() * suits.length)];
        const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
        
        this.addCard(isPlayer, randomSuit, randomRank, faceUp);
    }
    
    /**
     * Force re-render all cards
     */
    public renderCards(): void {
        this.cardVisualizer.renderCards();
        console.log("Cards re-rendered");
    }
    
    /**
     * Set player funds to specific amount
     * 
     * @param amount Fund amount
     */
    public setFunds(amount: number): void {
        if (amount < 0) {
            console.error("Funds cannot be negative");
            return;
        }
        
        // Access private playerFunds field
        (this.blackjackGame as any).playerFunds.funds = amount;
        this.updateUI();
        
        console.log(`Player funds set to ${amount}`);
    }
    
    /**
     * Set current bet to specific amount
     * 
     * @param amount Bet amount
     */
    public setBet(amount: number): void {
        if (amount < 0) {
            console.error("Bet cannot be negative");
            return;
        }
        
        // Set current bet
        (this.blackjackGame as any).currentBet = amount;
        this.updateUI();
        
        console.log(`Current bet set to ${amount}`);
    }
    
    /**
     * Force UI update
     */
    public updateUI(): void {
        this.gameUI.update();
        console.log("UI updated");
    }
    
    /**
     * Toggle Babylon.js inspector
     */
    public toggleInspector(): void {
        const scene = this.gameScene.getScene();
        
        if (scene.debugLayer.isVisible()) {
            scene.debugLayer.hide();
            console.log("Inspector hidden");
        } else {
            scene.debugLayer.show();
            console.log("Inspector shown");
        }
    }
}

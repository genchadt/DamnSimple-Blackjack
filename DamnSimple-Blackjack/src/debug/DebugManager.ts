// src/debug/debugmanager-ts
// No changes needed here for the core issue, but included for completeness.
import { Scene, Vector3 } from "@babylonjs/core";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState, GameResult } from "../game/GameState";
import { Card, Suit, Rank } from "../game/Card";
import { GameScene } from "../scenes/GameScene";
import { CardVisualizer } from "../scenes/components/CardVisualizer";
import { GameUI } from "../ui/GameUI";

export class DebugManager {
    private gameScene: GameScene;
    private blackjackGame: BlackjackGame;
    private cardVisualizer: CardVisualizer;
    private gameUI: GameUI;
    private debugCardContainerElement: HTMLElement | null = null;
    private isCardDebugContainerVisible: boolean = false;

    /**
     * Initializes a new instance of the DebugManager class.
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
     */
    public help(): void {
        console.log("%cBlackjack Debug Commands", "font-size: 16px; font-weight: bold; color: #4CAF50;");
        console.log("%cGame State Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setGameState(state) - Set game state (0=Initial, 1=Betting, 2=PlayerTurn, 3=DealerTurn, 4=GameOver)");
        console.log("  debug.setGameResult(result) - Set game result (0=PlayerWins, 1=DealerWins, 2=Push, 3=PlayerBlackjack, 4=InProgress)");
        console.log("  debug.resetGame() - Reset the game to initial state");
        console.log("  debug.startNewGame(bet) - Start a new game with specified bet (clears table)");
        console.log("  debug.getState() - Get current game state information");

        console.log("%cCard Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.addCard(isPlayer, suit, rank, faceUp) - Add a card to player or dealer hand");
        console.log("  debug.clearCards(isPlayer) - Clear all cards from player or dealer hand");
        console.log("  debug.flipCard(isPlayer, index) - Flip a specific card");
        console.log("  debug.dealRandomCard(isPlayer, faceUp) - Deal a random card");
        console.log("  debug.renderCards() - Force re-render all cards");
        console.log("  debug.revealDealerHole() - Reveals the dealer's hole card");

        console.log("%cFunds Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setFunds(amount) - Set player funds to specific amount");
        console.log("  debug.setBet(amount) - Set current bet to specific amount");

        console.log("%cUI Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.updateUI() - Force UI update");
        console.log("  debug.toggleInspector() - Toggle Babylon.js inspector");
        console.log("  debug.toggleCardDebugContainer(visible?) - Toggle visibility of the card SVG debug container.");

        console.log("%cExamples:", "font-weight: bold; color: #FF9800;");
        console.log("  debug.setGameState(2) - Set game to PlayerTurn");
        console.log("  debug.addCard(true, 'Hearts', 'A', true) - Add Ace of Hearts to player's hand face up");
        console.log("  debug.dealRandomCard(false, false) - Deal random card to dealer face down");
    }

    /**
     * Set the game state
     */
    public setGameState(state: number): void {
        if (state < 0 || state > 4) {
            console.error("Invalid game state. Use 0-4.");
            return;
        }
        // Use the proper setter in GameActions via BlackjackGame
        this.blackjackGame.getGameActions().setGameState(state as GameState, true); // Force save
        this.updateUI();
        console.log(`Game state set to ${GameState[state]}`);
    }

    /**
     * Set the game result
     */
    public setGameResult(result: number): void {
        if (result < 0 || result > 4) {
            console.error("Invalid game result. Use 0-4.");
            return;
        }
        // Use the proper setter in GameActions via BlackjackGame
        this.blackjackGame.getGameActions().setGameResult(result as GameResult, true); // Force save
        this.updateUI();
        console.log(`Game result set to ${GameResult[result]}`);
    }

    /**
     * Reset the game to initial state
     */
    public resetGame(): void {
        // Clear table visuals
        this.cardVisualizer.clearTable();

        // Reset game logic state
        this.blackjackGame.getGameActions().setGameState(GameState.Initial, true);
        this.blackjackGame.getGameActions().setGameResult(GameResult.InProgress, true);
        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);
        this.blackjackGame.setCurrentBet(0); // Reset bet logically
        this.blackjackGame.resetFunds(); // Reset funds

        this.updateUI();
        console.log("Game reset to initial state");
    }

    /**
     * Start a new game with specified bet (clears table)
     */
    public startNewGame(bet: number = 10): void {
        this.cardVisualizer.clearTable(); // Ensure table is clear visually
        const success = this.blackjackGame.startNewGame(bet);
        if (success) {
            this.updateUI(); // Update UI after starting
            this.renderCards(); // Render the newly dealt cards
            console.log(`Started new game with bet: ${bet}`);
        } else {
            console.error(`Failed to start new game with bet ${bet}. Insufficient funds?`);
            this.updateUI(); // Update UI to show current state (likely Betting or Initial)
        }
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
        console.log(`Dealer Score: ${dealerScore} (value of face-up cards only unless revealed)`);
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
     */
    public addCard(isPlayer: boolean, suit: string, rank: string, faceUp: boolean = true): void {
        if (!Object.values(Suit).includes(suit as Suit)) {
            console.error(`Invalid suit: ${suit}. Use Hearts, Diamonds, Clubs, or Spades.`);
            return;
        }
        if (!Object.values(Rank).includes(rank as Rank)) {
            console.error(`Invalid rank: ${rank}. Use 2-10, J, Q, K, or A.`);
            return;
        }

        const card = new Card(suit as Suit, rank as Rank);
        card.setFaceUp(faceUp); // Set face state directly

        // Get the correct hand array from BlackjackGame
        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();
        hand.push(card);

        // Re-register flip callback for the new card
        this.blackjackGame.getHandManager().registerFlipCallback(card);

        // Re-render cards and update UI
        this.renderCards();
        this.updateUI();

        console.log(`Added ${card.toString()} to ${isPlayer ? 'player' : 'dealer'}'s hand (${faceUp ? 'face up' : 'face down'})`);
    }

    /**
     * Clear all cards from player or dealer hand
     */
    public clearCards(isPlayer: boolean): void {
        if (isPlayer) {
            this.blackjackGame.setPlayerHand([]);
        } else {
            this.blackjackGame.setDealerHand([]);
        }

        // Clear card visualizations and update UI
        this.cardVisualizer.clearTable(); // Clear everything visually for simplicity in debug
        this.renderCards(); // Re-render (will show nothing for the cleared hand)
        this.updateUI();

        console.log(`Cleared ${isPlayer ? 'player' : 'dealer'}'s hand`);
    }

    /**
     * Flip a specific card
     */
    public flipCard(isPlayer: boolean, index: number): void {
        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();

        if (index < 0 || index >= hand.length) {
            console.error(`Invalid card index: ${index}. Hand has ${hand.length} cards.`);
            return;
        }

        hand[index].flip(); // This will trigger the onFlip callback -> updateCardVisual
        // No need to call updateUI or renderCards here, flip callback handles visual update

        console.log(`Flipped ${isPlayer ? 'player' : 'dealer'}'s card at index ${index}`);
    }

    /**
     * Reveal dealer's hole card
     */
    public revealDealerHole(): void {
        const dealerHand = this.blackjackGame.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            dealerHand[0].flip();
             console.log(`DEBUG: Revealed dealer hole card: ${dealerHand[0].toString()}`);
        } else {
             console.log("DEBUG: Dealer hole card already revealed or no cards dealt.");
        }
    }


    /**
     * Deal a random card to player or dealer
     */
    public dealRandomCard(isPlayer: boolean, faceUp: boolean = true): void {
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
     */
    public setFunds(amount: number): void {
        if (amount < 0) {
            console.error("Funds cannot be negative");
            return;
        }
        // Use the proper method in PlayerFunds via BlackjackGame
        this.blackjackGame.getPlayerFundsManager().setFunds(amount); // Need a setter in PlayerFunds
        this.updateUI();
        console.log(`Player funds set to ${amount}`);
    }

    /**
     * Set current bet to specific amount
     */
    public setBet(amount: number): void {
        if (amount < 0) {
            console.error("Bet cannot be negative");
            return;
        }
        // Use the proper method via BlackjackGame
        this.blackjackGame.setCurrentBet(amount);
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

    /**
     * Toggles the visibility of the temporary HTML container used for rendering card SVGs.
     * When visible, CardVisualizer will use this container.
     * @param visible Optional. Force visibility state. If undefined, it toggles.
     */
    public toggleCardDebugContainer(visible?: boolean): void {
        if (typeof visible === 'undefined') {
            this.isCardDebugContainerVisible = !this.isCardDebugContainerVisible;
        } else {
            this.isCardDebugContainerVisible = visible;
        }

        if (this.isCardDebugContainerVisible) {
            if (!this.debugCardContainerElement) {
                this.debugCardContainerElement = document.createElement("div");
                this.debugCardContainerElement.id = "cardmeister-debug-temp-container";
                Object.assign(this.debugCardContainerElement.style, {
                    position: 'absolute',
                    left: '10px',
                    top: '10px',
                    width: '300px',
                    height: '400px',
                    overflow: 'scroll',
                    border: '2px solid red',
                    zIndex: '1001', // Ensure it's on top of other debug elements if any
                    backgroundColor: 'rgba(200, 200, 200, 0.7)',
                    padding: '5px'
                });
                document.body.appendChild(this.debugCardContainerElement);
                console.log("Card SVG debug container created and shown.");
            } else {
                this.debugCardContainerElement.style.display = 'block';
                 console.log("Card SVG debug container shown.");
            }
            this.cardVisualizer.setTempCardContainer(this.debugCardContainerElement);
        } else {
            this.cardVisualizer.setTempCardContainer(null); // Tell CardVisualizer to use its internal container
            if (this.debugCardContainerElement) {
                this.debugCardContainerElement.style.display = 'none'; // Hide it instead of removing, to keep content if toggled back
                // Or to fully remove:
                // this.debugCardContainerElement.remove();
                // this.debugCardContainerElement = null;
                console.log("Card SVG debug container hidden.");
            }
        }
    }
}
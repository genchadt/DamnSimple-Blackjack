// src/debug/debugmanager-ts
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
    private cardVisualizer: CardVisualizer; // Keep for other debug purposes if needed
    private gameUI: GameUI;

    private debugHandDisplayElement: HTMLElement | null = null;
    private isHandDisplayVisible: boolean = false;
    private dragOffsetX: number = 0;
    private dragOffsetY: number = 0;
    private isDragging: boolean = false;

    /**
     * Initializes a new instance of the DebugManager class.
     */
    constructor(gameScene: GameScene, cardVisualizer: CardVisualizer, blackjackGame: BlackjackGame) {
        this.gameScene = gameScene;
        this.blackjackGame = blackjackGame; // Use passed instance
        this.cardVisualizer = cardVisualizer;
        this.gameUI = gameScene.getGameUI();

        (window as any).debug = this;
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
        console.log("  debug.renderCards() - Force re-render all cards (visuals in Babylon)");
        console.log("  debug.revealDealerHole() - Reveals the dealer's hole card");

        console.log("%cFunds Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setFunds(amount) - Set player funds to specific amount");
        console.log("  debug.setBet(amount) - Set current bet to specific amount");

        console.log("%cUI Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.updateUI() - Force UI update");
        console.log("  debug.toggleInspector() - Toggle Babylon.js inspector");
        console.log("  debug.toggleHandDisplay(visible?) - Toggle draggable display of current hands.");

        console.log("%cExamples:", "font-weight: bold; color: #FF9800;");
        console.log("  debug.setGameState(2) - Set game to PlayerTurn");
        console.log("  debug.addCard(true, 'Hearts', 'A', true) - Add Ace of Hearts to player's hand face up");
        console.log("  debug.dealRandomCard(false, false) - Deal random card to dealer face down");
    }

    public setGameState(state: number): void {
        if (state < 0 || state > 4) {
            console.error("Invalid game state. Use 0-4.");
            return;
        }
        this.blackjackGame.getGameActions().setGameState(state as GameState, true);
        this.updateUI();
        this.updateDebugHandDisplay();
        console.log(`Game state set to ${GameState[state]}`);
    }

    public setGameResult(result: number): void {
        if (result < 0 || result > 4) {
            console.error("Invalid game result. Use 0-4.");
            return;
        }
        this.blackjackGame.getGameActions().setGameResult(result as GameResult, true);
        this.updateUI();
        this.updateDebugHandDisplay();
        console.log(`Game result set to ${GameResult[result]}`);
    }

    public resetGame(): void {
        this.cardVisualizer.clearTable();
        this.blackjackGame.getGameActions().setGameState(GameState.Initial, true);
        this.blackjackGame.getGameActions().setGameResult(GameResult.InProgress, true);
        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);
        this.blackjackGame.setCurrentBet(0);
        this.blackjackGame.resetFunds();
        this.updateUI();
        this.updateDebugHandDisplay();
        console.log("Game reset to initial state");
    }

    public startNewGame(bet: number = 10): void {
        this.cardVisualizer.clearTable();
        const success = this.blackjackGame.startNewGame(bet);
        if (success) {
            // UI update and card rendering are handled by the game flow
            // this.updateUI(); // GameController will handle this
            // this.renderCards(); // CardVisualizer will handle this
            console.log(`Started new game with bet: ${bet}`);
        } else {
            console.error(`Failed to start new game with bet ${bet}. Insufficient funds?`);
            this.updateUI();
        }
        // Game flow should update hands, so update debug display after a short delay
        setTimeout(() => this.updateDebugHandDisplay(), 100);
    }

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
        this.updateDebugHandDisplay();
    }

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
        card.setFaceUp(faceUp);

        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();
        hand.push(card);
        this.blackjackGame.getHandManager().registerFlipCallback(card);

        this.renderCards(); // Update Babylon visuals
        this.updateUI();
        this.updateDebugHandDisplay(); // Update HTML debug display

        console.log(`Added ${card.toString()} to ${isPlayer ? 'player' : 'dealer'}'s hand (${faceUp ? 'face up' : 'face down'})`);
    }

    public clearCards(isPlayer: boolean): void {
        if (isPlayer) {
            this.blackjackGame.setPlayerHand([]);
        } else {
            this.blackjackGame.setDealerHand([]);
        }
        this.cardVisualizer.renderCards(); // Re-render Babylon visuals (will clear the hand)
        this.updateUI();
        this.updateDebugHandDisplay();
        console.log(`Cleared ${isPlayer ? 'player' : 'dealer'}'s hand`);
    }

    public flipCard(isPlayer: boolean, index: number): void {
        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();
        if (index < 0 || index >= hand.length) {
            console.error(`Invalid card index: ${index}. Hand has ${hand.length} cards.`);
            return;
        }
        hand[index].flip(); // Triggers visual update via CardVisualizer
        // Visual update in Babylon is handled by CardVisualizer's flip callback.
        // UI (scores) update is handled by GameController's animation complete chain.
        this.updateDebugHandDisplay(); // Update HTML debug display
        console.log(`Flipped ${isPlayer ? 'player' : 'dealer'}'s card at index ${index}`);
    }

    public revealDealerHole(): void {
        const dealerHand = this.blackjackGame.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            dealerHand[0].flip();
            console.log(`DEBUG: Revealed dealer hole card: ${dealerHand[0].toString()}`);
        } else {
            console.log("DEBUG: Dealer hole card already revealed or no cards dealt.");
        }
        this.updateDebugHandDisplay();
    }

    public dealRandomCard(isPlayer: boolean, faceUp: boolean = true): void {
        const suits = Object.values(Suit);
        const ranks = Object.values(Rank);
        const randomSuit = suits[Math.floor(Math.random() * suits.length)];
        const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
        this.addCard(isPlayer, randomSuit, randomRank, faceUp);
    }

    public renderCards(): void {
        this.cardVisualizer.renderCards(); // Renders Babylon visuals
        this.updateDebugHandDisplay(); // Update HTML debug display
        console.log("Cards re-rendered (Babylon visuals and debug display)");
    }

    public setFunds(amount: number): void {
        if (amount < 0) {
            console.error("Funds cannot be negative");
            return;
        }
        this.blackjackGame.getPlayerFundsManager().setFunds(amount);
        this.updateUI();
        console.log(`Player funds set to ${amount}`);
    }

    public setBet(amount: number): void {
        if (amount < 0) {
            console.error("Bet cannot be negative");
            return;
        }
        this.blackjackGame.setCurrentBet(amount);
        this.updateUI();
        console.log(`Current bet set to ${amount}`);
    }

    public updateUI(): void {
        this.gameUI.update(this.cardVisualizer.isAnimationInProgress());
        this.updateDebugHandDisplay(); // Also refresh debug display on general UI update
        console.log("UI updated");
    }

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
     * Toggles the visibility of the draggable HTML container that displays current hands.
     * @param visible Optional. Force visibility state. If undefined, it toggles.
     */
    public toggleHandDisplay(visible?: boolean): void {
        if (typeof visible === 'undefined') {
            this.isHandDisplayVisible = !this.isHandDisplayVisible;
        } else {
            this.isHandDisplayVisible = visible;
        }

        if (this.isHandDisplayVisible) {
            if (!this.debugHandDisplayElement) {
                this.createDebugHandDisplayElement();
            }
            this.debugHandDisplayElement!.style.display = 'block';
            this.updateDebugHandDisplay();
            console.log("Debug hand display shown.");
        } else {
            if (this.debugHandDisplayElement) {
                this.debugHandDisplayElement.style.display = 'none';
                console.log("Debug hand display hidden.");
            }
        }
    }

    private createDebugHandDisplayElement(): void {
        this.debugHandDisplayElement = document.createElement("div");
        this.debugHandDisplayElement.id = "blackjack-debug-hand-display";
        Object.assign(this.debugHandDisplayElement.style, {
            position: 'absolute',
            left: '10px',
            top: '10px',
            width: 'auto', // Adjust to content
            minWidth: '250px',
            maxWidth: '400px',
            maxHeight: '400px',
            overflowY: 'auto',
            overflowX: 'hidden',
            border: '2px solid blue',
            backgroundColor: 'rgba(220, 220, 255, 0.85)',
            padding: '10px',
            zIndex: '1002',
            cursor: 'move',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#333',
            borderRadius: '5px',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)'
        });
        document.body.appendChild(this.debugHandDisplayElement);

        // Make it draggable
        this.debugHandDisplayElement.onmousedown = (e) => {
            // Prevent dragging if clicking on an interactive element inside (e.g. a button, if any were added)
            if ((e.target as HTMLElement).closest('button, input, select, textarea')) {
                return;
            }
            this.isDragging = true;
            this.dragOffsetX = e.clientX - this.debugHandDisplayElement!.offsetLeft;
            this.dragOffsetY = e.clientY - this.debugHandDisplayElement!.offsetTop;
            document.onmousemove = this.dragElement.bind(this);
            document.onmouseup = this.stopDragElement.bind(this);
            e.preventDefault(); // Prevent text selection while dragging
        };
    }

    private dragElement(e: MouseEvent): void {
        if (this.isDragging && this.debugHandDisplayElement) {
            e.preventDefault();
            let newLeft = e.clientX - this.dragOffsetX;
            let newTop = e.clientY - this.dragOffsetY;

            // Constrain to viewport
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const elWidth = this.debugHandDisplayElement.offsetWidth;
            const elHeight = this.debugHandDisplayElement.offsetHeight;

            newLeft = Math.max(0, Math.min(newLeft, viewportWidth - elWidth));
            newTop = Math.max(0, Math.min(newTop, viewportHeight - elHeight));

            this.debugHandDisplayElement.style.left = newLeft + 'px';
            this.debugHandDisplayElement.style.top = newTop + 'px';
        }
    }

    private stopDragElement(): void {
        this.isDragging = false;
        document.onmousemove = null;
        document.onmouseup = null;
    }

    /** Updates the content of the debug hand display element. */
    public updateDebugHandDisplay(): void {
        if (!this.isHandDisplayVisible || !this.debugHandDisplayElement) {
            return;
        }

        this.debugHandDisplayElement.innerHTML = ''; // Clear previous content

        const createHeader = (text: string) => {
            const header = document.createElement('h4');
            header.textContent = text;
            header.style.margin = '10px 0 5px 0';
            header.style.borderBottom = '1px solid #999';
            header.style.paddingBottom = '3px';
            this.debugHandDisplayElement!.appendChild(header);
        };

        const createCardListContainer = () => {
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.flexWrap = 'wrap'; // Allow cards to wrap
            container.style.gap = '5px'; // Space between cards
            return container;
        };

        const createPlayingCardElement = (card: Card) => {
            const cardEl = document.createElement('playing-card');
            cardEl.setAttribute('cid', card.getCid());
            if (card.isFaceUp()) {
                cardEl.setAttribute('faceup', '');
            }
            // Style the <playing-card> element itself for consistency
            cardEl.style.width = '60px'; // Smaller size for debug view
            cardEl.style.height = '84px'; // Maintain aspect ratio
            cardEl.style.fontSize = '8px'; // If CardMeister uses em units for internal details
            return cardEl;
        };

        // Dealer Cards
        createHeader('Dealer Cards');
        const dealerHand = this.blackjackGame.getDealerHand();
        const dealerCardContainer = createCardListContainer();
        if (dealerHand.length > 0) {
            dealerHand.forEach(card => {
                dealerCardContainer.appendChild(createPlayingCardElement(card));
            });
        } else {
            dealerCardContainer.textContent = 'No cards';
        }
        this.debugHandDisplayElement.appendChild(dealerCardContainer);

        // Player Cards
        createHeader('Player Cards');
        const playerHand = this.blackjackGame.getPlayerHand();
        const playerCardContainer = createCardListContainer();
        if (playerHand.length > 0) {
            playerHand.forEach(card => {
                playerCardContainer.appendChild(createPlayingCardElement(card));
            });
        } else {
            playerCardContainer.textContent = 'No cards';
        }
        this.debugHandDisplayElement.appendChild(playerCardContainer);
    }

    public dispose(): void {
        if (this.debugHandDisplayElement) {
            this.debugHandDisplayElement.remove();
            this.debugHandDisplayElement = null;
        }
        // Remove global references if set
        if ((window as any).debug === this) {
            (window as any).debug = undefined;
        }
    }
}

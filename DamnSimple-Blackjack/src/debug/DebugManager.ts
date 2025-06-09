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

    // --- New properties for advanced debug display ---
    private handHistory: { player: Card[], dealer: Card[] }[] = [];
    private readonly MAX_HISTORY_ENTRIES = 10;
    private historyIndex: number = -1; // -1 means current hand, 0 is most recent history, etc.

    // Store last known hands to detect changes (deal/discard)
    private lastPlayerHand: Card[] = [];
    private lastDealerHand: Card[] = [];

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
        // If moving to GameOver, record the final hands for history
        if (state === GameState.GameOver && this.blackjackGame.getGameState() !== GameState.GameOver) {
            this.recordHandHistory();
        }
        this.blackjackGame.getGameActions().setGameState(state as GameState, true);
        this.updateUI();
        console.log(`Game state set to ${GameState[state]}`);
    }

    public setGameResult(result: number): void {
        if (result < 0 || result > 4) {
            console.error("Invalid game result. Use 0-4.");
            return;
        }
        this.blackjackGame.getGameActions().setGameResult(result as GameResult, true);
        this.updateUI();
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

        // Clear history and last known hands
        this.handHistory = [];
        this.historyIndex = -1;
        this.lastPlayerHand = [];
        this.lastDealerHand = [];

        this.updateUI();
        console.log("Game reset to initial state, debug history cleared.");
    }

    public startNewGame(bet: number = 10): void {
        this.cardVisualizer.clearTable();
        // The updateDebugHandDisplay call that follows will show the old cards as discarded
        const success = this.blackjackGame.startNewGame(bet);
        if (success) {
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

        if (isPlayer) {
            this.blackjackGame.addCardToPlayerHand(card);
        } else {
            this.blackjackGame.addCardToDealerHand(card);
        }
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

    /** Records the current hands to the history log. */
    private recordHandHistory(): void {
        const playerHand = this.blackjackGame.getPlayerHand();
        const dealerHand = this.blackjackGame.getDealerHand();

        if (playerHand.length > 0 || dealerHand.length > 0) {
            this.handHistory.unshift({
                player: [...playerHand],
                dealer: [...dealerHand]
            });

            if (this.handHistory.length > this.MAX_HISTORY_ENTRIES) {
                this.handHistory.pop();
            }
            console.log(`[DebugManager] Hand history recorded. Entries: ${this.handHistory.length}`);
        }
    }

    private createDebugHandDisplayElement(): void {
        // Inject styles for animations and indicators if they don't exist
        if (!document.getElementById('blackjack-debug-styles')) {
            const styleSheet = document.createElement("style");
            styleSheet.id = "blackjack-debug-styles";
            styleSheet.innerText = `
                .debug-card-container {
                    position: relative;
                    width: 60px;
                    height: 84px;
                    display: inline-block;
                }
                .debug-card-container playing-card {
                    width: 100%;
                    height: 100%;
                    border-radius: 3px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
                }
                .debug-card-indicator {
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    width: 18px; /* Adjusted for emoji */
                    height: 18px; /* Adjusted for emoji */
                    background-color: rgba(0, 0, 0, 0.6);
                    /* color property will be set dynamically for ❓ */
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px; /* Adjusted for emoji */
                    font-family: 'Segoe UI Symbol', sans-serif;
                    pointer-events: none;
                    line-height: 1;
                }
                @keyframes green-flash {
                    from { box-shadow: 0 0 8px 3px limegreen; }
                    to { box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
                }
                .card-dealt {
                    animation: green-flash 0.5s ease-out;
                }
                @keyframes red-flash-and-fade {
                    0% { box-shadow: 0 0 8px 3px tomato; opacity: 1; }
                    70% { box-shadow: none; opacity: 1; }
                    100% { opacity: 0; transform: scale(0.9); }
                }
                .card-discarded .debug-card-container {
                    animation: red-flash-and-fade 0.5s ease-out forwards;
                }
                .debug-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .debug-header-title {
                    font-weight: bold;
                    font-size: 16px;
                }
                .debug-header-nav button {
                    padding: 2px 6px;
                    margin-left: 5px;
                    cursor: pointer;
                    border: 1px solid #555;
                    background-color: #eee;
                    border-radius: 3px;
                }
                .debug-header-nav button:hover {
                    background-color: #ddd;
                }
            `;
            document.head.appendChild(styleSheet);
        }

        this.debugHandDisplayElement = document.createElement("div");
        this.debugHandDisplayElement.id = "blackjack-debug-hand-display";
        Object.assign(this.debugHandDisplayElement.style, {
            position: 'absolute',
            left: '10px',
            top: '10px',
            width: 'auto',
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

        this.debugHandDisplayElement.onmousedown = (e) => {
            if ((e.target as HTMLElement).closest('button, input, select, textarea')) {
                return;
            }
            this.isDragging = true;
            this.dragOffsetX = e.clientX - this.debugHandDisplayElement!.offsetLeft;
            this.dragOffsetY = e.clientY - this.debugHandDisplayElement!.offsetTop;
            document.onmousemove = this.dragElement.bind(this);
            document.onmouseup = this.stopDragElement.bind(this);
            e.preventDefault();
        };
    }

    private dragElement(e: MouseEvent): void {
        if (this.isDragging && this.debugHandDisplayElement) {
            e.preventDefault();
            let newLeft = e.clientX - this.dragOffsetX;
            let newTop = e.clientY - this.dragOffsetY;

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

    /** Creates the HTML element for a single card in the debug view. */
    private createCardElement(card: Card, isNew: boolean): HTMLElement {
        const container = document.createElement('div');
        container.className = 'debug-card-container';

        const cardEl = document.createElement('playing-card');
        cardEl.setAttribute('cid', card.getCid());

        if (isNew) {
            cardEl.classList.add('card-dealt');
            setTimeout(() => cardEl.classList.remove('card-dealt'), 500);
        }

        container.appendChild(cardEl);

        const indicator = document.createElement('span');
        indicator.className = 'debug-card-indicator';
        if (card.isFaceUp()) {
            indicator.innerHTML = `👁️`;
            // Optional: Set a specific color for the eyeball if needed, e.g., indicator.style.color = 'cyan';
        } else {
            indicator.innerHTML = `❓`;
            indicator.style.color = '#aaa'; // Medium grey for the question mark
        }
        container.appendChild(indicator);

        return container;
    }

    /** Renders a hand (dealer or player) into a container, handling diffing for animations. */
    private renderHandInContainer(title: string, currentCards: Card[], lastCards: Card[], isHistoryView: boolean, parentElement: HTMLElement): void {
        const header = document.createElement('h4');
        header.textContent = title;
        header.style.margin = '10px 0 5px 0';
        header.style.borderBottom = '1px solid #999';
        header.style.paddingBottom = '3px';
        parentElement.appendChild(header);

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '5px';
        parentElement.appendChild(container);

        const currentCardIds = new Set(currentCards.map(c => c.getUniqueId()));
        const lastCardIds = new Set(lastCards.map(c => c.getUniqueId()));

        // Animate discarded cards (only in current view)
        if (!isHistoryView) {
            // Iterate over a reversed copy of the last known cards
            [...lastCards].reverse().forEach(card => {
                if (!currentCardIds.has(card.getUniqueId())) {
                    const discardedEl = this.createCardElement(card, false);
                    discardedEl.classList.add('card-discarded');
                    container.appendChild(discardedEl);
                    setTimeout(() => discardedEl.remove(), 500);
                }
            });
        }

        // Render current cards in reverse order
        [...currentCards].reverse().forEach(card => {
            const isNew = !isHistoryView && !lastCardIds.has(card.getUniqueId());
            container.appendChild(this.createCardElement(card, isNew));
        });

        if (currentCards.length === 0 && lastCards.length === 0) {
            container.textContent = 'No cards';
        }
    }

    /** Updates the content of the debug hand display element. */
    public updateDebugHandDisplay(): void {
        if (!this.isHandDisplayVisible || !this.debugHandDisplayElement) {
            return;
        }

        const isHistoryView = this.historyIndex > -1;
        let playerHand: Card[], dealerHand: Card[];
        let titleText: string;

        if (isHistoryView) {
            const historicalState = this.handHistory[this.historyIndex];
            playerHand = historicalState.player;
            dealerHand = historicalState.dealer;
            titleText = `History (${this.historyIndex + 1}/${this.handHistory.length})`;
        } else {
            playerHand = this.blackjackGame.getPlayerHand();
            dealerHand = this.blackjackGame.getDealerHand();
            titleText = "Current Hand";
        }

        this.debugHandDisplayElement.innerHTML = ''; // Clear previous content

        // --- Create Header ---
        const header = document.createElement('div');
        header.className = 'debug-header';
        const title = document.createElement('span');
        title.className = 'debug-header-title';
        title.textContent = titleText;
        header.appendChild(title);

        const navContainer = document.createElement('div');
        navContainer.className = 'debug-header-nav';

        if (isHistoryView) {
            const homeButton = document.createElement('button');
            homeButton.innerHTML = '🏠&nbsp;Current';
            homeButton.onclick = () => {
                this.historyIndex = -1;
                this.updateDebugHandDisplay();
            };
            navContainer.appendChild(homeButton);
        }
        if (this.historyIndex > -1) {
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next →';
            nextButton.onclick = () => {
                this.historyIndex--;
                this.updateDebugHandDisplay();
            };
            navContainer.appendChild(nextButton);
        }
        if (this.historyIndex < this.handHistory.length - 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = '← Prev';
            prevButton.onclick = () => {
                this.historyIndex++;
                this.updateDebugHandDisplay();
            };
            navContainer.appendChild(prevButton);
        }
        header.appendChild(navContainer);
        this.debugHandDisplayElement.appendChild(header);

        // --- Render Hands ---
        this.renderHandInContainer('Dealer', dealerHand, this.lastDealerHand, isHistoryView, this.debugHandDisplayElement);
        this.renderHandInContainer('Player', playerHand, this.lastPlayerHand, isHistoryView, this.debugHandDisplayElement);

        // --- Update last known state if viewing current hand ---
        if (!isHistoryView) {
            this.lastPlayerHand = [...playerHand];
            this.lastDealerHand = [...dealerHand];
        }
    }

    public dispose(): void {
        if (this.debugHandDisplayElement) {
            this.debugHandDisplayElement.remove();
            this.debugHandDisplayElement = null;
        }
        const styleSheet = document.getElementById('blackjack-debug-styles');
        if (styleSheet) {
            styleSheet.remove();
        }
        if ((window as any).debug === this) {
            (window as any).debug = undefined;
        }
    }
}
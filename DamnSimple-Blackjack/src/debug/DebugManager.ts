// src/debug/debugmanager-ts
import { Scene, Vector3 } from "@babylonjs/core";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameState, GameResult } from "../game/GameState";
import { Card, Suit, Rank } from "../game/Card";
import { GameScene } from "../scenes/GameScene";
import { CardVisualizer } from "../scenes/components/CardVisualizer";
import { GameUI } from "../ui/GameUI";
import { Constants } from "../Constants";

export class DebugManager {
    private gameScene: GameScene;
    private blackjackGame: BlackjackGame;
    private cardVisualizer: CardVisualizer;
    private gameUI: GameUI;

    private debugHandDisplayElement: HTMLElement | null = null;
    private isHandDisplayVisible: boolean = false;

    // --- New properties for debug menu ---
    private debugMenuElement: HTMLElement | null = null;
    private isDebugMenuVisible: boolean = false;

    // --- Properties for dragging ---
    private dragOffsetX: number = 0;
    private dragOffsetY: number = 0;
    private isDragging: boolean = false;
    private draggedElement: HTMLElement | null = null;


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
        this.blackjackGame = blackjackGame;
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
        console.log("  debug.setGameState(state) - Set game state (0=Initial, 1=Betting, 2=Dealing, 3=PlayerTurn, 4=DealerTurn, 5=GameOver)");
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
        console.log("  debug.forceReshuffle() - Forces the deck to reshuffle.");

        console.log("%cFunds Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setFunds(amount) - Set player funds to specific amount");
        console.log("  debug.setBet(amount) - Set current bet to specific amount");
        console.log("  debug.resetFunds() - Reset player funds to default amount.");

        console.log("%cUI Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.updateUI() - Force UI update");
        console.log("  debug.toggleInspector() - Toggle Babylon.js inspector");
        console.log("  debug.toggleHandDisplay(visible?) - Toggle draggable display of current hands.");
        console.log("  debug.toggleDebugMenu(visible?) - Toggle the main debug menu window.");

        console.log("%cQuick Scenarios:", "font-weight: bold; color: #FF9800;");
        console.log("  debug.forceWin(isPlayer) - Force player (true) or dealer (false) win.");
        console.log("  debug.forcePush() - Force a push result.");


        console.log("%cExamples:", "font-weight: bold; color: #FF9800;");
        console.log("  debug.setGameState(3) - Set game to PlayerTurn");
        console.log("  debug.addCard(true, 'Hearts', 'A', true) - Add Ace of Hearts to player's hand face up");
        console.log("  debug.dealRandomCard(false, false) - Deal random card to dealer face down");
    }

    public setGameState(state: number): void {
        if (state < 0 || state >= Object.keys(GameState).length / 2) {
            console.error("Invalid game state. Use 0-" + (Object.keys(GameState).length / 2 - 1));
            return;
        }
        if (state === GameState.GameOver && this.blackjackGame.getGameState() !== GameState.GameOver) {
            this.recordHandHistory();
        }
        this.blackjackGame.getGameActions().setGameState(state as GameState, true, true);
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
        this.blackjackGame.getGameActions().setGameState(GameState.Initial, true, true);
        this.blackjackGame.getGameActions().setGameResult(GameResult.InProgress, true);
        this.blackjackGame.setPlayerHand([]);
        this.blackjackGame.setDealerHand([]);
        this.blackjackGame.setCurrentBet(0);
        this.blackjackGame.resetFunds();
        this.blackjackGame.insuranceTakenThisRound = false;
        this.blackjackGame.insuranceBetPlaced = 0;

        this.handHistory = [];
        this.historyIndex = -1;
        this.lastPlayerHand = [];
        this.lastDealerHand = [];

        console.log("Game reset to initial state, debug history cleared.");
    }

    public startNewGame(bet: number = Constants.MIN_BET): void {
        const currentState = this.blackjackGame.getGameState();
        if (currentState !== GameState.Initial &&
            currentState !== GameState.Betting &&
            currentState !== GameState.GameOver) {
            console.warn(`[DebugManager] Forcing game to Initial state before starting new game.`);
            this.resetGame();
        }
        const success = this.blackjackGame.startNewGame(bet);
        if (success) {
            console.log(`Started new game with bet: ${bet}`);
        } else {
            console.error(`Failed to start new game with bet ${bet}. Insufficient funds?`);
        }
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

        this.renderCards();
        this.updateUI();

        console.log(`Added ${card.toString()} to ${isPlayer ? 'player' : 'dealer'}'s hand (${faceUp ? 'face up' : 'face down'})`);
    }

    public clearCards(isPlayer: boolean): void {
        if (isPlayer) {
            this.blackjackGame.setPlayerHand([]);
        } else {
            this.blackjackGame.setDealerHand([]);
        }
        this.cardVisualizer.renderCards();
        this.updateUI();
        console.log(`Cleared ${isPlayer ? 'player' : 'dealer'}'s hand`);
    }

    public flipCard(isPlayer: boolean, index: number): void {
        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();
        if (index < 0 || index >= hand.length) {
            console.error(`Invalid card index: ${index}. Hand has ${hand.length} cards.`);
            return;
        }
        hand[index].flip();
        this.updateDebugHandDisplay();
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

    public dealRandomCard(isPlayer: boolean, faceUp: boolean = true): Card {
        const suits = Object.values(Suit);
        const ranks = Object.values(Rank);
        const randomSuit = suits[Math.floor(Math.random() * suits.length)];
        const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
        const card = new Card(randomSuit, randomRank);
        card.setFaceUp(faceUp);
        return card;
    }

    public renderCards(): void {
        this.cardVisualizer.renderCards();
        this.updateDebugHandDisplay();
        console.log("Cards re-rendered (Babylon visuals and debug display)");
    }

    public setFunds(amount?: number): void {
        let finalAmount: number;
        if (amount === undefined) {
            const amountStr = prompt("Enter new player funds:", this.blackjackGame.getPlayerFunds().toString());
            if (amountStr === null) {
                console.log("Set funds cancelled.");
                return;
            }
            finalAmount = parseInt(amountStr, 10);
            if (isNaN(finalAmount)) {
                console.error("Invalid amount entered for funds.");
                return;
            }
        } else {
            finalAmount = amount;
        }

        if (finalAmount < 0) {
            console.error("Funds cannot be negative");
            return;
        }
        this.blackjackGame.getPlayerFundsManager().setFunds(finalAmount);
        this.updateUI();
        console.log(`Player funds set to ${finalAmount}`);
    }

    public resetFunds(): void {
        this.blackjackGame.resetFunds();
        this.updateUI();
        console.log(`Player funds reset to ${this.blackjackGame.getPlayerFunds()}.`);
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
        this.updateDebugHandDisplay();
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

    public toggleDebugMenu(visible?: boolean): void {
        if (typeof visible === 'undefined') {
            this.isDebugMenuVisible = !this.isDebugMenuVisible;
        } else {
            this.isDebugMenuVisible = visible;
        }

        if (this.isDebugMenuVisible) {
            if (!this.debugMenuElement) {
                this.createDebugMenuElement();
            }
            this.debugMenuElement!.style.display = 'block';
            console.log("Debug menu shown.");
        } else {
            if (this.debugMenuElement) {
                this.debugMenuElement.style.display = 'none';
                console.log("Debug menu hidden.");
            }
        }
    }


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

    private injectGlobalStyles(): void {
        if (!document.getElementById('blackjack-debug-styles')) {
            const styleSheet = document.createElement("style");
            styleSheet.id = "blackjack-debug-styles";
            styleSheet.innerText = `
                .debug-window-base {
                    position: absolute;
                    width: auto;
                    min-width: 250px;
                    max-width: 400px;
                    max-height: 500px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    border: 2px solid blue;
                    background-color: rgba(220, 220, 255, 0.9);
                    padding: 10px;
                    z-index: 1002;
                    cursor: move;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    color: #333;
                    border-radius: 5px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                }
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
                    width: 18px;
                    height: 18px;
                    background-color: rgba(0, 0, 0, 0.6);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
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
                    padding-bottom: 5px;
                    border-bottom: 1px solid #aaa;
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
                .debug-close-button {
                    padding: 0;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background-color: #f06060;
                    color: white;
                    border: 1px solid #d04040;
                    font-size: 14px;
                    line-height: 20px;
                    text-align: center;
                    cursor: pointer;
                    font-weight: bold;
                    flex-shrink: 0;
                }
                .debug-close-button:hover {
                    background-color: #e04040;
                }
                .debug-menu-button-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .debug-menu-button {
                    padding: 8px 12px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    text-align: left;
                    font-size: 13px;
                }
                .debug-menu-button:hover {
                    background-color: #45a049;
                }
                .debug-menu-separator {
                    height: 1px;
                    background-color: #aaa;
                    margin-top: 8px;
                    margin-bottom: 8px;
                }
            `;
            document.head.appendChild(styleSheet);
        }
    }

    private makeDraggable(element: HTMLElement): void {
        element.onmousedown = (e) => {
            if ((e.target as HTMLElement).closest('button, input, select, textarea')) {
                return;
            }
            this.isDragging = true;
            this.draggedElement = element;
            this.dragOffsetX = e.clientX - element.offsetLeft;
            this.dragOffsetY = e.clientY - element.offsetTop;
            document.onmousemove = this.dragElement.bind(this);
            document.onmouseup = this.stopDragElement.bind(this);
            e.preventDefault();
        };
    }


    private createDebugHandDisplayElement(): void {
        this.injectGlobalStyles();

        this.debugHandDisplayElement = document.createElement("div");
        this.debugHandDisplayElement.id = "blackjack-debug-hand-display";
        this.debugHandDisplayElement.classList.add("debug-window-base");
        this.debugHandDisplayElement.style.left = '10px';
        this.debugHandDisplayElement.style.top = '10px';
        document.body.appendChild(this.debugHandDisplayElement);

        this.makeDraggable(this.debugHandDisplayElement);
    }

    private createDebugMenuElement(): void {
        this.injectGlobalStyles();

        this.debugMenuElement = document.createElement("div");
        this.debugMenuElement.id = "blackjack-debug-menu";
        this.debugMenuElement.classList.add("debug-window-base");
        this.debugMenuElement.style.left = 'calc(100vw - 270px)';
        this.debugMenuElement.style.top = '10px';
        this.debugMenuElement.style.minWidth = '220px';
        this.debugMenuElement.style.maxWidth = '280px';


        const header = document.createElement('div');
        header.className = 'debug-header';

        const title = document.createElement('span');
        title.className = 'debug-header-title';
        title.textContent = 'Debug Menu';

        const closeButton = document.createElement('button');
        closeButton.className = 'debug-close-button';
        closeButton.innerHTML = '&#x2715;';
        closeButton.title = 'Close Debug Menu';
        closeButton.onclick = (e) => {
            e.stopPropagation();
            this.toggleDebugMenu(false);
        };

        header.appendChild(title);
        header.appendChild(closeButton);
        this.debugMenuElement.appendChild(header);

        const content = document.createElement('div');
        content.className = 'debug-menu-button-container';

        const createButton = (text: string, action: () => void) => {
            const button = document.createElement('button');
            button.className = 'debug-menu-button';
            button.textContent = text;
            button.onclick = (e) => {
                e.stopPropagation();
                action();
            };
            content.appendChild(button);
        };

        const createSeparator = () => {
            const separator = document.createElement('div');
            separator.className = 'debug-menu-separator';
            content.appendChild(separator);
        };

        // --- Scenario Starters ---
        createButton('Start Hand (Normal)', () => this.debugStartNormalHand());
        createButton('Start Split Hand', () => this.debugStartSplitHand());
        createButton('Start Insurance Hand', () => this.debugStartInsuranceHand());

        createSeparator();

        // --- Game Control ---
        createButton('Open Card Debug Window', () => this.toggleHandDisplay(true));
        createButton('Reveal Dealer Hole Card', () => this.revealDealerHole());
        createButton('Force Reshuffle Deck', () => this.forceReshuffle());

        createSeparator();

        // --- Funds Control ---
        createButton('Set Player Funds...', () => this.setFunds());
        createButton('Reset Player Bank', () => this.resetFunds());

        createSeparator();

        // --- Outcome Control ---
        createButton('Force Player Win', () => this.forceWin(true));
        createButton('Force Dealer Win', () => this.forceWin(false));
        createButton('Force Push', () => this.forcePush());


        this.debugMenuElement.appendChild(content);
        document.body.appendChild(this.debugMenuElement);
        this.makeDraggable(this.debugMenuElement);
    }


    private dragElement(e: MouseEvent): void {
        if (this.isDragging && this.draggedElement) {
            e.preventDefault();
            let newLeft = e.clientX - this.dragOffsetX;
            let newTop = e.clientY - this.dragOffsetY;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const elWidth = this.draggedElement.offsetWidth;
            const elHeight = this.draggedElement.offsetHeight;

            newLeft = Math.max(0, Math.min(newLeft, viewportWidth - elWidth));
            newTop = Math.max(0, Math.min(newTop, viewportHeight - elHeight));

            this.draggedElement.style.left = newLeft + 'px';
            this.draggedElement.style.top = newTop + 'px';
        }
    }

    private stopDragElement(): void {
        if (this.isDragging) {
            this.isDragging = false;
            this.draggedElement = null;
            document.onmousemove = null;
            document.onmouseup = null;
        }
    }

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
        } else {
            indicator.innerHTML = `❓`;
            indicator.style.color = '#aaa';
        }
        container.appendChild(indicator);

        return container;
    }

    private renderHandInContainer(title: string, currentCards: Card[], lastCards: Card[], isHistoryView: boolean, parentElement: HTMLElement): void {
        const headerEl = document.createElement('h4');
        headerEl.textContent = title;
        headerEl.style.margin = '10px 0 5px 0';
        headerEl.style.borderBottom = '1px solid #999';
        headerEl.style.paddingBottom = '3px';
        parentElement.appendChild(headerEl);

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '5px';
        parentElement.appendChild(container);

        const currentCardIds = new Set(currentCards.map(c => c.getUniqueId()));
        const lastCardIds = new Set(lastCards.map(c => c.getUniqueId()));

        if (!isHistoryView) {
            [...lastCards].reverse().forEach(card => {
                if (!currentCardIds.has(card.getUniqueId())) {
                    const discardedEl = this.createCardElement(card, false);
                    discardedEl.classList.add('card-discarded');
                    container.appendChild(discardedEl);
                    setTimeout(() => discardedEl.remove(), 500);
                }
            });
        }

        [...currentCards].reverse().forEach(card => {
            const isNew = !isHistoryView && !lastCardIds.has(card.getUniqueId());
            container.appendChild(this.createCardElement(card, isNew));
        });

        if (currentCards.length === 0 && (isHistoryView || lastCards.length === 0)) {
            container.textContent = 'No cards';
        }
    }

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

        this.debugHandDisplayElement.innerHTML = '';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'debug-header';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'debug-header-title';
        titleSpan.textContent = titleText;

        const rightControls = document.createElement('div');
        rightControls.style.display = 'flex';
        rightControls.style.alignItems = 'center';

        const navContainer = document.createElement('div');
        navContainer.className = 'debug-header-nav';

        if (isHistoryView) {
            const homeButton = document.createElement('button');
            homeButton.innerHTML = '🏠&nbsp;Current';
            homeButton.onclick = () => { this.historyIndex = -1; this.updateDebugHandDisplay(); };
            navContainer.appendChild(homeButton);
        }
        if (this.historyIndex > -1) {
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next →';
            nextButton.disabled = this.historyIndex === 0;
            nextButton.onclick = () => { if (this.historyIndex > 0) this.historyIndex--; this.updateDebugHandDisplay(); };
            navContainer.appendChild(nextButton);
        }
        if (this.historyIndex < this.handHistory.length - 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = '← Prev';
            prevButton.disabled = this.historyIndex === this.handHistory.length - 1 && this.historyIndex !== -1;
            prevButton.onclick = () => { if (this.historyIndex < this.handHistory.length - 1) this.historyIndex++; this.updateDebugHandDisplay(); };
            navContainer.appendChild(prevButton);
        }
        if (this.handHistory.length > 0 && this.historyIndex === -1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = '← Prev';
            prevButton.onclick = () => { this.historyIndex = 0; this.updateDebugHandDisplay(); };
            navContainer.appendChild(prevButton);
        }


        const closeButton = document.createElement('button');
        closeButton.className = 'debug-close-button';
        closeButton.innerHTML = '&#x2715;';
        closeButton.title = 'Close Card Debug Window';
        closeButton.onclick = (e) => { e.stopPropagation(); this.toggleHandDisplay(false); };
        closeButton.style.marginLeft = '10px';

        rightControls.appendChild(navContainer);
        rightControls.appendChild(closeButton);
        headerDiv.appendChild(titleSpan);
        headerDiv.appendChild(rightControls);
        this.debugHandDisplayElement.appendChild(headerDiv);

        this.renderHandInContainer('Dealer', dealerHand, this.lastDealerHand, isHistoryView, this.debugHandDisplayElement);
        this.renderHandInContainer('Player', playerHand, this.lastPlayerHand, isHistoryView, this.debugHandDisplayElement);

        if (!isHistoryView) {
            this.lastPlayerHand = [...playerHand];
            this.lastDealerHand = [...dealerHand];
        }
    }

    // --- Debug Menu Button Actions ---

    private debugStartNormalHand(): void {
        console.log("DEBUG: Starting Normal Hand");
        this.resetGame();
        const success = this.blackjackGame.startNewGame(Constants.MIN_BET);
        if (!success) {
            console.error("DEBUG: Failed to start normal hand.");
        }
    }

    private debugStartSplitHand(): void {
        console.log("DEBUG: Starting Split Hand");
        this.resetGame();

        this.blackjackGame.setCurrentBet(Constants.MIN_BET);
        if (!this.blackjackGame.getPlayerFundsManager().deductFunds(this.blackjackGame.getCurrentBet())) {
            console.error("DEBUG Split: Could not deduct bet. Player funds:", this.blackjackGame.getPlayerFunds());
            return;
        }
        this.blackjackGame.getGameActions().setGameState(GameState.Dealing, true, true);

        const suits = Object.values(Suit);
        let randomRankIndex = Math.floor(Math.random() * (Object.values(Rank).length - 1));
        if (Object.values(Rank)[randomRankIndex] === Rank.Ace) randomRankIndex = 0;
        const splitRank = Object.values(Rank)[randomRankIndex];

        const playerCard1 = new Card(suits[0 % suits.length], splitRank); playerCard1.setFaceUp(true);
        const playerCard2 = new Card(suits[1 % suits.length], splitRank); playerCard2.setFaceUp(true);
        this.blackjackGame.setPlayerHand([playerCard1, playerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard2);

        const dealerCard1 = this.dealRandomCard(false, false); dealerCard1.setFaceUp(false);
        const dealerCard2 = this.dealRandomCard(false, true);  dealerCard2.setFaceUp(true);
        this.blackjackGame.setDealerHand([dealerCard1, dealerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard2);

        this.cardVisualizer.renderCards(true);
        this.blackjackGame.getGameActions().setGameState(GameState.PlayerTurn, true, true);
    }

    private debugStartInsuranceHand(): void {
        console.log("DEBUG: Starting Insurance Hand");
        this.resetGame();

        this.blackjackGame.setCurrentBet(Constants.MIN_BET);
        if (!this.blackjackGame.getPlayerFundsManager().deductFunds(this.blackjackGame.getCurrentBet())) {
            console.error("DEBUG Insurance: Could not deduct bet. Player funds:", this.blackjackGame.getPlayerFunds());
            return;
        }
        this.blackjackGame.getGameActions().setGameState(GameState.Dealing, true, true);

        const playerCard1 = this.dealRandomCard(true, true); playerCard1.setFaceUp(true);
        const playerCard2 = this.dealRandomCard(true, true); playerCard2.setFaceUp(true);
        this.blackjackGame.setPlayerHand([playerCard1, playerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard2);

        const dealerCard1 = this.dealRandomCard(false, false); dealerCard1.setFaceUp(false);
        const dealerCard2 = new Card(Suit.Spades, Rank.Ace);
        dealerCard2.setFaceUp(true);
        this.blackjackGame.setDealerHand([dealerCard1, dealerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard2);

        this.cardVisualizer.renderCards(true);
        this.blackjackGame.getGameActions().setGameState(GameState.PlayerTurn, true, true);
    }

    public forceReshuffle(): void {
        console.log("DEBUG: Forcing deck reshuffle.");
        const cardsRemaining = this.blackjackGame.getHandManager().forceDeckReshuffle();
        console.log(`Deck reshuffled. Cards remaining: ${cardsRemaining}`);
        this.updateUI();
    }

    private ensureBetActiveForForceOutcome(): void {
        const game = this.blackjackGame;
        if (game.getCurrentBet() === 0) {
            if (game.getPlayerFunds() >= Constants.MIN_BET) {
                game.setCurrentBet(Constants.MIN_BET);
                game.getPlayerFundsManager().deductFunds(Constants.MIN_BET);
                console.log(`DEBUG: Auto-placed MIN_BET (${Constants.MIN_BET}) for forced outcome.`);
            } else {
                console.warn("DEBUG: Cannot auto-place bet for forced outcome, insufficient funds. Outcome may not have monetary effect.");
            }
        }
        if (game.getGameState() !== GameState.PlayerTurn && game.getGameState() !== GameState.DealerTurn && game.getGameState() !== GameState.Dealing) {
            game.getGameActions().setGameState(GameState.PlayerTurn, true, false);
        }
    }


    public forceWin(playerWins: boolean): void {
        console.log(`DEBUG: Forcing ${playerWins ? 'Player Win' : 'Dealer Win'}`);
        this.ensureBetActiveForForceOutcome();
        const game = this.blackjackGame;
        const gameActions = game.getGameActions();

        const dealerHand = game.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            dealerHand[0].setFaceUp(true);
            this.cardVisualizer.updateCardVisual(dealerHand[0], true);
        }


        if (playerWins) {
            gameActions.setGameResult(GameResult.PlayerWins, true);
            game.getPlayerFundsManager().addFunds(game.getCurrentBet() * 2);
        } else {
            gameActions.setGameResult(GameResult.DealerWins, true);
        }
        gameActions.resolveInsurance();
        gameActions.setGameState(GameState.GameOver, true, true);
    }

    public forcePush(): void {
        console.log("DEBUG: Forcing Push");
        this.ensureBetActiveForForceOutcome();
        const game = this.blackjackGame;
        const gameActions = game.getGameActions();

        const dealerHand = game.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            dealerHand[0].setFaceUp(true);
            this.cardVisualizer.updateCardVisual(dealerHand[0], true);
        }

        gameActions.setGameResult(GameResult.Push, true);
        game.getPlayerFundsManager().addFunds(game.getCurrentBet());
        gameActions.resolveInsurance();
        gameActions.setGameState(GameState.GameOver, true, true);
    }


    public dispose(): void {
        if (this.debugHandDisplayElement) {
            this.debugHandDisplayElement.remove();
            this.debugHandDisplayElement = null;
        }
        if (this.debugMenuElement) {
            this.debugMenuElement.remove();
            this.debugMenuElement = null;
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

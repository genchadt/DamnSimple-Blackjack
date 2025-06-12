// src/debug/DebugManager.ts
import { BlackjackGame, PlayerHandInfo } from "../game/BlackjackGame"; // Import PlayerHandInfo
import { GameState, GameResult } from "../game/GameState";
import { Card, Suit, Rank } from "../game/Card";
import { GameScene } from "../scenes/GameScene";
import { CardVisualizer } from "../scenes/components/CardVisualizer";
import { GameUI } from "../ui/GameUI";
import { Constants } from "../Constants";
import { ScoreCalculator } from "../game/ScoreCalculator"; // Import ScoreCalculator
import { GameStorage } from "../game/GameStorage"; // Import GameStorage

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
    private openSubMenu: HTMLElement | null = null;
    private activeSubMenuTrigger: HTMLElement | null = null;
    private activeCustomPromptElement: HTMLElement | null = null; // For custom dialog
    private customPromptConfirmCallback: ((value: string | null) => void) | null = null;
    private customPromptEscapeListener: ((event: KeyboardEvent) => void) | null = null;
    private boundHandleSubMenuAccessKeys = this.handleSubMenuAccessKeys.bind(this);

    // --- Properties for hover-to-open/close submenus ---
    private hoverOpenTimer: number | null = null;
    private hoverCloseTimer: number | null = null;
    private readonly HOVER_OPEN_DELAY = 350; // ms
    private readonly HOVER_CLOSE_DELAY = 250; // ms

    // --- Key for localStorage ---
    private static readonly DEBUG_MENU_VISIBLE_KEY = "blackjack_debugMenuVisible";


    // --- Properties for dragging ---
    private dragOffsetX: number = 0;
    private dragOffsetY: number = 0;
    private isDragging: boolean = false;
    private draggedElement: HTMLElement | null = null;


    // --- New properties for advanced debug display ---
    private handHistory: { playerHands: PlayerHandInfo[], dealer: Card[] }[] = []; // Store array of PlayerHandInfo
    private readonly MAX_HISTORY_ENTRIES = 10;
    private historyIndex: number = -1; // -1 means current hand, 0 is most recent history, etc.

    // Store last known hands to detect changes (deal/discard)
    private lastPlayerHands: PlayerHandInfo[] = []; // Store array of PlayerHandInfo
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

        document.addEventListener('click', this.handleGlobalClick, true);

        // Load debug menu visibility state
        const storedVisibility = localStorage.getItem(DebugManager.DEBUG_MENU_VISIBLE_KEY);
        if (storedVisibility !== null) {
            this.isDebugMenuVisible = JSON.parse(storedVisibility);
            if (this.isDebugMenuVisible) {
                // Ensure menu is created and shown if it should be visible
                // Use a timeout to ensure the DOM is ready, especially if called very early
                setTimeout(() => {
                    if (!this.debugMenuElement) {
                        this.createDebugMenuElement();
                    }
                    if (this.debugMenuElement && this.isDebugMenuVisible) { // Check isDebugMenuVisible again in case it was toggled off before timeout
                        this.debugMenuElement.style.display = 'block';
                    }
                }, 0);
            }
        }

        console.log("Debug manager initialized. Type 'debug.help()' for available commands.");
    }

    /**
     * Prints a list of available debug commands and their descriptions.
     */
    public help(): void {
        console.log("%cBlackjack Debug Commands", "font-size: 16px; font-weight: bold; color: #4CAF50;");
        console.log("%cGame State Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setGameState(state) - Set game state (0=Initial, 1=Betting, 2=Dealing, 3=PlayerTurn, 4=DealerTurn, 5=GameOver)");
        console.log("  debug.setGameResult(result, handIndex?) - Set game result for active/specified player hand or overall (0=PlayerWins, 1=DealerWins, 2=Push, 3=PlayerBlackjack, 4=InProgress)");
        console.log("  debug.resetGame() - Reset the game to initial state");
        console.log("  debug.startNewGame(bet) - Start a new game with specified bet (clears table)");
        console.log("  debug.getState() - Get current game state information");

        console.log("%cCard Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.addCard(isPlayer, handIndex, suit, rank, faceUp) - Add a card to player (specify handIndex) or dealer hand");
        console.log("  debug.clearCards(isPlayer, handIndex?) - Clear cards from player (specify handIndex or all) or dealer hand");
        console.log("  debug.flipCard(isPlayer, handIndex, cardIndex) - Flip a specific card in a player or dealer hand");
        console.log("  debug.dealRandomCard(isPlayer, faceUp) - Deal a random card (returns card, doesn't add to hand)");
        console.log("  debug.renderCards() - Force re-render all cards (visuals in Babylon)");
        console.log("  debug.revealDealerHole() - Reveals the dealer's hole card");
        console.log("  debug.forceReshuffle() - Forces the deck to reshuffle.");

        console.log("%cFunds Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.setFunds(amount) - Set player funds to specific amount");
        console.log("  debug.setBet(amount, handIndex?) - Set current bet for active/specified hand or initial bet");
        console.log("  debug.resetFunds() - Reset player funds to default amount.");

        console.log("%cUI Commands:", "font-weight: bold; color: #2196F3;");
        console.log("  debug.updateUI() - Force UI update");
        console.log("  debug.toggleInspector() - Toggle Babylon.js inspector");
        console.log("  debug.toggleHandDisplay(visible?) - Toggle draggable display of current hands.");
        console.log("  debug.toggleDebugMenu(visible?) - Toggle the main debug menu window.");

        console.log("%cQuick Scenarios:", "font-weight: bold; color: #FF9800;");
        console.log("  debug.forceWin(isPlayer, handIndex?) - Force player (true) or dealer (false) win for active/specified hand.");
        console.log("  debug.forcePush(handIndex?) - Force a push result for active/specified hand.");


        console.log("%cExamples:", "font-weight: bold; color: #FF9800;");
        console.log("  debug.setGameState(3) - Set game to PlayerTurn");
        console.log("  debug.addCard(true, 0, 'Hearts', 'A', true) - Add Ace of Hearts to player's first hand face up");
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

    public setGameResult(result: number, handIndex?: number): void {
        if (result < 0 || result > 4) {
            console.error("Invalid game result. Use 0-4.");
            return;
        }
        const playerHands = this.blackjackGame.getPlayerHands();
        const targetHandIdx = handIndex ?? this.blackjackGame.getActivePlayerHandIndex();

        if (targetHandIdx >= 0 && targetHandIdx < playerHands.length) {
            playerHands[targetHandIdx].result = result as GameResult;
            console.log(`Game result for Player Hand ${targetHandIdx} set to ${GameResult[result]}`);
        } else if (handIndex === undefined) { // Apply to overall game result if no handIndex
            this.blackjackGame.getGameActions().setGameResult(result as GameResult, true);
            console.log(`Overall game result set to ${GameResult[result]}`);
        } else {
            console.error(`Invalid handIndex ${handIndex} for setGameResult.`);
            return;
        }
        this.updateUI();
    }

    public resetGame(): void {
        this.cardVisualizer.clearTable();
        this.blackjackGame.getGameActions().resetInternalState(); // Reset actions state first

        // Clear game storage to ensure a completely fresh start when game reloads/reinitializes
        GameStorage.clearAllGameData(); // Assuming GameStorage has or can have this method.
                                     // If not, GameStorage.clearSavedHands() is an alternative,
                                     // but clearAllGameState() would be more robust for a full reset.
                                     // For now, let's assume clearSavedHands is the primary way to clear persistent hand data.
        GameStorage.clearSavedHands();


        this.blackjackGame.getGameActions().setGameState(GameState.Initial, false, false); // No need to forceSave if storage cleared, no notify yet
        this.blackjackGame.getGameActions().setGameResult(GameResult.InProgress, false); // No need to forceSave
        this.blackjackGame.setPlayerHands([]); // Clear all player hands
        this.blackjackGame.setActivePlayerHandIndex(0); // Reset active hand index
        this.blackjackGame.setDealerHand([]);
        this.blackjackGame.setCurrentBet(0); // Resets initial bet for GameActions
        this.blackjackGame.resetFunds(); // This will save funds, which is fine.
        this.blackjackGame.insuranceTakenThisRound = false;
        this.blackjackGame.insuranceBetPlaced = 0;

        this.handHistory = [];
        this.historyIndex = -1;
        this.lastPlayerHands = [];
        this.lastDealerHand = [];

        console.log("Game reset to initial state, storage cleared, debug history cleared.");
        this.updateDebugHandDisplay();
        // Explicitly update UI after a full reset
        this.updateUI();
    }

    public startNewGame(bet: number = Constants.MIN_BET): void {
        const currentState = this.blackjackGame.getGameState();
        if (currentState !== GameState.Initial &&
            currentState !== GameState.Betting &&
            currentState !== GameState.GameOver) {
            console.warn(`[DebugManager] Forcing game to Initial state before starting new game.`);
            this.resetGame(); // resetGame now clears playerHands
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
        const gameResult = this.blackjackGame.getGameResult(); // Overall game result
        const playerFunds = this.blackjackGame.getPlayerFunds();
        const currentBet = this.blackjackGame.getCurrentBet(); // Initial bet for the round

        console.log("%cGame State Information", "font-weight: bold; color: #4CAF50;");
        console.log(`Game State: ${GameState[gameState]} (${gameState})`);
        console.log(`Overall Game Result: ${GameResult[gameResult]} (${gameResult})`);
        console.log(`Player Funds: ${playerFunds}`);
        console.log(`Initial Bet for Round: ${currentBet}`);
        console.log(`Active Player Hand Index: ${this.blackjackGame.getActivePlayerHandIndex()}`);

        this.blackjackGame.getPlayerHands().forEach((handInfo, index) => {
            const score = ScoreCalculator.calculateHandValue(handInfo.cards);
            console.log(`%cPlayer Hand ${index} (ID: ${handInfo.id}):`, "font-weight: bold; color: #2196F3;");
            console.log(`  Score: ${score}, Bet: ${handInfo.bet}, Result: ${GameResult[handInfo.result]}, Resolved: ${handInfo.isResolved}`);
            handInfo.cards.forEach((card, cardIdx) => {
                console.log(`    ${cardIdx}: ${card.toString()} (${card.isFaceUp() ? 'face up' : 'face down'})`);
            });
        });

        const dealerScore = this.blackjackGame.getDealerScore(); // Visible score
        const dealerFullScore = this.blackjackGame.getDealerFullScore(); // Full score
        console.log("%cDealer Hand:", "font-weight: bold; color: #2196F3;");
        console.log(`  Visible Score: ${dealerScore}, Full Score (if revealed): ${dealerFullScore}`);
        this.blackjackGame.getDealerHand().forEach((card, index) => {
            console.log(`  ${index}: ${card.toString()} (${card.isFaceUp() ? 'face up' : 'face down'})`);
        });
        this.updateDebugHandDisplay();
    }

    public addCard(isPlayer: boolean, handIndexOrSuit: number | string, suitOrRank: string, rankOrFaceUp: string | boolean, faceUp?: boolean): void {
        let targetHandIndex = 0;
        let cardSuit: string, cardRank: string, cardFaceUp: boolean;

        if (isPlayer) {
            if (typeof handIndexOrSuit !== 'number') {
                console.error("For player, first argument after isPlayer must be handIndex (number)."); return;
            }
            targetHandIndex = handIndexOrSuit;
            cardSuit = suitOrRank as string;
            cardRank = rankOrFaceUp as string;
            cardFaceUp = faceUp === undefined ? true : faceUp;
        } else { // Dealer
            cardSuit = handIndexOrSuit as string;
            cardRank = suitOrRank as string;
            cardFaceUp = rankOrFaceUp as boolean;
        }


        if (!Object.values(Suit).includes(cardSuit as Suit)) {
            console.error(`Invalid suit: ${cardSuit}. Use Hearts, Diamonds, Clubs, or Spades.`); return;
        }
        if (!Object.values(Rank).includes(cardRank as Rank)) {
            console.error(`Invalid rank: ${cardRank}. Use 2-10, J, Q, K, or A.`); return;
        }

        const card = new Card(cardSuit as Suit, cardRank as Rank);
        card.setFaceUp(cardFaceUp);

        if (isPlayer) {
            const playerHands = this.blackjackGame.getPlayerHands();
            if (targetHandIndex < 0 || targetHandIndex >= playerHands.length) {
                // If trying to add to a non-existent hand but it's the next logical hand, create it.
                if (targetHandIndex === playerHands.length && playerHands.length < Constants.MAX_SPLIT_HANDS) {
                    const newHand: PlayerHandInfo = {
                        id: `hand-${targetHandIndex}`, cards: [], bet: this.blackjackGame.getCurrentBet(), // Use initial bet or active hand's bet
                        result: GameResult.InProgress, isResolved: false, canHit: true, isBlackjack: false, isSplitAces: false
                    };
                    playerHands.push(newHand);
                    console.log(`Created new Player Hand ${targetHandIndex} due to addCard command.`);
                } else {
                    console.error(`Invalid player handIndex: ${targetHandIndex}. Player has ${playerHands.length} hands.`); return;
                }
            }
            this.blackjackGame.addCardToPlayerHand(card, targetHandIndex);
            console.log(`Added ${card.toString()} to player's hand ${targetHandIndex} (${cardFaceUp ? 'face up' : 'face down'})`);
        } else {
            this.blackjackGame.addCardToDealerHand(card);
            console.log(`Added ${card.toString()} to dealer's hand (${cardFaceUp ? 'face up' : 'face down'})`);
        }
        this.blackjackGame.getHandManager().registerFlipCallback(card);

        this.renderCards(); // This will also update debug display
        this.updateUI(); // Update main UI
    }

    public clearCards(isPlayer: boolean, handIndex?: number): void {
        if (isPlayer) {
            const playerHands = this.blackjackGame.getPlayerHands();
            if (handIndex !== undefined) {
                if (handIndex < 0 || handIndex >= playerHands.length) {
                    console.error(`Invalid player handIndex: ${handIndex}.`); return;
                }
                playerHands[handIndex].cards = [];
                playerHands[handIndex].result = GameResult.InProgress;
                playerHands[handIndex].isResolved = false;
                // Note: Clearing a single hand might break game logic if not careful.
                console.log(`Cleared player's hand ${handIndex}`);
            } else { // Clear all player hands
                this.blackjackGame.setPlayerHands([]);
                this.blackjackGame.setActivePlayerHandIndex(0);
                console.log(`Cleared all player hands.`);
            }
        } else { // Dealer
            this.blackjackGame.setDealerHand([]);
            console.log(`Cleared dealer's hand`);
        }
        this.cardVisualizer.renderCards();
        this.updateUI();
        this.updateDebugHandDisplay();
    }

    public flipCard(isPlayer: boolean, handIndex: number, cardIndexInHand: number): void {
        let hand: Card[];
        if (isPlayer) {
            const playerHands = this.blackjackGame.getPlayerHands();
            if (handIndex < 0 || handIndex >= playerHands.length) {
                console.error(`Invalid player handIndex: ${handIndex}.`); return;
            }
            hand = playerHands[handIndex].cards;
        } else { // Dealer
            // For dealer, handIndex is ignored, effectively 0
            hand = this.blackjackGame.getDealerHand();
        }

        if (cardIndexInHand < 0 || cardIndexInHand >= hand.length) {
            console.error(`Invalid card index: ${cardIndexInHand}. Hand has ${hand.length} cards.`); return;
        }
        hand[cardIndexInHand].flip(); // This will trigger CardVisualizer update via callback
        this.updateDebugHandDisplay();
        console.log(`Flipped ${isPlayer ? `player hand ${handIndex}` : 'dealer'}'s card at index ${cardIndexInHand}`);
    }


    public revealDealerHole(): void {
        const dealerHand = this.blackjackGame.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            // Use GameActions to reveal, as it handles animation and state
            this.blackjackGame.getGameActions().requestRevealDealerHoleCard(() => {
                console.log("DEBUG: Dealer hole card revealed via GameActions.");
                this.updateDebugHandDisplay();
            });
        } else {
            console.log("DEBUG: Dealer hole card already revealed or no cards dealt.");
        }
    }

    public dealRandomCard(isPlayer: boolean, faceUp: boolean = true): Card {
        const suits = Object.values(Suit);
        const ranks = Object.values(Rank);
        const randomSuit = suits[Math.floor(Math.random() * suits.length)];
        const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
        const card = new Card(randomSuit, randomRank);
        card.setFaceUp(faceUp);
        return card; // Does not add to any hand
    }

    public renderCards(): void {
        this.cardVisualizer.renderCards();
        this.updateDebugHandDisplay();
        console.log("Cards re-rendered (Babylon visuals and debug display)");
    }

    public setFunds(amount?: number): void {
        let finalAmount: number;
        if (amount !== undefined) {
            if (amount < 0) {
                console.error("Funds cannot be negative");
                return;
            }
            this.blackjackGame.getPlayerFundsManager().setFunds(amount);
            this.updateUI();
            console.log(`Player funds set to ${amount}`);
            return;
        }

        this.showCustomPrompt(
            "Enter new player funds:",
            this.blackjackGame.getPlayerFunds().toString(),
            (value) => {
                if (value === null) {
                    console.log("Set funds cancelled.");
                    return;
                }
                finalAmount = parseInt(value, 10);
                if (isNaN(finalAmount) || finalAmount < 0) {
                    console.error("Invalid amount entered for funds. Must be a non-negative number.");
                    // Optionally, re-show prompt or show an error in the prompt itself
                    this.showCustomPrompt(
                        "Invalid amount. Enter new player funds:",
                        this.blackjackGame.getPlayerFunds().toString(),
                        // Re-pass the same logic or a refined one
                        (reValue) => {
                            if (reValue === null) { console.log("Set funds cancelled."); return; }
                            const reFinalAmount = parseInt(reValue, 10);
                            if (isNaN(reFinalAmount) || reFinalAmount < 0) { console.error("Invalid amount again."); return; }
                            this.blackjackGame.getPlayerFundsManager().setFunds(reFinalAmount);
                            this.updateUI();
                            console.log(`Player funds set to ${reFinalAmount}`);
                        }
                    );
                    return;
                }
                this.blackjackGame.getPlayerFundsManager().setFunds(finalAmount);
                this.updateUI();
                console.log(`Player funds set to ${finalAmount}`);
            }
        );
    }

    public resetFunds(): void {
        this.blackjackGame.resetFunds();
        this.updateUI();
        console.log(`Player funds reset to ${this.blackjackGame.getPlayerFunds()}.`);
    }

    public setBet(amount: number, handIndex?: number): void {
        if (amount < 0) {
            console.error("Bet cannot be negative"); return;
        }
        if (this.blackjackGame.getGameState() === GameState.Betting || this.blackjackGame.getGameState() === GameState.Initial) {
            this.blackjackGame.setCurrentBet(amount); // Sets initial bet for GameActions
            console.log(`Initial bet for round set to ${amount}`);
        } else if (handIndex !== undefined) {
            const playerHands = this.blackjackGame.getPlayerHands();
            if (handIndex >= 0 && handIndex < playerHands.length) {
                playerHands[handIndex].bet = amount;
                console.log(`Bet for Player Hand ${handIndex} set to ${amount}`);
            } else {
                console.error(`Invalid handIndex ${handIndex} for setBet.`); return;
            }
        } else { // Set for active hand if in PlayerTurn
            const activeHand = this.blackjackGame.getActivePlayerHandInfo();
            if (activeHand && this.blackjackGame.getGameState() === GameState.PlayerTurn) {
                activeHand.bet = amount;
                console.log(`Bet for active Player Hand ${this.blackjackGame.getActivePlayerHandIndex()} set to ${amount}`);
            } else {
                console.warn("Cannot set bet now. Game not in Betting or PlayerTurn, or no active hand.");
            }
        }
        this.updateUI();
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
            this.closeOpenSubMenuAndCleanup(true); // Close any open submenus when main menu is hidden
        }
        // Save debug menu visibility state
        localStorage.setItem(DebugManager.DEBUG_MENU_VISIBLE_KEY, JSON.stringify(this.isDebugMenuVisible));
    }


    private recordHandHistory(): void {
        const playerHandsInfo = this.blackjackGame.getPlayerHands();
        const dealerHandCards = this.blackjackGame.getDealerHand();

        if (playerHandsInfo.length > 0 || dealerHandCards.length > 0) {
            // Deep clone player hands for history
            const clonedPlayerHands = playerHandsInfo.map(hand => ({
                ...hand,
                cards: [...hand.cards] // Shallow clone cards within hand
            }));
            this.handHistory.unshift({
                playerHands: clonedPlayerHands,
                dealer: [...dealerHandCards] // Shallow clone dealer cards
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
                    width: 100%; /* Ensure all buttons have the same width */
                    box-sizing: border-box; /* Include padding in width calculation */
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
                .debug-menu-button-group {
                    position: relative; /* For submenu positioning */
                }
                .debug-submenu {
                    display: none; /* Hidden by default */
                    position: fixed; /* Use fixed to pop out of container */
                    background-color: #f9f9f9;
                    min-width: 200px;
                    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
                    z-index: 1005; /* Ensure it's above other debug elements */
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    padding: 5px 0;
                    /* left, top, right will be set dynamically */
                }
                .debug-submenu-button {
                    color: black;
                    padding: 8px 12px;
                    text-decoration: none;
                    display: block;
                    text-align: left;
                    background-color: transparent;
                    border: none;
                    width: 100%;
                    font-size: 13px;
                    cursor: pointer;
                }
                .debug-submenu-button:hover {
                    background-color: #e0e0e0;
                }
                .debug-prompt-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.5);
                    z-index: 1010; /* Above submenus */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .debug-prompt-dialog {
                    position: absolute; /* Added for positioning */
                    left: 50%; /* Added for centering */
                    top: 50%; /* Added for centering */
                    transform: translate(-50%, -50%); /* Added for centering */
                    background-color: #fff;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    min-width: 300px;
                    max-width: 90%;
                    z-index: 1011;
                    cursor: move; /* Added for draggable */
                }
                .debug-prompt-dialog p {
                    margin-top: 0;
                    margin-bottom: 15px;
                    font-size: 16px;
                    color: #333;
                }
                .debug-prompt-dialog input[type="number"] {
                    width: calc(100% - 22px); /* Account for padding/border */
                    padding: 10px;
                    margin-bottom: 20px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 16px;
                }
                .debug-prompt-buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .debug-prompt-buttons button {
                    padding: 10px 15px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                }
                .debug-prompt-confirm {
                    background-color: #4CAF50;
                    color: white;
                }
                .debug-prompt-confirm:hover {
                    background-color: #45a049;
                }
                .debug-prompt-cancel {
                    background-color: #f44336;
                    color: white;
                }
                .debug-prompt-cancel:hover {
                    background-color: #d32f2f;
                }
                .debug-player-hand-section { /* Style for each player hand block */
                    border: 1px solid #777;
                    padding: 5px;
                    margin-bottom: 10px;
                    border-radius: 4px;
                    background-color: rgba(230,230,250,0.5); /* Light lavender */
                }
                .debug-player-hand-section.active-hand {
                     border-color: limegreen;
                     box-shadow: 0 0 5px limegreen;
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

            // If dragging the main debug menu, close any open submenu
            if (element === this.debugMenuElement && this.openSubMenu) {
                this.closeOpenSubMenuAndCleanup(true);
            }

            this.isDragging = true;
            this.draggedElement = element;

            const computedStyle = getComputedStyle(element);
            let finalEffectiveLeft = element.offsetLeft;
            let finalEffectiveTop = element.offsetTop;

            // If element was centered using transform, convert to explicit L/T for dragging
            if (computedStyle.transform !== 'none' && computedStyle.transform !== '') {
                const rect = element.getBoundingClientRect();
                // Assuming the element's offset parent is effectively the viewport origin
                // (e.g., child of a full-screen fixed overlay like .debug-prompt-overlay)
                // or the element itself is fixed.
                // For the dialog, its parent overlay is fixed at (0,0), so rect.left/top are correct.
                element.style.left = `${rect.left}px`;
                element.style.top = `${rect.top}px`;
                element.style.transform = 'none'; // Remove transform, subsequent drags won't re-enter

                finalEffectiveLeft = rect.left;
                finalEffectiveTop = rect.top;
            }

            // Ensure the element is positioned (not static) so style.left/top will work.
            if (computedStyle.position === 'static') {
                // Draggable elements are typically 'absolute', 'relative', or 'fixed'.
                // Setting to 'relative' is a fallback if it was 'static'.
                // The .debug-prompt-dialog is set to 'absolute' via CSS, so this won't apply to it.
                element.style.position = 'relative';
            }

            this.dragOffsetX = e.clientX - finalEffectiveLeft;
            this.dragOffsetY = e.clientY - finalEffectiveTop;

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
        this.createDropdownButton('Start Scenario ▸', [
            { text: 'Start Hand (Normal)', action: () => this.debugStartNormalHand(), accessKey: 'N' },
            { text: 'Start Split Hand Pair', action: () => this.debugStartSplitHand(), accessKey: 'S' },
            { text: 'Start Insurance Hand', action: () => this.debugStartInsuranceHand(), accessKey: 'I' }
        ], content, true); // true for openLeft

        createSeparator();

        // --- Game Control ---
        createButton('Toggle Card Debug Window', () => this.toggleHandDisplay());
        createButton('Reveal Dealer Hole Card', () => this.revealDealerHole());
        createButton('Force Reshuffle Deck', () => this.forceReshuffle());
        createButton('Reset Game', () => {
            this.resetGame();
            // Note: Debug menu visibility persists due to localStorage
        });

        createSeparator();

        // --- Funds Control ---
        this.createDropdownButton('Manage Funds ▸', [
            { text: 'Set Player Funds...', action: () => this.setFunds(), accessKey: 'F' },
            { text: 'Reset Player Bank', action: () => this.resetFunds(), accessKey: 'R' }
        ], content, true); // true for openLeft

        createSeparator();

        // --- Outcome Control ---
        this.createDropdownButton('Force Outcome ▸', [
            { text: 'Force Player Win (Active Hand)', action: () => this.forceWin(true), accessKey: 'P' },
            { text: 'Force Dealer Win (Active Hand)', action: () => this.forceWin(false), accessKey: 'D' },
            { text: 'Force Push (Active Hand)', action: () => this.forcePush(), accessKey: 'U' }
        ], content, true); // true for openLeft


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

    // *** ADDED METHOD ***
    private renderHandInContainer(
        title: string,
        currentHand: Card[],
        lastHand: Card[],
        isHistoryView: boolean,
        parentElement: HTMLElement
    ): void {
        const section = document.createElement('div');
        // No special class for dealer hand section

        const headerEl = document.createElement('h4');
        let headerText = title;
        if (currentHand) {
            const score = ScoreCalculator.calculateHandValue(currentHand);
            headerText += ` (Score: ${score})`;
        }
        headerEl.textContent = headerText;
        headerEl.style.margin = '10px 0 5px 0';
        headerEl.style.borderBottom = '1px solid #999';
        headerEl.style.paddingBottom = '3px';
        section.appendChild(headerEl);

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '5px';
        section.appendChild(container);
        parentElement.appendChild(section);

        const currentCardIds = new Set(currentHand.map(c => c.getUniqueId()));
        const lastCardIds = new Set(lastHand.map(c => c.getUniqueId()));

        if (!isHistoryView) {
            [...lastHand].reverse().forEach(card => {
                if (!currentCardIds.has(card.getUniqueId())) {
                    const discardedEl = this.createCardElement(card, false);
                    discardedEl.classList.add('card-discarded');
                    container.appendChild(discardedEl);
                    setTimeout(() => discardedEl.remove(), 500);
                }
            });
        }

        [...currentHand].reverse().forEach(card => {
            const isNew = !isHistoryView && !lastCardIds.has(card.getUniqueId());
            container.appendChild(this.createCardElement(card, isNew));
        });

        if (currentHand.length === 0 && (isHistoryView || lastHand.length === 0)) {
            container.textContent = 'No cards';
        }
    }

    private renderPlayerHandInContainer(
        playerHandInfo: PlayerHandInfo,
        lastPlayerHandInfo: PlayerHandInfo | undefined,
        isHistoryView: boolean,
        parentElement: HTMLElement,
        handIndex: number
    ): void {
        const section = document.createElement('div');
        section.className = 'debug-player-hand-section';
        if (!isHistoryView && handIndex === this.blackjackGame.getActivePlayerHandIndex()) {
            section.classList.add('active-hand');
        }

        const headerEl = document.createElement('h4');
        let title = `Player Hand ${handIndex}`;
        if (playerHandInfo) {
            const score = ScoreCalculator.calculateHandValue(playerHandInfo.cards);
            title += ` (Bet: ${playerHandInfo.bet}, Score: ${score}, Result: ${GameResult[playerHandInfo.result]}, Resolved: ${playerHandInfo.isResolved})`;
        }
        headerEl.textContent = title;
        headerEl.style.margin = '10px 0 5px 0';
        headerEl.style.borderBottom = '1px solid #999';
        headerEl.style.paddingBottom = '3px';
        section.appendChild(headerEl);

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '5px';
        section.appendChild(container);
        parentElement.appendChild(section);

        const currentCards = playerHandInfo.cards;
        const lastCards = lastPlayerHandInfo ? lastPlayerHandInfo.cards : [];
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
        let playerHands: PlayerHandInfo[];
        let dealerHand: Card[];
        let titleText: string;

        if (isHistoryView) {
            const historicalState = this.handHistory[this.historyIndex];
            playerHands = historicalState.playerHands;
            dealerHand = historicalState.dealer;
            titleText = `History (${this.historyIndex + 1}/${this.handHistory.length})`;
        } else {
            playerHands = this.blackjackGame.getPlayerHands();
            dealerHand = this.blackjackGame.getDealerHand();
            titleText = "Current Hands";
        }

        this.debugHandDisplayElement.innerHTML = ''; // Clear previous content

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
        if (this.historyIndex > -1) { // Next button (older history)
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next →';
            nextButton.disabled = this.historyIndex === 0;
            nextButton.onclick = () => { if (this.historyIndex > 0) this.historyIndex--; this.updateDebugHandDisplay(); };
            navContainer.appendChild(nextButton);
        }
        if (this.historyIndex < this.handHistory.length - 1) { // Prev button (newer history)
            const prevButton = document.createElement('button');
            prevButton.textContent = '← Prev';
            prevButton.disabled = this.historyIndex === this.handHistory.length - 1 && this.historyIndex !== -1;
            prevButton.onclick = () => { if (this.historyIndex < this.handHistory.length - 1) this.historyIndex++; this.updateDebugHandDisplay(); };
            navContainer.appendChild(prevButton);
        }
        if (this.handHistory.length > 0 && this.historyIndex === -1) { // Prev button from current to newest history
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

        // Render Dealer Hand
        const dealerSection = document.createElement('div');
        this.renderHandInContainer('Dealer', dealerHand, this.lastDealerHand, isHistoryView, dealerSection);
        this.debugHandDisplayElement.appendChild(dealerSection);


        // Render Player Hands
        playerHands.forEach((pHandInfo, index) => {
            const lastPHandInfo = !isHistoryView ? this.lastPlayerHands.find(h => h.id === pHandInfo.id) : undefined;
            this.renderPlayerHandInContainer(pHandInfo, lastPHandInfo, isHistoryView, this.debugHandDisplayElement!, index);
        });


        if (!isHistoryView) {
            // Deep clone for last state
            this.lastPlayerHands = playerHands.map(h => ({ ...h, cards: [...h.cards] }));
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
        console.log("DEBUG: Starting Split Hand Scenario");
        this.resetGame();

        const initialBet = Constants.MIN_BET;
        this.blackjackGame.setCurrentBet(initialBet); // Set initial bet for GameActions

        // Simulate placing the first bet
        if (!this.blackjackGame.getPlayerFundsManager().deductFunds(initialBet)) {
            console.error("DEBUG Split: Could not deduct initial bet. Player funds:", this.blackjackGame.getPlayerFunds());
            return;
        }

        this.blackjackGame.getGameActions().setGameState(GameState.Dealing, true, true);

        const suits = Object.values(Suit);
        // Find a rank that is not Ace for simpler split testing first
        let splitRank = Rank.Seven; // Example: Pair of 7s
        const ranks = Object.values(Rank);
        let randomRankIndex = Math.floor(Math.random() * ranks.length);
        if (ranks[randomRankIndex] === Rank.Ace) { // Avoid Ace for initial split test if possible
            randomRankIndex = (randomRankIndex + 1) % ranks.length;
        }
        splitRank = ranks[randomRankIndex];


        const playerCard1 = new Card(suits[0 % suits.length], splitRank); playerCard1.setFaceUp(true);
        const playerCard2 = new Card(suits[1 % suits.length], splitRank); playerCard2.setFaceUp(true);

        const initialPlayerHand: PlayerHandInfo = {
            id: 'hand-0', cards: [playerCard1, playerCard2], bet: initialBet,
            result: GameResult.InProgress, isResolved: false, canHit: true, isBlackjack: false, isSplitAces: false
        };
        this.blackjackGame.setPlayerHands([initialPlayerHand]);
        this.blackjackGame.setActivePlayerHandIndex(0);

        this.blackjackGame.getHandManager().registerFlipCallback(playerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard2);

        const dealerCard1 = this.dealRandomCard(false, false); dealerCard1.setFaceUp(false);
        const dealerCard2 = this.dealRandomCard(false, true);  dealerCard2.setFaceUp(true);
        this.blackjackGame.setDealerHand([dealerCard1, dealerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard2);

        this.cardVisualizer.renderCards(true); // Render initial state
        this.blackjackGame.getGameActions().setGameState(GameState.PlayerTurn, true, true); // Move to player turn
        this.updateUI();
        console.log("DEBUG: Split hand scenario set up. Player has a pair. Try splitting.");
    }

    private debugStartInsuranceHand(): void {
        console.log("DEBUG: Starting Insurance Hand");
        this.resetGame();
        const initialBet = Constants.MIN_BET;
        this.blackjackGame.setCurrentBet(initialBet);

        if (!this.blackjackGame.getPlayerFundsManager().deductFunds(initialBet)) {
            console.error("DEBUG Insurance: Could not deduct bet. Player funds:", this.blackjackGame.getPlayerFunds());
            return;
        }
        this.blackjackGame.getGameActions().setGameState(GameState.Dealing, true, true);

        const playerCard1 = this.dealRandomCard(true, true); playerCard1.setFaceUp(true);
        const playerCard2 = this.dealRandomCard(true, true); playerCard2.setFaceUp(true);

        const initialPlayerHand: PlayerHandInfo = {
            id: 'hand-0', cards: [playerCard1, playerCard2], bet: initialBet,
            result: GameResult.InProgress, isResolved: false, canHit: true, isBlackjack: false, isSplitAces: false
        };
        this.blackjackGame.setPlayerHands([initialPlayerHand]);
        this.blackjackGame.setActivePlayerHandIndex(0);

        this.blackjackGame.getHandManager().registerFlipCallback(playerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(playerCard2);

        const dealerCard1 = this.dealRandomCard(false, false); dealerCard1.setFaceUp(false); // Hole card
        const dealerCard2 = new Card(Suit.Spades, Rank.Ace); // Upcard is Ace
        dealerCard2.setFaceUp(true);
        this.blackjackGame.setDealerHand([dealerCard1, dealerCard2]);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard1);
        this.blackjackGame.getHandManager().registerFlipCallback(dealerCard2);

        this.cardVisualizer.renderCards(true);
        this.blackjackGame.getGameActions().setGameState(GameState.PlayerTurn, true, true);
        this.updateUI();
        console.log("DEBUG: Insurance hand scenario set up. Dealer's upcard is Ace.");
    }

    public forceReshuffle(): void {
        console.log("DEBUG: Forcing deck reshuffle.");
        const cardsRemaining = this.blackjackGame.getHandManager().forceDeckReshuffle();
        console.log(`Deck reshuffled. Cards remaining: ${cardsRemaining}`);
        this.updateUI();
    }

    private ensureBetActiveForForceOutcome(handIndex?: number): PlayerHandInfo | null {
        const game = this.blackjackGame;
        const targetHandIdx = handIndex ?? game.getActivePlayerHandIndex();
        const playerHands = game.getPlayerHands();

        if (targetHandIdx < 0 || targetHandIdx >= playerHands.length) {
            // If no hands, try to set up a basic one for the outcome
            if (playerHands.length === 0) {
                if (game.getPlayerFunds() >= Constants.MIN_BET) {
                    game.setCurrentBet(Constants.MIN_BET); // Sets initial bet for GameActions
                    const newHand: PlayerHandInfo = {
                        id: 'hand-0-debug', cards: [], bet: Constants.MIN_BET,
                        result: GameResult.InProgress, isResolved: false, canHit: true, isBlackjack: false, isSplitAces: false
                    };
                    game.setPlayerHands([newHand]);
                    game.setActivePlayerHandIndex(0);
                    game.getPlayerFundsManager().deductFunds(Constants.MIN_BET);
                    console.log(`DEBUG: Auto-created hand 0 and placed MIN_BET (${Constants.MIN_BET}) for forced outcome.`);
                    return newHand;
                } else {
                    console.warn("DEBUG: Cannot auto-place bet/create hand for forced outcome, insufficient funds.");
                    return null;
                }
            } else {
                console.error(`DEBUG: Invalid handIndex ${targetHandIdx} for forced outcome.`);
                return null;
            }
        }

        const targetHand = playerHands[targetHandIdx];
        if (targetHand.bet === 0) {
            if (game.getPlayerFunds() >= Constants.MIN_BET) {
                targetHand.bet = Constants.MIN_BET;
                game.getPlayerFundsManager().deductFunds(Constants.MIN_BET);
                console.log(`DEBUG: Auto-placed MIN_BET (${Constants.MIN_BET}) on Hand ${targetHandIdx} for forced outcome.`);
            } else {
                console.warn(`DEBUG: Cannot auto-place bet on Hand ${targetHandIdx} for forced outcome, insufficient funds. Outcome may not have monetary effect.`);
            }
        }

        if (game.getGameState() !== GameState.PlayerTurn && game.getGameState() !== GameState.DealerTurn && game.getGameState() !== GameState.Dealing) {
            game.getGameActions().setGameState(GameState.PlayerTurn, true, false);
        }
        return targetHand;
    }


    public forceWin(playerWins: boolean, handIndex?: number): void {
        const targetHand = this.ensureBetActiveForForceOutcome(handIndex);
        if (!targetHand) {
            console.error("DEBUG: Could not ensure active bet for forceWin."); return;
        }
        const targetHandIdx = this.blackjackGame.getPlayerHands().findIndex(h => h.id === targetHand.id);
        console.log(`DEBUG: Forcing ${playerWins ? 'Player Win' : 'Dealer Win'} for Hand ${targetHandIdx}`);

        const game = this.blackjackGame;
        const gameActions = game.getGameActions();

        const dealerHand = game.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            // Don't use requestRevealDealerHoleCard as it has callbacks that might interfere
            dealerHand[0].setFaceUp(true);
            this.cardVisualizer.updateCardVisual(dealerHand[0], true); // Force immediate visual update
        }

        if (playerWins) {
            targetHand.result = GameResult.PlayerWins;
            game.getPlayerFundsManager().addFunds(targetHand.bet * 2);
        } else {
            targetHand.result = GameResult.DealerWins;
            // Player loses bet, already deducted or handled by ensureBetActive
        }
        targetHand.isResolved = true;

        // Check if all hands are resolved to end game
        if (game.getPlayerHands().every(h => h.isResolved)) {
            gameActions.resolveInsurance(); // Resolve insurance if all hands done
            gameActions.setGameState(GameState.GameOver, true, true);
        } else {
            this.updateUI(); // Update UI if game not over
        }
    }

    public forcePush(handIndex?: number): void {
        const targetHand = this.ensureBetActiveForForceOutcome(handIndex);
        if (!targetHand) {
            console.error("DEBUG: Could not ensure active bet for forcePush."); return;
        }
        const targetHandIdx = this.blackjackGame.getPlayerHands().findIndex(h => h.id === targetHand.id);
        console.log(`DEBUG: Forcing Push for Hand ${targetHandIdx}`);

        const game = this.blackjackGame;
        const gameActions = game.getGameActions();

        const dealerHand = game.getDealerHand();
        if (dealerHand.length > 0 && !dealerHand[0].isFaceUp()) {
            dealerHand[0].setFaceUp(true);
            this.cardVisualizer.updateCardVisual(dealerHand[0], true);
        }

        targetHand.result = GameResult.Push;
        game.getPlayerFundsManager().addFunds(targetHand.bet); // Return bet
        targetHand.isResolved = true;

        if (game.getPlayerHands().every(h => h.isResolved)) {
            gameActions.resolveInsurance();
            gameActions.setGameState(GameState.GameOver, true, true);
        } else {
            this.updateUI();
        }
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
        if (this.activeCustomPromptElement) {
            this.closeCustomPrompt(true); // Pass true to indicate cancellation
        }
        // Ensure any open submenu is removed from the body and listener is cleaned up
        this.closeOpenSubMenuAndCleanup(true);

        const styleSheet = document.getElementById('blackjack-debug-styles');
        if (styleSheet) {
            styleSheet.remove();
        }
        document.removeEventListener('click', this.handleGlobalClick, true);
        if ((window as any).debug === this) {
            (window as any).debug = undefined;
        }
    }

    // --- Sub-menu helper and global click handler ---
    private handleGlobalClick = (event: MouseEvent): void => {
        // If a custom prompt is active, don't close submenus.
        // The prompt overlay should handle its own dismissal or prevent clicks from passing.
        if (this.activeCustomPromptElement) {
            // Check if the click was on the overlay itself to close the prompt
            if (event.target === this.activeCustomPromptElement) { // activeCustomPromptElement is the overlay
                this.closeCustomPrompt(true); // true for cancel
            }
            return;
        }

        if (this.openSubMenu) {
            const target = event.target as HTMLElement;

            // Do not close if the click is on the button that triggered the current submenu
            if (this.activeSubMenuTrigger && this.activeSubMenuTrigger.contains(target)) {
                return;
            }
            // Do not close if the click is inside the currently open submenu
            if (this.openSubMenu.contains(target)) {
                return;
            }

            // Click is outside, close the submenu
            this.closeOpenSubMenuAndCleanup(true);
        }
    };

    private formatTextWithAccessKey(text: string, accessKey?: string): string {
        if (!accessKey || accessKey.length !== 1) {
            return text;
        }
        const keyIndex = text.toLowerCase().indexOf(accessKey.toLowerCase());
        if (keyIndex === -1) {
            return text;
        }
        return `${text.substring(0, keyIndex)}<u>${text.substring(keyIndex, keyIndex + 1)}</u>${text.substring(keyIndex + 1)}`;
    }


    private closeOpenSubMenuAndCleanup(removeFromDom: boolean): void {
        this.clearHoverTimers(); // Clear any pending hover actions
        if (this.openSubMenu) {
            document.removeEventListener('keydown', this.boundHandleSubMenuAccessKeys);
            if (removeFromDom && this.openSubMenu.parentNode === document.body) {
                document.body.removeChild(this.openSubMenu);
            }
            // Ensure style.display is 'none' even if not removed from DOM,
            // as it might be reused if its parent button is clicked again.
            this.openSubMenu.style.display = 'none';
            this.openSubMenu = null;
            this.activeSubMenuTrigger = null;
        }
    }

    private handleSubMenuAccessKeys(event: KeyboardEvent): void {
        if (!this.openSubMenu) { // Should not happen if listener is correctly managed, but good check
            return;
        }

        this.clearHoverTimers(); // User is interacting, clear hover timers

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            const triggerToFocus = this.activeSubMenuTrigger;
            this.closeOpenSubMenuAndCleanup(true);
            triggerToFocus?.focus();
            return;
        }

        if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();

            const focusableItems = Array.from(this.openSubMenu.querySelectorAll('.debug-submenu-button')) as HTMLElement[];
            if (focusableItems.length === 0) return;

            let currentIndex = focusableItems.indexOf(document.activeElement as HTMLElement);

            if (event.shiftKey) {
                currentIndex = (currentIndex - 1 + focusableItems.length) % focusableItems.length;
            } else {
                currentIndex = (currentIndex + 1) % focusableItems.length;
            }
            focusableItems[currentIndex]?.focus();
            return;
        }


        if (event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        const pressedKey = event.key.toLowerCase();
        for (const child of Array.from(this.openSubMenu.children)) {
            const button = child as HTMLElement;
            if (button.dataset.accessKey === pressedKey) {
                event.preventDefault();
                event.stopPropagation();
                button.click(); // This will trigger the action and close the submenu
                return;
            }
        }
    }

    private clearHoverTimers(): void {
        if (this.hoverOpenTimer) {
            clearTimeout(this.hoverOpenTimer);
            this.hoverOpenTimer = null;
        }
        if (this.hoverCloseTimer) {
            clearTimeout(this.hoverCloseTimer);
            this.hoverCloseTimer = null;
        }
    }

    private openSubMenuLogic(subMenu: HTMLElement, triggerButton: HTMLElement, openLeft: boolean): void {
        this.clearHoverTimers();

        // If the requested submenu is already open, do nothing.
        if (this.openSubMenu === subMenu && subMenu.style.display === 'block') {
            return;
        }

        // Close any other currently open submenu
        if (this.openSubMenu && this.openSubMenu !== subMenu) {
            this.closeOpenSubMenuAndCleanup(true);
        }

        if (subMenu.parentNode !== document.body) {
            document.body.appendChild(subMenu); // Append to body to avoid clipping and for fixed positioning
        }

        subMenu.style.visibility = 'hidden'; // Hide for measurement
        subMenu.style.display = 'block';

        const rect = triggerButton.getBoundingClientRect();
        const subMenuWidth = subMenu.offsetWidth;
        const subMenuHeight = subMenu.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top, left, right;

        // Vertical positioning: Try below, then above
        if (rect.bottom + subMenuHeight <= viewportHeight) {
            top = rect.bottom;
        } else if (rect.top - subMenuHeight >= 0) {
            top = rect.top - subMenuHeight;
        } else {
            // Not enough space above or below, position at top or bottom of viewport
            top = Math.max(0, viewportHeight - subMenuHeight);
        }
        subMenu.style.top = `${top}px`;

        // Horizontal positioning
        if (openLeft) {
            // Try to open to the left of the trigger
            if (rect.left - subMenuWidth >= 0) {
                left = rect.left - subMenuWidth;
                subMenu.style.left = `${left}px`;
                subMenu.style.right = 'auto';
            } else { // Not enough space to the left, try to open to the right
                left = rect.right;
                if (left + subMenuWidth <= viewportWidth) {
                    subMenu.style.left = `${left}px`;
                    subMenu.style.right = 'auto';
                } else { // Still not enough space, align to right edge of viewport
                    subMenu.style.right = `0px`;
                    subMenu.style.left = 'auto';
                }
            }
        } else { // Open right (default)
            // Try to open to the right of the trigger
            if (rect.right + subMenuWidth <= viewportWidth) {
                left = rect.right;
                subMenu.style.left = `${left}px`;
                subMenu.style.right = 'auto';
            } else { // Not enough space to the right, try to open to the left
                left = rect.left - subMenuWidth;
                if (left >= 0) {
                    subMenu.style.left = `${left}px`;
                    subMenu.style.right = 'auto';
                } else { // Still not enough space, align to left edge of viewport
                    subMenu.style.left = `0px`;
                    subMenu.style.right = 'auto';
                }
            }
        }
        
        subMenu.style.position = 'fixed'; // Ensure it's fixed for viewport-relative positioning
        subMenu.style.visibility = 'visible'; // Show after positioning

        this.openSubMenu = subMenu;
        this.activeSubMenuTrigger = triggerButton;
        document.addEventListener('keydown', this.boundHandleSubMenuAccessKeys);

        // If the trigger button is the currently focused element, it implies keyboard activation.
        // In this case, move focus to the first item in the submenu.
        if (document.activeElement === triggerButton) {
            const firstItem = subMenu.querySelector('.debug-submenu-button') as HTMLElement;
            firstItem?.focus();
        }
    }


    private createDropdownButton(
        mainButtonText: string,
        items: { text: string, action: () => void, accessKey?: string }[],
        parentContainer: HTMLElement,
        openLeft: boolean = false
    ): void {
        const group = document.createElement('div');
        group.className = 'debug-menu-button-group';

        const mainButton = document.createElement('button');
        mainButton.className = 'debug-menu-button';
        mainButton.textContent = mainButtonText;

        const subMenu = document.createElement('div');
        subMenu.className = 'debug-submenu';
        // subMenu.style.top and left/right will be set on show by openSubMenuLogic

        items.forEach(item => {
            const subButton = document.createElement('button');
            subButton.className = 'debug-submenu-button';
            subButton.innerHTML = this.formatTextWithAccessKey(item.text, item.accessKey);
            if (item.accessKey) {
                subButton.dataset.accessKey = item.accessKey.toLowerCase();
            }

            subButton.onclick = (e) => {
                e.stopPropagation(); // Prevent global click handler from closing immediately
                this.clearHoverTimers();
                item.action();
                this.closeOpenSubMenuAndCleanup(true); // Action performed, close menu
            };
            subMenu.appendChild(subButton);
        });

        mainButton.onclick = (e) => {
            e.stopPropagation(); // Prevent global click handler
            this.clearHoverTimers();

            if (this.openSubMenu === subMenu) {
                this.closeOpenSubMenuAndCleanup(true);
            } else {
                this.openSubMenuLogic(subMenu, mainButton, openLeft);
            }
        };

        mainButton.onmouseenter = () => {
            this.clearHoverTimers();
            this.hoverOpenTimer = window.setTimeout(() => {
                this.openSubMenuLogic(subMenu, mainButton, openLeft);
            }, this.HOVER_OPEN_DELAY);
        };

        mainButton.onmouseleave = () => {
            this.clearHoverTimers();
            this.hoverCloseTimer = window.setTimeout(() => {
                // Only close if the mouse hasn't entered the submenu itself
                if (this.openSubMenu === subMenu && !subMenu.matches(':hover')) {
                    this.closeOpenSubMenuAndCleanup(true);
                }
            }, this.HOVER_CLOSE_DELAY);
        };

        subMenu.onmouseenter = () => {
            this.clearHoverTimers(); // Mouse is over the submenu, cancel any pending close
        };

        subMenu.onmouseleave = () => {
            this.clearHoverTimers();
            this.hoverCloseTimer = window.setTimeout(() => {
                 if (this.openSubMenu === subMenu) {
                    this.closeOpenSubMenuAndCleanup(true);
                }
            }, this.HOVER_CLOSE_DELAY);
        };


        group.appendChild(mainButton);
        // subMenu is appended to document.body by openSubMenuLogic when needed
        parentContainer.appendChild(group);
    }

    // --- Custom Prompt Methods ---
    private showCustomPrompt(
        message: string,
        defaultValue: string,
        onConfirm: (value: string | null) => void
    ): void {
        if (this.activeCustomPromptElement) {
            // Close existing prompt first if any
            this.closeCustomPrompt(true);
        }

        this.customPromptConfirmCallback = onConfirm;

        const overlay = document.createElement('div');
        overlay.className = 'debug-prompt-overlay';
        overlay.onclick = () => this.closeCustomPrompt(true); // Close when clicking outside
        this.activeCustomPromptElement = overlay; // The overlay is the main tracked element

        const dialog = document.createElement('div');
        dialog.className = 'debug-prompt-dialog';
        dialog.onclick = (e) => e.stopPropagation(); // Prevent overlay click when clicking dialog

        // Add dialog header with title and close button
        const headerDiv = document.createElement('div');
        headerDiv.className = 'debug-header';
        headerDiv.style.marginTop = '0';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'debug-header-title';
        titleSpan.textContent = 'Set Player Funds';

        const closeButton = document.createElement('button');
        closeButton.className = 'debug-close-button';
        closeButton.innerHTML = '&#x2715;';
        closeButton.title = 'Cancel';
        closeButton.onclick = (e) => {
            e.stopPropagation();
            this.closeCustomPrompt(true);
        };

        headerDiv.appendChild(titleSpan);
        headerDiv.appendChild(closeButton);
        dialog.appendChild(headerDiv);

        const p = document.createElement('p');
        p.textContent = message;

        const input = document.createElement('input');
       
        input.type = 'number';
        input.value = defaultValue;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.closeCustomPrompt(false, input.value);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.closeCustomPrompt(true);
            }
        };

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'debug-prompt-buttons';

        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Confirm';
        confirmButton.className = 'debug-prompt-confirm';
        confirmButton.onclick = () => this.closeCustomPrompt(false, input.value);

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'debug-prompt-cancel';
        cancelButton.onclick = () => this.closeCustomPrompt(true);

        buttonsDiv.appendChild(cancelButton);
        buttonsDiv.appendChild(confirmButton);

        dialog.appendChild(p);
        dialog.appendChild(input);
        dialog.appendChild(buttonsDiv);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Make the dialog draggable
        this.makeDraggable(dialog);

        input.focus();
        input.select();

        // Add Escape key listener to the document
        this.customPromptEscapeListener = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                this.closeCustomPrompt(true);
            }
        };
        document.addEventListener('keydown', this.customPromptEscapeListener);
    }

    private closeCustomPrompt(isCancel: boolean, value?: string): void {
        if (this.activeCustomPromptElement) {
            // Remove the overlay click event to prevent memory leaks
            if (this.activeCustomPromptElement.onclick) {
                (this.activeCustomPromptElement as HTMLElement).onclick = null;
            }

            // Find and clean up the dialog element
            const dialogElement = this.activeCustomPromptElement.querySelector('.debug-prompt-dialog');
            if (dialogElement) {
                (dialogElement as HTMLElement).onclick = null;

                // Clean up header buttons if present
                const closeButton = dialogElement.querySelector('.debug-close-button');
                if (closeButton) {
                    (closeButton as HTMLElement).onclick = null;
                }

                // Clean up input event handlers
                const input = dialogElement.querySelector('input');
                if (input) {
                    (input as HTMLInputElement).onkeydown = null;
                }

                // Clean up button click handlers
                const buttons = dialogElement.querySelectorAll('button');
                buttons.forEach(button => {
                    (button as HTMLButtonElement).onclick = null;
                });
            }

            document.body.removeChild(this.activeCustomPromptElement);
            this.activeCustomPromptElement = null;
        }

        // Remove escape key listener
        if (this.customPromptEscapeListener) {
            document.removeEventListener('keydown', this.customPromptEscapeListener);
            this.customPromptEscapeListener = null;
        }

        // Call the callback with result
        if (this.customPromptConfirmCallback) {
            this.customPromptConfirmCallback(isCancel ? null : (value ?? ''));
            this.customPromptConfirmCallback = null;
        }
    }
}

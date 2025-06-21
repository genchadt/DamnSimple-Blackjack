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
import { CustomPromptDialog, DebugHandDisplayDialog, DebugMenuDialog } from "../ui/factories/DialogFactory";

export class DebugManager {
    private gameScene: GameScene;
    private blackjackGame: BlackjackGame;
    private cardVisualizer: CardVisualizer;
    private gameUI: GameUI;

    // --- New Dialog-based UI ---
    private handDisplay: DebugHandDisplayDialog;
    private debugMenu: DebugMenuDialog;
    private isHandDisplayVisible: boolean = false;
    private isDebugMenuVisible: boolean = false;

    // --- Key for localStorage ---
    private static readonly DEBUG_MENU_VISIBLE_KEY = "blackjack_debugMenuVisible";

    /**
     * Initializes a new instance of the DebugManager class.
     */
    constructor(gameScene: GameScene, cardVisualizer: CardVisualizer, blackjackGame: BlackjackGame) {
        this.gameScene = gameScene;
        this.blackjackGame = blackjackGame;
        this.cardVisualizer = cardVisualizer;
        this.gameUI = gameScene.getGameUI();

        // --- Initialize new UI components ---
        this.handDisplay = new DebugHandDisplayDialog(this.blackjackGame, () => this.toggleHandDisplay(false));
        this.debugMenu = new DebugMenuDialog(this);

        (window as any).debug = this;
        (window as any).game = this.blackjackGame;
        (window as any).scene = gameScene.getScene();
        (window as any).cardViz = this.cardVisualizer;
        (window as any).gameUI = this.gameUI;

        // Load debug menu visibility state
        const storedVisibility = localStorage.getItem(DebugManager.DEBUG_MENU_VISIBLE_KEY);
        if (storedVisibility !== null) {
            this.isDebugMenuVisible = JSON.parse(storedVisibility);
            if (this.isDebugMenuVisible) {
                setTimeout(() => this.debugMenu.show(), 0);
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

        this.handDisplay.resetHistory();

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

        CustomPromptDialog.show(
            "Enter new player funds:",
            this.blackjackGame.getPlayerFunds().toString(),
            (value) => {
                if (value === null) {
                    console.log("Set funds cancelled.");
                    return;
                }
                const finalAmount = parseInt(value, 10);
                if (isNaN(finalAmount) || finalAmount < 0) {
                    console.error("Invalid amount entered for funds. Must be a non-negative number.");
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

        this.handDisplay.toggle(this.isHandDisplayVisible);
        if (this.isHandDisplayVisible) {
            this.updateDebugHandDisplay();
            console.log("Debug hand display shown.");
        } else {
            console.log("Debug hand display hidden.");
        }
    }

    public toggleDebugMenu(visible?: boolean): void {
        if (typeof visible === 'undefined') {
            this.isDebugMenuVisible = !this.isDebugMenuVisible;
        } else {
            this.isDebugMenuVisible = visible;
        }
        
        this.debugMenu.toggle(this.isDebugMenuVisible);
        if (this.isDebugMenuVisible) {
            console.log("Debug menu shown.");
        } else {
            console.log("Debug menu hidden.");
        }
        localStorage.setItem(DebugManager.DEBUG_MENU_VISIBLE_KEY, JSON.stringify(this.isDebugMenuVisible));
    }


    private recordHandHistory(): void {
        this.handDisplay.recordHandHistory(
            this.blackjackGame.getPlayerHands(),
            this.blackjackGame.getDealerHand()
        );
        console.log(`[DebugManager] Hand history recorded.`);
    }

    public updateDebugHandDisplay(): void {
        if (this.isHandDisplayVisible) {
            this.handDisplay.update();
        }
    }

    // --- Debug Menu Button Actions ---

    public debugStartNormalHand(): void {
        console.log("DEBUG: Starting Normal Hand");
        this.resetGame();
        const success = this.blackjackGame.startNewGame(Constants.MIN_BET);
        if (!success) {
            console.error("DEBUG: Failed to start normal hand.");
        }
    }

    public debugStartSplitHand(): void {
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

    public debugStartInsuranceHand(): void {
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
        this.handDisplay?.dispose();
        this.debugMenu?.dispose();
        
        const styleSheet = document.getElementById('blackjack-dialog-styles');
        if (styleSheet) {
            styleSheet.remove();
        }
        
        if ((window as any).debug === this) {
            (window as any).debug = undefined;
        }
    }
}